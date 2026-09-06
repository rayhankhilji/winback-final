// ============================================================================
// src/lib/supabase/service.ts — the service-role client.
//
// Server-only, and only for work that outlives a request. A background
// ingestion job has no cookies to act under: the user's session ends when
// `POST /api/ingest` returns 202, but the job keeps writing for another
// minute.
//
// This client bypasses RLS, so every caller must scope its own queries by
// `org_id` explicitly. The route that starts the job is what checks membership;
// the job trusts the org id it was handed and nothing else from the client.
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createServiceSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // One correct path: if the preconditions are not met, throw. A service
  // client built from a missing key would fail later, further from the cause.
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
