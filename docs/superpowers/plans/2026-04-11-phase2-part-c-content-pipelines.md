# Phase 2 Part C: Content Page Rewrite + Pipelines Page + PipelineTriggerButton

**Date**: 2026-04-11
**Status**: Not Started
**Goal**: Rewrite the Content Library with pipeline column, rebuild Pipelines page to show only 3 implemented pipelines, and create an improved PipelineTriggerButton with toast feedback.

## Architecture Overview

- **PipelineTriggerButton**: Client component replacing `PipelineTrigger`. Calls `POST /api/pipelines/[id]/trigger`, shows loading spinner, uses `sonner` toast for success/error feedback.
- **Content Page**: Server component with status tabs, search, platform filter, table with Title/Platform/Pipeline/Status/Quality/Created columns, pagination.
- **Pipelines Page**: Server component showing only the 3 implemented pipelines (`github-trends`, `signal-amplifier`, `release-radar`). Each card shows name, description, schedule, last run, metrics, "Run Now" button, "View Details" link.

## File Map

### New Files
- `apps/web/src/components/dashboard/pipeline-trigger-button.tsx`

### Modified Files
- `apps/web/src/app/(dashboard)/content/page.tsx` — rewrite with pipeline column
- `apps/web/src/app/(dashboard)/pipelines/page.tsx` — rewrite for 3 implemented pipelines only

### Deleted Files
- `apps/web/src/components/dashboard/pipeline-trigger.tsx` — replaced by pipeline-trigger-button.tsx

## Database Schema Reference

**content_items**: `id`, `title`, `body`, `pillar_slug`, `pipeline_slug`, `platform`, `format`, `status`, `quality_score`, `created_at`

**pipeline_runs**: `id`, `pipeline_slug`, `status`, `items_generated`, `signals_ingested`, `created_at`, `completed_at`

## Tasks

### Task 1: Create PipelineTriggerButton Component

- [ ] Create `apps/web/src/components/dashboard/pipeline-trigger-button.tsx`
- [ ] Delete `apps/web/src/components/dashboard/pipeline-trigger.tsx`

Replaces the old `PipelineTrigger` component. Adds sonner toast notifications for success/error feedback. The existing sonner Toaster is already mounted in the app layout.

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PipelineTriggerButtonProps {
  pipelineSlug: string;
  pipelineName: string;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
  className?: string;
}

