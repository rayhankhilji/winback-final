# CHECKLIST — live build state

> **This is the only file in the repo that you are expected to edit every session.**
> It carries context from one agent to the next. Everything else is a spec; this is the pin on the
> map. If you change nothing else, change this.

## How to use it

**At the start of a session:** read this file top to bottom before anything else. It tells you which
stage you are on, what the last agent assumed, what they deviated from, and what is blocked.

**At the end of a session, always:**
1. Tick what you finished. Do not tick anything partially done — mark it `~` and say what remains.
2. Update **Current state** to point at the next thing.
3. Add every assumption you made to the **Assumptions** table. If you guessed, say you guessed.
4. Add anything you did differently from the docs to **Redirections**, with the reason.
5. Add anything you could not resolve to **Open questions**.
6. Add one **Session log** entry. Three lines is enough.

**Rules for editing this file:**
- Append, don't rewrite. History is the point. Strike through obsolete lines rather than deleting.
- Be specific. "Fixed some stuff in the pipeline" is useless. "Widened `DocKindSchema`; 3 switches in
  `extraction.ts` needed default branches" is useful.
- If you disagree with a doc, say so here and follow the doc anyway, unless it is factually wrong
  about the codebase — in which case fix the doc and record it under Redirections.
- Never delete an assumption because it turned out wrong. Mark it wrong and say what replaced it.

---

## Current state

**Stage:** 9 — Polish and ship
**Status:** code-complete pending live verification. Stages 2–8 are written and static-regressed, but no path has touched a live database or model.
**Last session:** 2026-09-06 — Stage 9 README, onboarding, secret scan.
**Next action:** add real Supabase and Gemini credentials, then run the prescribed unblocking sequence in `HANDOVER.md` before claiming the build is shipped.
**Blocked by:** no database and no Gemini key reachable from this machine (Q6/Q9/Q13). All new
database code is written and typechecked, not executed.

---

## Stages

Full definitions in `docs/BUILD_PLAN.md`. Mark `[x]` done, `[~]` partial, `[ ]` not started.

- [x] **0 — Baseline.** Pipeline, contracts, evidence drawer, Supabase auth, orgs, invites,
      onboarding, knowledge graph, five screens. Verified at commit `6a903ba`. Do not rebuild.
- [x] **1 — Open the document contract.** Keystone. Nothing works until this lands. Landed 2026-09-06.
- [~] **2 — Database.** Migration `0004`: documents, document_blocks, runs, RLS. Written and
      reviewed; **not applied and not executed** — no Postgres on this machine (no Docker, no local
      server). The RLS proof test is written and skips itself until a database exists. See Q9.
- [~] **3 — Parsers.** pdf-parse, mammoth, xlsx, Gemini fallback, block persistence. Parsers done and
      proven on real files; the persistence half is written but unrun for want of a database (Q9).
- [~] **4 — Ingest API + background job.** `/api/ingest`, `/api/runs/[id]`, failure matrix. Routes,
      job and budget caps written; **the A1 verification is done and it was a real bug** (see R13).
      Nothing has run against a database or a live model (Q9/Q11/Q13).
- [~] **5 — Upload and Processing screens.** Both built (`/companies/new`, `/runs/[id]`). Neither has
      completed a real run — no database, no model key (Q9/Q11/Q13). Onboarding still carries its own
      upload path (Q16).
- [~] **6 — Dashboard and portfolio list.** Typed `GET /api/companies`, dashboard, portfolio list,
      filters, empty/loading/error states, and sidebar links are written. None has read a real row.
- [~] **7 — Company deep dive.** Typed heavy read, five-tab screen, evidence chips, Recharts revenue
      trajectory, and persisted-document reanalysis route are written. No real result has rendered.
- [~] **8 — Document viewer on real documents.** `GET /api/blocks/[blockId]` returns a block and ±10
      neighbours under RLS; the existing drawer falls back to it when a citation is not in fixture docs.
      No live block has been resolved yet.
- [~] **9 — Polish, README, secret scan, ship.** README now describes persisted documents; onboarding routes to the single `/companies/new` path; secret scan is clean. Live QA, 1024px/browser keyboard checks, and the credential unblocking sequence remain.

---

## Assumptions

Everything believed but not verified. The next agent should trust these but is free to disprove one
and say so.

