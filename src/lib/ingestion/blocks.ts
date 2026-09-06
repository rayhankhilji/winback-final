// ============================================================================
// src/lib/ingestion/blocks.ts
//
// Raw parser output -> Block[]. Every parser in this folder emits `Segment[]`
// and hands it here, so block id namespacing, ordering and the length cap are
// decided in exactly one place.
//
// Block ids are `{documentId}-p{page}-b{n}`, n restarting per page, exactly the
// shape docs/INGESTION.md step 0 specifies and seed-sessions.ts already uses.
// They are permanent: a citation written today must resolve to the same block
// months from now, so nothing in this file may ever renumber an existing
// document.
// ============================================================================

import type { Block, BlockKind } from '@/lib/contracts/types';

/** What a parser produces. Page and order are known; the id is not yet. */
export interface Segment {
  kind: BlockKind;
  text: string;
  page: number;
  section?: string;
  table?: { columns: string[]; rows: string[][] };
}

/**
 * Matches `scripts/validate-data.ts`'s cap for the hand-authored fixtures. A
 * block longer than this stops being one addressable claim and starts being a
 * page, which makes the evidence drawer useless — the highlight would cover
 * everything.
 */
export const MAX_BLOCK_CHARS = 1_200;

export function blockId(documentId: string, page: number, n: number): string {
  return `${documentId}-p${page}-b${n}`;
}

/** Collapse runs of whitespace but keep the text verbatim otherwise: evidence
 *  quotes are checked as substrings of this, so it cannot be reworded. */
function normalise(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Split a segment that exceeds the cap on sentence boundaries, falling back to
 * a hard cut only when a single sentence is itself over the limit. Splitting
 * mid-word would corrupt the quote-verification substring check.
 */
function splitLongText(text: string): string[] {
  if (text.length <= MAX_BLOCK_CHARS) return [text];

  const out: string[] = [];
  let current = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (sentence.length > MAX_BLOCK_CHARS) {
      if (current) {
        out.push(current.trim());
        current = '';
      }
      for (let i = 0; i < sentence.length; i += MAX_BLOCK_CHARS) {
        out.push(sentence.slice(i, i + MAX_BLOCK_CHARS).trim());
      }
      continue;
    }
    if (current.length + sentence.length + 1 > MAX_BLOCK_CHARS) {
      out.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter((t) => t.length > 0);
}

/**
 * Assign permanent ids to a document's segments.
 *
 * Segments must arrive in document order — every parser here produces them
 * that way, and `document_blocks.ordinal` is derived from array position when
 * they are persisted, so a caller that reorders them corrupts the viewer.
 */
export function toBlocks(documentId: string, segments: Segment[]): Block[] {
  if (!documentId) throw new Error('toBlocks: documentId is required for block id namespacing');

  const perPage = new Map<number, number>();
  const blocks: Block[] = [];

  for (const segment of segments) {
    const text = normalise(segment.text);
    if (!text) continue; // an empty block is not addressable; drop it silently

    // A table's flattened text can be long, but splitting it would orphan the
    // structured `table` payload from its own text. Tables stay whole.
    const parts = segment.table ? [text] : splitLongText(text);

    for (const part of parts) {
      const n = (perPage.get(segment.page) ?? 0) + 1;
      perPage.set(segment.page, n);
      blocks.push({
        id: blockId(documentId, segment.page, n),
        kind: segment.kind,
        text: part,
        page: segment.page,
        ...(segment.section ? { section: segment.section } : {}),
        ...(segment.table ? { table: segment.table } : {}),
      });
    }
  }

  return blocks;
}

/** Highest page number present, which is what `SourceDoc.pages` reports. */
export function pageCount(blocks: Block[]): number {
  return blocks.reduce((max, b) => Math.max(max, b.page), 0);
}

/** Flatten a table to text that reads correctly in the drawer and still
 *  contains every cell, so a quote can be verified against it. */
export function flattenTable(columns: string[], rows: string[][]): string {
  const header = columns.filter(Boolean).join(' | ');
  const body = rows.map((r) => r.join(' | ')).join('\n');
  return header ? `${header}\n${body}` : body;
}
