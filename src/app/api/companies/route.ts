// ============================================================================
// GET /api/companies — portfolio summary for the dashboard and list.
// ============================================================================

import { DecisionResultSchema, CompaniesResponseSchema } from '@/lib/contracts/schemas';
import { apiSuccess, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { CompanyListItem } from '@/lib/contracts/types';

function findingCount(decision: unknown): number {
  const parsed = DecisionResultSchema.safeParse(decision);
  if (!parsed.success) return 0;
  return parsed.data.crosschecks.filter((check) => check.status === 'contradiction_found').length;
}

export async function GET(req: Request) {
  return withRoute(req, 'GET /api/companies', 'standard', async () => {
    const db = await createServerSupabaseClient();
    const { data: companies, error: companyError } = await db
      .from('companies')
      .select('id, name, sector, latest_run_id, created_at')
      .order('name', { ascending: true });
    if (companyError) throw companyError;

    const ids = (companies ?? []).map((company) => company.id as string);
    const [{ data: documents, error: documentError }, { data: runs, error: runError }] = await Promise.all([
      ids.length > 0
        ? db.from('documents').select('company_id').in('company_id', ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length > 0
        ? db.from('runs').select('id, status, created_at, decision').in('company_id', ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (documentError) throw documentError;
    if (runError) throw runError;

    const documentCounts = new Map<string, number>();
    for (const document of documents ?? []) {
      const companyId = document.company_id as string;
      documentCounts.set(companyId, (documentCounts.get(companyId) ?? 0) + 1);
    }
    const runsById = new Map((runs ?? []).map((run) => [run.id as string, run]));

    const result: CompanyListItem[] = (companies ?? []).map((company) => {
      const latest = company.latest_run_id ? runsById.get(company.latest_run_id as string) : undefined;
      const findingTotal = latest ? findingCount(latest.decision) : 0;
      const status: CompanyListItem['status'] = !latest
        ? 'not_analysed'
        : latest.status === 'queued' || latest.status === 'running'
          ? 'in_progress'
          : latest.status === 'failed'
            ? 'failed'
            : findingTotal > 0
              ? 'attention'
              : 'complete';
      return {
        id: company.id as string,
        name: company.name as string,
        sector: (company.sector as string | null) ?? null,
        documentCount: documentCounts.get(company.id as string) ?? 0,
        findingCount: findingTotal,
        status,
        lastRunAt: latest ? (latest.created_at as string) : null,
      };
    });

    const meta = { ms: 0, model: 'none', mock: false };
    const body = { ok: true as const, data: { companies: result }, meta };
    const violation = validateOwnOutput(CompaniesResponseSchema, body);
    if (violation) return violation;
    return apiSuccess({ companies: result }, meta);
  });
}
