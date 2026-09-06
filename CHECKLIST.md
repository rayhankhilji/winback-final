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
**Last session:** none — this is a fresh start on top of the existing repo
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

---

## Open questions

Things nobody has resolved. Add to this rather than guessing silently.

| # | Question | Blocks | Raised |
|---|---|---|---|
| Q1 | What is the actual Vercel plan ceiling for `maxDuration`? | Stage 4 sizing | Stage 0 |
| Q2 | Is there a per-file size cap we should enforce at upload? | Stage 5 | Stage 0 |
| Q3 | When a company is re-analysed, do old runs stay queryable or does `latest_run_id` make them dead weight? | Stage 7 | Stage 0 |
| Q4 | Which repo is canonical once the team is awake — do we merge our branches into upstream, or does upstream merge from us? | Nothing today; matters before the demo | Setup |
| Q5 | Does the open PR on upstream touch `src/lib/contracts/`? If so it collides with Stage 1. | Stage 1 | Setup |

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

### 2026-09-06 — Stage 0 audit
Did: audited the repo at `6a903ba`; wrote the doc suite; identified the closed doc-kind enums as the
keystone blocker.
Broke / didn't finish: nothing — no code was changed.
Next agent should know: start at Stage 1 and do nothing else in that session. It touches contracts
that everything depends on, and it must land with the fixture path still green. Also: this repo is a
clone of `rochak779/Winback-1` with that repo as `upstream`. Run `git fetch upstream` at the start of
a session to see whether teammates shipped anything worth merging.
