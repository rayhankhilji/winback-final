# Data Model — Winback

Supabase Postgres. Ground truth for all persisted data. Types and validation live in
`src/lib/contracts/schemas.ts`; this file is the database.

**Owns:** tables, columns, relationships, RLS.
**Never contains:** endpoint shapes (→ `API.md`), parsing logic (→ `INGESTION.md`).

## Conventions

- All ids `uuid` with `gen_random_uuid()` default, except `document_blocks.id` which is a namespaced
  text key so a citation is stable and human-readable.
- Every table carries `org_id` and is RLS-anchored on it. No table is readable without organisation
  membership.
- Helper functions `is_org_member(uuid)` and `is_org_admin(uuid)` already exist in
  `0002_fix_rls_and_atomicity.sql`. Use them; do not write new predicates.
- Every function pins `search_path`. Multi-row creates go through an RPC so they are atomic.
- `created_at` / `updated_at` are `timestamptz not null default now()`.

## Existing tables — do not modify except as noted

Defined in `supabase/migrations/0001`–`0003`. These are correct.

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user. Full name, avatar. |
| `orgs` | An organisation. Created atomically via the `create_org` RPC. |
| `org_members` | Join table. `role` is `admin` or `member`. |
| `invites` | Tokenised invite links. Admin-generated, member-accepted. |
| `companies` | A tracked portfolio company. Currently `id`, `org_id`, `name`. |

Storage bucket `company-documents` (private), objects at `{orgId}/{companyId}/{filename}`, RLS
mirroring `companies`: members read, admins write.

## Migration `0004_ingestion_and_runs.sql`

### `companies` — two added columns

```sql
alter table companies
  add column sector text,
  add column latest_run_id uuid;
```

`sector` because concentration analysis needs it and onboarding collects only a name today.
`latest_run_id` so the portfolio list renders without a per-row subquery.

### `documents`

One row per uploaded file. Metadata only — the file itself stays in Storage.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | Also the `SourceDoc.id`, making citations globally unique |
| `org_id` | uuid not null → orgs | RLS anchor |
| `company_id` | uuid not null → companies on delete cascade | |
| `storage_path` | text not null | `{orgId}/{companyId}/{filename}` |
| `filename` | text not null | Original name, cosmetic |
| `title` | text | Model-classified, human-readable |
| `doc_kind` | text | Matches the widened `DocKindSchema` |
| `date_label` | text | e.g. "March 2026" |
| `mime_type` | text not null | |
| `pages` | int not null default 0 | |
| `page_noun` | text not null default 'page' | `slide` / `page` / `row` / `grant` |
| `status` | text not null default 'pending' | `pending` / `parsing` / `parsed` / `failed` |
| `failure_reason` | text | Surfaced in the UI, never swallowed |
| `created_at` | timestamptz | |

Index: `(company_id, created_at desc)`.

### `document_blocks`

The atom of traceability. Every citation resolves to exactly one row here.

| Column | Type | Notes |
|---|---|---|
| `id` | text pk | `{documentId}-p{page}-b{n}`. Permanent. Never rewritten. |
| `document_id` | uuid not null → documents on delete cascade | |
| `org_id` | uuid not null | Denormalised so a citation lookup needs no join |
| `kind` | text not null | `heading` / `paragraph` / `bullet` / `kv` / `table` / `clause` |
| `text` | text not null | Plain text; readable flattening for tables |
| `page` | int not null | 1-indexed |
| `section` | text | Human label, e.g. "Revenue Quality" |
| `table_json` | jsonb | `{ columns: string[], rows: string[][] }` |
| `ordinal` | int not null | Document order, drives the viewer |

Indexes: `(document_id, ordinal)` and `(org_id, id)`. The drawer resolves by primary key, so this
path must be fast.

### `runs`

One row per pipeline execution. The processing screen polls it; the deep dive reads it.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id` | uuid not null → orgs | |
| `company_id` | uuid not null → companies on delete cascade | |
| `status` | text not null default 'queued' | `queued` / `running` / `complete` / `failed` |
| `stage` | text not null default 'parse' | `parse` / `extract` / `analyse` / `crosscheck` |
| `stage_detail` | text | "Parsing 3 of 7 documents" — rendered verbatim |
| `extraction` | jsonb | `ExtractionResult` |
| `benchmark` | jsonb | `BenchmarkResult` |
| `portfolio` | jsonb | `PortfolioImpact` |
| `decision` | jsonb | `DecisionResult` |
| `memo` | jsonb | `IcMemo` |
| `llm_calls` | int not null default 0 | Checked against `RUN_BUDGET_MAX` |
| `error` | text | |
| `created_at` / `updated_at` | timestamptz | |

Index: `(company_id, created_at desc)`.

**Pipeline results are `jsonb`, validated by the existing Zod schemas on write and on read.** Do not
normalise `ExtractionResult` into relational tables. The contracts already define these shapes, they
are always read whole, and normalising buys nothing.

## RLS

Every new table: select via `is_org_member(org_id)`, insert and update via `is_org_admin(org_id)`.
`document_blocks` carries its own `org_id` specifically so a citation lookup stays a single-table
read under RLS.

## What stays as fixtures

`src/data/target/` (the four Kestrel documents), `src/data/peers.ts`, `src/data/portfolio.ts`,
`src/data/golden/`, and `src/data/seed-sessions.ts` remain static TypeScript. They keep
`MOCK_LLM=1`, the golden-fixture path, and the graph preview working. Fixture documents and
uploaded documents coexist; only the type widens. If a change breaks the fixture path, it widened
something it shouldn't have.
