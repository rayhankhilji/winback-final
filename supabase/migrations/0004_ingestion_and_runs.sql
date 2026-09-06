-- 0004_ingestion_and_runs.sql
--
-- Persistence for the ingestion pipeline: uploaded documents, their citable
-- blocks, and pipeline runs. Storage already holds the files themselves
-- (bucket `company-documents`, migration 0003) — these tables hold the
-- metadata, the traceability atoms, and the pipeline output.
--
-- Every table is RLS-anchored on `org_id` using the `is_org_member` /
-- `is_org_admin` helpers pinned in 0002. No new predicates.
--
-- Pipeline results are stored as `jsonb` and validated by the Zod schemas in
-- src/lib/contracts/schemas.ts on write and on read. They are always read
-- whole; normalising them into relational tables buys nothing.

-- 1. companies — two added columns -------------------------------------------

alter table companies
  add column if not exists sector text,
  add column if not exists latest_run_id uuid;

-- `sector` because concentration analysis needs it and onboarding collects only
-- a name today. `latest_run_id` so the portfolio list renders without a per-row
-- subquery. Deliberately not a foreign key to `runs`: the reference is circular
-- (a run points at its company) and a FK here would force an insert ordering
-- dance on every new run for no integrity gain.

-- 2. documents ---------------------------------------------------------------
--
-- One row per uploaded file. `id` doubles as `SourceDoc.id`, which is what
-- makes a citation globally unique now that SourceDocIdSchema is an open
-- string (migration of the contract landed in Stage 1).

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  title text,
  doc_kind text check (
    doc_kind in (
      'presentation', 'contract', 'financial_statement', 'cap_table',
      'report', 'spreadsheet', 'image', 'other'
    )
  ),
  date_label text,
  mime_type text not null,
  pages int not null default 0,
  page_noun text not null default 'page' check (page_noun in ('slide', 'page', 'row', 'grant')),
  status text not null default 'pending' check (status in ('pending', 'parsing', 'parsed', 'failed')),
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists documents_company_created_idx
  on documents(company_id, created_at desc);

-- 3. document_blocks ---------------------------------------------------------
--
-- The atom of traceability. Every evidence chip in the UI resolves to exactly
-- one row here, by primary key, so that lookup must stay a single-table read.
-- `org_id` is denormalised for exactly that reason: joining to `documents` to
-- satisfy RLS would make the drawer's hot path a two-table read.

create table if not exists document_blocks (
  id text primary key,
  document_id uuid not null references documents(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('heading', 'paragraph', 'bullet', 'kv', 'table', 'clause')),
  text text not null,
  page int not null,
  section text,
  table_json jsonb,
  ordinal int not null
);

create index if not exists document_blocks_document_ordinal_idx
  on document_blocks(document_id, ordinal);
create index if not exists document_blocks_org_id_idx
  on document_blocks(org_id, id);

-- 4. runs --------------------------------------------------------------------
--
-- One row per pipeline execution. The processing screen polls it; the deep
-- dive reads it. `stage_detail` is rendered verbatim to the user.

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'complete', 'failed')),
  stage text not null default 'parse' check (stage in ('parse', 'extract', 'analyse', 'crosscheck')),
  stage_detail text,
  extraction jsonb,
  benchmark jsonb,
  portfolio jsonb,
  decision jsonb,
  memo jsonb,
  llm_calls int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runs_company_created_idx
  on runs(company_id, created_at desc);

-- 5. updated_at ---------------------------------------------------------------
--
-- `runs` is the first table in this schema with a mutable row, so this is the
-- first trigger. Pinned search_path like every other function here.

create or replace function set_updated_at() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists runs_set_updated_at on runs;
create trigger runs_set_updated_at
  before update on runs
  for each row execute function set_updated_at();

-- 6. RLS ----------------------------------------------------------------------
--
-- Members read, admins write, on all three. Same shape as `companies`.

alter table documents enable row level security;
alter table document_blocks enable row level security;
alter table runs enable row level security;

drop policy if exists "documents: members read" on documents;
create policy "documents: members read" on documents for select
  using (is_org_member(org_id));
drop policy if exists "documents: admins insert" on documents;
create policy "documents: admins insert" on documents for insert
  with check (is_org_admin(org_id));
drop policy if exists "documents: admins update" on documents;
create policy "documents: admins update" on documents for update
  using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "document_blocks: members read" on document_blocks;
create policy "document_blocks: members read" on document_blocks for select
  using (is_org_member(org_id));
drop policy if exists "document_blocks: admins insert" on document_blocks;
create policy "document_blocks: admins insert" on document_blocks for insert
  with check (is_org_admin(org_id));
drop policy if exists "document_blocks: admins update" on document_blocks;
create policy "document_blocks: admins update" on document_blocks for update
  using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "runs: members read" on runs;
create policy "runs: members read" on runs for select
  using (is_org_member(org_id));
drop policy if exists "runs: admins insert" on runs;
create policy "runs: admins insert" on runs for insert
  with check (is_org_admin(org_id));
drop policy if exists "runs: admins update" on runs;
create policy "runs: admins update" on runs for update
  using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- 7. Atomic block insert ------------------------------------------------------
--
-- Blocks are only ever created in bulk, one batch per parsed document, and a
-- half-written document is a document whose citations dangle. Per the data
-- model's convention, multi-row creates go through an RPC so they are atomic.
--
-- `p_blocks` is a serialised `Block[]` straight from the contract — same field
-- names, no caller-side remapping. `ordinal` is derived from array position
-- rather than accepted from the caller, so document order cannot silently
-- disagree with the order the blocks were parsed in.
--
-- SECURITY INVOKER: this runs as the caller, so the RLS policies above still
-- apply. The function exists for atomicity, not to escape authorisation.

create or replace function insert_document_blocks(p_document_id uuid, p_blocks jsonb)
returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_org_id uuid;
  v_count int;
begin
  if jsonb_typeof(p_blocks) is distinct from 'array' then
    raise exception 'p_blocks must be a JSON array, got %', jsonb_typeof(p_blocks)
      using errcode = 'invalid_parameter_value';
  end if;

  select org_id into v_org_id from documents where id = p_document_id;
  if v_org_id is null then
    raise exception 'unknown document %', p_document_id using errcode = 'no_data_found';
  end if;

  insert into document_blocks (id, document_id, org_id, kind, text, page, section, table_json, ordinal)
  select
    b->>'id',
    p_document_id,
    v_org_id,
    b->>'kind',
    b->>'text',
    (b->>'page')::int,
    b->>'section',
    b->'table',
    (ord - 1)::int
  from jsonb_array_elements(p_blocks) with ordinality as t(b, ord);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