export function PipelineTriggerButton({
  pipelineSlug,
  pipelineName,
  size = 'sm',
  variant = 'default',
  className,
}: PipelineTriggerButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleTrigger = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pipelines/${pipelineSlug}/trigger`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger pipeline');
      }

      toast.success(`${pipelineName} started`, {
        description: `Generated ${data.itemsGenerated ?? 0} items in ${((data.durationMs ?? 0) / 1000).toFixed(1)}s`,
      });
      router.refresh();
    } catch (error) {
      toast.error(`${pipelineName} failed`, {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleTrigger}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          Running...
        </>
      ) : (
        <>
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Run Now
        </>
      )}
    </Button>
  );
}
```

### Task 2: Rewrite Content Library Page

- [ ] Rewrite `apps/web/src/app/(dashboard)/content/page.tsx`

Adds a Pipeline column to the table, keeps status tabs and search. Uses the existing `getContentItems` query (now with `pipeline` filter support from Part A). Includes pagination.

```typescript
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, getStatusColor, getPillarColor } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  Search,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Star,
} from 'lucide-react';
import { getContentItems } from '@/lib/queries/content';

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const statusLabels: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
};

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending_review: 'warning',
  approved: 'default',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
};

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

const PLATFORM_OPTIONS = [
  { value: '', label: 'All Platforms' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
];

export default async function ContentLibrary({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; platform?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status && params.status !== 'all' ? params.status : undefined;
  const search = params.search || undefined;
  const platform = params.platform || undefined;
  const page = parseInt(params.page ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let items: Array<{
    id: string;
    title: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    platform: string;
    status: string;
    quality_score: number | null;
    created_at: string;
  }> = [];
  let total = 0;

  try {
    const result = await getContentItems({ status, search, platform, limit, offset });
    items = result.items;
    total = result.total;
  } catch {
    // Fallback to empty on error
  }

  const activeTab = params.status ?? 'all';
  const activePlatform = params.platform ?? '';

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const s = overrides.status ?? params.status;
    if (s && s !== 'all') p.set('status', s);
    const srch = overrides.search !== undefined ? overrides.search : params.search;
    if (srch) p.set('search', srch);
    const plat = overrides.platform !== undefined ? overrides.platform : params.platform;
    if (plat) p.set('platform', plat);
    const pg = overrides.page ?? params.page;
    if (pg && pg !== '1') p.set('page', pg);
    const qs = p.toString();
    return qs ? `/content?${qs}` : '/content';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Content Library</h1>
        <p className="mt-1 text-sm text-zinc-400">{total} total pieces of content</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildUrl({ status: tab.value, page: '1' })}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-300'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Platform filter */}
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {PLATFORM_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildUrl({ platform: opt.value || undefined, page: '1' })}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  activePlatform === opt.value
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-300'
                )}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Search */}
          <form className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="text"
              name="search"
              defaultValue={search ?? ''}
              placeholder="Search content..."
              className="bg-transparent text-sm text-zinc-50 placeholder-zinc-500 outline-none w-48"
            />
            {status && <input type="hidden" name="status" value={status} />}
            {platform && <input type="hidden" name="platform" value={platform} />}
          </form>
        </div>
      </div>

      {/* Content Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Pipeline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Quality</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No content found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
                    const PlatformIcon = platformIcons[item.platform] ?? FileText;
                    const pipelineLabel = item.pipeline_slug
                      ? item.pipeline_slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
                      : null;

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-zinc-800/50">
                        <td className="px-6 py-4">
                          <Link
                            href={`/review/${item.id}`}
                            className="flex items-center gap-3 group"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-50 line-clamp-1 group-hover:text-violet-400 transition-colors">
                              {item.title}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformIcon className="h-4 w-4 text-zinc-400" />
                            <span className="text-sm capitalize text-zinc-400">{item.platform}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {pipelineLabel ? (
                            <Badge variant="secondary" className="text-xs">
                              {pipelineLabel}
                            </Badge>
                          ) : (
                            <span className="text-xs text-zinc-600">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusBadgeVariant[item.status] ?? 'secondary'}>
                            {statusLabels[item.status] ?? item.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {item.quality_score !== null ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-400" />
                              <span className="text-sm text-zinc-300">{item.quality_score}/10</span>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-zinc-500">
                            {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            {offset + limit < total && (
              <Link href={buildUrl({ page: String(page + 1) })}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Task 3: Rewrite Pipelines Page

- [ ] Rewrite `apps/web/src/app/(dashboard)/pipelines/page.tsx`

Show only the 3 implemented pipelines. Each card includes: icon, name, description, schedule (parsed from cron or "On-demand"), last run status + time, items generated count, "Run Now" button (via `PipelineTriggerButton`), and "View Details" link to `/pipelines/[slug]`.

```typescript
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, getRelativeTime } from '@/lib/utils';
import { PIPELINE_MAP } from '@influenceai/core';
import { getLastRunPerPipeline, getPipelineStats } from '@/lib/queries/pipelines';
import { PipelineTriggerButton } from '@/components/dashboard/pipeline-trigger-button';
import {
  GitBranch,
  Radio,
  Radar,
  ArrowRight,
  Clock,
  Zap,
  FileText,
  CheckCircle,
  XCircle,
  Timer,
} from 'lucide-react';

const IMPLEMENTED_SLUGS = ['github-trends', 'signal-amplifier', 'release-radar'] as const;

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitBranch,
  Radio,
  Radar,
};

const pipelineColors: Record<string, string> = {
  'github-trends': 'from-blue-500/20 to-blue-600/5',
  'signal-amplifier': 'from-violet-500/20 to-violet-600/5',
  'release-radar': 'from-amber-500/20 to-amber-600/5',
};

const pipelineIconColors: Record<string, string> = {
  'github-trends': 'text-blue-400 bg-blue-500/10',
  'signal-amplifier': 'text-violet-400 bg-violet-500/10',
  'release-radar': 'text-amber-400 bg-amber-500/10',
};

function parseCronToHuman(cron?: string): string {
  if (!cron) return 'On-demand';
  // Simple cron parsing for the patterns we use
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (hour.startsWith('*/')) {
      return `Every ${hour.slice(2)} hours`;
    }
    return `Daily at ${hour}:${minute.padStart(2, '0')} UTC`;
  }
  if (dayOfWeek !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[parseInt(dayOfWeek)] ?? dayOfWeek;
    return `${day} at ${hour}:${minute.padStart(2, '0')} UTC`;
  }
  return cron;
}

