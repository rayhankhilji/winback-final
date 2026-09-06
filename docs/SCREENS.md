# Screens

Desktop only, 1280–1600px, must not break at 1024px. No phone layouts.
Tokens and component rules: `docs/DESIGN.md`. Working is the bar, not beautiful — but consistent
beats novel, and every view needs its four states (loading, empty, error, populated).

Status is verified against `Winback-1` @ `6a903ba`.

---

## 1 · Upload — `/companies/new` · **missing**

Where messy data comes in. Onboarding has a version of this; it needs to be a standalone route
reachable from the dashboard's "Add company" button.

- Company name and sector at the top. Sector is a select, because portfolio concentration needs it.
- One large drag-and-drop zone plus a browse button. Multi-file.
- Accept: PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG. Reject anything else **at the picker**, with a named
  reason, before upload starts.
- Each queued file shows as a row: name, size, type icon, remove control, per-file progress.
- Submit is disabled until the name is set and at least one file is queued.
- Submit uploads to Storage, calls `POST /api/ingest`, routes to Screen 2 with the run id.

## 2 · Processing — `/runs/[id]` · **missing**

The loading screen. It exists to make a 60–120 second wait feel like work rather than a hang.

- Poll `GET /api/runs/[id]` every 1.5s. Never a bare indeterminate spinner.
- Reuse the existing four-stage stepper from `src/components/app-shell/`. Stages: Parse → Extract →
  Analyse → Crosscheck. Do not build a second stepper.
- Show `stage_detail` verbatim ("Parsing 3 of 7 documents") and elapsed seconds.
- List each document with a live status. A failed document shows its reason inline and the run
  continues — one bad file must not fail the run.
- On complete: route to `/` and fire a sonner toast, "Northstar added to your portfolio."
- On failure: stay put, show the error, offer Retry and Back. Never a stack trace.

## 3 · Dashboard — `/` · **built, thin**

Currently lists company names and raw storage filenames. Needs to become a real home.

- Four counter cards across the top: companies, documents ingested, open findings, requires attention.
- "Recent activity" list: last five runs with company, stage outcome, timestamp.
- Portfolio preview: 5–6 company cards, then "View all companies →".
- Primary action "Add company" routing to Screen 1.
- Keep the existing sidebar. Add Portfolio; keep New Deal and Knowledge Graph.

## 4 · Portfolio list — `/companies` · **missing**

- One card per company: name, sector, document count, last-updated, findings count, status pill.
- Filter by sector and by status. Sort by name, last updated, findings.
- Empty state is designed: one line plus the Add company button.
- Card click → deep dive.

## 5 · Company deep dive — `/companies/[id]` · **missing**

The largest screen and the one the demo should land on. Header with name, sector, status, Add
documents, Re-run analysis. Below it, tabs:

- **Overview** — extracted profile, key figures, the findings summary.
- **Financials** — charts. **`recharts` is not installed; add it.** Revenue trajectory, margin trend,
  the benchmark comparison against peer medians. Reuse `benchmark-panel.tsx` and
  `portfolio-panel.tsx`, which already exist and work.
- **Documents** — every uploaded document with kind, pages, status. Row click opens the viewer.
- **Findings** — crosscheck results. Reuse `crosscheck-card.tsx`. Evidence chips open the drawer.
- **Memo** — reuse `memo-card.tsx`.

Every number that came from a document carries an evidence chip. That is the product.

## 6 · Document viewer · **built, needs rewiring**

`evidence-drawer.tsx` works but resolves against static `TARGET_DOCS`. Point it at
`document_blocks` by block id. Behaviour stays identical: open on the cited block, highlight it,
80px of headroom, Esc closes. Do not build a second drawer — `seed-sessions.ts` already established
the snapshot pattern for resolving historical documents, so follow it.

## 7–11 · Auth and onboarding · **built**

`/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`, `/invite/[token]`, `/onboarding`.
Working, with RLS and roles behind them. Leave them alone. The only change: onboarding's upload step
should link to Screen 1 rather than carrying its own upload implementation, so there is one code path.

## 12 · Knowledge graph — `/graph` · **built**

Working with d3-force, keyboard accessible, deterministic. Non-demo requests return 503 until the
saved-session reader is wired. Once `runs` exists (`DATA_MODEL.md`), connect
`createGraphHandler(source)` to it — the integration boundary is already written and documented. Low
priority; the graph is first on the cut list.

---

## Existing deal screens

`/plan`, `/deal/[id]/ingest`, `/deal/[id]/analysis`, `/deal/[id]/decision` all work and drive the
fixture demo. **Do not delete them.** They are your guaranteed-working fallback if real ingestion is
not stable by the freeze, and the analysis and decision components get reused wholesale by the deep
dive tabs. Keep them reachable from the sidebar.
