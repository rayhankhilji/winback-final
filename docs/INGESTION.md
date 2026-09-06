# Ingestion — turning uploaded files into citable documents

The single highest-value thing left to build. Everything else is a screen; this is the engine that
makes the screens have something to show.

**Goal:** a user drops a mixed pile of PDFs, PowerPoints, Word docs, spreadsheets and screenshots,
and the existing pipeline runs against them with working evidence citations. No fixtures.

## Step 0 — Open the document contract

Do this before writing any parser. It is a contract change under `erd.md` Part 2 §11 and it touches
every downstream module, so it happens once, deliberately, in one commit.

```ts
// src/lib/contracts/schemas.ts

// WAS: z.enum(['mgmt-pres', 'contracts', 'cap-table', 'options'])
export const SourceDocIdSchema = z.string().min(1);

// WAS: z.enum(['management_presentation', 'customer_contracts', 'cap_table', 'option_grants'])
export const DocKindSchema = z.enum([
  'presentation', 'contract', 'financial_statement', 'cap_table',
  'report', 'spreadsheet', 'image', 'other',
]);

export const SourceDocSchema = SourceDocSchema.extend({
  companyId: z.string().uuid(),
  storagePath: z.string(),          // {orgId}/{companyId}/{filename}
  mimeType: z.string(),
  ingestedAt: z.string().datetime(),
});
```

`BlockSchema` does not change. Block ids stay strings, still stable, still permanent. Namespace them
per document — `{docId}-p3-b7` — exactly as `seed-sessions.ts` already does for the historical
fixtures. That pattern is proven in this codebase; copy it.

**Keep the fixtures working.** `TARGET_DOCS` keeps its four ids and simply becomes valid data under a
wider type. Golden fixtures, `MOCK_LLM=1`, and the demo path all survive unchanged. If any of them
break, you widened something you shouldn't have.

Anything that switches on `docKind` needs a default branch after this change. Grep for it.

## Step 1 — Parse

Add these. They are the boring, reliable choices; do not get creative under a clock.

```
pnpm add pdf-parse mammoth xlsx
```

| Input | Tool | Notes |
|---|---|---|
| PDF | `pdf-parse` | Text-layer only. Per-page text out, one block per paragraph. |
| DOCX | `mammoth` | Convert to HTML, then split on headings, paragraphs and list items. |
| XLSX / CSV | `xlsx` | Each sheet is a page. Each row region becomes a `kind: 'table'` block with `columns` and `rows`. |
| PPTX | Gemini | No good Node parser worth the time. Send the file to Gemini directly and ask for blocks. |
| Images / screenshots | Gemini vision | Same path as PPTX. |
| Scanned PDF (no text layer) | Gemini vision | Detect: `pdf-parse` returns under ~100 chars for a multi-page file. |

**Gemini is the fallback parser, not the primary one.** Deterministic parsers are faster, free, and
produce stable block ids across re-runs. Use the model only where no parser exists.

`GEMINI_API_KEY` is server-only. All parsing happens in a route handler or a job, never the browser.

## Step 2 — Block, classify, persist

```
file → parse to raw segments
     → blocks with namespaced ids       ({docId}-p{page}-b{n})
     → one Gemini call: classify docKind + title + dateLabel + section labels
     → SourceDoc
     → write to `documents` (metadata) and `document_blocks` (blocks) — see DATA_MODEL.md
```

The classify call is cheap and worth it: it gives the deep dive real document titles rather than
`Q4_FINAL_v3(2).pdf`, and it routes the document into the right extraction prompt.

Blocks are persisted, not held in memory. The evidence drawer must resolve a citation months later
without re-parsing. This is a deliberate change from the current design where documents are
rehydrated from static fixtures on every load.

**Note the shift in stance.** The README currently says "Documents are never persisted" as a
deliberate privacy tradeoff. Persisting user uploads reverses that. Say so explicitly in the README
and in the pitch rather than letting a judge catch the contradiction — RLS on the bucket and the
tables is your answer.

## Step 3 — Run the pipeline

`/api/extract` currently takes fixture docs. Change its input to a `companyId`, load that company's
`SourceDoc`s from the database, and pass them through. Extraction, benchmark, portfolio, crosscheck
and memo need no logic changes — they already operate on `SourceDoc[]`.

The crosscheck prompts are written as procedures, not answers, which means they should transfer to
arbitrary documents. Verify this early on a real upload. If they only fire on the Kestrel fixtures,
that is the thing to fix, not the screens.

## Step 4 — Make it a background job

`maxDuration = 60` will not cover parsing a 40-page PDF plus four parallel Gemini calls. Ingestion
cannot be a single request.

Simplest approach that works inside the clock:

1. `POST /api/ingest` writes a `runs` row with `status: 'queued'` and returns the run id immediately.
2. It kicks off processing without awaiting it, updating `runs.stage` as each phase completes.
3. Screen 2 polls `GET /api/runs/[id]` every 1.5s and animates against the returned stage.
4. On `status: 'complete'`, the client routes to the dashboard and fires the sonner toast.

Polling, not websockets. The stage field is the same four-stage shape the existing stepper renders,
so Screen 2 reuses the component that already exists.

Set a per-document cap and a per-run cap. `RUN_BUDGET_MAX` defaults to 500 calls, which a few real
uploads will burn through faster than you expect.

## Failure handling

Every one of these is likely on demo day, so design them now rather than discovering them live:

- Unsupported file type → reject at the picker with a named reason. Do not upload then fail.
- PDF with no text layer → route to vision. Never return an empty document silently.
- Parse succeeds, zero blocks → mark the document `failed` with a reason, keep the rest of the run.
- Gemini timeout → retry once, then mark that document failed and continue. **One bad file must
  never fail the whole run.**
- Every failure surfaces on Screen 2 and on the company deep dive as a named document with a status,
  never as a missing row.

## Done when

A stranger uploads three real files they made themselves, watches Screen 2, lands on the dashboard
with a toast, opens the company, sees an extracted profile, and clicks a citation that opens the
drawer on the correct block of *their own* document.