function mapRunStatus(dbStatus?: string): 'idle' | 'running' | 'success' | 'failed' {
  if (!dbStatus) return 'idle';
  if (dbStatus === 'completed' || dbStatus === 'partial_success') return 'success';
  if (dbStatus === 'running') return 'running';
  if (dbStatus === 'failed') return 'failed';
  return 'idle';
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  idle: { icon: Timer, color: 'text-zinc-500', label: 'Never run' },
  running: { icon: Zap, color: 'text-blue-400', label: 'Running' },
  success: { icon: CheckCircle, color: 'text-emerald-400', label: 'Succeeded' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
};

export default async function PipelinesPage() {
  let lastRuns: Record<string, { status: string; created_at: string; items_generated?: number }> = {};
  let pipelineStats = { totalRuns: 0, successRate: 0, totalGenerated: 0 };

  try {
    [lastRuns, pipelineStats] = await Promise.all([
      getLastRunPerPipeline(),
      getPipelineStats(),
    ]);
  } catch {
    // Fallback to defaults on error
  }

  const pipelines = IMPLEMENTED_SLUGS.map((slug) => PIPELINE_MAP.get(slug)!).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Pipelines</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {pipelineStats.totalRuns} total runs &middot; {pipelineStats.successRate}% success rate &middot; {pipelineStats.totalGenerated} items generated
        </p>
      </div>

      {/* Pipeline Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {pipelines.map((pipeline) => {
          const Icon = iconMap[pipeline.icon] || GitBranch;
          const run = lastRuns[pipeline.slug];
          const status = mapRunStatus(run?.status);
          const StatusIcon = statusConfig[status].icon;
          const schedule = parseCronToHuman(pipeline.schedule);
          const iconColor = pipelineIconColors[pipeline.slug] ?? 'text-zinc-400 bg-zinc-800';
          const gradient = pipelineColors[pipeline.slug] ?? '';

          return (
            <Card
              key={pipeline.slug}
              className="flex flex-col overflow-hidden"
            >
              {/* Gradient accent bar */}
              <div className={cn('h-1 bg-gradient-to-r', gradient)} />

              <CardContent className="flex-1 p-6">
                {/* Icon + Name */}
                <div className="flex items-start gap-3">
                  <div className={cn('rounded-lg p-2.5', iconColor)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-50">{pipeline.name}</h3>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{schedule}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-zinc-400 line-clamp-2">
                  {pipeline.description}
                </p>

                {/* Last run status */}
                <div className="mt-4 flex items-center gap-2">
                  <StatusIcon className={cn('h-3.5 w-3.5', statusConfig[status].color)} />
                  <span className={cn('text-xs', statusConfig[status].color)}>
                    {statusConfig[status].label}
                  </span>
                  {run?.created_at && (
                    <>
                      <span className="text-xs text-zinc-600">&middot;</span>
                      <span className="text-xs text-zinc-500">{getRelativeTime(run.created_at)}</span>
                    </>
                  )}
                </div>

                {/* Items generated */}
                {run?.items_generated !== undefined && run.items_generated > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-zinc-500" />
                    <span className="text-xs text-zinc-500">
                      {run.items_generated} item{run.items_generated !== 1 ? 's' : ''} last run
                    </span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="gap-2 border-t border-zinc-800 px-6 py-4">
                <PipelineTriggerButton
                  pipelineSlug={pipeline.slug}
                  pipelineName={pipeline.name}
                  size="sm"
                  className="flex-1"
                />
                <Link href={`/pipelines/${pipeline.slug}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                    <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

### Task 4: Commit

```bash
git rm apps/web/src/components/dashboard/pipeline-trigger.tsx
git add -A
git commit -m "feat(web): rewrite Content and Pipelines pages, add PipelineTriggerButton with toast feedback"
```

## Verification

After completing all tasks:
1. `pnpm -F @influenceai/web build` should succeed with no type errors
2. Content Library at `/content` shows 6-column table (Title, Platform, Pipeline, Status, Quality, Created)
3. Status tabs and platform filter pills work via search params
4. Pipelines page shows exactly 3 cards: GitHub Trends, Signal Amplifier, Release Radar
5. Each pipeline card shows schedule ("Daily at 8:00 UTC", "Every 3 hours", "On-demand")
6. "Run Now" button triggers pipeline and shows success/error toast
7. "View Details" links to `/pipelines/[slug]` (built in Part D)
8. No remaining imports of the old `PipelineTrigger` component
