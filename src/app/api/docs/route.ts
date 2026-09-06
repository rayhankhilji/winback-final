// ============================================================================
// GET /api/docs — docs/API.md
//
//   GET /api/docs?companyId=<uuid>  -> that company's parsed documents
//   GET /api/docs                   -> TARGET_DOCS, the fixture fallback
//
// The fallback is not legacy: it is what keeps MOCK_LLM=1 and the /plan demo
// path working, and it is the regression check for every stage after this.
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { apiError, apiSuccess, withRoute } from '@/lib/pipeline/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadCompanyDocuments } from '@/lib/ingestion/persist';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  return withRoute(req, 'GET /api/docs', 'standard', async () => {
    const companyId = new URL(req.url).searchParams.get('companyId');
    if (!companyId) {
      return apiSuccess({ docs: TARGET_DOCS }, { ms: 0, model: 'none', mock: false });
    }

    // The user's client, under RLS: another org's company reads as absent.
    const db = await createServerSupabaseClient();
    const { data: company } = await db
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle();
    if (!company) return apiError('BAD_REQUEST', 'Company not found');

    const docs = await loadCompanyDocuments(db, companyId);
    return apiSuccess({ docs }, { ms: 0, model: 'none', mock: false });
  });
}
