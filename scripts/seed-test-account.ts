// ============================================================================
// scripts/seed-test-account.ts — the demo login.
//
//   pnpm seed:test
//
// Creates test@test.com / test123 with its email pre-confirmed, an org, a
// company, and admin membership — everything the app needs to render past the
// sign-in wall. Idempotent: run it again and it repairs whatever is missing
// rather than erroring.
//
// This does NOT hardcode a credential into the app. Winback's auth is Supabase
// end to end — `src/proxy.ts` gates every route on a real session, and every
// query runs under RLS keyed to `org_members`. A bypass would have to fake the
// session AND the whole data layer, and would then have to be kept out of
// production forever. Seeding a real user is the same convenience with none of
// that risk, and it exercises the real sign-in path.
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env.local, and migrations 0001–0004 applied.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const EMAIL = 'test@test.com';
const PASSWORD = 'test123';
const ORG_NAME = 'Test Fund';
const COMPANY_NAME = 'Kestrelbrook Health Partners';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || /placeholder/i.test(`${url}${serviceKey}`)) {
    console.error(
      '\nNEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to real values in\n' +
        '.env.local. Both are in the Supabase dashboard under Project Settings -> API.\n' +
        '\nThere is no way around this: sign-in is Supabase, so a login needs a Supabase project.\n',
    );
    process.exit(1);
  }

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 1. The user. createUser fails if the email exists, so look first.
  const { data: list, error: listError } = await db.auth.admin.listUsers();
  if (listError) throw new Error(`listUsers failed: ${listError.message}`);

  let userId = list.users.find((u) => u.email === EMAIL)?.id;

  if (userId) {
    // Reset the password so a half-seeded account from an earlier run still
    // logs in with the documented credentials.
    const { error } = await db.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`updateUser failed: ${error.message}`);
    console.log(`  user      ${EMAIL} (existing, password reset)`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // no inbox to click a link in
    });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    userId = data.user.id;
    console.log(`  user      ${EMAIL} (created)`);
  }

  // 2. Profile. `onboarding` writes this for a real signup.
  const { error: profileError } = await db
    .from('profiles')
    .upsert({ id: userId, full_name: 'Test Analyst' }, { onConflict: 'id' });
  if (profileError) throw new Error(`profile upsert failed: ${profileError.message}`);

  // 3. Org + admin membership. Created directly rather than through the
  //    create_org RPC, which is SECURITY DEFINER on auth.uid() and has no
  //    session to read here.
  const { data: existingOrg } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  let orgId = existingOrg?.org_id as string | undefined;

  if (!orgId) {
    const { data: org, error } = await db
      .from('orgs')
      .insert({ name: ORG_NAME })
      .select('id')
      .single();
    if (error || !org) throw new Error(`org insert failed: ${error?.message}`);
    orgId = org.id as string;

    const { error: memberError } = await db
      .from('org_members')
      .insert({ org_id: orgId, user_id: userId, role: 'admin' });
    if (memberError) throw new Error(`org_members insert failed: ${memberError.message}`);
    console.log(`  org       ${ORG_NAME} (created)`);
  } else {
    console.log(`  org       existing (${orgId})`);
  }

  // 4. A company to land on, so the app is not an empty state.
  const { data: existingCompany } = await db
    .from('companies')
    .select('id')
    .eq('org_id', orgId)
    .eq('name', COMPANY_NAME)
    .maybeSingle();

  if (!existingCompany) {
    const { data: company, error } = await db
      .from('companies')
      .insert({ org_id: orgId, name: COMPANY_NAME, sector: 'Healthcare Services' })
      .select('id')
      .single();
    if (error || !company) throw new Error(`company insert failed: ${error?.message}`);
    console.log(`  company   ${COMPANY_NAME} (created, id ${company.id})`);
  } else {
    console.log(`  company   ${COMPANY_NAME} (existing, id ${existingCompany.id})`);
  }

  console.log(`\n  Sign in at /sign-in with ${EMAIL} / ${PASSWORD}\n`);
}

main().catch((err) => {
  console.error(`\nseed-test-account failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
