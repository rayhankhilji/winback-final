// ============================================================================
// src/lib/ingestion/model-parse.ts — the fallback parser.
//
// Gemini is the fallback, never the primary: deterministic parsers are faster,
// free, and produce stable block ids across re-runs. This path exists only for
// inputs no Node parser handles — PPTX, images, and PDFs whose text layer is
// empty because they are scans.
//
// The model returns segments, not blocks. Ids are still assigned by blocks.ts,
// so a model that invents an id cannot corrupt the citation namespace.
// ============================================================================

import { z } from 'zod';
import { generateJson } from '@/lib/pipeline/gemini';
import type { Segment } from './blocks';

const ModelSegmentSchema = z.object({
  kind: z.enum(['heading', 'paragraph', 'bullet', 'kv', 'table', 'clause']),
  text: z.string().min(1),
  page: z.number().int().min(1),
  section: z.string().optional(),
  table: z
    .object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) })
    .optional(),
});

const ModelParseSchema = z.object({
  pages: z.number().int().min(0),
  segments: z.array(ModelSegmentSchema),
});

/** Gemini's own responseSchema. Enforced by the API before we ever see it. */
const responseSchema = {
  type: 'object',
  properties: {
    pages: { type: 'integer' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['heading', 'paragraph', 'bullet', 'kv', 'table', 'clause'],
          },
          text: { type: 'string' },
          page: { type: 'integer' },
          section: { type: 'string' },
          table: {
            type: 'object',
            properties: {
              columns: { type: 'array', items: { type: 'string' } },
              rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
            },
            required: ['columns', 'rows'],
          },
        },
        required: ['kind', 'text', 'page'],
      },
    },
  },
  required: ['pages', 'segments'],
};

const SYSTEM_INSTRUCTION =
  'You transcribe a document into ordered, addressable segments for a diligence tool. You are a ' +
  'transcriber, not a summariser: every segment\'s text must be what the document actually says, ' +
  'verbatim where possible, because each one is cited back to this document and a reader will see ' +
  'it next to the original. Never invent a figure, a date, a party or a clause. Never merge two ' +
  'statements into one segment, and never split a sentence across two. If part of the document is ' +
  'illegible, omit it rather than guessing at it.';

const PROMPT = [
  'Transcribe this document into segments, in reading order.',
  '',
  'For each segment give:',
  '- kind: heading (a section title), paragraph (prose), bullet (a list item), kv (a label/value',
  '  pair such as "FY24 Revenue: $42.1m"), table (tabular data), or clause (a numbered contract',
  '  clause).',
  '- text: what the document says. Verbatim. For a table, a readable flattening of every cell.',
  '- page: the 1-indexed page or slide the segment appears on. Get this right — a citation with the',
  '  wrong page is worse than no citation.',
  '- section: the heading this segment sits under, if any.',
  '- table: for kind=table only, the columns and rows as arrays of strings.',
  '',
  'Also give `pages`: the total number of pages or slides in the document.',
  '',
  'Keep each segment to one idea, under 1000 characters. A whole page in one segment is wrong.',
].join('\n');

export interface ModelParseOutcome {
  segments: Segment[];
  pages: number;
  model: string;
}

/**
 * `purpose` is logged and, under MOCK_LLM, selects a golden fixture. It must
 * never contain document text — a filename is already more than we want in a
 * log line, so the caller passes an opaque id.
 */
export async function parseWithModel(
  data: Uint8Array,
  mimeType: string,
  purpose: string,
): Promise<ModelParseOutcome> {
  const { data: parsed, model } = await generateJson({
    purpose,
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: PROMPT,
    responseSchema,
    zodSchema: ModelParseSchema,
    files: [{ mimeType, data }],
    timeoutMs: 90_000, // a whole document is a much larger call than an extraction
  });

  const segments: Segment[] = parsed.segments.map((s) => ({
    kind: s.kind,
    text: s.text,
    page: s.page,
    ...(s.section ? { section: s.section } : {}),
    ...(s.table ? { table: s.table } : {}),
  }));

  // Trust the segments over the model's own page count: `pages` is a summary
  // field it has no reason to get right, and the segments are the evidence.
  const maxSegmentPage = segments.reduce((max, s) => Math.max(max, s.page), 0);

  return { segments, pages: Math.max(parsed.pages, maxSegmentPage), model };
}
