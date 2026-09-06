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

**Stage:** 3 — Parsers
**Status:** not started. Stage 2 is written but unverified — read Q9 before treating it as done.
**Last session:** 2026-09-06 — Stage 2. Migration `0004` and the RLS proof test written; neither has
ever touched a database.
**Next action:** either apply `0004` against a real Supabase project and run the RLS test (Q6/Q9), or
start Stage 3 parsers on the understanding that the schema underneath them is unexecuted SQL.
**Blocked by:** nothing in code. No database of any kind is reachable from this machine — no
credentials (Q6) and no local Postgres (Q9).

---

## Stages

Full definitions in `docs/BUILD_PLAN.md`. Mark `[x]` done, `[~]` partial, `[ ]` not started.

- [x] **0 — Baseline.** Pipeline, contracts, evidence drawer, Supabase auth, orgs, invites,
      onboarding, knowledge graph, five screens. Verified at commit `6a903ba`. Do not rebuild.
- [x] **1 — Open the document contract.** Keystone. Nothing works until this lands. Landed 2026-09-06.
- [~] **2 — Database.** Migration `0004`: documents, document_blocks, runs, RLS. Written and
      reviewed; **not applied and not executed** — no Postgres on this machine (no Docker, no local
      server). The RLS proof test is written and skips itself until a database exists. See Q9.
- [ ] **3 — Parsers.** pdf-parse, mammoth, xlsx, Gemini fallback, block persistence.
- [ ] **4 — Ingest API + background job.** `/api/ingest`, `/api/runs/[id]`, failure matrix.
- [ ] **5 — Upload and Processing screens.**
- [ ] **6 — Dashboard and portfolio list.**
- [ ] **7 — Company deep dive.** Needs `recharts` added.
- [ ] **8 — Document viewer on real documents.**
- [ ] **9 — Polish, README, secret scan, ship.**

---

## Assumptions

Everything believed but not verified. The next agent should trust these but is free to disprove one
and say so.

| # | Assumption | Made in | Confidence | Verified? |
|---|---|---|---|---|
| A1 | The crosscheck prompts are written as procedures, not answers, so they will fire on arbitrary uploaded documents rather than only the Kestrel fixtures. | Stage 0 review | medium | **No — verify in Stage 4. If false, this is the whole project.** |
| A2 | Widening the two doc-kind enums does not break `MOCK_LLM=1`, the golden fixtures, or `/graph?demo=1`, because fixtures become valid data under a wider type. | Stage 1 plan | high | No |
| A3 | Parsing a large PDF plus parallel Gemini calls exceeds `maxDuration = 60`, which is why ingestion is a background job. | Stage 0 review | high | No |
| A4 | `RUN_BUDGET_MAX = 500` is too low once documents are real rather than four fixtures. | Stage 0 review | medium | No |
| A5 | Storing `ExtractionResult` and friends as validated `jsonb` is correct; normalising them into relational tables buys nothing. | Data model | high | n/a — judgement |
| A10 | Migration `0004` is syntactically valid Postgres and applies cleanly on top of `0003`. **Reviewed by eye only — never executed.** No Docker, no local Postgres, no reachable Supabase project, so `supabase db lint` and `supabase start` were both unavailable. | Stage 2 | medium — **unverified** | **No. This is the weakest claim in the build. Apply it before building anything on top of it.** |
| A11 | `companies.latest_run_id` is deliberately not a foreign key to `runs`. The reference is circular — a run points at its company — and a FK would force an insert-ordering dance on every new run for no integrity gain. | Stage 2 | high | n/a — judgement |
| A8 | Remapping the four fixture `kind` values is behaviourally inert. Verified: nothing in `src/` switches on `docKind` — no switch statement, no `Record<DocKind, …>`, no UI label map. It is passed through `extraction.ts:341` into `DocClassification` and displayed as a string. | Stage 1 | high | Yes — grepped, and the full fixture pipeline reruns identically. |
| A9 | `option_grants` maps to `cap_table` in the new vocabulary. Guessed. Both are equity documents and the new enum has no grant-schedule literal; `report`/`spreadsheet`/`other` all fit worse. Consequence: `cap-table` and `options` now report the same `docKind`. Nothing reads it, so nothing breaks, but the classification display is less specific than it was. | Stage 1 | medium — **guessed** | No — revisit if a screen ever surfaces `docKind` to the user. |
| A7 | The `/onboarding` prerender crash on a bare `pnpm build` is purely missing Supabase env, not inherited breakage — it disappeared entirely once placeholder values were present. | Setup | high | Partly — build goes green with placeholders; not retested with real keys. |
| A6 | Gemini vision handles PPTX and screenshots well enough to produce usable blocks, since no good Node PPTX parser is worth the time. | Ingestion design | medium | No |

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
| Q9 | Migration `0004` has never been executed. There is no Postgres on this machine — no Docker for `supabase start`, no local server, no reachable project — so the SQL is reviewed but unrun, and Stage 2's "done when" (org A cannot read org B's rows, **proven by a test**) is unproven. The test exists at `src/lib/__tests__/rls.integration.test.ts` and skips itself with a visible marker rather than passing vacuously. | Everything from Stage 3 on rests on this schema | Stage 2 |
| Q10 | `BlockSchema` carries a `deprecated?: boolean` — the documented way to retire a block after Hour 6 without breaking a citation — but `DATA_MODEL.md` gives `document_blocks` no column for it. A deprecated block cannot currently be persisted as deprecated. Either the column is missing from the data model or the field is dead in the contract. | Stage 8 — document viewer | Stage 2 |
| Q7 | `mergeSlices` in `extraction.ts:407` reads `byDoc['mgmt-pres']`, `byDoc.contracts`, `byDoc['cap-table']`, `byDoc.options` by literal. An uploaded document's extracted slice is silently dropped — it contributes nothing to the merged `CompanyProfile`. Left alone deliberately: fixing it means designing how N arbitrary documents merge into one profile, which is Stage 3/4 work, not a contract change. | Stage 3 — uploaded documents produce nothing until this is solved | Stage 1 |
| Q8 | `quantify.ts:68,72` filters counter-evidence on `e.docId === 'options'`, and both crosscheck prompt packs (`recurring-revenue.ts:24`, `option-dilution.ts:21`) declare hardcoded fixture `docIds`. The crosscheck layer is still Kestrel-shaped even though the contract is now open. | Stage 4 — crosschecks firing on arbitrary uploads (this is A1, the assumption the whole project rests on) | Stage 1 |
| Q6 | Which Supabase project do we point at? The build needs real `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` before any page past `/sign-in` can be opened, including the fixture demo. | Verifying the fixture path; Vercel deploy | Setup |

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

### (template — copy this)
```
### YYYY-MM-DD HH:MM — Stage N
Did: 
Broke / didn't finish: 
Next agent should know: 
```

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
