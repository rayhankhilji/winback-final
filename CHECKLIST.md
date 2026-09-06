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

**Stage:** 1 — Open the document contract
**Status:** not started
**Last session:** 2026-09-06 — Setup (clone, docs install, baseline verify, push). No feature code written.
**Next action:** widen `SourceDocIdSchema` and `DocKindSchema` in `src/lib/contracts/schemas.ts`
**Blocked by:** nothing

---

## Stages

Full definitions in `docs/BUILD_PLAN.md`. Mark `[x]` done, `[~]` partial, `[ ]` not started.

- [x] **0 — Baseline.** Pipeline, contracts, evidence drawer, Supabase auth, orgs, invites,
      onboarding, knowledge graph, five screens. Verified at commit `6a903ba`. Do not rebuild.
- [ ] **1 — Open the document contract.** Keystone. Nothing works until this lands.
- [ ] **2 — Database.** Migration `0004`: documents, document_blocks, runs, RLS.
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
