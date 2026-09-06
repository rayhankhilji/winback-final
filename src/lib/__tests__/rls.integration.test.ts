// ============================================================================
// RLS proof for migration 0004 — Stage 2's "done when".
//
// Proves that a member of org A cannot read org B's rows in `documents`,
// `document_blocks` or `runs`, against a real Postgres with the real policies.
// RLS cannot be unit-tested: the policies live in the database, so a mock would
// prove only that the mock was written to agree with itself.
//
// Needs a Supabase instance. Either:
//   supabase start                       (local, requires Docker)
//   pnpm test src/lib/__tests__/rls      with the three env vars set
//
// Skips loudly rather than failing when they are absent, so the default
// `pnpm test` run stays green on a machine with no database.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLACEHOLDER = /placeholder/i;

const configured =
  Boolean(URL && ANON && SERVICE) && !PLACEHOLDER.test(`${URL}${ANON}${SERVICE}`);

interface Tenant {
  email: string;
  userId: string;
  orgId: string;
  companyId: string;
  documentId: string;
  blockId: string;
  runId: string;
  client: SupabaseClient;
}

const PASSWORD = 'rls-test-password-8f2a1c';

describe.skipIf(!configured)('RLS — org isolation on documents, document_blocks and runs', () => {
  let admin: SupabaseClient;
  let a: Tenant;
  let b: Tenant;

  async function makeTenant(label: string): Promise<Tenant> {
    const email = `rls-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (userErr || !created.user) throw new Error(`createUser failed: ${userErr?.message}`);
    const userId = created.user.id;

    // Sign in as this user and create the org through the real RPC, so the
    // membership row is written exactly as the app writes it.
    const client = createClient(URL!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

    const { data: orgId, error: orgErr } = await client.rpc('create_org', { p_name: `RLS ${label}` });
    if (orgErr || !orgId) throw new Error(`create_org failed: ${orgErr?.message}`);

    // Seed the rows with the service-role client: this test is about who can
    // READ them, and writing them through RLS would confound the two.
    const { data: company, error: cErr } = await admin
      .from('companies')
      .insert({ org_id: orgId, name: `Co ${label}`, sector: 'Healthcare Services' })
      .select('id')
      .single();
    if (cErr || !company) throw new Error(`company insert failed: ${cErr?.message}`);

    const { data: doc, error: dErr } = await admin
      .from('documents')
      .insert({
        org_id: orgId,
        company_id: company.id,
        storage_path: `${orgId}/${company.id}/deck.pdf`,
        filename: 'deck.pdf',
        title: `${label} management presentation`,
        doc_kind: 'presentation',
        mime_type: 'application/pdf',
        pages: 3,
        page_noun: 'slide',
        status: 'parsed',
      })
      .select('id')
      .single();
    if (dErr || !doc) throw new Error(`document insert failed: ${dErr?.message}`);

    const blockId = `${doc.id}-p1-b1`;
    const { error: bErr } = await admin.from('document_blocks').insert({
      id: blockId,
      document_id: doc.id,
      org_id: orgId,
      kind: 'paragraph',
      text: `${label} confidential revenue detail`,
      page: 1,
      section: 'Revenue Quality',
      ordinal: 0,
    });
    if (bErr) throw new Error(`block insert failed: ${bErr.message}`);

    const { data: run, error: rErr } = await admin
      .from('runs')
      .insert({ org_id: orgId, company_id: company.id, status: 'complete', stage: 'crosscheck' })
      .select('id')
      .single();
    if (rErr || !run) throw new Error(`run insert failed: ${rErr?.message}`);

    return {
      email,
      userId,
      orgId,
      companyId: company.id,
      documentId: doc.id,
      blockId,
      runId: run.id,
      client,
    };
  }

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    a = await makeTenant('a');
    b = await makeTenant('b');
  }, 60_000);

  afterAll(async () => {
    for (const t of [a, b]) {
      if (!t) continue;
      await t.client.auth.signOut();
      await admin.from('orgs').delete().eq('id', t.orgId);
      await admin.auth.admin.deleteUser(t.userId);
    }
  }, 60_000);

  it('lets a member read their own org rows', async () => {
    const [docs, blocks, runs] = await Promise.all([
      a.client.from('documents').select('id').eq('id', a.documentId),
      a.client.from('document_blocks').select('id').eq('id', a.blockId),
      a.client.from('runs').select('id').eq('id', a.runId),
    ]);
    expect(docs.data).toHaveLength(1);
    expect(blocks.data).toHaveLength(1);
    expect(runs.data).toHaveLength(1);
  });

  it('does not let org A read org B documents', async () => {
    const { data } = await a.client.from('documents').select('id').eq('id', b.documentId);
    expect(data).toEqual([]);
  });

  it('does not let org A read org B document_blocks, even by primary key', async () => {
    // The evidence drawer resolves a citation by block id alone. If this leaks,
    // a guessed or leaked block id reads another tenant's source text.
    const { data } = await a.client.from('document_blocks').select('id, text').eq('id', b.blockId);
    expect(data).toEqual([]);
  });

  it('does not let org A read org B runs', async () => {
    const { data } = await a.client.from('runs').select('id').eq('id', b.runId);
    expect(data).toEqual([]);
  });

  it('scopes an unfiltered select to the caller org on all three tables', async () => {
    // The dangerous shape is a bare select with no eq() — a missing WHERE must
    // return one org's rows, not every org's.
    const [docs, blocks, runs] = await Promise.all([
      a.client.from('documents').select('org_id'),
      a.client.from('document_blocks').select('org_id'),
      a.client.from('runs').select('org_id'),
    ]);
    for (const res of [docs, blocks, runs]) {
      expect(res.data ?? []).not.toHaveLength(0);
      for (const row of res.data ?? []) expect(row.org_id).toBe(a.orgId);
    }
  });

  it('does not let org A write into org B', async () => {
    const { error } = await a.client.from('runs').insert({
      org_id: b.orgId,
      company_id: b.companyId,
      status: 'queued',
      stage: 'parse',
    });
    expect(error).not.toBeNull();
  });

  it('leaves existing auth flows unaffected — companies still readable by its own org only', async () => {
    const own = await a.client.from('companies').select('id').eq('id', a.companyId);
    const other = await a.client.from('companies').select('id').eq('id', b.companyId);
    expect(own.data).toHaveLength(1);
    expect(other.data).toEqual([]);
  });
});

describe.skipIf(configured)('RLS integration test', () => {
  it('is skipped without a configured Supabase instance', () => {
    // Visible in the run output so a green suite never reads as "RLS proven".
    expect(configured).toBe(false);
  });
});