| # | Assumption | Made in | Confidence | Verified? |
|---|---|---|---|---|
| A1 | The crosscheck prompts are written as procedures, not answers, so they will fire on arbitrary uploaded documents rather than only the Kestrel fixtures. | Stage 0 review | medium | **Partly — arbitrary UUID extraction now works live with zero dropped citations; multi-document live crosschecks still unverified.** |
| A2 | Widening the two doc-kind enums does not break `MOCK_LLM=1`, the golden fixtures, or `/graph?demo=1`, because fixtures become valid data under a wider type. | Stage 1 plan | high | No |
| A3 | Parsing a large PDF plus parallel Gemini calls exceeds `maxDuration = 60`, which is why ingestion is a background job. | Stage 0 review | high | No |
| A4 | `RUN_BUDGET_MAX = 500` is too low once documents are real rather than four fixtures. | Stage 0 review | medium | No |
| A5 | Storing `ExtractionResult` and friends as validated `jsonb` is correct; normalising them into relational tables buys nothing. | Data model | high | n/a — judgement |
| A15 | The three cubes of the mark tile edge-to-edge with no overlap, so the logo needs no fill and works on any background. | Brand | high | Yes — computed from the brand animation's own path data and checked rendered at 460px against `LOGO.png`. |
| A16 | Rebuilding the supplied Lottie references as SVG + CSS is the right call rather than shipping them. Reasons in `design/reference/README.md`: the integration reference carries another company's branding, Lottie colour is baked hex where CLAUDE.md wants tokens, a Lottie cannot answer `prefers-reduced-motion`, and the player is ~250KB. | Brand | medium — **judgement, and the user supplied those files expecting them to be used** | n/a — flag it if the user wants the originals shipped instead. |
| A12 | The block-id scheme `{documentId}-p{page}-b{n}`, with n restarting per page, is stable across re-parses of the same bytes. Verified by test for determinism, but it is only stable if the parser is: a pdf-parse upgrade that changes paragraph splitting would renumber every block after the change and break existing citations. | Stage 3 | medium | Partly — determinism tested, version-stability not. **Pin the parser versions before any citation is stored for real.** |
| A13 | Gemini vision produces usable blocks for PPTX and images (this is A6, now load-bearing). The fallback path is written and typechecks but has never run — it needs a real `GEMINI_API_KEY`, and there is no golden fixture for `parse:*` so `MOCK_LLM=1` cannot exercise it either. | Stage 3 | medium — **unverified** | **No. The entire PPTX and image path is unexecuted code.** |
| A14 | Losing the classify call should degrade, not fail. A document that parsed correctly is kept with a filename-derived title and a MIME-derived kind rather than discarded. This is a deliberate exception to "no fallbacks just in case" — classification is a convenience, not a precondition, and the caller is told via `classified: false`. | Stage 3 | high | n/a — judgement |
| A10 | Migration `0004` is syntactically valid Postgres and applies cleanly on top of `0003`. **Reviewed by eye only — never executed.** No Docker, no local Postgres, no reachable Supabase project, so `supabase db lint` and `supabase start` were both unavailable. | Stage 2 | medium — **unverified** | **No. This is the weakest claim in the build. Apply it before building anything on top of it.** |
| A11 | `companies.latest_run_id` is deliberately not a foreign key to `runs`. The reference is circular — a run points at its company — and a FK would force an insert-ordering dance on every new run for no integrity gain. | Stage 2 | high | n/a — judgement |
| A8 | Remapping the four fixture `kind` values is behaviourally inert. Verified: nothing in `src/` switches on `docKind` — no switch statement, no `Record<DocKind, …>`, no UI label map. It is passed through `extraction.ts:341` into `DocClassification` and displayed as a string. | Stage 1 | high | Yes — grepped, and the full fixture pipeline reruns identically. |
| A9 | `option_grants` maps to `cap_table` in the new vocabulary. Guessed. Both are equity documents and the new enum has no grant-schedule literal; `report`/`spreadsheet`/`other` all fit worse. Consequence: `cap-table` and `options` now report the same `docKind`. Nothing reads it, so nothing breaks, but the classification display is less specific than it was. | Stage 1 | medium — **guessed** | No — revisit if a screen ever surfaces `docKind` to the user. |
| A7 | The `/onboarding` prerender crash on a bare `pnpm build` is purely missing Supabase env, not inherited breakage — it disappeared entirely once placeholder values were present. | Setup | high | Partly — build goes green with placeholders; not retested with real keys. |
| A6 | Gemini vision handles PPTX and screenshots well enough to produce usable blocks, since no good Node PPTX parser is worth the time. | Ingestion design | medium | No |
| A17 | A company’s `latest_run_id` always references a row visible under the same org RLS policy, so the portfolio summary can read the run set once and map it in memory. | Stage 6 | high | No — follows the migration shape but has not run against Postgres. |

---

## Redirections

Deviations from the written docs, and why. Empty is fine at the start.

| # | Doc says | We did | Why |
|---|---|---|---|
| R1 | `erd.md` specifies Firebase Auth and Firestore | The build uses Supabase | Already done before these docs were written. `erd.md` is stale here; `ARCHITECTURE.md` is correct. |
| R2 | `erd.md` README says documents are never persisted | We persist uploaded documents and their blocks | The deep dive and the document viewer cannot work otherwise. Protected by RLS. Must be corrected in `README.md` at Stage 9. |
| R3 | The supplied colour doc specifies an editorial direction — sand-dune ground, coffee-bean bands, 0px corners | `DESIGN.md` keeps the palette and the pink-means-AI rule, rejects the editorial framing | The product is an agentic workflow tool, not a publication. |
| R4 | Normal practice is to build in the original repo | We build in a full-history clone; `rochak779/Winback-1` is the `upstream` remote | Nobody was awake to grant access at 3am. Histories share a root, so merging either direction is a normal merge. **Do not rewrite history** — it is what keeps that true. |

| R5 | `SETUP.md` verifies the baseline with a bare `pnpm install` | Used `corepack pnpm` throughout | `package.json` pins `pnpm@11.22.0`; the machine's global pnpm is 9.15.9, which rejects this repo's `pnpm-workspace.yaml` (no `packages:` key) with "packages field missing or empty". `corepack pnpm` runs the pinned 11.22.0 and installs clean. |

| R6 | `INGESTION.md` step 0 says the fixtures "survive unchanged" while prescribing an enum that drops three of their four `kind` values (`management_presentation`, `customer_contracts`, `option_grants`) | Implemented the prescribed eight-value enum and remapped the four fixture kinds | The doc contradicts itself; something had to give. Kept the docs' vocabulary rather than a superset enum carrying both old and new literals, because a superset means two ways to say "presentation" and violates *one way to do a thing*. The remap is 6 lines across 4 files and provably inert (A8). **`docs/INGESTION.md` is factually wrong on this point and should be corrected to say the fixture kinds are remapped.** |
| R7 | `INGESTION.md` types `ingestedAt` as `z.string().datetime()` and the four new `SourceDoc` fields as required | Used `IsoSchema` and made all four `.optional()` | Optional per the Stage 1 prompt, so the hand-authored fixtures stay valid without carrying storage or tenancy fields. `IsoSchema` is what every other timestamp in `schemas.ts` uses — introducing a second timestamp type here would be a new pattern for a solved problem. Stage 3 populates the fields. |

