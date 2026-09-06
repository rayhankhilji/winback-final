import { CompanyDetailResponseSchema, DecisionResultSchema } from '@/lib/contracts/schemas';
import { apiError, apiSuccess, withRoute } from '@/lib/pipeline/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withRoute(req, 'GET /api/companies/[id]', 'standard', async () => {
    const { id } = await ctx.params;
    const db = await createServerSupabaseClient();
    const { data: company, error: companyError } = await db.from('companies').select('id, name, sector, latest_run_id').eq('id', id).maybeSingle();
    if (companyError) throw companyError;
    if (!company) return apiError('BAD_REQUEST', 'Company not found');
    const [{ data: documents, error: documentError }, { data: latestRun, error: runError }] = await Promise.all([
      db.from('documents').select('id, filename, title, doc_kind, pages, page_noun, status, failure_reason').eq('company_id', id).order('created_at'),
      company.latest_run_id ? db.from('runs').select('id, status, stage, created_at, extraction, benchmark, portfolio, decision, memo').eq('id', company.latest_run_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (documentError) throw documentError;
    if (runError) throw runError;
    const decision = latestRun ? DecisionResultSchema.safeParse(latestRun.decision) : null;
    const findingCount = decision?.success ? decision.data.crosschecks.filter((check) => check.status === 'contradiction_found').length : 0;
    const status = !latestRun ? 'not_analysed' : latestRun.status === 'queued' || latestRun.status === 'running' ? 'in_progress' : latestRun.status === 'failed' ? 'failed' : findingCount > 0 ? 'attention' : 'complete';
    const data = {
      company: { id: company.id as string, name: company.name as string, sector: (company.sector as string | null) ?? null, documentCount: (documents ?? []).length, findingCount, status, lastRunAt: latestRun ? latestRun.created_at as string : null },
      latestRun: latestRun ? { id: latestRun.id as string, status: latestRun.status as string, stage: latestRun.stage as string, createdAt: latestRun.created_at as string, extraction: latestRun.extraction, benchmark: latestRun.benchmark, portfolio: latestRun.portfolio, decision: latestRun.decision, memo: latestRun.memo } : null,
      documents: (documents ?? []).map((document) => ({ id: document.id as string, filename: document.filename as string, title: (document.title as string | null) ?? null, docKind: (document.doc_kind as string | null) ?? null, pages: document.pages as number, pageNoun: document.page_noun as string, status: document.status as string, failureReason: (document.failure_reason as string | null) ?? null })),
    };
    const meta = { ms: 0, model: 'none', mock: false };
    const validated = CompanyDetailResponseSchema.safeParse({ ok: true as const, data, meta });
    if (!validated.success || !validated.data.ok) return apiError('CONTRACT_VIOLATION', 'Server produced a response that failed its own schema');
    return apiSuccess(validated.data.data, meta);
  });
}
