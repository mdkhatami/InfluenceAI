# Phase 4 Part B: Pipeline Run Detail Page + Trigger Button Enhancement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a run detail page that shows a full breakdown of a single pipeline execution (stats, chronological log timeline, generated content, errors). Enhance the pipeline trigger button to link to the run detail page after a successful trigger.

**Prerequisites:** Phase 4 Part A must be completed first (query functions + trigger API fix).

**Architecture:** The run detail page is a server component at `apps/web/src/app/(dashboard)/pipelines/[slug]/runs/[runId]/page.tsx`. It uses the queries from Part A. The log timeline needs a collapsible toggle, so it is a small client component (`LogTimeline`) in a separate file. The trigger button enhancement modifies the existing `apps/web/src/components/dashboard/pipeline-trigger.tsx`.

**Tech Stack:** Next.js 15 App Router, Supabase server client, shadcn/ui (Badge, Card, Button), Tailwind CSS v4, lucide-react icons

---

### Task 1: Create the Pipeline Run Detail Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/pipelines/[slug]/runs/[runId]/page.tsx`

**Context:**
- Route: `/pipelines/:slug/runs/:runId`
- This is a server component — no `'use client'` directive
- Uses `getPipelineRunDetail`, `getPipelineLogsAsc`, `getRunContentItems` from Part A
- Uses `getPipeline` from `@influenceai/core` for pipeline name in breadcrumb
- The `[slug]` param is the pipeline slug (e.g., `github-trends`), used for the back link and pipeline name lookup
- The `[runId]` param is the UUID of the `pipeline_runs` row

- [ ] **Step 1: Create the run detail page**

Create `apps/web/src/app/(dashboard)/pipelines/[slug]/runs/[runId]/page.tsx`:

```typescript
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPipeline } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getPipelineRunDetail,
  getPipelineLogsAsc,
  getRunContentItems,
} from '@/lib/queries/pipelines';
import { LogTimeline } from '@/components/dashboard/log-timeline';
import {
  ArrowLeft,
  Radio,
  Filter,
  FileText,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'In progress...';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function getRunStatusBadge(status: string) {
  const map: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'default'; label: string }> = {
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'destructive', label: 'Failed' },
    partial_success: { variant: 'warning', label: 'Partial Success' },
    running: { variant: 'default', label: 'Running' },
  };
  const entry = map[status] ?? { variant: 'secondary' as const, label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function getPlatformLabel(platform: string): string {
  const map: Record<string, string> = {
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
    instagram: 'Instagram',
    youtube: 'YouTube',
  };
  return map[platform] ?? platform;
}

function getContentStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending_review: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    published: 'border-green-500/20 bg-green-500/10 text-green-400',
    rejected: 'border-red-500/20 bg-red-500/10 text-red-400',
    draft: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
    scheduled: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  };
  return map[status] ?? map.draft;
}

export default async function PipelineRunDetailPage({
  params,
}: {
  params: Promise<{ slug: string; runId: string }>;
}) {
  const { slug, runId } = await params;

  const [run, logs, contentItems] = await Promise.all([
    getPipelineRunDetail(runId),
    getPipelineLogsAsc(runId),
    getRunContentItems(runId),
  ]);

  if (!run) notFound();

  const pipeline = getPipeline(slug);
  const pipelineName = pipeline?.name ?? slug;
  const duration = formatDuration(run.started_at ?? run.created_at, run.completed_at);
  const startedDate = new Date(run.started_at ?? run.created_at);
  const errorCount = logs.filter((l: { level: string }) => l.level === 'error').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href={`/pipelines/${slug}`}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-50">{pipelineName}</h1>
            {getRunStatusBadge(run.status)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span className="font-mono text-xs text-zinc-500" title={runId}>
              Run {runId.slice(0, 8)}...
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span>
              {startedDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at{' '}
              {startedDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>

      {/* Run Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Radio className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Signals Ingested</p>
                <p className="text-xl font-bold text-zinc-50">{run.signals_ingested ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Filter className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Signals Filtered</p>
                <p className="text-xl font-bold text-zinc-50">{run.signals_filtered ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <FileText className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Items Generated</p>
                <p className="text-xl font-bold text-zinc-50">{run.items_generated ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Errors</p>
                <p className="text-xl font-bold text-zinc-50">{errorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execution Log */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">
              Execution Log ({logs.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogTimeline logs={logs} />
          </CardContent>
        </Card>
      )}

      {/* Generated Content */}
      {contentItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">
              Generated Content ({contentItems.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contentItems.map((item: {
              id: string;
              title: string;
              platform: string;
              status: string;
              quality_score: number | null;
              created_at: string;
            }) => (
              <Link
                key={item.id}
                href={`/review/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 p-4 transition hover:border-zinc-700 hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-50">
                    {item.title || 'Untitled'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {getPlatformLabel(item.platform)}
                    </Badge>
                    <Badge className={getContentStatusColor(item.status)}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                    {item.quality_score != null && (
                      <span className="text-xs text-zinc-500">
                        Score: {item.quality_score}/10
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="ml-4 h-4 w-4 shrink-0 text-zinc-500" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Error Details */}
      {run.error && (
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-400">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm leading-relaxed text-red-300">
              {run.error}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {logs.length === 0 && contentItems.length === 0 && !run.error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-zinc-400">No log entries or content found for this run.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the directory structure exists**

The route is `apps/web/src/app/(dashboard)/pipelines/[slug]/runs/[runId]/page.tsx`. The `[slug]` directory and `runs/[runId]` subdirectories are new.

Run: `mkdir -p apps/web/src/app/\(dashboard\)/pipelines/\[slug\]/runs/\[runId\]`

- [ ] **Step 3: Verify no type errors**

Run: `pnpm -F @influenceai/web type-check`
Expected: Will fail until Task 2 (LogTimeline component) is created. Proceed to Task 2.

---

### Task 2: Create the LogTimeline Client Component

**Files:**
- Create: `apps/web/src/components/dashboard/log-timeline.tsx`

**Context:** This is a `'use client'` component because it needs `useState` for the collapsible toggle. When there are more than 10 log entries, it shows the first 5 and last 5 with a "Show all X entries" button in between. When expanded, it shows all entries.

Step badge colors by step name:
- `ingest` = blue-500
- `dedup` = purple-500
- `relevance` = amber-500
- `filter` = green-500
- `generate` = violet-500
- `runner` = red-500
- fallback = zinc-500

Log level colors:
- `info` = zinc-400
- `warn` = yellow-400
- `error` = red-400

- [ ] **Step 1: Create the LogTimeline component**

Create `apps/web/src/components/dashboard/log-timeline.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LogEntry {
  id: string;
  run_id: string;
  step: string;
  level: string;
  message: string;
  created_at: string;
}

const stepColors: Record<string, { bg: string; text: string }> = {
  ingest: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  dedup: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  relevance: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  filter: { bg: 'bg-green-500/10', text: 'text-green-500' },
  generate: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
  runner: { bg: 'bg-red-500/10', text: 'text-red-500' },
};

const levelColors: Record<string, string> = {
  info: 'text-zinc-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

function getStepColor(step: string) {
  // Match on partial step name (e.g., "ingest_signals" matches "ingest")
  for (const [key, colors] of Object.entries(stepColors)) {
    if (step.toLowerCase().includes(key)) return colors;
  }
  return { bg: 'bg-zinc-500/10', text: 'text-zinc-500' };
}

function formatLogTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const COLLAPSE_THRESHOLD = 10;
const VISIBLE_ENDS = 5;

export function LogTimeline({ logs }: { logs: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = logs.length > COLLAPSE_THRESHOLD;
  const hiddenCount = logs.length - VISIBLE_ENDS * 2;

  const visibleLogs = !shouldCollapse || expanded
    ? logs
    : null; // handled inline for split rendering

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-3 bottom-3 w-px bg-zinc-800" />

      <div className="space-y-0">
        {shouldCollapse && !expanded ? (
          <>
            {/* First N entries */}
            {logs.slice(0, VISIBLE_ENDS).map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))}

            {/* Collapsed indicator */}
            <div className="relative flex items-center py-2 pl-6">
              <div className="absolute left-[5px] h-2.5 w-2.5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="ml-2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <ChevronDown className="mr-1 h-3 w-3" />
                Show all {logs.length} entries ({hiddenCount} hidden)
              </Button>
            </div>

            {/* Last N entries */}
            {logs.slice(-VISIBLE_ENDS).map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))}
          </>
        ) : (
          <>
            {(visibleLogs ?? logs).map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))}

            {shouldCollapse && expanded && (
              <div className="relative flex items-center py-2 pl-6">
                <div className="absolute left-[5px] h-2.5 w-2.5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(false)}
                  className="ml-2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  <ChevronUp className="mr-1 h-3 w-3" />
                  Collapse
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LogEntryRow({ log }: { log: LogEntry }) {
  const stepColor = getStepColor(log.step);
  const levelColor = levelColors[log.level] ?? 'text-zinc-400';

  return (
    <div className="group relative flex items-start gap-3 py-1.5 pl-6">
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-[3px] top-[10px] h-3 w-3 rounded-full border-2 border-zinc-900',
          log.level === 'error'
            ? 'bg-red-500'
            : log.level === 'warn'
              ? 'bg-yellow-500'
              : 'bg-zinc-600',
        )}
      />

      {/* Timestamp */}
      <span className="w-[72px] shrink-0 pt-0.5 font-mono text-xs text-zinc-600">
        {formatLogTime(log.created_at)}
      </span>

      {/* Step badge */}
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium',
          stepColor.bg,
          stepColor.text,
        )}
      >
        {log.step}
      </span>

      {/* Level indicator + message */}
      <span className={cn('flex-1 text-sm', levelColor)}>
        {log.level !== 'info' && (
          <span className="mr-1 font-medium uppercase">[{log.level}]</span>
        )}
        {log.message}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors. The run detail page from Task 1 imports `LogTimeline` from this file.

---

### Task 3: Enhance the Pipeline Trigger Button

**Files:**
- Modify: `apps/web/src/components/dashboard/pipeline-trigger.tsx`

**Context:** The existing `PipelineTrigger` component (at `apps/web/src/components/dashboard/pipeline-trigger.tsx`) fires a POST to `/api/pipelines/${pipelineSlug}/trigger` and refreshes the page on success. We enhance it to:
1. Store the `runId` from the response
2. Show a "View Run" link after successful completion
3. Link to `/pipelines/${slug}/runs/${runId}`

Note: Phase 3 installs sonner. We show the link inline below the button for persistent visibility (better than a disappearing toast).

- [ ] **Step 1: Replace the trigger component with the enhanced version**

Replace the entire contents of `apps/web/src/components/dashboard/pipeline-trigger.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Loader2, ExternalLink } from 'lucide-react';

interface PipelineTriggerProps {
  pipelineSlug: string;
  disabled?: boolean;
}

export function PipelineTrigger({ pipelineSlug, disabled }: PipelineTriggerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async () => {
    setIsLoading(true);
    setError(null);
    setLastRunId(null);
    try {
      const response = await fetch(`/api/pipelines/${pipelineSlug}/trigger`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to trigger pipeline');
      }
      if (data.runId) {
        setLastRunId(data.runId);
      }
      router.refresh();
    } catch (err) {
      console.error('Failed to trigger pipeline:', err);
      setError(err instanceof Error ? err.message : 'Failed to trigger pipeline');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size="sm"
        variant="default"
        onClick={handleTrigger}
        disabled={disabled || isLoading}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-1" />
            Run Now
          </>
        )}
      </Button>

      {lastRunId && (
        <Link
          href={`/pipelines/${pipelineSlug}/runs/${lastRunId}`}
          className="flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-violet-400 transition hover:bg-violet-500/10 hover:text-violet-300"
        >
          <ExternalLink className="h-3 w-3" />
          View Run
        </Link>
      )}

      {error && (
        <p className="text-center text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
```

Key changes from the original:
1. Added `lastRunId` state — set from `data.runId` in the response
2. Added `error` state — shows inline error message
3. After success, renders a "View Run" link pointing to `/pipelines/${pipelineSlug}/runs/${lastRunId}`
4. Wrapped button in a `flex flex-col` container for the optional link/error below it
5. Added `w-full` to the button (was implicit before since it was the only child)
6. Parse response JSON to extract both `runId` and potential error messages
7. Reset `lastRunId` and `error` at the start of each trigger

- [ ] **Step 2: Verify no type errors**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

- [ ] **Step 3: Verify the pipelines page still renders correctly**

The `PipelineTrigger` component is used in `apps/web/src/app/(dashboard)/pipelines/page.tsx` at line 184:
```tsx
<PipelineTrigger pipelineSlug={pipeline.slug} />
```

The wrapper `div` with `flex-col` will stack inside the existing `flex-1` container. The button keeps `w-full` so it fills the same space. The "View Run" link only appears after a successful trigger. No changes to the parent page are needed.

---

### Task 4: Commit

- [ ] **Step 1: Commit all changes**

```bash
git add apps/web/src/app/\(dashboard\)/pipelines/\[slug\]/runs/ apps/web/src/components/dashboard/log-timeline.tsx apps/web/src/components/dashboard/pipeline-trigger.tsx
git commit -m "feat(pipelines): add run detail page with log timeline and trigger link

New route /pipelines/:slug/runs/:runId shows run summary stats,
chronological execution log with collapsible timeline, generated
content list, and error details. Trigger button now shows a
'View Run' link after successful pipeline execution."
```

---

## Summary of Changes

| Action | File | What |
|--------|------|------|
| Create | `apps/web/src/app/(dashboard)/pipelines/[slug]/runs/[runId]/page.tsx` | Run detail page (server component) |
| Create | `apps/web/src/components/dashboard/log-timeline.tsx` | Collapsible log timeline (client component) |
| Modify | `apps/web/src/components/dashboard/pipeline-trigger.tsx` | Add `runId` capture + "View Run" link |

## Design Reference

### Run Detail Page Layout

```
+-------------------------------------------------------+
| [<-] GitHub Trends Daily Digest    [Completed]        |
|      Run abc12345...  Apr 11, 2026 at 08:00  2m 14s   |
+-------------------------------------------------------+

+-------------+  +-------------+  +-------------+  +----+
| Signals     |  | Signals     |  | Items       |  |Err |
| Ingested    |  | Filtered    |  | Generated   |  |ors |
|     25      |  |      8      |  |      3      |  | 0  |
+-------------+  +-------------+  +-------------+  +----+

+-------------------------------------------------------+
| Execution Log (47 entries)                            |
|-------------------------------------------------------|
| o 08:00:01  [ingest]    Starting signal ingestion     |
| o 08:00:03  [ingest]    Fetched 25 GitHub repos       |
| o 08:00:03  [dedup]     Checking for duplicates       |
| o 08:00:04  [dedup]     Removed 2 duplicates          |
| o 08:00:04  [relevance] Scoring 23 signals            |
|                                                       |
|   [v] Show all 47 entries (37 hidden)                 |
|                                                       |
| o 08:02:10  [generate]  Generated item for twitter    |
| o 08:02:12  [generate]  Generated item for linkedin   |
| o 08:02:14  [runner]    Pipeline completed             |
| o 08:02:14  [runner]    Run finished in 133s          |
| o 08:02:14  [runner]    Status: completed             |
+-------------------------------------------------------+

+-------------------------------------------------------+
| Generated Content (3 items)                           |
|-------------------------------------------------------|
| 3 AI repos blowing up on GitHub...  [LinkedIn]  [->]  |
|   [pending_review]  Score: 8/10                       |
|-------------------------------------------------------|
| Open-source GPT-4 alternative...    [Twitter]   [->]  |
|   [pending_review]  Score: 7/10                       |
|-------------------------------------------------------|
| The repo every AI engineer...       [LinkedIn]  [->]  |
|   [approved]  Score: 9/10                             |
+-------------------------------------------------------+
```

### Trigger Button States

```
Before trigger:     [Play] Run Now

During trigger:     [Spin] Running...

After success:      [Play] Run Now
                    [->] View Run

After error:        [Play] Run Now
                    Failed to trigger pipeline
```

### Color Reference

| Element | Color Classes |
|---------|---------------|
| Status: completed | Badge variant="success" (emerald) |
| Status: failed | Badge variant="destructive" (red) |
| Status: partial_success | Badge variant="warning" (amber) |
| Status: running | Badge variant="default" (blue) |
| Step: ingest | bg-blue-500/10 text-blue-500 |
| Step: dedup | bg-purple-500/10 text-purple-500 |
| Step: relevance | bg-amber-500/10 text-amber-500 |
| Step: filter | bg-green-500/10 text-green-500 |
| Step: generate | bg-violet-500/10 text-violet-500 |
| Step: runner | bg-red-500/10 text-red-500 |
| Log: info | text-zinc-400 |
| Log: warn | text-yellow-400, yellow dot |
| Log: error | text-red-400, red dot |
| Timeline dot: info | bg-zinc-600 |
| Timeline dot: warn | bg-yellow-500 |
| Timeline dot: error | bg-red-500 |
| "View Run" link | text-violet-400 hover:text-violet-300 |