| R8 | `DATA_MODEL.md` specifies the three tables and their indexes but no RPC for blocks | Also added `insert_document_blocks(uuid, jsonb)` | The same doc's conventions say "multi-row creates go through an RPC so they are atomic", and blocks are the multi-row create — a half-written document is one whose citations dangle. `SECURITY INVOKER`, so the RLS policies still apply; it exists for atomicity, not to escape authorisation. It takes a serialised `Block[]` in the contract's own field names and derives `ordinal` from array position, so parse order cannot silently disagree with stored order. |
| R9 | `DATA_MODEL.md` gives `runs` an `updated_at` with `default now()` and no trigger | Added a `set_updated_at()` trigger | A default only fires on insert. `runs` is the first mutable row in this schema and the processing screen polls `updated_at`; without a trigger it would be frozen at creation time and every poll would look stale. First trigger in the schema, `search_path` pinned like every other function. |

| R10 | `INGESTION.md` step 1 lists the parser dependencies only | Also added `jszip` as a **devDependency** | Test fixtures are real PDF, DOCX and XLSX bytes generated in memory rather than binary blobs committed to the repo. A DOCX is a zip and there was no zip writer in the tree that was not a transitive dependency of mammoth; depending on another package's transitive dep silently is worse than declaring it. Test-only — nothing in `src/` imports it. |
| R11 | Nothing in the docs says the Gemini surface takes file bytes | Extended `generateJson` with an optional `files` parameter | The fallback parser has to send PPTX and image bytes to Gemini, and `CLAUDE.md` forbids any file but `gemini.ts` importing `@google/genai`. Adding the parameter there was the only option that respects the rule. Text-only calls are byte-identical to before: the prompt string is still passed straight through when `files` is absent. |
| R12 | `INGESTION.md` step 1 says mammoth converts to HTML and to split on headings, paragraphs and list items | Added a mammoth `styleMap` for Word's "List Paragraph" style | Without it mammoth only emits `<li>` when `numbering.xml` defines the list, so real Word bullets arrive as prose and lose the structure that makes them individually citable. Found because the DOCX fixture test failed, not by reading ahead. |

| R13 | `BUILD_PLAN.md` Stage 4 asks whether the crosscheck prompts fire on non-Kestrel documents, expecting a yes | **They could not fire at all.** Every `CrosscheckDef` selected its inputs by hardcoded fixture id (`docIds: ['mgmt-pres', 'contracts']`), so an uploaded document with a uuid matched nothing and `runDecision` ran zero crosschecks | The procedures were general; their *inputs* were not, which is why the doc's optimism was half right. Replaced `docIds` with `docKinds`, added `defIsSatisfiable` so a comparison never runs with one side missing, and capped selection at 8 documents. The Kestrel fixtures still fire — the Stage 1 kind remap is what lets one selector match both. **A1 is not yet answered: whether the model's *answers* transfer still needs a real key (Q13).** |
| R14 | `DESIGN.md` says long waits use a determinate stepper and that nothing animates decoratively; the user asked for an orbiting-logo loading animation | Built `IngestionOrbit` as a determinate orbit | Rather than choose between them: the ring is driven by how many documents have actually settled, each node carries its own document's real status, and a connector pulses only while that document is being parsed. It is the animation the user asked for and it carries information, so it is not decoration and not an indefinite spinner. |
| R16 | `SCREENS.md` 2 says to reuse the existing four-stage stepper in `src/components/app-shell/` and not build a second one | Built `src/components/ingest/stage-stepper.tsx` | There is no stepper in `app-shell/` — the doc is wrong about the codebase. Built once, in the place the instruction should now point at. **`SCREENS.md` needs correcting.** |
| R17 | The supplied orbit animation was to be rebuilt natively (R14/A16) | Also ship the original SVG with only its gear cluster swapped for the Winback mark, at `/anim/orbit-winback.svg` | The user twice asked for their own assets, and they were right that the rebuild threw away the orbiting product marks that made the reference good. The SVG animates via SMIL with no player, so it costs one cached request and no JavaScript. `scripts/build-orbit-svg.ts` (`pnpm build:orbit`) regenerates it and throws if the reference no longer matches, rather than silently keeping the gears. The native `IngestionOrbit` stays for the data-driven per-document view. |
| R15 | Nothing in the docs covers a settings area | Added `/settings` with its own grouped nav and `/settings/integrations` | Requested directly, with a reference design. The switches have no OAuth backend and the page says so on its face rather than implying a connection it cannot make. |
| R18 | `SCREENS.md` 7–11 says onboarding should link to `/companies/new`, but the implementation carried a separate storage upload form | Removed the duplicate form and now route the final onboarding step to `/companies/new` | One upload path is a correctness constraint: the unified screen applies picker validation, creates the run, and reports processing progress; onboarding's old path only wrote storage objects. |
| R19 | `DESIGN.md` says to use one sans-serif face and leads with a restrained sand palette | The user redirected the live product toward layered white/pearl surfaces, an editorial serif reserved for display headings, and bright bounded cobalt/coral/mint/violet ambience with dither texture | The UI needs a clearer premium visual hierarchy. Semantic rules remain: pink continues to mean AI-generated content only, and data remains legible on neutral surfaces. |

---

## Open questions

Things nobody has resolved. Add to this rather than guessing silently.

