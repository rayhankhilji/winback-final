// ============================================================================
// src/lib/client/ingest.ts
//
// Upload and run-polling for Screens 1 and 2. The UI never calls `fetch`
// itself, so it lives here alongside the rest of the client layer.
//
// Unlike api.ts these do not dispatch into RunProvider: RunProvider holds one
// fixture-path Run, and an ingestion run is a database row polled by id. They
// return plain results and the screens hold their own state.
// ============================================================================

import { RunProgressResponseSchema } from '@/lib/contracts/schemas';
import type { RunProgress } from '@/lib/contracts/types';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export const STORAGE_BUCKET = 'company-documents';

/** Mirrors what the parsers can actually read. Rejected at the picker so a
 *  user never watches a file upload only to be told it was never supported. */
export const ACCEPTED_EXTENSIONS = [
  'pdf', 'docx', 'pptx', 'xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg', 'webp',
] as const;

export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',');

export function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function rejectionReason(file: File): string | null {
  const ext = extensionOf(file.name);
  if (!ext) return 'No file extension — we cannot tell what this is.';
  if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return `.${ext} files cannot be read. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}.`;
  }
  if (file.size === 0) return 'This file is empty.';
  return null;
}

export class UploadError extends Error {
  constructor(filename: string, cause: unknown) {
    super(`${filename} could not be uploaded: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'UploadError';
  }
}

/** Objects live at {orgId}/{companyId}/{filename} — migration 0003's RLS
 *  reads the org id out of the first path segment, so this shape is load
 *  bearing, not cosmetic. */
export function storagePathFor(orgId: string, companyId: string, filename: string): string {
  return `${orgId}/${companyId}/${filename}`;
}

export async function uploadFile(
  orgId: string,
  companyId: string,
  file: File,
): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const path = storagePathFor(orgId, companyId, file.name);
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw new UploadError(file.name, error);
  return path;
}

export interface StartIngestResult {
  ok: true;
  runId: string;
}

export interface StartIngestFailure {
  ok: false;
  message: string;
}

export async function startIngest(
  companyId: string,
  storagePaths: string[],
): Promise<StartIngestResult | StartIngestFailure> {
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, storagePaths }),
  });
  const json = await res.json();

  if (!json?.ok) {
    return { ok: false, message: json?.error?.message ?? 'Could not start the analysis.' };
  }
  return { ok: true, runId: json.data.runId as string };
}

/** One poll. Validated with the same schema the route validates its output
 *  against, so a contract drift shows up here rather than as a broken screen. */
export async function fetchRunProgress(
  runId: string,
): Promise<{ ok: true; progress: RunProgress } | { ok: false; message: string }> {
  const res = await fetch(`/api/runs/${runId}`, { cache: 'no-store' });
  const json = await res.json();

  const parsed = RunProgressResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, message: 'The server sent a response we could not read.' };
  }
  if (!parsed.data.ok) {
    return { ok: false, message: parsed.data.error.message };
  }
  return { ok: true, progress: parsed.data.data };
}
