// ============================================================================
// src/lib/db/runs.ts — the `runs` row, read and written.
//
// One row per pipeline execution. The processing screen polls it, so every
// write here is something a user is watching happen.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RunProgress, RunStage, RunStatus } from '@/lib/contracts/types';

export class RunError extends Error {
  constructor(what: string, cause: unknown) {
    super(`${what}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'RunError';
    this.cause = cause;
  }
}

/** A company may have exactly one run in flight. Returns its id if there is one. */
export async function findActiveRun(
  db: SupabaseClient,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('runs')
    .select('id')
    .eq('company_id', companyId)
    .in('status', ['queued', 'running'])
    .limit(1);
  if (error) throw new RunError('active run lookup failed', error);
  return data?.[0]?.id ?? null;
}

export async function createRun(
  db: SupabaseClient,
  orgId: string,
  companyId: string,
): Promise<string> {
  const { data, error } = await db
    .from('runs')
    .insert({ org_id: orgId, company_id: companyId, status: 'queued', stage: 'parse' })
    .select('id')
    .single();
  if (error || !data) throw new RunError('run insert failed', error);
  return data.id as string;
}

/**
 * `stageDetail` is rendered verbatim to the user ("Parsing 3 of 7 documents"),
 * so it is written on every meaningful step rather than only on stage change.
 */
export async function setStage(
  db: SupabaseClient,
  runId: string,
  stage: RunStage,
  stageDetail: string,
  status: RunStatus = 'running',
): Promise<void> {
  const { error } = await db
    .from('runs')
    .update({ status, stage, stage_detail: stageDetail })
    .eq('id', runId);
  if (error) throw new RunError(`stage update for run ${runId}`, error);
}

export async function addLlmCalls(db: SupabaseClient, runId: string, n: number): Promise<number> {
  const { data, error } = await db.from('runs').select('llm_calls').eq('id', runId).single();
  if (error || !data) throw new RunError(`llm_calls read for run ${runId}`, error);
  const next = (data.llm_calls as number) + n;
  const { error: writeError } = await db.from('runs').update({ llm_calls: next }).eq('id', runId);
  if (writeError) throw new RunError(`llm_calls write for run ${runId}`, writeError);
  return next;
}

export interface RunResults {
  extraction?: unknown;
  benchmark?: unknown;
  portfolio?: unknown;
  decision?: unknown;
  memo?: unknown;
}

export async function completeRun(
  db: SupabaseClient,
  runId: string,
  companyId: string,
  results: RunResults,
): Promise<void> {
  const { error } = await db
    .from('runs')
    .update({ ...results, status: 'complete', stage: 'crosscheck', stage_detail: null, error: null })
    .eq('id', runId);
  if (error) throw new RunError(`run completion for ${runId}`, error);

  // The portfolio list reads `latest_run_id` rather than subquerying per row,
  // so a completed run that does not update it is invisible to the dashboard.
  const { error: companyError } = await db
    .from('companies')
    .update({ latest_run_id: runId })
    .eq('id', companyId);
  if (companyError) throw new RunError(`latest_run_id update for ${companyId}`, companyError);
}

export async function failRun(db: SupabaseClient, runId: string, message: string): Promise<void> {
  const { error } = await db
    .from('runs')
    .update({ status: 'failed', error: message.slice(0, 1_000), stage_detail: null })
    .eq('id', runId);
  // On an error path already — surfacing this would mask the real cause.
  if (error) console.error(`[winback] failRun(${runId}) also failed:`, error.message);
}

/**
 * The polled progress shell. Result blobs are deliberately not selected: they
 * are megabytes, and the screen polls this every 1.5 seconds.
 */
export async function loadRunProgress(
  db: SupabaseClient,
  runId: string,
): Promise<RunProgress | null> {
  const { data: run, error } = await db
    .from('runs')
    .select('id, company_id, status, stage, stage_detail, error, llm_calls, created_at, updated_at')
    .eq('id', runId)
    .maybeSingle();
  if (error) throw new RunError(`run progress read for ${runId}`, error);
  if (!run) return null;

  const { data: docs, error: docError } = await db
    .from('documents')
    .select('id, filename, title, status, failure_reason')
    .eq('company_id', run.company_id)
    .order('created_at', { ascending: true });
  if (docError) throw new RunError(`document progress read for run ${runId}`, docError);

  const started = new Date(run.created_at as string).getTime();
  const ended =
    run.status === 'complete' || run.status === 'failed'
      ? new Date(run.updated_at as string).getTime()
      : Date.now();

  return {
    id: run.id as string,
    status: run.status as RunProgress['status'],
    stage: run.stage as RunProgress['stage'],
    stageDetail: (run.stage_detail as string | null) ?? null,
    error: (run.error as string | null) ?? null,
    llmCalls: (run.llm_calls as number) ?? 0,
    elapsedMs: Math.max(0, ended - started),
    documents: (docs ?? []).map((d) => ({
      id: d.id as string,
      filename: d.filename as string,
      title: (d.title as string | null) ?? null,
      status: d.status as RunProgress['documents'][number]['status'],
      failureReason: (d.failure_reason as string | null) ?? null,
    })),
  };
}
