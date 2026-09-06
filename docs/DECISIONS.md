# Decisions

Settled calls made before the build. **Do not relitigate.** If you think one is wrong, record the
argument in `CHECKLIST.md` under Redirections and follow the decision anyway unless it is factually
wrong about the codebase.

**This file vs `CHECKLIST.md`:** decisions here are stable and made in advance. Assumptions made
*during* the build go in the checklist. If something in the checklist hardens into a permanent
choice, promote it here.

---

## D1 — Portfolio product, with the diligence pipeline as its engine

The original spec built a four-screen one-shot diligence tool. The product is now a portfolio
platform: upload documents against a company, get a continuously updated sourced profile.

The pipeline is not replaced, it is repointed. Deal → Company. Run → a company's latest analysis.
The four fixture documents → whatever the user uploaded. Decision screen → the Findings tab.
Evidence drawer → the document viewer.

**Consequence:** the existing `/plan → /deal/[id]/*` screens stay. They are the reuse source for the
deep dive tabs and the guaranteed-working demo fallback.

## D2 — Open the document contract

`SourceDocIdSchema` and `DocKindSchema` are closed enums of four literals, so an uploaded file cannot
become a valid document. Both open. This is Stage 1 and everything depends on it.

**Consequence:** fixture documents and uploaded documents coexist under a wider type. If widening
breaks the fixture path, too much was widened.

## D3 — Uploaded documents are persisted

The current README states documents are never persisted, as a privacy tradeoff. That reverses: the
deep dive and the document viewer cannot resolve a citation without stored blocks.

**Consequence:** RLS on `documents` and `document_blocks` is the answer, and `README.md` must be
corrected at Stage 9. Do not let a reader catch the contradiction.

## D4 — Ingestion is a background job, not a request

`maxDuration = 60` will not cover parsing plus parallel model calls. `POST /api/ingest` returns
immediately; the client polls `GET /api/runs/[id]`.

**Consequence:** the processing screen exists because of this decision, and polls rather than
streaming. No websockets.

## D5 — Supabase, not Firebase

`erd.md` specifies Firebase Auth and Firestore. The build shipped Supabase Postgres, Auth and
Storage, with RLS, roles and an atomic `create_org` RPC. That work is done and correct.

**Consequence:** `erd.md` is stale on persistence and auth. `ARCHITECTURE.md` and `DATA_MODEL.md`
are authoritative.

## D6 — Modern product design, not editorial

The supplied colour direction proposed an editorial-finance aesthetic: sand-coloured paper ground,
full-bleed coffee bands, alternating warm/dark section rhythm, 0px corners. The palette is kept and
so is its best idea — **pink means AI and nothing else**. The editorial framing is rejected.

**Consequence:** warm off-white canvas, white cards, soft 10px radii, Inter throughout, subtle
layered shadows. See `DESIGN.md`. Do not reintroduce sand-dune grounds or brown bands.

## D7 — Model reads, TypeScript calculates

Medians, deltas, percentages, concentration ratios and corrected totals are computed in TypeScript
from extracted values. The model's job is reading and judgement, never arithmetic.

## D8 — No verdicts

Winback states facts, comparisons and contradictions, never whether to do the deal. Banned in UI
copy, prompts and type names: *verdict*, *recommendation to proceed*, *risk score*,
*materiality rating*. Use `severityHint`.

## D9 — One agent at a time

There is no lane ownership, no branch protocol, no merge authority. A single agent works, updates
`CHECKLIST.md`, and hands off. Continuity is the problem to solve, not collision.

**Consequence:** `CHECKLIST.md` is load-bearing. An agent that does not update it has broken the
process regardless of what it shipped.

## D10 — Build in a full-history clone, with the original as upstream

Nobody could grant repo access at 3am mid-hackathon, so the build moved to a separate public repo
seeded by `git clone` rather than a zip. `rochak779/Winback-1` stays configured as the `upstream`
remote.

**Consequence:** the two repos share a commit root, so `git merge upstream/main` pulls teammates'
work in and handing branches back later is a normal merge rather than an unreviewable diff. This
only holds while history is intact — **never force-push, rebase published commits, or squash the
inherited history.**
