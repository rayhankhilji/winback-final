# API — Winback

**Owns:** endpoint contracts — paths, inputs, outputs, status codes.
**Never contains:** schema (→ `DATA_MODEL.md`), pipeline internals (→ `INGESTION.md`).

## Shared rules

Every route handler, without exception:

```
getUserId()  ->  rateLimit  ->  Zod parse input  ->  handler  ->  Zod parse output  ->  respond
```

- `runtime = 'nodejs'`, `maxDuration = 60`.
- Unauthenticated: **401** with the standard error envelope. API routes never redirect.
- Not a member of the resource's org: **404**, never 403. Do not leak existence.
- Rate limited: **429** with `retryAfter` in seconds.
- Own output fails its schema: **500** `CONTRACT_VIOLATION`. Fail loudly; never ship malformed data.

Error envelope, used everywhere:

```json
{ "ok": false, "error": { "code": "STRING_CODE", "message": "Human readable.", "retryAfter": 30 } }
```

Success envelope:

```json
{ "ok": true, "data": { }, "meta": { "ms": 1240, "model": "gemini-...", "mock": false } }
```

## Existing routes — built

| Route | In | Out |
|---|---|---|
| `GET /api/docs` | — | `{ docs: SourceDoc[] }` |
| `POST /api/extract` | docs | `ExtractionResult` — 4 parallel model calls |
| `POST /api/benchmark` | extraction | `BenchmarkResult` — deterministic, no model |
| `POST /api/portfolio` | extraction | `PortfolioImpact` — deterministic, no model |
| `POST /api/crosscheck` | docs + extraction | `DecisionResult` — 2 parallel model calls |
| `POST /api/memo` | full run | `IcMemo` — 1 model call |
| `GET /api/graph` | `demo`, `scope`, `sessionId` | Graph projection. Returns 503 without `demo=1` until the saved-session reader is wired. |

### Changes required

`GET /api/docs` currently returns the static `TARGET_DOCS` and ignores every parameter. It becomes:

```
GET /api/docs?companyId=<uuid>        -> { docs: SourceDoc[] }   from `documents` + `document_blocks`
GET /api/docs                          -> { docs: TARGET_DOCS }   fixture fallback, keeps MOCK_LLM working
```

`POST /api/extract` accepts `{ companyId }` and loads that company's documents server-side, or
`{ docs }` directly for the fixture path. Both are valid; the schema is a union.

## New routes

### `POST /api/ingest`

Starts an ingestion run. Returns immediately; work continues in the background.

```
in   { companyId: uuid, storagePaths: string[] }
out  { runId: uuid }                                    202
```

- Creates a `runs` row with `status: 'queued'`, creates a `documents` row per path with
  `status: 'pending'`, then kicks off processing without awaiting it.
- **409** if a run for this company is already `queued` or `running`.
- **400** `UNSUPPORTED_TYPE` if any path has an extension outside the accepted set. Validate here as
  well as at the picker — the client check is UX, this one is the guarantee.

### `GET /api/runs/[id]`

Polled by the processing screen every 1.5 seconds.

```
out  { id, status, stage, stageDetail, error,
       documents: [{ id, filename, title, status, failureReason }],
       elapsedMs }
```

- Returns only the progress shell while running. Pipeline result blobs are omitted until
  `status === 'complete'` — do not ship five JSON payloads on every poll.
- **404** if the run belongs to another org.

### `GET /api/companies`

```
out  { companies: [{ id, name, sector, documentCount, findingCount,
                     status, lastRunAt }] }
```

Backs the portfolio list and the dashboard preview. Reads `companies.latest_run_id` rather than
subquerying per row.

### `GET /api/companies/[id]`

```
out  { company, latestRun: Run | null, documents: DocumentMeta[] }
```

Backs the deep dive. Returns the whole run including result blobs — this is the one heavy read, and
it happens once per screen load.

### `POST /api/companies/[id]/reanalyse`

Re-runs the pipeline against already-parsed documents. No re-parsing.

```
out  { runId: uuid }                                    202
```

### `GET /api/blocks/[blockId]`

Resolves a citation for the document viewer.

```
out  { block: Block, document: DocumentMeta, neighbours: Block[] }
```

`neighbours` is the surrounding ±10 blocks by `ordinal`, so the drawer renders context without a
second request. Single-table read on `(org_id, id)`. Must return in under 300ms.

## Ordering

`/api/ingest`, `/api/runs/[id]`, and the `/api/docs` change are blocking — the upload and processing
screens cannot work without them. `/api/companies*` and `/api/blocks/[blockId]` come after.
