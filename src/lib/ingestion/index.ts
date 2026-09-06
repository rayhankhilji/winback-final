// ============================================================================
// src/lib/ingestion/index.ts — file bytes in, a SourceDoc out.
//
//   file -> parse to segments (deterministic parser, or Gemini where none exists)
//        -> blocks with namespaced ids  ({documentId}-p{page}-b{n})
//        -> one Gemini call: docKind, title, dateLabel, pageNoun
//        -> SourceDoc
//
// Persistence is deliberately not here: see persist.ts. This module is pure
// apart from the model calls, which makes it testable against a real file
// without a database.
// ============================================================================

import type { Block, DocKind, SourceDoc } from '@/lib/contracts/types';
import { toBlocks, pageCount, type Segment } from './blocks';
import { parsePdf } from './pdf';
import { parseDocx } from './docx';
import { parseSheet } from './sheet';
import { parseWithModel } from './model-parse';
import { classifyDocument, fallbackClassification } from './classify';

export class UnsupportedFileTypeError extends Error {
  constructor(mimeType: string, filename: string) {
    super(`Unsupported file type '${mimeType}' for ${filename}`);
    this.name = 'UnsupportedFileTypeError';
  }
}

export class EmptyDocumentError extends Error {
  constructor(filename: string) {
    super(`${filename} produced no readable content`);
    this.name = 'EmptyDocumentError';
  }
}

export type ParseStrategy = 'pdf' | 'docx' | 'sheet' | 'model';

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** Browsers lie about MIME types often enough that the extension is the more
 *  reliable signal for the office formats. Used only when the type is absent
 *  or the generic octet-stream. */
export function resolveMimeType(filename: string, declared?: string): string {
  if (declared && declared !== 'application/octet-stream') return declared;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? declared ?? 'application/octet-stream';
}

export function strategyFor(mimeType: string): ParseStrategy {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword') return 'docx';
  if (
    mimeType.includes('spreadsheetml') ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'text/csv'
  ) {
    return 'sheet';
  }
  if (mimeType.includes('presentationml') || mimeType.startsWith('image/')) return 'model';
  throw new UnsupportedFileTypeError(mimeType, '');
}

export interface ParseInput {
  /** The document's uuid. Block ids are namespaced under it, permanently. */
  documentId: string;
  filename: string;
  data: Uint8Array;
  mimeType?: string;
  /** Skip the classify call. The caller then supplies title/kind itself. */
  skipClassify?: boolean;
}

export interface ParseOutcome {
  doc: SourceDoc;
  strategy: ParseStrategy;
  /** True when a text-layer PDF turned out to be a scan and went to Gemini. */
  usedVisionFallback: boolean;
  classified: boolean;
}

async function segmentsFor(
  input: ParseInput,
  mimeType: string,
): Promise<{ segments: Segment[]; pages: number; strategy: ParseStrategy; usedVisionFallback: boolean }> {
  const strategy = strategyFor(mimeType);

  if (strategy === 'pdf') {
    const outcome = await parsePdf(input.data);
    if (!outcome.needsVisionFallback && outcome.segments.length > 0) {
      return { ...outcome, strategy, usedVisionFallback: false };
    }
    // No usable text layer: a scan, or a deck exported as images. This is the
    // documented detection, not a guess — see MIN_CHARS_PER_PAGE.
    const viaModel = await parseWithModel(input.data, mimeType, `parse:${input.documentId}`);
    return { ...viaModel, strategy, usedVisionFallback: true };
  }

  if (strategy === 'docx') {
    return { ...(await parseDocx(input.data)), strategy, usedVisionFallback: false };
  }

  if (strategy === 'sheet') {
    return { ...parseSheet(input.data), strategy, usedVisionFallback: false };
  }

  const viaModel = await parseWithModel(input.data, mimeType, `parse:${input.documentId}`);
  return { ...viaModel, strategy, usedVisionFallback: false };
}

export async function parseDocument(input: ParseInput): Promise<ParseOutcome> {
  const mimeType = resolveMimeType(input.filename, input.mimeType);
  const { segments, pages, strategy, usedVisionFallback } = await segmentsFor(input, mimeType);

  const blocks: Block[] = toBlocks(input.documentId, segments);
  if (blocks.length === 0) throw new EmptyDocumentError(input.filename);

  let classification = fallbackClassification(input.filename, mimeType);
  let classified = false;
  if (!input.skipClassify) {
    try {
      classification = await classifyDocument(
        blocks,
        input.filename,
        mimeType,
        `classify:${input.documentId}`,
      );
      classified = true;
    } catch {
      // Classification is a convenience, not a precondition: it supplies a
      // nicer title and a routing hint. Losing it must not discard a document
      // that parsed correctly, so the deterministic fallback stands in and the
      // caller is told via `classified`.
      classified = false;
    }
  }

  const doc: SourceDoc = {
    id: input.documentId,
    kind: classification.docKind as DocKind,
    title: classification.title,
    filename: input.filename,
    dateLabel: classification.dateLabel,
    pages: Math.max(pages, pageCount(blocks)),
    pageNoun: classification.pageNoun,
    blocks,
    mimeType,
    ingestedAt: new Date().toISOString(),
  };

  return { doc, strategy, usedVisionFallback, classified };
}

export { toBlocks, pageCount, MAX_BLOCK_CHARS, type Segment } from './blocks';
export { MIN_CHARS_PER_PAGE } from './pdf';