| # | Question | Blocks | Raised |
|---|---|---|---|
| Q1 | What is the actual Vercel plan ceiling for `maxDuration`? | Stage 4 sizing | Stage 0 |
| Q2 | Is there a per-file size cap we should enforce at upload? | Stage 5 | Stage 0 |
| Q3 | When a company is re-analysed, do old runs stay queryable or does `latest_run_id` make them dead weight? | Stage 7 | Stage 0 |
| Q4 | Which repo is canonical once the team is awake — do we merge our branches into upstream, or does upstream merge from us? | Nothing today; matters before the demo | Setup |
| ~~Q5~~ | ~~Does the open PR on upstream touch `src/lib/contracts/`? If so it collides with Stage 1.~~ **Answered in Setup: upstream PR #3 (`feature/phase-5-ship`, 36 files) touches no file under `src/lib/contracts/`. No collision with Stage 1.** | Stage 1 | Setup |
| Q16 | Onboarding still carries its own upload implementation. `SCREENS.md` 7-11 says it should link to `/companies/new` so there is one upload code path. Not done — onboarding is working Stage 0 code and rewiring it blind, with no way to test the flow, risks breaking the only auth path that exists. | Stage 9 tidy-up | Stage 5 |
| Q13 | **The A1 question is still open.** Stage 4 fixed the mechanical blocker — crosschecks now *select* uploaded documents — but whether the procedures produce good findings on documents that are not Kestrel needs a real `GEMINI_API_KEY` and real documents. Everything else in the roadmap is secondary to this. | The whole product thesis | Stage 4 |
| Q14 | Should the supplied Lottie files ship as-is instead of the SVG rebuilds (A16)? The rebuild is smaller, tokenised and reduced-motion-aware, but it is not pixel-identical to what the user chose. | Brand sign-off | Stage 4 |
| Q15 | `NEXT_PUBLIC_LOGOKIT_TOKEN` is unset, so `/settings/integrations` renders monogram tiles rather than real logos. A free LogoKit key turns them on with no code change. | Cosmetic only | Stage 4 |
| Q11 | Nothing in Stage 3 wrote a row. `persistDocument`, `loadDocument` and the `--dry-run`-less half of `scripts/ingest-file.ts` are unexecuted for the same reason as Q9. Stage 3's "done when" is "write correct, ordered, addressable blocks **to the database**" — the parse half is proven on real files, the write half is not. | Stage 4 stores pipeline results in the same tables | Stage 3 |
| Q12 | Should the parser dependency versions be pinned exactly? Block ids are permanent, and a minor `pdf-parse` release that changes paragraph splitting would renumber blocks and dangle every stored citation (A12). Currently caret ranges. | Any real stored citation | Stage 3 |
| Q9 | Migration `0004` has never been executed. There is no Postgres on this machine — no Docker for `supabase start`, no local server, no reachable project — so the SQL is reviewed but unrun, and Stage 2's "done when" (org A cannot read org B's rows, **proven by a test**) is unproven. The test exists at `src/lib/__tests__/rls.integration.test.ts` and skips itself with a visible marker rather than passing vacuously. | Everything from Stage 3 on rests on this schema | Stage 2 |
| Q10 | `BlockSchema` carries a `deprecated?: boolean` — the documented way to retire a block after Hour 6 without breaking a citation — but `DATA_MODEL.md` gives `document_blocks` no column for it. A deprecated block cannot currently be persisted as deprecated. Either the column is missing from the data model or the field is dead in the contract. | Stage 8 — document viewer | Stage 2 |
| ~~Q7~~ | ~~`mergeSlices` reads four fixture IDs and drops uploaded slices.~~ **Answered in Stage 6: it now merges every successful slice by `doc.kind`, using deterministic authority order and de-duplication. The behaviour is typechecked/test-suite-regressed but has not run on a live model.** | ~~Stage 3~~ | Stage 1 / Stage 6 |
| ~~Q8~~ | ~~Crosscheck input selectors and option quantification are fixture-shaped.~~ **Partly answered in Stage 4 (R13): crosscheck selectors now use `docKinds`. The model-quality question remains Q13; `quantify.ts` still needs a real non-fixture run to establish whether any option-grant evidence carries the correct open document id.** | ~~Stage 4 mechanical blocker~~ | Stage 1 / Stage 4 |
| Q6 | Which Supabase project do we point at? The build needs real `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` before any page past `/sign-in` can be opened, including the fixture demo. | Verifying the fixture path; Vercel deploy | Setup |
| Q17 | `pnpm build` compiled and completed TypeScript, but static generation timed out retrying `/_global-error` and `/_not-found`. Determine whether this is a local Next/Turbopack worker issue or inherited app behaviour before ship; do not call the full build green yet. | Stage 9 ship gate | Stage 6 |
| ~~Q18~~ | ~~`POST /api/companies/[id]/reanalyse` is not implemented.~~ **Answered in Stage 7: the route creates a run and `runReanalysis` loads only persisted parsed documents; it never downloads or parses files. This remains unexecuted until Q9/Q11 are closed.** | ~~Stage 7 completion~~ | Stage 7 |
| ~~Q9~~ | ~~Migration `0004` has never executed and RLS is unproven.~~ **Answered live: `supabase db push` applied 0001–0004 and all 7 RLS isolation cases passed.** | ~~Everything persisted~~ | Stage 10 live verification |
| ~~Q11~~ | ~~No ingestion code has written a row.~~ **Answered live: `pnpm ingest:file` parsed a real PDF, Gemini classified it, wrote `documents` + 12 blocks, and read the contract-valid blocks back in order.** | ~~Persistence~~ | Stage 10 live verification |
| Q19 | Gemini vision fallback for a sparse synthetic PDF returns Gemini `400 INVALID_ARGUMENT` at `parse:<uuid>`. A live PNG invocation on 2026-09-06 succeeded through the same `parseWithModel`/inline-data path (`pages: 1`, `segments: 0` for an intentionally blank image), so image fallback is no longer implicated. Diagnose PDF-specific input/model handling before claiming scanned-PDF or PPTX support. | Scanned-PDF/PPTX promise | Stage 10 live verification |

---

## Known-good commands

Update this if any of them stop being true.

```bash
pnpm install
pnpm dev
MOCK_LLM=1 pnpm dev        # full pipeline, no API key, golden fixtures
pnpm typecheck             # must pass before every commit
pnpm test
pnpm lint
pnpm build                 # must pass before every commit
pnpm validate:data
```

---

## Session log

Newest at the top. Three lines each: what you did, what broke, what the next agent should know.

