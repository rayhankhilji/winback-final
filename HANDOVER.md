# Handover — 2026-09-06

Read `CLAUDE.md` then `CHECKLIST.md`. This file is only what a fresh agent needs
that those two do not already say.

## Where things stand

~55%. Stages 0–1 done. **Stages 2–5 are written but no code path in them has
ever touched a database or a live model.** Stages 6–9 not started.

| Stage | State |
|---|---|
| 0 Baseline | Done, inherited. Do not rebuild. |
| 1 Open document contract | Done and verified. |
| 2 Database (`0004`) | SQL written, **never executed**. |
| 3 Parsers | PDF/DOCX/XLSX proven on real files. Persistence + Gemini fallback unrun. |
| 4 Ingest API + job | Written. Found and fixed a real bug (below). Unrun. |
| 5 Upload + processing screens | Built, render-checked only. |
| 6–9 | Not started. |

## The one blocker

**No Supabase project and no `GEMINI_API_KEY`.** `.env.local` holds placeholders
so the build compiles. `src/proxy.ts` gates every route except `/sign-in`,
`/sign-up`, `/forgot-password`, `/reset-password`, `/invite/*`,
`/motion-preview`, `/settings/integrations` — so nothing past sign-in can be
opened, and no run can execute.

Unblocking sequence, in order:

1. Real values in `.env.local` for `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.
2. Apply `supabase/migrations/0004_ingestion_and_runs.sql`.
3. `pnpm test src/lib/__tests__/rls` — proves org isolation. Closes Q9.
4. `pnpm seed:test` — creates `test@test.com` / `test123` with org, membership,
   company. Closes Q6.
5. `pnpm ingest:file <real.pdf> --company <uuid>` — proves persistence. Closes Q11.
6. Upload three real files at `/companies/new` and watch `/runs/[id]`.
   **This answers Q13, which is the only question that matters.**

## The finding that matters most

`BUILD_PLAN.md` Stage 4 asks whether the crosscheck procedures fire on
non-Kestrel documents. **They could not fire at all.** Every `CrosscheckDef`
selected its inputs by hardcoded fixture id, so an uploaded document with a
uuid matched nothing and `runDecision` produced zero crosschecks.

Fixed: selection is now by `docKinds`, with `defIsSatisfiable()` refusing to run
a comparison when one side is absent. Six tests pin it. The Kestrel fixtures
still fire unchanged.

**That was only the mechanical blocker. Whether the model's *answers* transfer
to arbitrary documents is unverified (Q13, assumption A1). If they do not, that
is the product, and every remaining screen is secondary.**

## Traps

- **Use `pnpm` normally** — `pnpm-workspace.yaml` was fixed so pnpm 9 works. The
  repo pins pnpm 11 via `packageManager`; `corepack pnpm` also works.
- **Never break the fixture path.** `MOCK_LLM=1` with `TARGET_DOCS` is the
  regression check for everything. Verify with
  `pnpm test` plus a manual `runExtraction`/`runDecision` over `TARGET_DOCS`.
- **Block ids are permanent.** `{documentId}-p{page}-b{n}`. Parser deps are on
  caret ranges; a minor `pdf-parse` release that changes paragraph splitting
  would renumber blocks and dangle every stored citation. Pin before real use
  (Q12).
- **`mergeSlices` (`extraction.ts`) still reads fixture ids by literal**, so an
  uploaded document's extracted slice is silently dropped (Q7). This is the next
  real obstacle after persistence.
- **Docs are wrong in three places, all recorded as redirections in
  `CHECKLIST.md`:** `INGESTION.md` step 0 (fixture kinds must be remapped, R6),
  `DATA_MODEL.md` (`runs.updated_at` needs a trigger, R9), `SCREENS.md` 2 (the
  stepper it says to reuse never existed, R16).

## Design and brand

- The mark is `src/components/ingestion/winback-mark.tsx` — computed isometric
  geometry, three cubes tiling edge to edge. Verified against `LOGO.png`.
- `/anim/orbit-winback.svg` is the user's own supplied animation with its gear
  cluster swapped for the mark. Regenerate with `pnpm build:orbit`. Sources in
  `design/reference/`, unbundled.
- **The user prefers their own supplied assets over native rebuilds.** They said
  so twice. Ask before substituting.
- `globals.css` carries the `DESIGN.md` tokens; the inherited shadcn theme is
  untouched. **Zero hardcoded hex in components.**
- `/motion-preview` is a harness for the motion components. Check it before
  editing any of them.

## Verify before every push

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All four are green at `7e6b629`. 80 tests pass, 7 skip (the RLS suite, which
skips loudly rather than passing vacuously without a database).
