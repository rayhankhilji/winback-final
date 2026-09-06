# PRD — Winback

Winback turns a pile of messy private-market documents into a continuously updated, fully sourced
company profile. A fund manager uploads whatever they have — CIMs, board packs, contracts, cap
tables, spreadsheets, screenshots — and gets back a structured profile, benchmarks, and flagged
contradictions, every claim clickable back to the exact line of the exact document it came from.

**Owns:** what we build, for whom, and how we know it works.
**Never contains:** schema (→ `DATA_MODEL.md`), stack (→ `ARCHITECTURE.md`), tokens (→ `DESIGN.md`),
build order (→ `BUILD_PLAN.md`), current progress (→ `CHECKLIST.md`).

## Users

**Primary — fund manager / deal team.** Senior, time-poor, handling confidential material. Has been
pitched "AI for diligence" a dozen times and does not trust a black box. Wins when they can see
where a number came from in one click.

**Secondary — analyst.** Does the reading today. Uploads the documents, reviews findings, accepts or
dismisses them.

## The core promise

Everything the AI produces is traceable. Every figure, claim, and finding carries a citation that
opens the source document at the exact block. Nothing is asserted without provenance.

## Feature set

### F1 — Upload and ingestion
Upload mixed-format documents against a company. The system parses them into addressable blocks,
classifies each document, and stores both.

- **Accepts:** PDF, DOCX, PPTX, XLSX, CSV, PNG, JPG.
- **Acceptance:** a user uploads three files of different formats; all three appear as parsed
  documents with correct page counts and a readable title within 3 minutes.
- **Acceptance:** an unsupported file is rejected at the picker with a named reason, before upload.
- **Acceptance:** one file failing to parse does not fail the run; it shows as `failed` with a reason
  and the other documents still process.

### F2 — Processing feedback
A dedicated screen shows ingestion progress by stage while the job runs.

- **Acceptance:** stages advance visibly (Parse → Extract → Analyse → Crosscheck), elapsed time is
  shown, and per-document status updates live. No indeterminate spinner at any point.
- **Acceptance:** on completion the user lands on the dashboard with a toast naming the company.

### F3 — Extraction
Gemini reads the parsed documents and produces a structured company profile: revenue, growth,
margins, headcount, customers, ownership, and the narrative claims management makes.

- **Acceptance:** every extracted field carries an `EvidenceRef` that resolves to a real block.
- **Acceptance:** no arithmetic is performed by the model. Medians, deltas, percentages and corrected
  totals are computed in TypeScript from extracted values.

### F4 — Benchmarks and portfolio impact
Compare the company against peer comparables, and model its effect on sector concentration.

- **Acceptance:** each metric shows the company figure, the peer median, and the delta, with the
  direction indicated by more than colour alone.

### F5 — Crosschecks
Find contradictions between what management claims and what the underlying documents show.

- **Acceptance:** prompts state a *procedure*, never an answer. No prompt names a specific finding,
  quotes a clause, or references a figure from the fixtures.
- **Acceptance:** each finding shows what was claimed, what the evidence shows, the quantified gap,
  and citations to both sides.
- **Acceptance:** the analyst can accept, edit, or dismiss each finding.

### F6 — Portfolio and company views
A dashboard, a portfolio list, and a per-company deep dive with tabs for overview, financials,
documents, findings, and memo.

- **Acceptance:** every number displayed anywhere that came from a document has a working citation.
- **Acceptance:** all four states (loading, empty, error, populated) are designed on every view.

### F7 — Document viewer
Clicking any citation opens the source document scrolled to the cited block, highlighted.

- **Acceptance:** works for user-uploaded documents, not just fixtures. Resolves in under 300ms with
  no visible network wait.

### F8 — IC memo
Draft a memo from the analysis, section by section, every claim sourced.

- **Acceptance:** no section contains an unsourced assertion.

### F9 — Accounts and organisations
Sign-up, sign-in, password reset, organisation creation, teammate invites, admin/member roles.
**Already built.** Do not rebuild.

## Non-negotiable product rules

1. **No verdicts.** Winback states facts, comparisons, and contradictions. It never says whether to
   do the deal. Banned in UI copy, prompts, and type names: *verdict*, *recommendation to proceed*,
   *risk score*, *materiality rating*. Use `severityHint`.
2. **No unsourced claims.** Every generated statement is `cited`, `derived`, or explicitly
   `unsourced` and labelled as such in the UI.
3. **The model reads and judges; TypeScript calculates.**
4. **Pink means AI.** Any pink in the interface means machine-generated or machine-extracted. It is
   never decorative. See `DESIGN.md`.
5. **Failures are visible.** A document that failed to parse is shown as failed with a reason. Never
   silently dropped, never a blank row.

## Out of scope

Real-time collaboration. Mobile layouts. Data-room integrations (Google Drive, SharePoint, Dropbox).
An investee-facing portal. A signals feed. Scheduled report generation. Multi-currency. Anything in
the brand deck's nine-screen board that is not listed under Feature Set above.

## Success criteria for the build

A stranger with no setup signs up, creates an organisation, uploads three real documents they made
themselves, watches the processing screen, lands on the dashboard, opens the company, reads an
extracted profile with benchmarks and at least one flagged contradiction, and clicks a citation that
opens the correct block of their own document.