### 2026-09-06 — Visual system and workflow polish
Did: redesigned the live dashboard around a bright ambient/dither hero, layered neutral cards, display typography, a card-based "Add a company" CTA, portfolio activity and a useful empty state; removed Add company from sidebar. Restyled the company upload and real processing screen around the same system. Added a compact, evidence-bound Ask Winback panel inside the citation drawer — it is a source-navigation helper and explicitly does not fabricate uncited analysis.
Broke / didn't finish: Image generation returned no usable asset, so the new ambient treatment is tokenised CSS rather than a checked-in raster. Local `tsc --noEmit`, targeted ESLint and the full Vitest suite are green (80 passed / 7 skipped); `next build` compiled successfully and entered its TypeScript stage, but the runner cut off before static-generation completion, so do not call the full ship gate green. The assistant is deliberately local/evidence-bound; a real conversational model endpoint still needs a separately-designed cited-answer contract.
Next agent should know: the user’s latest direct redirection is R19. Keep the dynamic colour bright but contained; never use it to conceal status or make a non-AI element pink. Validate the new dashboard, `/companies/new`, `/runs/[id]`, and the evidence drawer in the browser after restarting the dev server.

### 2026-09-06 — Workspace scale pass
Did: enlarged the permanent navigation rail to 288px/320px at large breakpoints, added icon-led grouped navigation and brand treatment, removed the main content max-width, and increased dashboard hero/metric/card scale for a full-screen 16:10 workspace.
Broke / didn't finish: this was derived from the user’s sizing/layout reference only; browser interaction automation was unavailable, so the visual proportions still need a human pass at the user’s MacBook viewport. No proprietary copy or third-party imagery was imported.
Next agent should know: preserve this generous rail/canvas ratio across remaining screens; shrinking individual pages back to `max-w-6xl` will undo the product-level layout correction.

### 2026-09-06 — Navigation hierarchy correction
Did: replaced the global deal/graph navigation with Home, Portfolio and Companies; added the cross-portfolio `/portfolio` view; made the rail viewport-height and independently scrollable; removed dark icon backdrops; restored a single modern sans type system; and placed a company-specific source-map/knowledge-graph tab inside each company workspace.
Broke / didn't finish: image generation again returned no usable asset, so ambient colour remains CSS-backed. The company graph currently maps real documents in that company; it is not yet the richer entity relationship graph promised by the older fixture-only `/graph` screen. Documents are listed in the company workspace but a dedicated full-document reading route remains unfinished.
Next agent should know: `tsc --noEmit` and targeted ESLint are green after this pass. Do not restore `/graph` to the global sidebar; it is fixture-shaped and violates the user’s requested hierarchy.

### 2026-09-06 — Company knowledge-map direction
Did: found the cofounder’s real graph implementation: `GraphCanvas`, `GraphExplorer`, and `lib/graph/build.ts` genuinely construct nodes and edges for documents, blocks, entities, metrics, findings, contradictions and evidence. Added slow token-colour ambient drift, respecting reduced-motion preferences.
Broke / didn't finish: removed the erroneous honeycomb placeholder. The real graph API is fixture-only by explicit design: `/api/graph` returns unavailable for saved company data. It needs a persisted-company adapter before it can truthfully render inside a company workspace.
Next agent should know: do not replace the existing graph with a visual approximation. Wire `latestRun` and persisted documents into `buildKnowledgeGraph` behind an authenticated company-scoped API, then render the existing `GraphExplorer`/`GraphCanvas`.

### 2026-09-06 — Upload workspace expansion
Did: expanded `/companies/new` into a full-width upload workspace with Excel, Word, PowerPoint and Airtable-export affordance cards plus the existing real drag/drop, picker validation and upload pipeline.
Broke / didn't finish: the cards are deliberately format affordances, not claimed live OAuth integrations; LogoKit remains unconfigured. The required authenticated persisted-company graph adapter and full-document route are still outstanding implementation, not solved by UI.
Next agent should know: retain one upload path. Do not make a modal or card that simulates importing a third-party service without a real connection.

### 2026-09-06 — Source logo and sidebar pass
Did: expanded the upload source gallery to eight recognised formats and replaced invented icons with the Simple Icons CDN marks for Microsoft Excel/Word/PowerPoint, Airtable, Google Sheets/Drive, Notion and Dropbox. Used the open lower sidebar area for a concise workspace guide.
Broke / didn't finish: these are correctly labelled export/source options, not authenticated integrations; all still feed the one file-upload path. CDN availability is external and needs a local asset fallback only if product requirements demand offline branding.
Next agent should know: the real graph and document-reader functional gaps remain separate from this visual pass.

### 2026-09-06 — Contextual company navigation
Did: added a company-only nested section to the persistent sidebar which appears on `/companies/[id]` and links directly to Overview, Financials, Documents, Knowledge graph, Findings and Memo. The selected company tab now reads the `tab` query parameter. Added four distinct, tokenised colour/dither treatments cycling across source-format cards.
Broke / didn't finish: tabs remain the current implementation beneath the sidebar rather than a newly-built second navigation system. The company overview still needs a fuller information architecture once real persisted graph/document reader data is connected.
Next agent should know: use `?tab=graph` for the graph section (not `knowledge-graph`). Keep all colour treatments token-derived and pink reserved for AI-related context.

### 2026-09-06 — Demo visual correction
Did: removed the source-card pseudo-element that overlaid card content and switched the eight source panels to opaque, saturated token-derived colour treatments for a clearer demo state.
Broke / didn't finish: no claim that remaining persisted graph/document reader functionality is complete; it remains the substantive gap. Source logos are CDN assets and may be unavailable if the demo network blocks them.
Next agent should know: the actual upload, validation and run-start workflow is still the single canonical path and was not altered by this visual correction.

### 2026-09-06 — Downloadable analysis workbook
Did: added authenticated `GET /api/companies/[id]/export` and a Download XLSX action in the company workspace. It generates a workbook on demand from persisted data: Overview, Financials, Insights, Source documents and Memo. Extracted the workbook builder into `lib/export/company-workbook.ts` and added a regression test which creates a workbook, reopens it through `xlsx`, and asserts all sheets, an insight and source document are intact. The actual ingestion pipeline already parses supported documents, stores addressable source blocks, and runs extraction/crosschecks; live text-layer PDF parsing, persistence and extraction were previously proven.
Broke / didn't finish: the workbook reflects only a completed persisted run; a company without one gets the source-document sheet and explicit empty analysis sheets. Vision fallback for scanned/PPTX/images remains Q19 and must not be demoed as proven.
Next agent should know: `tsc --noEmit`, targeted lint, the workbook regression test, and the full suite pass: **81 passed / 7 expected skipped**. The persisted-company graph and full-document reader remain unimplemented.

