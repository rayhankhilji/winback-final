// ============================================================================
// src/lib/ingestion/sheet.ts — XLSX / XLS / CSV parsing via the `xlsx` package.
//
// Each sheet is a page, so a citation reads "row 14, Cap Table" rather than an
// opaque offset. A contiguous run of rows becomes one `kind: 'table'` block
// carrying `columns` and `rows`, which is what the evidence drawer needs to
// highlight a cell rather than a wall of text.
//
// Blank rows separate regions: a sheet with a header block, a gap, and a
// totals block yields two table blocks, not one with a hole in it.
// ============================================================================

import * as XLSX from 'xlsx';
import { flattenTable, type Segment } from './blocks';

/** A run of rows shorter than this is a stray note, not a table. */
const MIN_TABLE_ROWS = 2;

type Cell = string | number | boolean | null | undefined;

function cellText(value: Cell): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isBlankRow(row: Cell[]): boolean {
  return row.every((c) => cellText(c) === '');
}

/** Trim trailing empty columns so a ragged sheet does not produce ragged rows. */
function trimRow(row: Cell[], width: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < width; i += 1) out.push(cellText(row[i]));
  return out;
}

/**
 * A first row is a header when every one of its cells is non-empty and
 * non-numeric — a row of labels. Otherwise the region is all data and the
 * table carries no columns rather than mislabelling its first data row.
 */
function looksLikeHeader(row: string[]): boolean {
  if (row.length === 0) return false;
  return row.every((c) => c !== '' && !/^-?[\d,.$%()]+$/.test(c));
}

export function parseSheet(data: Uint8Array): { segments: Segment[]; pages: number } {
  const workbook = XLSX.read(data, { type: 'array' });
  const segments: Segment[] = [];

  workbook.SheetNames.forEach((sheetName, index) => {
    const page = index + 1;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const grid = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, blankrows: true, defval: '' });

    // The sheet name is a real, citable label — it is how a reader refers to
    // the page — so it leads the page as a heading.
    segments.push({ kind: 'heading', text: sheetName, page, section: sheetName });

    let region: Cell[][] = [];

    const flush = () => {
      if (region.length === 0) return;
      const width = region.reduce((w, r) => Math.max(w, r.length), 0);
      const rows = region.map((r) => trimRow(r, width));
      region = [];

      if (rows.length < MIN_TABLE_ROWS) {
        // One lone row is a note, not a table. Keep it as text so it stays
        // citable rather than dropping it.
        const text = rows[0]!.filter(Boolean).join(' | ');
        if (text) segments.push({ kind: 'kv', text, page, section: sheetName });
        return;
      }

      const header = looksLikeHeader(rows[0]!);
      const columns = header ? rows[0]! : [];
      const body = header ? rows.slice(1) : rows;
      if (body.length === 0) return;

      segments.push({
        kind: 'table',
        text: flattenTable(columns, body),
        page,
        section: sheetName,
        table: { columns, rows: body },
      });
    };

    for (const row of grid) {
      if (isBlankRow(row)) flush();
      else region.push(row);
    }
    flush();
  });

  return { segments, pages: workbook.SheetNames.length };
}
