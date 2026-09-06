// ============================================================================
// src/lib/ingestion/persist.ts — a parsed SourceDoc into Postgres.
//
// `documents` takes the metadata; `document_blocks` takes the blocks, through
// the `insert_document_blocks` RPC so a document's blocks land atomically. A
// half-written document is a document whose citations dangle, which is the one
// failure this module exists to prevent.
//
// The caller supplies the Supabase client, so this works under a user's RLS
// session in a route handler and under the service role in a background job
// without knowing which it is.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Block, SourceDoc } from '@/lib/contracts/types';
import { SourceDocSchema } from '@/lib/contracts/schemas';

export class PersistError extends Error {
  constructor(what: string, cause: unknown) {
    super(`Failed to persist ${what}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'PersistError';
    this.cause = cause;
  }
}

export interface PersistInput {
  db: SupabaseClient;
  doc: SourceDoc;
  orgId: string;
  companyId: string;
  storagePath: string;
}

/** The row shape of `documents`, mirroring migration 0004. */
interface DocumentRow {
  id: string;
  org_id: string;
  company_id: string;
  storage_path: string;
  filename: string;
  title: string;
  doc_kind: string;
  date_label: string;
  mime_type: string;
  pages: number;
  page_noun: string;
  status: 'pending' | 'parsing' | 'parsed' | 'failed';
  failure_reason: string | null;
}

/** Blocks cross into Postgres as the contract shapes them; the RPC maps
 *  `table` to `table_json` and derives `ordinal` from array position. */
function blocksPayload(blocks: Block[]) {
  return blocks.map((b) => ({
    id: b.id,
    kind: b.kind,
    text: b.text,
    page: b.page,
    section: b.section ?? null,
    table: b.table ?? null,
  }));
}

/**
 * Insert the document row and its blocks. Validates the SourceDoc first: a
 * malformed document must never reach the database, because every citation
 * written afterwards depends on these rows being exactly what the contract
 * says they are.
 */
export async function persistDocument(input: PersistInput): Promise<{ documentId: string; blocks: number }> {
  const { db, orgId, companyId, storagePath } = input;

  const parsed = SourceDocSchema.safeParse(input.doc);
  if (!parsed.success) {
    throw new PersistError('document (contract violation before write)', parsed.error);
  }
  const doc = parsed.data;

  const row: DocumentRow = {
    id: doc.id,
    org_id: orgId,
    company_id: companyId,
    storage_path: storagePath,
    filename: doc.filename,
    title: doc.title,
    doc_kind: doc.kind,
    date_label: doc.dateLabel,
    mime_type: doc.mimeType ?? 'application/octet-stream',
    pages: doc.pages,
    page_noun: doc.pageNoun,
    status: 'parsed',
    failure_reason: null,
  };

  const { error: docError } = await db.from('documents').upsert(row, { onConflict: 'id' });
  if (docError) throw new PersistError(`documents row ${doc.id}`, docError);

  const { data: inserted, error: blockError } = await db.rpc('insert_document_blocks', {
    p_document_id: doc.id,
    p_blocks: blocksPayload(doc.blocks),
  });
  if (blockError) {
    // The document row is now orphaned without its blocks. Mark it failed
    // rather than leaving a `parsed` document that cites nothing — the UI
    // surfaces failure_reason, and a silent empty document would not.
    await markFailed(db, doc.id, `block insert failed: ${blockError.message}`);
    throw new PersistError(`document_blocks for ${doc.id}`, blockError);
  }

  return { documentId: doc.id, blocks: typeof inserted === 'number' ? inserted : doc.blocks.length };
}

export async function markFailed(db: SupabaseClient, documentId: string, reason: string): Promise<void> {
  const { error } = await db
    .from('documents')
    .update({ status: 'failed', failure_reason: reason.slice(0, 500) })
    .eq('id', documentId);
  // Deliberately not thrown: this runs on an error path, and masking the
  // original failure with a bookkeeping one would lose the real cause.
  if (error) console.error(`markFailed(${documentId}) also failed:`, error.message);
}

/**
 * Read a document and its blocks back as a SourceDoc, validated on the way
 * out. This is what lets the evidence drawer resolve a citation months later
 * without re-parsing the original file.
 */
export async function loadDocument(db: SupabaseClient, documentId: string): Promise<SourceDoc> {
  const { data: doc, error: docError } = await db
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();
  if (docError || !doc) throw new PersistError(`load of document ${documentId}`, docError);

  const { data: blocks, error: blockError } = await db
    .from('document_blocks')
    .select('id, kind, text, page, section, table_json')
    .eq('document_id', documentId)
    .order('ordinal', { ascending: true });
  if (blockError) throw new PersistError(`load of blocks for ${documentId}`, blockError);

  const candidate = {
    id: doc.id,
    kind: doc.doc_kind,
    title: doc.title ?? doc.filename,
    filename: doc.filename,
    dateLabel: doc.date_label ?? '',
    pages: doc.pages,
    pageNoun: doc.page_noun,
    blocks: (blocks ?? []).map((b) => ({
      id: b.id,
      kind: b.kind,
      text: b.text,
      page: b.page,
      ...(b.section ? { section: b.section } : {}),
      ...(b.table_json ? { table: b.table_json } : {}),
    })),
    companyId: doc.company_id,
    storagePath: doc.storage_path,
    mimeType: doc.mime_type,
    ...(doc.created_at ? { ingestedAt: doc.created_at } : {}),
  };

  const parsed = SourceDocSchema.safeParse(candidate);
  if (!parsed.success) {
    // Both directions validated: what comes out of the database is checked as
    // strictly as what went in.
    throw new PersistError(`document ${documentId} (contract violation on read)`, parsed.error);
  }
  return parsed.data;
}
