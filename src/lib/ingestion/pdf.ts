// ============================================================================
// src/lib/ingestion/pdf.ts — text-layer PDF parsing.
//
// pdf-parse gives per-page text. One block per paragraph, page numbers taken
// from the parser rather than counted here, so a citation's page always
// matches what the reader sees.
//
// A PDF with no text layer (a scan, or a deck exported as images) yields
// almost nothing here. That is detected, not papered over: the caller routes
// it to the Gemini vision fallback instead.
// ============================================================================

import { PDFParse } from 'pdf-parse';
import type { Segment } from './blocks';

/**
 * Below this many characters per page, a multi-page PDF has no usable text
 * layer. docs/INGESTION.md step 1 puts the threshold at ~100 chars.
 */
export const MIN_CHARS_PER_PAGE = 100;

export interface PdfParseOutcome {
  segments: Segment[];
  pages: number;
  /** True when the text layer is too thin to use — send it to Gemini vision. */
  needsVisionFallback: boolean;
  charsPerPage: number;
}

/** A heading is short, has no terminal punctuation, and is not a sentence. */
function looksLikeHeading(text: string): boolean {
  if (text.length > 80) return false;
  if (/[.!?,;]$/.test(text)) return false;
  return /^[A-Z0-9]/.test(text);
}

function looksLikeBullet(text: string): boolean {
  return /^\s*([-•▪◦*·]|\d+[.)]|[a-z][.)])\s+/i.test(text);
}

/** "FY24 Revenue: $42.1m" — a label/value pair, which the UI renders as `kv`. */
function looksLikeKv(text: string): boolean {
  return /^[^:\n]{1,60}:\s*\S/.test(text) && text.length < 200;
}

function classifySegment(text: string): Segment['kind'] {
  if (looksLikeBullet(text)) return 'bullet';
  if (looksLikeKv(text)) return 'kv';
  if (looksLikeHeading(text)) return 'heading';
  return 'paragraph';
}

/**
 * Split one page's text into paragraphs. Blank lines are the primary
 * separator; a page that uses single newlines throughout falls back to
 * line-per-paragraph rather than returning the whole page as one block.
 */
function paragraphsOf(pageText: string): string[] {
  const byBlankLine = pageText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (byBlankLine.length > 1) return byBlankLine;

  return pageText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function parsePdf(data: Uint8Array): Promise<PdfParseOutcome> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const pages = result.pages.length;
    const totalChars = result.pages.reduce((n, p) => n + p.text.trim().length, 0);
    const charsPerPage = pages > 0 ? Math.round(totalChars / pages) : 0;

    const segments: Segment[] = [];
    let currentSection: string | undefined;

    for (const page of result.pages) {
      for (const paragraph of paragraphsOf(page.text)) {
        const kind = classifySegment(paragraph);
        if (kind === 'heading') currentSection = paragraph;
        segments.push({
          kind,
          text: paragraph,
          page: page.num,
          ...(currentSection ? { section: currentSection } : {}),
        });
      }
    }

    return {
      segments,
      pages,
      charsPerPage,
      needsVisionFallback: pages > 0 && charsPerPage < MIN_CHARS_PER_PAGE,
    };
  } finally {
    // pdfjs holds a worker open; leaking it wedges a long-running job.
    await parser.destroy();
  }
}
