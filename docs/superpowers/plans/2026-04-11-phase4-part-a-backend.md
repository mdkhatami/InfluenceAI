# Phase 4 Part A: Pipeline Run Queries + Trigger API Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side query functions for the pipeline run detail page (Part B) and fix the trigger API to return `runId` so the UI can link to run details after triggering.

**Architecture:** All queries use the Supabase server client (`createClient` from `@/lib/supabase/server`). They are added to the existing `apps/web/src/lib/queries/pipelines.ts` module. The trigger API route at `apps/web/src/app/api/pipelines/[id]/trigger/route.ts` is patched to include `runId` in the JSON response.

**Tech Stack:** Supabase server client, Next.js 15 API Routes, `@influenceai/core` types

---

### Task 1: Add `getPipelineRunDetail(runId)` Query

**Files:**
- Modify: `apps/web/src/lib/queries/pipelines.ts`

- [ ] **Step 1: Add `getPipelineRunDetail` function**

Add the following function at the end of `apps/web/src/lib/queries/pipelines.ts`:

```typescript
export async function getPipelineRunDetail(runId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('id', runId)
    .single();
  if (error) return null;
  return data;
}
```

This returns a single pipeline run by ID, or `null` if not found. Used by the run detail page (Part B) to render the header, stats, and error details.

- [ ] **Step 2: Verify no type errors**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

---

### Task 2: Add `getRunContentItems(runId)` Query

**Files:**
- Modify: `apps/web/src/lib/queries/pipelines.ts`

- [ ] **Step 1: Add `getRunContentItems` function**

Add the following function at the end of `apps/web/src/lib/queries/pipelines.ts` (after the function added in Task 1):

```typescript
export async function getRunContentItems(runId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('id, title, platform, status, quality_score, created_at')
    .eq('pipeline_run_id', runId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

This queries `content_items` where `pipeline_run_id` matches the run. The `pipeline_run_id` column was added in the v2 migration. We select only the columns needed for the run detail page list view.

- [ ] **Step 2: Verify no type errors**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

---

### Task 3: Add `getPipelineLogsAsc(runId)` Query

**Files:**
- Modify: `apps/web/src/lib/queries/pipelines.ts`

**Context:** The existing `getPipelineLogs` (line 74) orders by `created_at` descending. The run detail page needs ascending order for a chronological timeline display. We add a new function rather than modifying the existing one, since other code may depend on the descending order.

- [ ] **Step 1: Add `getPipelineLogsAsc` function**

Add the following function at the end of `apps/web/src/lib/queries/pipelines.ts` (after the function added in Task 2):

```typescript
export async function getPipelineLogsAsc(runId: string, limit: number = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

Key differences from `getPipelineLogs`:
- `ascending: true` instead of `ascending: false`
- Default limit of 100 instead of 50 (pipeline runs can produce many log entries)
- Uses `run_id` column (same as existing — the FK column is `run_id`, NOT `pipeline_run_id`)

- [ ] **Step 2: Verify no type errors**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

---

### Task 4: Fix Trigger API to Return `runId`

**Files:**
- Modify: `apps/web/src/app/api/pipelines/[id]/trigger/route.ts`

**Context:** The current trigger response (lines 32-41) returns `success`, `pipelineId`, `status`, `signalsIngested`, `signalsFiltered`, `itemsGenerated`, `errors`, and `durationMs` — but NOT `runId`. The `PipelineRunResult` type in `packages/core/src/types/engine.ts` includes `runId: string` (line 26). The trigger button enhancement in Part B needs `runId` to construct a link to `/pipelines/${slug}/runs/${runId}`.

- [ ] **Step 1: Add `runId` to the response JSON**

Edit `apps/web/src/app/api/pipelines/[id]/trigger/route.ts`. Replace the current response block:

```typescript
    return NextResponse.json({
      success: true,
      pipelineId: id,
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
```

With this updated version that includes `runId`:

```typescript
    return NextResponse.json({
      success: true,
      runId: result.runId,
      pipelineId: id,
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
```

The only change is adding `runId: result.runId` on the line after `success: true`.

- [ ] **Step 2: Verify no type errors**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors. `result` is typed as `PipelineRunResult` which has `runId: string`.

---

### Task 5: Commit

- [ ] **Step 1: Commit all changes**

```bash
git add apps/web/src/lib/queries/pipelines.ts apps/web/src/app/api/pipelines/\[id\]/trigger/route.ts
git commit -m "feat(pipelines): add run detail queries and return runId from trigger API

Add getPipelineRunDetail, getRunContentItems, and getPipelineLogsAsc
query functions. Fix trigger route to include runId in response for
the run detail page link."
```

---

## Summary of Changes

| Action | File | What |
|--------|------|------|
| Modify | `apps/web/src/lib/queries/pipelines.ts` | Add `getPipelineRunDetail(runId)` — single run by ID |
| Modify | `apps/web/src/lib/queries/pipelines.ts` | Add `getRunContentItems(runId)` — content items for a run |
| Modify | `apps/web/src/lib/queries/pipelines.ts` | Add `getPipelineLogsAsc(runId)` — logs in chronological order |
| Modify | `apps/web/src/app/api/pipelines/[id]/trigger/route.ts` | Add `runId: result.runId` to response JSON |

## Final State of `apps/web/src/lib/queries/pipelines.ts`

After all tasks, the file should contain these exports:

```typescript
// Existing (unchanged)
export async function getPipelineRunsToday() { ... }
export async function getLastRunPerPipeline() { ... }
export async function getRecentPipelineRuns(limit) { ... }
export async function getPipelineSuccessRate() { ... }
export async function getPipelineStats() { ... }
export async function getPipelineLogs(runId, limit) { ... }  // descending order

// New (added by this plan)
export async function getPipelineRunDetail(runId) { ... }
export async function getRunContentItems(runId) { ... }
export async function getPipelineLogsAsc(runId, limit) { ... }  // ascending order
```