### 2026-09-06 — Production-route check
Did: reran the production build after the workbook route was added. Next compiled the optimized application successfully, including the route, and entered its TypeScript verification stage.
Broke / didn't finish: the local runner again cut the build off after 30 seconds before static-generation completion (Q17); this is not a reported application compile failure. The test suite remains the authoritative completed verification for the new workbook behavior.
Next agent should know: do not represent a full `next build` completion until the local worker/static-generation behaviour is resolved.

### 2026-09-06 — Collapsible workspace rail
Did: added a real state-driven compact sidebar mode using the supplied `MenuButton` motion component. It smoothly transitions between the wide workspace rail and an icon rail, keeps accessible labels/tooltips, preserves Add company, and hides dense guide/company navigation only in compact mode.
Broke / didn't finish: no new duplicate navigation or fake animation was added; company sections remain available in the expanded rail. README simplification remains a documentation follow-up rather than an excuse to retain incorrect product claims.
Next agent should know: this is UI state only; it does not affect routing, upload, extraction or the persisted-company workflow.

### 2026-09-06 — README correction
Did: replaced the README’s stale promotional opening and unverified live-URL claim with a concise, accurate capability summary and an explicit reliable-demo format note.
Broke / didn't finish: deeper historical implementation notes remain for maintainers; the public opening no longer claims unsupported scanned-PDF/PPTX handling.
Next agent should know: keep user-facing documentation tied to proven workflows and call out unverified branches plainly.

### 2026-09-06 — Live model fallback distinction
Did: invoked `parseWithModel` with a valid PNG through the configured live Gemini key. The model accepted the base64 inline-data request and returned a contract-valid parse (`pages: 1`, zero segments for an intentionally blank image) in 2.3s.
Broke / didn't finish: this disproves a general image-inline-data fault but does not resolve the earlier sparse synthetic-PDF 400 or prove PPTX handling.
Next agent should know: Q19 is PDF/PPTX-specific now; normal deterministic formats and image fallback are independently verified.

### (template — copy this)
```
### YYYY-MM-DD HH:MM — Stage N
Did: 
Broke / didn't finish: 
Next agent should know: 
```

### 2026-09-06 — Stages 6 and 8, Q7
Did: replaced the dashboard's direct browser-Supabase reads with `src/lib/client/companies.ts` and a
typed, RLS-backed `GET /api/companies`; built dashboard and `/companies` loading, empty, error and
filter states. Fixed Q7 in `extraction.ts`: slices now merge by document kind and deterministic field
authority, with duplicate keys removed, instead of silently selecting four fixture IDs. Added the real
`GET /api/blocks/[blockId]` reader and made `EvidenceDrawer` use it only when the fixture snapshot
cannot resolve a citation. Added `recharts` at the workspace root for Stage 7.
Broke / didn't finish: no live database/model verification; Stage 7 API/deep dive is still next.
`typecheck`, `lint`, and `test` pass (80 / 7 skipped). Build compiled and typed but static page
generation timed out on global Next error pages (Q17), so it is not marked green.
Next agent should know: do not weaken the fixture path — drawer local resolution remains first, and
the remote request happens only for unknown block IDs. Run the credential unblocking sequence before
declaring the new routes functional.

### 2026-09-06 — Stage 7
Did: added typed `GET /api/companies/[id]` (one heavy result-blob read), `src/lib/client/company-detail.ts`,
and `/companies/[id]` with Overview, Financials, Documents, Findings, and Memo tabs. The financial chart
uses `recharts`; extracted figures and finding/memo claims retain the existing evidence-chip path.
Broke / didn't finish: `POST /api/companies/[id]/reanalyse` is not wired (Q18); the UI button is disabled
rather than pretending it works. No deep dive has rendered live data.
Next agent should know: typecheck, lint, and tests pass after Stage 7 (80 / 7 skipped). Run the full build
again after the next coherent change, and only turn on reanalysis after a live project can prove it loads
persisted parsed blocks rather than parsing again.

### 2026-09-06 — Stage 7 reanalysis
Did: added `POST /api/companies/[id]/reanalyse`, `runReanalysis`, and the deep-dive action. The runner
loads `loadCompanyDocuments` and explicitly does not download or parse original files; it writes normal
run progress and routes to `/runs/[id]`.
Broke / didn't finish: typecheck passes, but no database/model path has run.
Next agent should know: lint/test/build remain to run after this exact change; Q13 stays the priority.

### 2026-09-06 — Stage 9
Did: removed onboarding's duplicate file-upload path and now hand off to `/companies/new` (R18); corrected README claims about persisted documents and real parsing; added `recharts`; fixed the secret scanner to exclude its own detector expressions in the working tree and git-history scan. The corrected secret scan is clean; typecheck and lint pass.
Broke / didn't finish: live browser, RLS, persistence, real upload, Gemini fallback, and arbitrary-document crosscheck verification cannot run without credentials. The build command compiles/typechecks but its static-generation process has been flaky in this shell (Q17), so do not claim the full gate green until it completes once cleanly.
Next agent should know: do not build more UI before the HANDOVER.md credential sequence. Q13/A1 is the product proof; if it fails, fix that before polish.

