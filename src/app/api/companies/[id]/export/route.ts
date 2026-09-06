import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { withRoute, apiError } from '@/lib/pipeline/http';
import { buildCompanyWorkbook, type WorkbookRun } from '@/lib/export/company-workbook';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withRoute(req, 'GET /api/companies/[id]/export', 'standard', async () => {
    const { id } = await ctx.params;
    const db = await createServerSupabaseClient();
    const [{ data: company, error: companyError }, { data: docs, error: docsError }] = await Promise.all([
      db.from('companies').select('id, name, sector, latest_run_id').eq('id', id).maybeSingle(),
      db.from('documents').select('filename, title, doc_kind, pages, page_noun, status').eq('company_id', id).order('created_at'),
    ]);
    if (companyError || docsError) throw companyError ?? docsError;
    if (!company) return apiError('BAD_REQUEST', 'Company not found');
    const { data: run, error: runError } = company.latest_run_id
      ? await db.from('runs').select('extraction, decision, memo, created_at').eq('id', company.latest_run_id).maybeSingle()
      : { data: null, error: null };
    if (runError) throw runError;

    const extraction = run?.extraction as { profile?: WorkbookRun['profile'] } | null;
    const decision = run?.decision as { crosschecks?: Array<{ title: string; status: string; severityHint: string; explanation: string }> } | null;
    const memo = run?.memo as { sections?: Array<{ heading: string; body: string }> } | null;
    const bytes = buildCompanyWorkbook({ name: company.name as string, sector: (company.sector as string | null) ?? null }, (docs ?? []).map((doc) => ({ filename: doc.filename as string, title: (doc.title as string | null) ?? null, docKind: (doc.doc_kind as string | null) ?? null, pages: doc.pages as number, status: doc.status as string })), run ? { createdAt: run.created_at as string, profile: extraction?.profile, findings: decision?.crosschecks, memo: memo?.sections } : null);
    const filename = `${String(company.name).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'company'}-winback-insights.xlsx`;
    return new NextResponse(Buffer.from(bytes), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' } });
  });
}
