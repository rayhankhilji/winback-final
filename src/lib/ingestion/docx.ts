// ============================================================================
// src/lib/ingestion/docx.ts — DOCX parsing via mammoth.
//
// mammoth converts to semantic HTML, which is the point: h1-h6, p, li and
// table survive, so block kinds come from the document's own structure rather
// than from guessing at text shape the way the PDF parser has to.
//
// A DOCX has no pages until it is rendered, so every block is page 1 and the
// document's pageNoun is 'page'. Inventing page breaks would put wrong numbers
// on citations.
// ============================================================================

import mammoth from 'mammoth';
import { flattenTable, type Segment } from './blocks';

/** Minimal HTML walk. mammoth's output is a known, small tag set — a full DOM
 *  parser would be a dependency for no gain. */
const TAG_RE = /<(h[1-6]|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const CELL_RE = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
const ROW_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTable(html: string): { columns: string[]; rows: string[][] } {
  const rows: string[][] = [];
  for (const rowMatch of html.matchAll(ROW_RE)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1]!.matchAll(CELL_RE)) cells.push(stripTags(cellMatch[1]!));
    if (cells.length > 0) rows.push(cells);
  }
  if (rows.length === 0) return { columns: [], rows: [] };
  // First row is the header only if it is followed by data rows of equal width.
  const [first, ...rest] = rows;
  const isHeader = rest.length > 0 && rest.every((r) => r.length === first!.length);
  return isHeader ? { columns: first!, rows: rest } : { columns: [], rows };
}

/**
 * Word's built-in "List Paragraph" style is what real bulleted lists are
 * written in, but mammoth only emits `<li>` when numbering.xml defines the
 * list. Without this map a document's bullets arrive as prose and lose the
 * structure that makes them individually citable.
 */
// Matched by both name and id: Word writes the style id `ListParagraph` with
// the display name "List Paragraph", and a document whose styles.xml is absent
// or minimal only carries the id.
const STYLE_MAP = [
  "p[style-name='List Paragraph'] => ul > li:fresh",
  "p[style-id='ListParagraph'] => ul > li:fresh",
];

export async function parseDocx(data: Uint8Array): Promise<{ segments: Segment[]; pages: number }> {
  const { value: html } = await mammoth.convertToHtml(
    { buffer: Buffer.from(data) },
    { styleMap: STYLE_MAP },
  );

  const segments: Segment[] = [];
  let currentSection: string | undefined;

  for (const match of html.matchAll(TAG_RE)) {
    const tag = match[1]!.toLowerCase();
    const inner = match[2]!;

    if (tag === 'table') {
      const { columns, rows } = parseTable(inner);
      if (rows.length === 0) continue;
      segments.push({
        kind: 'table',
        text: flattenTable(columns, rows),
        page: 1,
        ...(currentSection ? { section: currentSection } : {}),
        table: { columns, rows },
      });
      continue;
    }

    const text = stripTags(inner);
    if (!text) continue;

    if (tag.startsWith('h')) {
      currentSection = text;
      segments.push({ kind: 'heading', text, page: 1, section: text });
      continue;
    }

    segments.push({
      kind: tag === 'li' ? 'bullet' : 'paragraph',
      text,
      page: 1,
      ...(currentSection ? { section: currentSection } : {}),
    });
  }

  return { segments, pages: segments.length > 0 ? 1 : 0 };
}