### 2026-09-06 — Live verification
Did: linked the configured Supabase project; applied migrations 0001–0004; live RLS suite passed 7/7; seeded `test@test.com` / `test123` and company `5bdcd4a7-c0c4-4e0f-8080-58b3ddefcee0`. `pnpm ingest:file` parsed a text-layer PDF, Gemini classified it, wrote 12 blocks, and read them back contract-valid. Live Gemini extraction initially emitted fixture `mgmt-pres` document ids and dropped three citations; fixed the prompt to pin the active doc id, then reran with zero dropped citations and an extracted Northstar Analytics profile.
Broke / didn't finish: sparse/scanned PDF vision fallback returns Gemini `400 INVALID_ARGUMENT` (Q19). Browser sign-in and dashboard work on localhost; the UI file chooser automation session dropped before a `/companies/new` submission. Full multi-document crosscheck transfer/Q13 remains unproven.
Next agent should know: the next product test is three arbitrary docs (presentation, contract, cap table) through `/companies/new`, then verify crosschecks and evidence drawer. Do not call PPTX/image/scan support live until Q19 is fixed.

### 2026-09-06 — Stage 5
Did: `/companies/new` (name, sector, drag-and-drop, per-file rows, picker-level rejection with a
named reason before a byte uploads) and `/runs/[id]` (1.5s poll, stepper, verbatim `stage_detail`,
elapsed seconds, per-document status with failure reasons inline, sonner toast then route home on
completion). `src/lib/client/ingest.ts` keeps the UI off `fetch`. Built the four-stage stepper the
docs said already existed (R16). Shipped the user's own orbit animation with the gears swapped for
the mark via `pnpm build:orbit` (R17). Fixed `pnpm-workspace.yaml` so a machine with pnpm 9 can run
the repo at all — it was erroring on every command with "packages field missing or empty".
Broke / didn't finish: no run has ever completed, so neither screen has been seen with real data —
both were checked rendering only. Stages 6-9 not started.
Next agent should know: Screen 2 is wired to `GET /api/runs/[id]` exactly as the contract returns it,
so the moment a database exists it should work without changes. Q16 (onboarding's duplicate upload
path) is deliberately left alone.

### 2026-09-06 — Stage 4, brand and integrations
Did: `POST /api/ingest` (202 + run id, work continues after the response) and `GET /api/runs/[id]`
(progress shell only — result blobs stay out of a 1.5s poll). `runIngestion` walks parse → extract →
analyse → crosscheck writing `runs.stage`/`stage_detail`, isolates per-document failure so one bad
file never fails a run, and checks `RUN_BUDGET_MAX` before each model phase. `/api/docs?companyId`
and `/api/extract` take a companyId with the fixture path kept as a union member.
**The Stage 4 verification found a real bug, not a confirmation** — see R13. Crosschecks could not
fire on uploaded documents at all. Fixed by selecting on `docKinds`; 6 tests pin it.
Also built the brand and motion layer the user asked for: `WinbackMark` (the quad-cube logo as
computed isometric geometry — A15), `IngestionOrbit` (determinate, R14), `MenuButton`, `SuccessTick`,
the DESIGN.md colour tokens in `globals.css`, `/motion-preview` as a harness, and
`/settings/integrations` with its own grouped settings nav (R15). Source Lotties kept unbundled in
`design/reference/` with the reasoning written down (A16, Q14).
Wrote `scripts/seed-test-account.ts` (`pnpm seed:test`) creating test@test.com / test123 with an org,
membership and a company. Deliberately a seed and not a hardcoded bypass: auth is Supabase end to
end and every query runs under RLS, so a fake session would have to fake the entire data layer too
and would then have to be kept out of production forever.
Broke / didn't finish: nothing ran against a database or a live model. Q13 is now the one that
matters — the mechanical blocker on A1 is gone, but whether the findings transfer is unanswered.
Next agent should know: Screen 2 is mostly wiring — `IngestionOrbit` already takes `RunProgress`
exactly as `GET /api/runs/[id]` returns it. Check `/motion-preview` before touching any of it.

