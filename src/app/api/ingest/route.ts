// ============================================================================
// POST /api/ingest — docs/API.md
//
// Starts an ingestion run. Returns 202 with a run id immediately; the work
// continues in the background because parsing plus model calls does not fit
// inside maxDuration.
// ============================================================================

import { randomUUID } from 'node:crypto';
import {
  IngestRequestSchema,
  IngestResponseSchema,
} from '@/lib/contracts/schemas';
import { apiError, apiSuccess, parseBody, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createServiceSupabaseClient } from '@/lib/supabase/service';
import { createPendingDocuments } from '@/lib/ingestion/persist';
import { resolveMimeType, strategyFor, UnsupportedFileTypeError } from '@/lib/ingestion';
import { createRun, failRun, findActiveRun } from '@/lib/db/runs';
import { runIngestion } from '@/lib/ingestion/run';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return withRoute(req, 'POST /api/ingest', 'standard', async () => {
    const parsed = await parseBody(req, IngestRequestSchema);
    if (!parsed.ok) return parsed.response;
    const { companyId, storagePaths } = parsed.data;

    // Membership is checked with the *user's* client, under RLS. A company the
    // caller cannot see reads as absent — 404, never 403, so the route does not
    // leak which companies exist.
    const userDb = await createServerSupabaseClient();
    const { data: company } = await userDb
      .from('companies')
      .select('id, org_id')
      .eq('id', companyId)
      .maybeSingle();
    if (!company) return apiError('BAD_REQUEST', 'Company not found');
    const orgId = company.org_id as string;

    // The picker checks file types for UX; this check is the guarantee.
    const documents = [];
    for (const storagePath of storagePaths) {
      const filename = storagePath.split('/').pop() ?? storagePath;
      const mimeType = resolveMimeType(filename);
      try {
        strategyFor(mimeType);
      } catch (err) {
        if (err instanceof UnsupportedFileTypeError) {
          return apiError('BAD_REQUEST', `${filename} is a file type we cannot read.`, {
            code: 'UNSUPPORTED_TYPE',
            filename,
          });
        }
        throw err;
      }
      documents.push({ id: randomUUID(), storagePath, filename, mimeType });
    }

    const db = createServiceSupabaseClient();

    // One run per company at a time. Two concurrent runs would race on
    // `latest_run_id` and show the user a stepper that jumps backwards.
    const active = await findActiveRun(db, companyId);
    if (active) {
      return apiError('BAD_REQUEST', 'This company already has an analysis in progress.', {
        code: 'RUN_IN_PROGRESS',
        runId: active,
      });
    }

    const runId = await createRun(db, orgId, companyId);
    await createPendingDocuments(db, orgId, companyId, documents);

    // Deliberately not awaited: the response must return in well under a
    // second. An unhandled rejection here would be invisible, so the job's own
    // catch-all is backed up by this one, which at least marks the run failed.
    void runIngestion({ db, runId, orgId, companyId, documents }).catch(async (err) => {
      console.error('[winback] ingestion job crashed', err);
      await failRun(db, runId, 'The analysis stopped unexpectedly.');
    });

    const body = { ok: true as const, data: { runId }, meta: { ms: 0, model: 'none', mock: false } };
    const violation = validateOwnOutput(IngestResponseSchema, body);
    if (violation) return violation;
    return apiSuccess({ runId }, { ms: 0, model: 'none', mock: false }, 202);
  });
}
