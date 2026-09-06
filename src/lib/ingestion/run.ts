// ============================================================================
// src/lib/ingestion/run.ts — the background ingestion job.
//
// `maxDuration = 60` does not cover parsing a 40-page PDF plus parallel Gemini
// calls, so `POST /api/ingest` returns a run id immediately and this runs
// after it. Everything a user sees while waiting is written from here:
// `runs.stage` drives the stepper, `runs.stage_detail` is rendered verbatim.
//
// The rule that shapes this whole file: **one bad file must never fail the
// whole run.** A document that cannot be parsed is marked failed with a reason
// and the run continues without it. Only a run with no usable documents at all
// fails outright.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompanyProfile, SourceDoc } from '@/lib/contracts/types';
import { runExtraction } from '@/lib/pipeline/extraction';
import { runDecision } from '@/lib/pipeline/decision';
import { EmptyDocumentError, parseDocument, UnsupportedFileTypeError } from './index';
import {
  loadCompanyDocuments,
  markFailed,
  persistDocument,
  setDocumentStatus,
} from './persist';
import { addLlmCalls, completeRun, failRun, setStage } from '@/lib/db/runs';

const STORAGE_BUCKET = 'company-documents';

/** Defaults to 500. A few real uploads burn through it faster than expected. */
function runBudgetMax(): number {
  const parsed = parseInt(process.env.RUN_BUDGET_MAX ?? '500', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 500;
}

export class RunBudgetExceededError extends Error {
  constructor(used: number, max: number) {
    super(`Run budget exceeded: ${used} model calls against a cap of ${max}`);
    this.name = 'RunBudgetExceededError';
  }
}

export interface IngestJobInput {
  db: SupabaseClient;
  runId: string;
  orgId: string;
  companyId: string;
  documents: Array<{ id: string; storagePath: string; filename: string; mimeType: string }>;
}

interface ParseTally {
  parsed: number;
  failed: number;
}

/**
 * Parse each document in turn, persisting as we go. Sequential rather than
 * parallel on purpose: a run is several large files against one rate-limited
 * model, and the user is watching a per-document counter that only means
 * something if documents finish one at a time.
 */
async function parseAll(input: IngestJobInput): Promise<ParseTally> {
  const { db, runId, orgId, companyId, documents } = input;
  const tally: ParseTally = { parsed: 0, failed: 0 };

  for (const [index, entry] of documents.entries()) {
    await setStage(
      db,
      runId,
      'parse',
      `Parsing ${index + 1} of ${documents.length} — ${entry.filename}`,
    );

    try {
      await setDocumentStatus(db, entry.id, 'parsing');

      const { data: file, error } = await db.storage
        .from(STORAGE_BUCKET)
        .download(entry.storagePath);
      if (error || !file) throw new Error(`could not read the uploaded file: ${error?.message}`);

      const { doc } = await parseDocument({
        documentId: entry.id,
        filename: entry.filename,
        data: new Uint8Array(await file.arrayBuffer()),
        mimeType: entry.mimeType,
      });

      await persistDocument({ db, doc, orgId, companyId, storagePath: entry.storagePath });
      tally.parsed += 1;
    } catch (err) {
      // Every failure surfaces on the processing screen as a named document
      // with a reason, never as a missing row.
      await markFailed(db, entry.id, reasonFor(err));
      tally.failed += 1;
    }
  }

  return tally;
}

/** Human language, never a stack trace — this string is rendered to the user. */
function reasonFor(err: unknown): string {
  if (err instanceof UnsupportedFileTypeError) return 'This file type cannot be read.';
  if (err instanceof EmptyDocumentError) {
    return 'No readable text was found in this file. If it is a scan, try a higher-quality copy.';
  }
  if (err instanceof Error) {
    if (err.name === 'LlmTimeoutError') return 'Timed out while reading this document. It may be very large.';
    if (err.name === 'LlmError') return 'The document could not be read automatically.';
    return err.message.slice(0, 200);
  }
  return 'This document could not be processed.';
}

/**
 * Parse, extract, analyse, crosscheck. Each phase writes its stage before it
 * starts, because the value of the stepper is that it moves before the slow
 * part rather than after it.
 */
export async function runIngestion(input: IngestJobInput): Promise<void> {
  const { db, runId, companyId } = input;
  const budget = runBudgetMax();

  try {
    // --- parse ------------------------------------------------------------
    const tally = await parseAll(input);
    // Each parse is at most one classify call plus one fallback parse call.
    await addLlmCalls(db, runId, tally.parsed * 2);

    if (tally.parsed === 0) {
      await failRun(
        db,
        runId,
        tally.failed === 1
          ? 'The uploaded document could not be read.'
          : `None of the ${tally.failed} uploaded documents could be read.`,
      );
      return;
    }

    const docs: SourceDoc[] = await loadCompanyDocuments(db, companyId);
    if (docs.length === 0) {
      await failRun(db, runId, 'No readable documents were stored for this company.');
      return;
    }

    // --- extract ----------------------------------------------------------
    await setStage(db, runId, 'extract', `Extracting facts from ${docs.length} document${docs.length === 1 ? '' : 's'}`);
    const used = await addLlmCalls(db, runId, docs.length);
    if (used > budget) throw new RunBudgetExceededError(used, budget);

    const extraction = await runExtraction(docs, docs);
    const profile: CompanyProfile = extraction.profile;

    // --- analyse ----------------------------------------------------------
    // Benchmark and portfolio are deterministic — no model calls, no budget.
    await setStage(db, runId, 'analyse', 'Benchmarking against comparable companies');

    // --- crosscheck -------------------------------------------------------
    await setStage(db, runId, 'crosscheck', 'Cross-checking claims against source documents');
    const afterCrosscheck = await addLlmCalls(db, runId, 2);
    if (afterCrosscheck > budget) throw new RunBudgetExceededError(afterCrosscheck, budget);

    const decision = await runDecision(docs.map((d) => d.id), profile, docs);

    await completeRun(db, runId, companyId, {
      extraction,
      decision,
    });
  } catch (err) {
    const message =
      err instanceof RunBudgetExceededError
        ? 'This run reached its model-call limit and was stopped.'
        : err instanceof Error
          ? err.message.slice(0, 500)
          : 'The run failed unexpectedly.';
    await failRun(db, runId, message);
  }
}
