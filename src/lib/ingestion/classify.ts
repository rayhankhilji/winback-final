// ============================================================================
// src/lib/ingestion/classify.ts — one cheap Gemini call per document.
//
// Gives the deep dive a real title instead of `Q4_FINAL_v3(2).pdf`, a date
// label, and the docKind that routes the document into the right extraction
// prompt. It reads a sample of the parsed blocks, never the raw file — the
// bytes have already been parsed by this point, and re-sending them would cost
// a multiple of this call for no extra signal.
// ============================================================================

import { z } from 'zod';
import { generateJson } from '@/lib/pipeline/gemini';
import { DocKindSchema } from '@/lib/contracts/schemas';
import type { Block, DocKind } from '@/lib/contracts/types';

const PAGE_NOUNS = ['slide', 'page', 'row', 'grant'] as const;

const ClassificationSchema = z.object({
  docKind: DocKindSchema,
  title: z.string().min(1),
  dateLabel: z.string(),
  pageNoun: z.enum(PAGE_NOUNS),
});

export type DocClassification = z.infer<typeof ClassificationSchema>;

const responseSchema = {
  type: 'object',
  properties: {
    docKind: {
      type: 'string',
      enum: [
        'presentation', 'contract', 'financial_statement', 'cap_table',
        'report', 'spreadsheet', 'image', 'other',
      ],
    },
    title: { type: 'string' },
    dateLabel: { type: 'string' },
    pageNoun: { type: 'string', enum: [...PAGE_NOUNS] },
  },
  required: ['docKind', 'title', 'dateLabel', 'pageNoun'],
};

const SYSTEM_INSTRUCTION =
  'You label a business document for a diligence tool, from an excerpt of its text. You are literal: ' +
  'the title and date must come from the document itself, never from the filename and never ' +
  'invented. If the document states no date, say so rather than estimating one.';

/** Enough to classify, small enough to stay cheap. Front and back, because a
 *  date is usually on the cover and a total is usually at the end. */
function sample(blocks: Block[]): string {
  const HEAD = 25;
  const TAIL = 10;
  const chosen =
    blocks.length <= HEAD + TAIL ? blocks : [...blocks.slice(0, HEAD), ...blocks.slice(-TAIL)];
  return chosen
    .map((b) => `[p${b.page}] ${b.kind}: ${b.text.slice(0, 300)}`)
    .join('\n')
    .slice(0, 12_000);
}

/**
 * Deterministic fallback used when the classify call fails. Classification is
 * a convenience — a real title and a routing hint — and losing it must never
 * fail an otherwise good document, so this is the one place in ingestion where
 * a degraded result is correct rather than a swallowed error.
 */
export function fallbackClassification(filename: string, mimeType: string): DocClassification {
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return {
    docKind: kindFromMime(mimeType),
    title: stem || filename,
    dateLabel: '',
    pageNoun: mimeType.includes('presentation') ? 'slide' : 'page',
  };
}

function kindFromMime(mimeType: string): DocKind {
  if (mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) {
    return 'spreadsheet';
  }
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

export async function classifyDocument(
  blocks: Block[],
  filename: string,
  mimeType: string,
  purpose: string,
): Promise<DocClassification> {
  if (blocks.length === 0) throw new Error('classifyDocument: no blocks to classify');

  const prompt = [
    `Filename, as a weak hint only: ${filename}`,
    `MIME type: ${mimeType}`,
    '',
    'Document excerpt:',
    sample(blocks),
    '',
    'Give:',
    '- docKind: what kind of document this is.',
    '- title: the document\'s own title, as a person would refer to it. Not the filename.',
    '- dateLabel: the date the document states, as it states it (e.g. "March 2026", "FY24").',
    '  Empty string if it states none. Never estimate.',
    '- pageNoun: what one page of this document should be called — slide for a deck, row for a',
    '  spreadsheet, grant for a schedule of option grants, page otherwise.',
  ].join('\n');

  const { data } = await generateJson({
    purpose,
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    responseSchema,
    zodSchema: ClassificationSchema,
  });

  return data;
}
