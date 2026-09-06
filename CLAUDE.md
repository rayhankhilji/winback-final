# Winback

AI intelligence platform for private-market fund managers. Upload messy documents against a company;
get a structured, benchmarked, contradiction-checked profile where every claim is clickable back to
the exact line of the exact source document.

@AGENTS.md

## Start here, every session

**Read `CHECKLIST.md` first.** It is the live state of the build: which stage you are on, what the
last agent assumed, what they deviated from, and what is blocked. Nothing else in this repo tells
you where things actually stand.

**Update `CHECKLIST.md` before you finish.** One agent works at a time and that file is the only
thing carrying context forward. An agent that ships good code and leaves the checklist stale has
broken the process.

## The docs

Each file owns one thing. Do not look for a fact in the wrong file, and never restate a fact across
files — point to it instead.

- `CHECKLIST.md` — **live state.** Stage, assumptions, redirections, open questions, session log.
- `docs/BUILD_PLAN.md` — the ordered stages and what "done" means for each.
- `docs/PRD.md` — what we're building, features, acceptance criteria.
- `docs/ARCHITECTURE.md` — stack, system shape, repo map, environment.
- `docs/DATA_MODEL.md` — the complete schema. Ground truth for all persisted data.
- `docs/API.md` — endpoint contracts.
- `docs/INGESTION.md` — the deep design for turning uploaded files into citable documents.
- `docs/SCREENS.md` — every screen, marked built or missing.
- `docs/DESIGN.md` — the visual system and tokens.
- `docs/DECISIONS.md` — settled calls. Do not relitigate.

`AGENTS.md` is auto-generated and re-added by `next dev`. It carries Next.js version-specific rules
that override training data. Never delete it; commit it with your work if it reappears in a diff.

The root `design.md` is **superseded by `docs/DESIGN.md`** and should be deleted. If it is still
present, ignore it — it specifies a dense Bloomberg-style dark-capable system that the current
direction rejects.

`docs/erd.md`, if present, is the original spec. Good on pipeline internals and prompt design, **stale on
auth, persistence, and the document contract.** Where it disagrees with the docs above, they win.

**Do not read `docs/erd.md` end to end.** It is 3,500 lines and will eat your context for little return.

## Commands

```bash
pnpm install
pnpm dev
MOCK_LLM=1 pnpm dev        # full pipeline offline, from golden fixtures
pnpm typecheck             # must pass before every commit
pnpm test
pnpm lint
pnpm build                 # must pass before every commit
pnpm validate:data
pnpm record:golden
```

## Stack

Next.js 15 App Router · TypeScript strict · React 19 · Tailwind v4 · shadcn/ui · Zod at every
boundary · `@google/genai` (Gemini) · Supabase (Postgres, Auth, Storage) · Vercel · pnpm.
Full detail in `ARCHITECTURE.md`.

## Conventions

- **The UI never calls `fetch`.** It calls `src/lib/client/*`, which dispatches loading and error
  state into the store.
- **Types derive from Zod.** `type X = z.infer<typeof XSchema>`. Never hand-maintain both.
- **Both directions validated.** Routes validate input and their own output. Malformed output is a
  500 `CONTRACT_VIOLATION`, never quietly shipped to the UI.
- No `any`. No untyped functions. No non-null `!` on API data.
- Colours, spacing, radii and type come from `DESIGN.md` tokens. **Zero hardcoded hex in components.**
- Server-only secrets. No `NEXT_PUBLIC_*` API key. All model calls server-side.

## House rules (non-negotiable)

- **One correct path.** No fallbacks "just in case". If preconditions aren't met, throw.
- **One way to do a thing.** Don't add a second pattern for something already solved here.
- **Surgical changes.** Smallest correct edit. No drive-by refactors, no symptom patches.
- **Evidence-based debugging.** Reproduce, isolate with targeted logging, diagnose, then fix. Find
  the cause before touching code. Don't guess-patch.
- **Real error handling everywhere.** Every async call handles failure. Never leak a stack trace.
- **Separation of concerns.** Each function does one thing.
- **Don't overengineer.** Let the type system carry what it can.
- **Clarity over cleverness.**

## Guardrails (never do these)

- **Never rebuild Stage 0 work.** The pipeline, contracts, evidence drawer, auth, orgs, invites,
  onboarding and knowledge graph exist and work. Read before you write.
- **Never delete `/plan` or `/deal/[id]/*`.** They are the demo fallback and the component source for
  the deep dive tabs.
- **Never hardcode a pipeline output.** `MOCK_LLM=1` is local-only and throws in production.
- **Never render a verdict.** No *verdict*, *risk score*, *materiality*, or *recommend* in UI copy,
  prompts, or type names. Use `severityHint`.
- **Never let the model do arithmetic.** TypeScript computes every figure.
- **Never use pink for decoration.** Pink means AI-generated or AI-extracted, everywhere, only.
- **Never use white text on an accent fill.** Nothing in the palette supports it.
- **Never break the fixture path.** If `MOCK_LLM=1` stops working, you widened or rewired too much.
- **Never commit a secret.** The repo is public.
- **Never finish a session without updating `CHECKLIST.md`.**

## Definition of done

`pnpm typecheck` passes, `pnpm build` passes, `pnpm test` passes, no console errors, the stage's
"Done when" in `BUILD_PLAN.md` is satisfied, and `CHECKLIST.md` is updated.
