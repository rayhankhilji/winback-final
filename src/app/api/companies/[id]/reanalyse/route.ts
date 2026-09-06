import { IngestResponseSchema } from '@/lib/contracts/schemas';
import { apiError, apiSuccess, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceSupabaseClient } from '@/lib/supabase/service';
import { createRun, failRun, findActiveRun } from '@/lib/db/runs';
import { runReanalysis } from '@/lib/ingestion/run';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withRoute(req, 'POST /api/companies/[id]/reanalyse', 'standard', async () => {
    const { id: companyId } = await ctx.params;
    const userDb = await createServerSupabaseClient();
    const { data: company, error } = await userDb.from('companies').select('id, org_id').eq('id', companyId).maybeSingle();
    if (error) throw error;
    if (!company) return apiError('BAD_REQUEST', 'Company not found');
    const db = createServiceSupabaseClient();
    const active = await findActiveRun(db, companyId);
    if (active) return apiError('BAD_REQUEST', 'This company already has an analysis in progress.', { code: 'RUN_IN_PROGRESS', runId: active });
    const runId = await createRun(db, company.org_id as string, companyId);
    void runReanalysis({ db, runId, companyId }).catch(async () => { await failRun(db, runId, 'The re-analysis stopped unexpectedly.'); });
    const meta = { ms: 0, model: 'none', mock: false };
    const violation = validateOwnOutput(IngestResponseSchema, { ok: true as const, data: { runId }, meta });
    if (violation) return violation;
    return apiSuccess({ runId }, meta, 202);
  });
}
