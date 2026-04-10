# Phase 4: Pipeline Management — Run Details & Monitoring

**Date**: 2026-04-11
**Status**: Approved
**Depends on**: Phase 2 (UI Rebuild — creates the pipeline detail page shell)
**Goal**: See what happened in each pipeline run — logs, signals processed, content generated. Debug when things go wrong.

---

## Problem

After Phase 2, the pipeline detail page (`/pipelines/[slug]`) shows run history and recent content. But you can't drill into a specific run to see:
- What signals were fetched
- Which were dropped by dedup or relevance filtering (Phase 1)
- What errors occurred
- Which content items were generated from which signals

When a pipeline fails or produces unexpected content, there's no way to understand why.

## Solution

Add a run detail view that shows the full execution trace of a single pipeline run, using data already stored in `pipeline_runs`, `pipeline_logs`, `content_signals`, and `content_items`.

---

## Run Detail View

**Route**: `/pipelines/[slug]/runs/[runId]`

**Server component** that queries:
```typescript
const run = await getPipelineRunDetail(runId);
const logs = await getPipelineLogs(runId);  // Already exists in apps/web/src/lib/queries/pipelines.ts
const items = await getRunContentItems(runId);
```

### Layout

**Header**:
- Back link: "← Back to [Pipeline Name]"
- Run ID (truncated UUID)
- Status badge (completed / failed / partial_success / running)
- Started at (full timestamp)
- Duration (computed: completed_at - started_at, formatted as "Xm Ys")

**Run Summary** (horizontal stat cards):
- Signals ingested
- Signals filtered (passed relevance + filter)
- Items generated
- Errors count

**Execution Log** (timeline):
- Rendered as a vertical timeline / log view
- Each entry from `pipeline_logs`: timestamp, step name (badge), level (info/warn/error color), message
- Steps appear in order: ingest → dedup → relevance → filter → generate → finalize
- Error entries highlighted in red
- Collapsible by default for long runs — show first/last 5 entries with "Show all X entries" toggle

**No Signals Table**: `content_signals` doesn't have a `pipeline_run_id` column, so signals can't be linked to specific runs. The execution log already captures signal counts and which signals were dropped (Phase 1 adds relevance logging). This gives sufficient debugging context without a DB migration.

**Generated Content** (list):
- Content items where `pipeline_run_id` matches this run
- Title, platform icon, status badge, quality score
- Each links to `/review/[id]`

**Error Details** (if status is failed):
- Full error text from `pipeline_runs.error` column
- Rendered in a code block for readability

---

## Enhance "Run Now" Feedback

The "Run Now" button from Phase 2 currently shows a toast with results. Enhance it:

- After a successful run, the toast includes a "View Run →" link to `/pipelines/[slug]/runs/[runId]`
- The trigger API response already returns `runId` (it's part of `PipelineRunResult`)
- The `PipelineTriggerButton` component stores the `runId` from the response and renders the link

---

## New Query Functions

Add to `apps/web/src/lib/queries/pipelines.ts`:

```typescript
// Single pipeline run with full details
export async function getPipelineRunDetail(runId: string) {
  // SELECT * FROM pipeline_runs WHERE id = runId
  // Returns single row or null
}

// Content items generated in a specific run
export async function getRunContentItems(runId: string) {
  // SELECT * FROM content_items WHERE pipeline_run_id = runId ORDER BY created_at DESC
}
```

`getPipelineLogs(runId)` already exists.

---

## Files Summary

| Action | File |
|--------|------|
| **Create** | `apps/web/src/app/(dashboard)/pipelines/[slug]/runs/[runId]/page.tsx` |
| **Modify** | `apps/web/src/lib/queries/pipelines.ts` (add getPipelineRunDetail, getRunContentItems) |
| **Modify** | `apps/web/src/components/dashboard/pipeline-trigger-button.tsx` (add "View Run" link after success) |

## Testing

1. Navigate to `/pipelines/github-trends/runs/[valid-runId]` — see full run details
2. Verify logs appear in chronological order with correct step badges
3. Verify generated content items are listed and link to review
4. Failed run shows error details in code block
5. "Run Now" on pipelines page → after completion, toast shows "View Run →" link
6. Navigate to `/pipelines/github-trends/runs/[invalid-id]` → 404
7. Run with 0 items generated shows "No content generated" message