### 2026-09-06 — Stage 3
Did: added `pdf-parse`, `mammoth`, `xlsx` and built `src/lib/ingestion/` — `blocks.ts` (the single
place block ids are minted, `{documentId}-p{page}-b{n}`, n per page, with sentence-boundary splitting
at 1,200 chars so quote verification's substring check still holds), `pdf.ts`, `docx.ts`, `sheet.ts`,
`model-parse.ts` (the Gemini fallback for PPTX, images and scanned PDFs), `classify.ts`, `index.ts`
(the router) and `persist.ts`. Extended `generateJson` with an optional `files` parameter so the
fallback parser can send bytes without any file but `gemini.ts` importing `@google/genai` (R11).
Wrote `scripts/ingest-file.ts` (`pnpm ingest:file`, with `--dry-run`) and 26 parser tests against
real generated PDF/DOCX/XLSX bytes rather than mocks.
Proven: all three formats parse from disk into ordered, addressable, correctly-paged blocks — the
3-page PDF gives 11 blocks with headings, a kv and section labels carried down; the DOCX gives
heading/paragraph/bullet/table with columns and rows intact; the XLSX gives one page per sheet, two
table regions split on a blank row, and the sheet name as a citable heading. Ids unique, pages
non-decreasing, verified by the script itself. `typecheck`, `lint`, `test` (74 passed / 7 skipped),
`build`, `validate:data` all green, and the `MOCK_LLM=1` fixture pipeline still runs identically —
4/4 docs, 0 dropped refs, both contradictions firing, 5/5 chips verified.
Broke / didn't finish: **the persistence half never ran** (Q11) — same missing database as Q9. And
the **Gemini fallback path is entirely unexecuted** (A13): it needs a real `GEMINI_API_KEY`, and
there is no `parse:*` golden fixture so `MOCK_LLM=1` cannot reach it either. PPTX and image ingestion
should be treated as unwritten until someone runs it once.
Next agent should know: two failing tests during this stage were the code being right, not the test —
the PDF vision-fallback threshold correctly rejected a too-sparse fixture, and mammoth genuinely does
not emit `<li>` for Word's List Paragraph style without a styleMap (R12). Both were fixed at the
cause. Also read Q12 before storing any real citation: block ids are permanent, and the parser
versions that mint them are on caret ranges.

### 2026-09-06 — Stage 2
Did: wrote `supabase/migrations/0004_ingestion_and_runs.sql` — `sector` and `latest_run_id` on
`companies`; `documents`, `document_blocks` and `runs` with the columns, checks and indexes from
`DATA_MODEL.md`; RLS on all three (members read via `is_org_member`, admins write via
`is_org_admin`, no new predicates); a `set_updated_at()` trigger for `runs` (R9); and an atomic
`insert_document_blocks(uuid, jsonb)` RPC (R8). `document_blocks.org_id` is denormalised exactly as
the doc specifies, so the evidence drawer's by-primary-key lookup stays a single-table read under
RLS. Wrote `src/lib/__tests__/rls.integration.test.ts`: seven cases covering own-org reads,
cross-org reads on all three tables, the bare unfiltered select, a cross-org write, and that
`companies` isolation is unaffected.
Broke / didn't finish: **the migration has never run.** No Docker, no local Postgres, no reachable
Supabase project, so neither `supabase start` nor `supabase db lint` was available and the SQL is
reviewed by eye only (A10). Stage 2's "done when" requires the isolation to be *proven by a test*, so
Stage 2 is marked `~`, not `[x]`. The test skips itself loudly when the env vars are absent or still
placeholders, so a green `pnpm test` never reads as "RLS proven" — it prints a skipped suite instead.
Verified what could be verified: `typecheck`, `lint` (clean, and removed a warning Stage 1 left in
`validate-data.ts`), `test` 52 passed / 7 skipped, `build`, `validate:data` all green.
Next agent should know: do not treat the schema as real until someone runs it. The single command
that closes Q9 and Q6 together is applying `0004` to a live project and running
`pnpm test src/lib/__tests__/rls`. Also logged Q10 — `BlockSchema.deprecated` has no column to live
in, which is a genuine contract/data-model mismatch someone has to rule on.

### 2026-09-06 — Stage 1
Did: opened the document contract. `SourceDocIdSchema` is now `z.string().min(1)` (was a four-literal
enum); `DocKindSchema` is the eight-value open set from `INGESTION.md` step 0; `SourceDocSchema`
gained optional `companyId`, `storagePath`, `mimeType`, `ingestedAt`. `BlockSchema` untouched.
Remapped the four fixture kinds — `management_presentation`→`presentation`,
`customer_contracts`→`contract`, `option_grants`→`cap_table`, `cap_table` unchanged — across
`src/data/target/`, `src/lib/fixtures/mockRun.ts` and `evidence.test.ts` (see R6, A9). Added two
default branches: `DOC_RESPONSIBILITY` in `extraction.ts` was interpolating a literal `undefined`
into the model prompt for any non-fixture doc id, now falls back to `DEFAULT_DOC_RESPONSIBILITY`;
`ID_PATTERN` in `scripts/validate-data.ts` now skips assertion 1 for docs with no registered pattern
instead of crashing on it. No switch statement on `docKind` exists anywhere in `src/` — grepped.
Verified: `typecheck`, `test` (51/51), `build`, `validate:data` all green. Ran the full fixture
pipeline directly under `MOCK_LLM=1` — 4/4 docs extract, 0 failures, 0 dropped evidence refs, both
planted contradictions still fire at `severityHint=high`, 5/5 evidence chips resolve to a real block
and quote-verify.
Broke / didn't finish: nothing in scope. The browser click-through is still unverified — auth gates
every route and the Supabase credentials are placeholders (Q6), so the pipeline was verified by
direct invocation instead. Two fixture-shaped assumptions survive the widening and are now logged as
Q7 (`mergeSlices` drops uploaded docs' slices) and Q8 (crosschecks still hardcode fixture doc ids) —
both deliberately out of Stage 1 scope.
Next agent should know: Stage 2 is clear to start. The contract no longer blocks anything, but an
uploaded document still dead-ends at `mergeSlices` — Q7 is the next real obstacle after persistence,
and Q8 is the one that decides whether A1 holds.

### 2026-09-06 — Setup
Did: cloned `rochak779/Winback-1` with full history (48 commits) into `winback/`, renamed its remote
to `upstream`, added `origin` = `github.com/rayhankhilji/winback-final` (public) and pushed `main`.
Installed the build kit — `CLAUDE.md` (replacing the one-line `@AGENTS.md` file; the import is
preserved at line 6), `CHECKLIST.md`, and nine docs into `docs/`. `git rm design.md`.
`docs/superpowers/` and `AGENTS.md` untouched. Verified baseline: `typecheck` green, `test` green
(51/51 across 8 files), `build` green. All three doc spot-checks held — `SourceDocIdSchema` and
`DocKindSchema` are closed four-value enums at `schemas.ts:50` and `:33`; no PDF/DOCX/XLSX parser in
`package.json`; no charting library (the four `d3-*` deps are the knowledge-graph force layout, not
charts). Secrets scan clean — only `.env.example` and `scripts/scan-secrets.sh` were ever added.
Broke / didn't finish: `pnpm build` fails on a bare checkout — `/onboarding` prerenders a browser
Supabase client that throws without `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY`. Inherited, not caused
here. Worked around with a gitignored `.env.local` of placeholder values; build then completes, 18
routes. The fixture demo is therefore NOT yet verified end to end: `src/proxy.ts` gates every path
except `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` and `/invite/*`, and placeholder
credentials cannot sign in. See Q6.
Next agent should know: use `corepack pnpm`, not the global `pnpm` (see R5). Real Supabase keys are
the one blocker on seeing anything past the sign-in wall — nothing about it is a code fault. Upstream
PR #3 does not touch `src/lib/contracts/`, so Stage 1 is clear to start (Q5 closed).

### 2026-09-06 — Stage 0 audit
Did: audited the repo at `6a903ba`; wrote the doc suite; identified the closed doc-kind enums as the
keystone blocker.
Broke / didn't finish: nothing — no code was changed.
Next agent should know: start at Stage 1 and do nothing else in that session. It touches contracts
that everything depends on, and it must land with the fixture path still green. Also: this repo is a
clone of `rochak779/Winback-1` with that repo as `upstream`. Run `git fetch upstream` at the start of
a session to see whether teammates shipped anything worth merging.
