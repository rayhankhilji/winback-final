// ============================================================================
// GET /api/runs/[id] — docs/API.md
//
// Polled by the processing screen every 1.5 seconds. Returns the progress
// shell only: result blobs stay out until the run is complete, because
// shipping five JSON payloads on every poll is how a 40-second wait starts
// feeling like a broken one.
// ============================================================================

import { RunProgressResponseSchema } from '@/lib/contracts/schemas';
import { apiError, apiSuccess, validateOwnOutput, withRoute } from '@/lib/pipeline/http';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { loadRunProgress } from '@/lib/db/runs';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withRoute(req, 'GET /api/runs/[id]', 'standard', async () => {
    const { id } = await ctx.params;

    // The user's client, under RLS: a run belonging to another org simply is
    // not there, which is the 404 the contract asks for.
    const db = await createServerSupabaseClient();
    const progress = await loadRunProgress(db, id);
    if (!progress) return apiError('BAD_REQUEST', 'Run not found');

    const meta = { ms: 0, model: 'none', mock: false };
    const violation = validateOwnOutput(RunProgressResponseSchema, {
      ok: true as const,
      data: progress,
      meta,
    });
    if (violation) return violation;
    return apiSuccess(progress, meta);
  });
}
