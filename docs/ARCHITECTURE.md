# Architecture — Winback

**Owns:** stack, system shape, directory map, integrations, environment.
**Never contains:** schema (→ `DATA_MODEL.md`), endpoints (→ `API.md`), features (→ `PRD.md`).

Verified against `6a903ba` — 48 commits, ~10,200 lines of TS/TSX. This repo is a full-history clone
of `rochak779/Winback-1`, which remains configured as the `upstream` remote.

## Stack

Next.js 15 App Router · TypeScript strict · React 19 · Tailwind v4 · shadcn/ui + Base UI ·
Zod at every boundary · `@google/genai` (Gemini, structured output) · Supabase (Postgres, Auth,
Storage) with `@supabase/ssr` · d3-force for the graph · sonner for toasts · Vercel · pnpm · Node 20+.

**To add:** `pdf-parse`, `mammoth`, `xlsx` for parsing; `recharts` for charts. There is currently no
parser and no charting library in the tree.

## Shape

```
Browser
  RunStore (React context + useReducer, localStorage mirror)
  Evidence drawer resolves EvidenceRef -> document block
        |  fetch, plain JSON POST, no streaming
Next.js route handlers (server, stateless w.r.t. the pipeline)
  auth -> rateLimit -> zod in -> handler -> zod out
        |
   Gemini API          Supabase Postgres        Supabase Storage
   (server-only key)   (auth, orgs, runs,       (uploaded files,
                        documents, blocks)       private bucket)
```

**Routes are stateless with respect to the pipeline.** Postgres holds saved results, not in-flight
state. If a route needs the extracted profile, the client sends it. Ingestion is the one exception:
it is a background job writing progress to `runs`, which the client polls.

## The evidence model

The core architectural idea, and the reason the product is credible.

Every document is an ordered list of blocks with stable permanent ids. Every generated statement
carries an `EvidenceRef { docId, blockId }`. The server validates every ref the model produces
against the real blocks before returning it — a hallucinated quote or dead link is dropped or
downgraded, so the UI cannot render a broken citation.

Block ids are namespaced per document (`{documentId}-p{page}-b{n}`) and never change after they are
written. `seed-sessions.ts` already established this pattern; follow it.

## Ingestion is a job, not a request

`maxDuration = 60` will not cover parsing a large PDF plus parallel Gemini calls. `POST /api/ingest`
writes a `runs` row, returns immediately, and processes without awaiting, updating `runs.stage` as
it goes. The client polls `GET /api/runs/[id]` every 1.5s. Polling, not websockets. Full design in
`INGESTION.md`.

## Repo map

```
src/app/                     App Router
  page.tsx                   Dashboard
  plan/, deal/[id]/*         Existing fixture-driven deal flow — KEEP, it is the fallback demo
  sign-in|sign-up|...        Auth screens — built
  onboarding/                4-step wizard — built
  graph/                     Knowledge graph explorer — built
  api/                       Route handlers
src/components/
  ui/                        shadcn primitives (17)
  app-shell/                 shell, sidebar, deal gate, stage stepper
  evidence/                  chip + drawer — the money interaction
  analysis/, decision/, ingest/, graph/
src/lib/
  contracts/                 Zod schemas + types. The frozen contract.
  pipeline/                  gemini.ts, extraction, benchmark, portfolio, crosscheck, decision,
                             memo, quantify, http, prompts/
  evidence.ts                server-side ref validation
  store/                     RunStore
  client/                    typed fetch wrappers — UI never calls fetch directly
  auth/, org/, supabase/     getUserId(), membership, SSR clients
  graph/                     deterministic projection + http boundary
  fixtures/                  mockRun
src/data/                    target/, peers, portfolio, golden/, seed-sessions
supabase/migrations/         0001-0003 exist; 0004 is the next one
scripts/                     validate-data, record-golden
```

## Conventions

- **The UI never calls `fetch`.** It calls `src/lib/client/*`, which dispatches loading and error
  state into the store. This is what lets screens be built before routes exist.
- **Types derive from Zod.** `type X = z.infer<typeof XSchema>`. Never hand-maintain both.
- **Both directions validated.** A route validates its input and its own output. Malformed output is
  a 500 `CONTRACT_VIOLATION`, not something quietly shipped to the UI.
- **Server-only secrets.** `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` never appear in a
  `NEXT_PUBLIC_*` variable. All model calls are server-side.
- **`getUserId()` is the single auth surface.** Swapping the provider is one file.

## Environment

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | yes | Server-only |
| `GOOGLE_CLOUD_PROJECT` | yes | |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only |
| `MOCK_LLM` | no | `1` runs the full pipeline from golden fixtures, no API key. Local only — throws at module load if `VERCEL_ENV === 'production'`. |
| `RUN_BUDGET_MAX` | no | Default 500 LLM calls. Real uploads burn this faster than fixtures do. |

## On `erd.md`

The original spec. Still the best reference for pipeline internals, prompt design, and the evidence
model. **Stale in three places:** it specifies Firebase (the build uses Supabase), it contains
contradictory solo-build and four-person instructions, and it assumes a closed four-document
contract that `INGESTION.md` deliberately opens. Where `erd.md` and these docs disagree, these docs
win.
