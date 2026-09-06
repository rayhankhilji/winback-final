// ============================================================================
// POST /api/extract — erd.md Part 2 §5.2, Part 5 §5.4
// ============================================================================

import { TARGET_DOCS } from '@/data/target';
import { ExtractRequestSchema, ExtractResponseSchema } from '@/lib/contracts/schemas';
import type { ApiMeta } from '@/lib/contracts/types';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { runExtraction } from '@/lib/pipeline/extraction';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadCompanyDocuments } from '@/lib/ingestion/persist';
import type { SourceDoc } from '@/lib/contracts/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/extract', 'llm', async () => {
    const started = Date.now();
    const parsed = await parseBody(req, ExtractRequestSchema);
    if (!parsed.ok) return parsed.response;

    // Two valid shapes, one union: `companyId` is a real upload, `docIds` is
    // the fixture path. Both go through the same runExtraction — the pipeline
    // already operates on SourceDoc[] and needs no change for either.
    let docs: SourceDoc[];
    let allDocs: SourceDoc[];

    if ('companyId' in parsed.data) {
      const db = await createServerSupabaseClient();
      const { data: company } = await db
        .from('companies')
        .select('id')
        .eq('id', parsed.data.companyId)
        .maybeSingle();
      if (!company) return apiError('BAD_REQUEST', 'Company not found');

      docs = await loadCompanyDocuments(db, parsed.data.companyId);
      if (docs.length === 0) {
        return apiError('BAD_REQUEST', 'This company has no readable documents yet.');
      }
      allDocs = docs;
    } else {
      const { docIds } = parsed.data;
      const found = docIds.map((id) => TARGET_DOCS.find((d) => d.id === id));
      const unknownIndex = found.findIndex((d) => !d);
      if (unknownIndex !== -1) {
        return apiError('BAD_REQUEST', `Unknown docId: ${docIds[unknownIndex]}`);
      }
      docs = found.filter((d): d is SourceDoc => Boolean(d));
      allDocs = TARGET_DOCS;
    }

    let result;
    try {
      result = await runExtraction(docs, allDocs);
    } catch (err) {
      return apiError('LLM_ERROR', 'Extraction failed for every document', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const violation = validateOwnOutput(ExtractResponseSchema, {
      ok: true,
      data: result,
      meta: { ms: 0, model: result.profile.provenance.producedBy, mock: false },
    });
    if (violation) return violation;

    const meta: ApiMeta = {
      ms: Date.now() - started,
      model: result.profile.provenance.producedBy,
      mock: result.profile.provenance.producedBy === 'mock',
      droppedEvidenceRefs: result.droppedEvidenceRefs,
    };
    return apiSuccess(result, meta);
  });
}
