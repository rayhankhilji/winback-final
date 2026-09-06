// ============================================================================
// Parser tests. Real PDF, DOCX and XLSX bytes, generated in memory — these
// exercise pdf-parse, mammoth and xlsx themselves, not stand-ins for them.
//
// The classify and vision paths are Gemini calls and are covered by the block
// contract tests below plus the Stage 4 fixture path, not mocked here: a mock
// would only prove the mock agrees with itself.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { BlockSchema } from '@/lib/contracts/schemas';
import { MAX_BLOCK_CHARS, toBlocks, pageCount, type Segment } from '../blocks';
import { MIN_CHARS_PER_PAGE, parsePdf } from '../pdf';
import { parseDocx } from '../docx';
import { parseSheet } from '../sheet';
import { resolveMimeType, strategyFor, UnsupportedFileTypeError } from '../index';
import { makeDocx, makePdf, makeTextlessPdf, makeXlsx } from './make-fixtures';

const DOC_ID = '11111111-2222-3333-4444-555555555555';

describe('block ids and ordering', () => {
  it('namespaces ids as {documentId}-p{page}-b{n}, restarting n per page', () => {
    const segments: Segment[] = [
      { kind: 'heading', text: 'One', page: 1 },
      { kind: 'paragraph', text: 'Two', page: 1 },
      { kind: 'paragraph', text: 'Three', page: 2 },
    ];
    const blocks = toBlocks(DOC_ID, segments);
    expect(blocks.map((b) => b.id)).toEqual([
      `${DOC_ID}-p1-b1`,
      `${DOC_ID}-p1-b2`,
      `${DOC_ID}-p2-b1`,
    ]);
  });

  it('produces blocks that satisfy the contract', () => {
    const blocks = toBlocks(DOC_ID, [{ kind: 'kv', text: 'FY24 Revenue: $45.8m', page: 1 }]);
    for (const b of blocks) expect(() => BlockSchema.parse(b)).not.toThrow();
  });

  it('is deterministic — the same input yields the same ids', () => {
    const segments: Segment[] = [
      { kind: 'paragraph', text: 'Stable', page: 1 },
      { kind: 'paragraph', text: 'Also stable', page: 1 },
    ];
    expect(toBlocks(DOC_ID, segments)).toEqual(toBlocks(DOC_ID, segments));
  });

  it('drops empty segments rather than minting unaddressable blocks', () => {
    const blocks = toBlocks(DOC_ID, [
      { kind: 'paragraph', text: '   ', page: 1 },
      { kind: 'paragraph', text: 'Real', page: 1 },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.id).toBe(`${DOC_ID}-p1-b1`);
  });

  it('splits an over-long segment on sentence boundaries, keeping text verbatim', () => {
    const sentence = `${'x'.repeat(200)}. `;
    const long = sentence.repeat(12).trim(); // ~2400 chars
    const blocks = toBlocks(DOC_ID, [{ kind: 'paragraph', text: long, page: 1 }]);

    expect(blocks.length).toBeGreaterThan(1);
    for (const b of blocks) expect(b.text.length).toBeLessThanOrEqual(MAX_BLOCK_CHARS);
    // Every word survives the split — quote verification is a substring check,
    // so a parser that reworded text would silently break every citation.
    expect(blocks.map((b) => b.text).join(' ').replace(/\s+/g, '')).toBe(long.replace(/\s+/g, ''));
  });

  it('never splits a table block away from its structured payload', () => {
    const table = { columns: ['A', 'B'], rows: [['1', '2']] };
    const blocks = toBlocks(DOC_ID, [
      { kind: 'table', text: 'x'.repeat(3_000), page: 1, table },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.table).toEqual(table);
  });

  it('refuses to build blocks without a document id', () => {
    expect(() => toBlocks('', [{ kind: 'paragraph', text: 'x', page: 1 }])).toThrow(/documentId/);
  });

  it('reports the highest page as the page count', () => {
    const blocks = toBlocks(DOC_ID, [
      { kind: 'paragraph', text: 'a', page: 1 },
      { kind: 'paragraph', text: 'b', page: 4 },
    ]);
    expect(pageCount(blocks)).toBe(4);
  });
});

describe('PDF parser', () => {
  it('reads a real text-layer PDF, one block per paragraph, with correct pages', async () => {
    // Enough text per page to clear MIN_CHARS_PER_PAGE — a page this sparse
    // would legitimately be treated as a scan.
    const pdf = makePdf([
      [
        'Management Presentation',
        'FY24 Revenue: $45.8m',
        'Recurring revenue is 80% of the total.',
        'The business operates outpatient diagnostic imaging clinics across the Carolinas.',
        'Growth came from same-site volume gains and selective tuck-in acquisitions.',
      ],
      [
        'Customer Concentration',
        'The top five customers are 61% of revenue.',
        'Contracts are typically three years with automatic annual renewal thereafter.',
        'Management considers the renewal profile to be stable across the portfolio.',
      ],
    ]);
    const { segments, pages, needsVisionFallback } = await parsePdf(pdf);

    expect(pages).toBe(2);
    expect(needsVisionFallback).toBe(false);

    const text = segments.map((s) => s.text).join('\n');
    expect(text).toContain('FY24 Revenue: $45.8m');
    expect(text).toContain('top five customers are 61%');

    // Pages must come from the parser, not be inferred — a citation with the
    // wrong page is worse than no citation.
    const p2 = segments.filter((s) => s.page === 2).map((s) => s.text).join(' ');
    expect(p2).toContain('Customer Concentration');
    expect(p2).not.toContain('45.8');
  });

  it('classifies a label/value line as kv and a bare title as a heading', async () => {
    const pdf = makePdf([['Revenue Quality', 'FY24 Revenue: $45.8m']]);
    const { segments } = await parsePdf(pdf);
    const byText = Object.fromEntries(segments.map((s) => [s.text, s.kind]));
    expect(byText['Revenue Quality']).toBe('heading');
    expect(byText['FY24 Revenue: $45.8m']).toBe('kv');
  });

  it('carries the current heading down as the section label', async () => {
    const pdf = makePdf([['Revenue Quality', 'Recurring revenue is 80% of the total.']]);
    const { segments } = await parsePdf(pdf);
    const body = segments.find((s) => s.text.startsWith('Recurring'));
    expect(body?.section).toBe('Revenue Quality');
  });

  it('flags a PDF with no text layer for the vision fallback', async () => {
    const { segments, pages, needsVisionFallback, charsPerPage } = await parsePdf(makeTextlessPdf(3));
    expect(pages).toBe(3);
    expect(segments).toHaveLength(0);
    expect(charsPerPage).toBeLessThan(MIN_CHARS_PER_PAGE);
    expect(needsVisionFallback).toBe(true);
  });
});

describe('DOCX parser', () => {
  it('takes block kinds from the document structure, not from guesswork', async () => {
    const docx = await makeDocx([
      { kind: 'heading', text: 'Termination Provisions' },
      { kind: 'paragraph', text: 'Either party may terminate for convenience on 30 days notice.' },
      { kind: 'bullet', text: 'Automatic annual renewal.' },
    ]);
    const { segments } = await parseDocx(docx);
    const kinds = Object.fromEntries(segments.map((s) => [s.text, s.kind]));

    expect(kinds['Termination Provisions']).toBe('heading');
    expect(kinds['Either party may terminate for convenience on 30 days notice.']).toBe('paragraph');
    expect(kinds['Automatic annual renewal.']).toBe('bullet');
  });

  it('extracts a table with its columns and rows', async () => {
    const docx = await makeDocx([
      { kind: 'table', rows: [['Customer', 'Revenue'], ['Northgate', '$8.2m'], ['Ridgeline', '$5.1m']] },
    ]);
    const { segments } = await parseDocx(docx);
    const table = segments.find((s) => s.kind === 'table');

    expect(table?.table?.columns).toEqual(['Customer', 'Revenue']);
    expect(table?.table?.rows).toEqual([['Northgate', '$8.2m'], ['Ridgeline', '$5.1m']]);
    // The flattened text must still contain every cell, or a quote drawn from
    // the table cannot be verified against the block.
    expect(table?.text).toContain('Northgate');
    expect(table?.text).toContain('$5.1m');
  });

  it('puts every block on page 1, because a DOCX has no pages until rendered', async () => {
    const docx = await makeDocx([
      { kind: 'heading', text: 'A' },
      { kind: 'paragraph', text: 'B' },
    ]);
    const { segments, pages } = await parseDocx(docx);
    expect(pages).toBe(1);
    expect(segments.every((s) => s.page === 1)).toBe(true);
  });
});

describe('spreadsheet parser', () => {
  it('makes each sheet a page and each row region a table block', () => {
    const xlsx = makeXlsx({
      'Cap Table': [
        ['Holder', 'Shares', 'Pct'],
        ['Founders', 4_200_000, '53.5%'],
        ['Series A', 2_100_000, '26.8%'],
      ],
      Options: [
        ['Grantee', 'Options'],
        ['A. Okonkwo', 45_000],
      ],
    });
    const { segments, pages } = parseSheet(xlsx);
    expect(pages).toBe(2);

    const capTable = segments.find((s) => s.kind === 'table' && s.page === 1);
    expect(capTable?.table?.columns).toEqual(['Holder', 'Shares', 'Pct']);
    expect(capTable?.table?.rows).toHaveLength(2);
    expect(capTable?.section).toBe('Cap Table');

    const options = segments.find((s) => s.kind === 'table' && s.page === 2);
    expect(options?.table?.columns).toEqual(['Grantee', 'Options']);
    expect(options?.section).toBe('Options');
  });

  it('splits regions on blank rows instead of producing one table with a hole', () => {
    const xlsx = makeXlsx({
      Sheet1: [
        ['Holder', 'Shares'],
        ['Founders', 4_200_000],
        [],
        ['Note', 'Excludes unissued options'],
        ['Basis', 'Fully diluted'],
      ],
    });
    const { segments } = parseSheet(xlsx);
    const tables = segments.filter((s) => s.kind === 'table');
    expect(tables.length).toBeGreaterThanOrEqual(2);
    expect(tables[0]!.table?.rows).toEqual([['Founders', '4200000']]);
  });

  it('leads each page with the sheet name as a citable heading', () => {
    const { segments } = parseSheet(makeXlsx({ 'Option Grants': [['a', 'b'], ['1', '2']] }));
    expect(segments[0]).toMatchObject({ kind: 'heading', text: 'Option Grants', page: 1 });
  });

  it('does not mistake a numeric first row for a header', () => {
    const { segments } = parseSheet(makeXlsx({ S: [['1', '2'], ['3', '4']] }));
    const table = segments.find((s) => s.kind === 'table');
    expect(table?.table?.columns).toEqual([]);
    expect(table?.table?.rows).toHaveLength(2);
  });
});

describe('format routing', () => {
  it('routes each format to the right strategy', () => {
    expect(strategyFor('application/pdf')).toBe('pdf');
    expect(strategyFor('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx');
    expect(strategyFor('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('sheet');
    expect(strategyFor('text/csv')).toBe('sheet');
    // No Node PPTX parser is worth the time, and an image has no text layer at
    // all: both go to Gemini.
    expect(strategyFor('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('model');
    expect(strategyFor('image/png')).toBe('model');
  });

  it('throws on a type it cannot parse rather than guessing', () => {
    expect(() => strategyFor('application/zip')).toThrow(UnsupportedFileTypeError);
  });

  it('falls back to the extension when the browser sends octet-stream', () => {
    expect(resolveMimeType('deck.pptx', 'application/octet-stream')).toContain('presentationml');
    expect(resolveMimeType('model.xlsx')).toContain('spreadsheetml');
    // A declared, specific type is trusted over the extension.
    expect(resolveMimeType('report.pdf', 'application/pdf')).toBe('application/pdf');
  });
});
