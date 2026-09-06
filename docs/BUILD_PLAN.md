# Build Plan — Winback

**Owns:** the order to build in, and what "done" means for each stage.
**Never contains:** current progress (→ `CHECKLIST.md`). This file is the map; the checklist is the
pin showing where you are on it.

One agent works at a time. Each stage below is sized to be a single session. Do not start a stage
before its dependency is done and checked off. Do not work on two stages at once.

## Before every session

1. Read `CHECKLIST.md`. It tells you which stage you are on and what the last agent left behind.
2. Read the stage below.
3. Read only the docs that stage names.

## Before ending every session

Update `CHECKLIST.md`. This is not optional — it is the only thing carrying context to the next
agent. See the instructions at the top of that file.

---

## Stage 0 — Baseline (done)

The repo already contains: the full Gemini pipeline, contracts, evidence chip and drawer, Supabase
auth with RLS, orgs, invites, the onboarding wizard, the knowledge graph, and five working screens.
Verified at commit `6a903ba`. See `ARCHITECTURE.md`.

**Do not rebuild any of it.**

---

## Stage 1 — Open the document contract

Docs: `INGESTION.md` step 0.

The keystone. `SourceDocIdSchema` and `DocKindSchema` are closed enums of four literals, so an
uploaded file can never become a valid document, never be extracted, and never be cited. Nothing
downstream of this stage can work until it lands.

- Widen both schemas. Add `companyId`, `storagePath`, `mimeType`, `ingestedAt` to `SourceDocSchema`.
- Grep for every switch on `docKind` and add a default branch.
- **`TARGET_DOCS`, the golden fixtures, `MOCK_LLM=1` and `/graph?demo=1` must all still work.** If
  they break, something was widened that shouldn't have been.

**Done when:** `pnpm typecheck && pnpm test && pnpm build` pass and `MOCK_LLM=1 pnpm dev` runs the
full fixture pipeline end to end exactly as before.

---

## Stage 2 — Database

Docs: `DATA_MODEL.md`.

- Write and apply `0004_ingestion_and_runs.sql`: `documents`, `document_blocks`, `runs`, plus the two
  new `companies` columns.
- RLS on all three, using the existing `is_org_member` / `is_org_admin` helpers.
- Indexes as specified.

**Done when:** a member of org A cannot read org B's rows in any of the three tables, proven by a
test, and existing auth flows are unaffected.

---

## Stage 3 — Parsers

Docs: `INGESTION.md` steps 1–2.

- `pnpm add pdf-parse mammoth xlsx`.
- One module per format producing `Block[]` with namespaced ids `{documentId}-p{page}-b{n}`.
- Gemini fallback for PPTX, images, and PDFs with no text layer.
- The classify call: document kind, title, date label, section labels.
- Persist to `documents` and `document_blocks`.

**Done when:** a script can take a real PDF, DOCX and XLSX from disk and write correct, ordered,
addressable blocks to the database for each.

---

## Stage 4 — Ingest API and background job

Docs: `API.md`, `INGESTION.md` steps 3–4.

- `POST /api/ingest`, `GET /api/runs/[id]`.
- Background processing that updates `runs.stage` and `runs.stage_detail` as it goes.
- Rewire `/api/docs` and `/api/extract` to accept `companyId`, keeping the fixture path as a union
  member.
- The full failure matrix: unsupported type, no text layer, zero blocks, model timeout. **One bad
  file must never fail the whole run.**
- Budget caps against `RUN_BUDGET_MAX`.

**Done when:** `POST /api/ingest` on a real company returns a run id in under a second, and polling
the run shows stages advancing to `complete` with pipeline results stored.

### Verify here, not later

Do the crosscheck prompts fire on documents that are **not** the Kestrel fixtures? They are written
as procedures rather than answers, so they should transfer. If they do not, that is the real
project and every remaining screen is secondary. Record the result in `CHECKLIST.md`.

---

## Stage 5 — Upload and Processing screens

Docs: `SCREENS.md` 1–2, `DESIGN.md`.

- `/companies/new` — name, sector, drag-and-drop multi-file, per-file rows, picker-level rejection.
- `/runs/[id]` — polls every 1.5s, reuses the existing stage stepper, shows per-document status and
  elapsed time, routes to `/` with a sonner toast on completion.
- Point onboarding's upload step at `/companies/new` so there is one upload code path.

**Done when:** a user goes from empty state to a completed run without touching a fixture, and a
deliberately corrupt file shows as failed while the rest of the run completes.

---

## Stage 6 — Dashboard and portfolio

Docs: `SCREENS.md` 3–4, `API.md`, `DESIGN.md`.

- `GET /api/companies`.
- Dashboard: metric cards, recent activity, portfolio preview, Add company.
- `/companies` list with sector and status filters.

**Done when:** both screens render real data with all four states designed.

---

## Stage 7 — Company deep dive

Docs: `SCREENS.md` 5, `API.md`, `DESIGN.md`.

- `GET /api/companies/[id]`, `POST /api/companies/[id]/reanalyse`.
- Tabs: Overview, Financials, Documents, Findings, Memo.
- `pnpm add recharts`. There is no charting library in the repo today.
- Reuse `benchmark-panel`, `portfolio-panel`, `crosscheck-card`, `memo-card` — they exist and work.

**Done when:** every figure on the screen that came from a document carries a working evidence chip.

---

## Stage 8 — Document viewer on real documents

Docs: `SCREENS.md` 6, `API.md`.

- `GET /api/blocks/[blockId]` returning the block, its document, and ±10 neighbours.
- Point `evidence-drawer.tsx` at it. Do not build a second drawer.

**Done when:** clicking a citation anywhere in the product opens the user's own uploaded document at
the correct highlighted block, in under 300ms.

---

## Stage 9 — Polish and ship

- All four states on every view. Keyboard path through every interactive element.
- 1024px check. No console errors.
- Update `README.md`, including the fact that uploaded documents are now persisted — that reverses a
  stated principle in the current README and a reader will notice.
- Secret scan before anything is made public.

---

## Cut list, decided in advance

Cut from the bottom, in this order: knowledge-graph rewiring → derived spreadsheet export →
Financials charts → portfolio filters → Documents tab.

**Never cut:** Stage 1, PDF and DOCX parsing, Stages 4–5, the deep dive Overview and Findings tabs,
evidence resolution on uploaded documents, deploy.

## Fallback

If real ingestion is not stable by Stage 8, ship both paths. Uploads still create a company and a
document list; the demo runs the existing `/plan → /deal/[id]/decision` fixture flow, which works
today. Say plainly in the README which path is live. This is why those screens are not deleted.
