# Phase 2 Part D: Pipeline Detail Page + Settings Rewrite

**Date**: 2026-04-11
**Status**: Not Started
**Goal**: Build the pipeline detail page at `/pipelines/[slug]` with stats, run history, and recent content. Simplify Settings to 2 sections: Profile and Content Pillars.

## Architecture Overview

- **Pipeline Detail**: Server component at `/pipelines/[slug]`. Shows header with name + description + schedule + "Run Now", 3 stat cards, run history table, and recent content list. 404s for non-implemented pipelines.
- **Settings**: Simplified from 4 tabs to 2 sections (no tabs). Profile section shows user info + sign out. Content Pillars section uses the existing `/api/settings/pillar-toggles` API.

## File Map

### New Files
- `apps/web/src/app/(dashboard)/pipelines/[slug]/page.tsx`

### Modified Files
- `apps/web/src/app/(dashboard)/settings/page.tsx` — simplified to 2 sections

## Database Schema Reference

**pipeline_runs**: `id`, `pipeline_slug`, `pipeline_id`, `status` (running | completed | partial_success | failed), `signals_ingested`, `signals_filtered`, `items_generated`, `error`, `created_at`, `completed_at`

**content_items**: `id`, `title`, `platform`, `status`, `quality_score`, `pipeline_slug`, `created_at`

## Tasks

### Task 1: Create Pipeline Detail Page

- [ ] Create `apps/web/src/app/(dashboard)/pipelines/[slug]/page.tsx`

Server component that validates the slug against the 3 implemented pipelines, fetches pipeline runs and content items, and displays a comprehensive detail view. Uses `getPipelineRuns` and `getPipelineContentItems` from Part A.

```typescript
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, getRelativeTime } from '@/lib/utils';
import { PIPELINE_MAP } from '@influenceai/core';
import { getPipelineRuns, getPipelineContentItems } from '@/lib/queries/pipelines';
import { PipelineTriggerButton } from '@/components/dashboard/pipeline-trigger-button';
import {
  ArrowLeft,
  GitBranch,
  Radio,
  Radar,
  Clock,
  Activity,
  CheckCircle,
  XCircle,
  FileText,
  Zap,
  TrendingUp,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  Star,
} from 'lucide-react';

const IMPLEMENTED_SLUGS = new Set(['github-trends', 'signal-amplifier', 'release-radar']);

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitBranch,
  Radio,
  Radar,
};

const pipelineIconColors: Record<string, string> = {
  'github-trends': 'text-blue-400 bg-blue-500/10',
  'signal-amplifier': 'text-violet-400 bg-violet-500/10',
  'release-radar': 'text-amber-400 bg-amber-500/10',
};

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const statusBadgeVariant: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  pending_review: 'warning',
  approved: 'default',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
};

const statusLabels: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
};

function parseCronToHuman(cron?: string): string {
  if (!cron) return 'On-demand';
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

function mapRunStatus(dbStatus: string): 'success' | 'failed' | 'running' | 'idle' {
  if (dbStatus === 'completed' || dbStatus === 'partial_success') return 'success';
  if (dbStatus === 'running') return 'running';
  if (dbStatus === 'failed') return 'failed';
  return 'idle';
}

const runStatusConfig: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
  success: { color: 'text-emerald-400', label: 'Completed', icon: CheckCircle },
  failed: { color: 'text-red-400', label: 'Failed', icon: XCircle },
  running: { color: 'text-blue-400', label: 'Running', icon: Zap },
  idle: { color: 'text-zinc-500', label: 'Unknown', icon: Activity },
};

export default async function PipelineDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!IMPLEMENTED_SLUGS.has(slug)) {
    notFound();
  }

  const pipeline = PIPELINE_MAP.get(slug);
  if (!pipeline) notFound();

  let runs: Array<{
    id: string;
    pipeline_slug: string;
    status: string;
    items_generated: number | null;
    signals_ingested: number | null;
    signals_filtered: number | null;
    error: string | null;
    created_at: string;
    completed_at: string | null;
  }> = [];

  let contentItems: Array<{
    id: string;
    title: string;
    platform: string;
    status: string;
    quality_score: number | null;
    created_at: string;
  }> = [];

  try {
    [runs, contentItems] = await Promise.all([
      getPipelineRuns(slug, 20),
      getPipelineContentItems(slug, 10),
    ]);
  } catch {
    // Fallback to empty
  }

  // Compute stats
  const totalRuns = runs.length;
  const successfulRuns = runs.filter(
    (r) => r.status === 'completed' || r.status === 'partial_success'
  ).length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
  const totalItemsGenerated = runs.reduce((sum, r) => sum + (r.items_generated ?? 0), 0);

  const Icon = iconMap[pipeline.icon] || GitBranch;
  const iconColor = pipelineIconColors[slug] ?? 'text-zinc-400 bg-zinc-800';
  const schedule = parseCronToHuman(pipeline.schedule);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/pipelines"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pipelines
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn('rounded-lg p-3', iconColor)}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-50">{pipeline.name}</h1>
            <p className="mt-1 text-sm text-zinc-400">{pipeline.description}</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">{schedule}</span>
              </div>
              <span className="text-xs text-zinc-600">&middot;</span>
              <span className="text-xs text-zinc-500">{pipeline.outputVolume}</span>
              <span className="text-xs text-zinc-600">&middot;</span>
              <span className="text-xs text-zinc-500 capitalize">{pipeline.automationLevel} automation</span>
            </div>
          </div>
        </div>
        <PipelineTriggerButton
          pipelineSlug={pipeline.slug}
          pipelineName={pipeline.name}
          size="default"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-zinc-800 p-2">
                <Activity className="h-4 w-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-50">{totalRuns}</p>
                <p className="text-xs text-zinc-500">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-zinc-800 p-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-50">
                  {totalRuns > 0 ? `${successRate}%` : '--'}
                </p>
                <p className="text-xs text-zinc-500">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-zinc-800 p-2">
                <FileText className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-50">{totalItemsGenerated}</p>
                <p className="text-xs text-zinc-500">Items Generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Signals</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No runs recorded yet. Click "Run Now" to trigger this pipeline.
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => {
                    const s = mapRunStatus(run.status);
                    const cfg = runStatusConfig[s];
                    const StatusIcon = cfg.icon;

                    // Calculate duration
                    let durationStr = '--';
                    if (run.completed_at && run.created_at) {
                      const ms = new Date(run.completed_at).getTime() - new Date(run.created_at).getTime();
                      if (ms < 1000) durationStr = `${ms}ms`;
                      else if (ms < 60000) durationStr = `${(ms / 1000).toFixed(1)}s`;
                      else durationStr = `${Math.round(ms / 60000)}m`;
                    }

                    return (
                      <tr key={run.id} className="transition-colors hover:bg-zinc-800/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={cn('h-3.5 w-3.5', cfg.color)} />
                            <span className={cn('text-sm', cfg.color)}>{cfg.label}</span>
                          </div>
                          {run.error && (
                            <p className="mt-1 text-xs text-red-400/70 line-clamp-1">{run.error}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-zinc-300">{run.items_generated ?? 0}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-zinc-400">
                            {run.signals_ingested ?? 0} ingested / {run.signals_filtered ?? 0} filtered
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-zinc-400">{durationStr}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-zinc-500">
                            {getRelativeTime(run.created_at)}
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

      {/* Recent Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Content</CardTitle>
            <Link
              href={`/content?pipeline=${slug}`}
              className="text-xs text-violet-400 transition-colors hover:text-violet-300"
            >
              View all in library
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Quality</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {contentItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No content generated by this pipeline yet.
                    </td>
                  </tr>
                ) : (
                  contentItems.map((item) => {
                    const PlatformIcon = platformIcons[item.platform] ?? FileText;
                    return (
                      <tr key={item.id} className="transition-colors hover:bg-zinc-800/50">
                        <td className="px-6 py-4">
                          <Link
                            href={`/review/${item.id}`}
                            className="text-sm font-medium text-zinc-50 hover:text-violet-400 transition-colors line-clamp-1"
                          >
                            {item.title}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformIcon className="h-4 w-4 text-zinc-400" />
                            <span className="text-sm capitalize text-zinc-400">{item.platform}</span>
                          </div>
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
    </div>
  );
}
```

### Task 2: Rewrite Settings Page

- [ ] Rewrite `apps/web/src/app/(dashboard)/settings/page.tsx`

Simplify from 4 tabs to 2 stacked sections (no tabs). The Profile section fetches the user from Supabase client-side and shows email, avatar, and a sign-out button. The Content Pillars section uses the existing `/api/settings/pillar-toggles` API for toggle switches.

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PILLARS } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, getPillarColor } from '@/lib/utils';
import {
  User,
  LogOut,
  Loader2,
} from 'lucide-react';

interface UserInfo {
  email: string;
  name: string;
  avatarUrl?: string;
}

export default function SettingsPage() {
  const router = useRouter();

  // User state
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Pillar toggle state
  const [pillarStates, setPillarStates] = useState<Record<string, boolean>>(
    Object.fromEntries(PILLARS.map((p) => [p.slug, true])),
  );
  const [pillarsLoading, setPillarsLoading] = useState(true);
  const [pillarSaving, setPillarSaving] = useState<string | null>(null);

  // Load user
  useEffect(() => {
    async function loadUser() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setUser({
            email: data.user.email || '',
            name:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name ||
              data.user.email?.split('@')[0] ||
              'Operator',
            avatarUrl: data.user.user_metadata?.avatar_url,
          });
        }
      } catch {
        // Supabase not configured
      } finally {
        setUserLoading(false);
      }
    }
    loadUser();
  }, []);

  // Load pillar toggles
  const fetchPillarToggles = useCallback(async () => {
    setPillarsLoading(true);
    try {
      const res = await fetch('/api/settings/pillar-toggles');
      if (res.ok) {
        const data = await res.json();
        const merged = Object.fromEntries(PILLARS.map((p) => [p.slug, true]));
        for (const [slug, enabled] of Object.entries(data.toggles as Record<string, boolean>)) {
          merged[slug] = enabled;
        }
        setPillarStates(merged);
      }
    } catch {
      // Use defaults
    } finally {
      setPillarsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPillarToggles();
  }, [fetchPillarToggles]);

  // Toggle pillar handler
  const handleTogglePillar = async (slug: string) => {
    const newValue = !pillarStates[slug];
    setPillarSaving(slug);
    setPillarStates((prev) => ({ ...prev, [slug]: newValue }));

    try {
      const res = await fetch('/api/settings/pillar-toggles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, enabled: newValue }),
      });
      if (!res.ok) {
        setPillarStates((prev) => ({ ...prev, [slug]: !newValue }));
      }
    } catch {
      setPillarStates((prev) => ({ ...prev, [slug]: !newValue }));
    } finally {
      setPillarSaving(null);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your profile and content configuration</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {userLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-14 w-14 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
                    <User className="h-7 w-7 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50">
                    {user?.name || 'AI Operator'}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {user?.email || 'Not signed in'}
                  </p>
                </div>
              </div>
              {user && (
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Sign Out
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Pillars Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Content Pillars</CardTitle>
            <p className="text-sm text-zinc-400">
              {pillarsLoading ? (
                <Loader2 className="inline h-3 w-3 animate-spin" />
              ) : (
                `${Object.values(pillarStates).filter(Boolean).length} of ${PILLARS.length} active`
              )}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {PILLARS.map((pillar, i) => (
            <div key={pillar.slug}>
              <div className="flex items-center gap-4 px-6 py-4 transition hover:bg-zinc-800/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-zinc-50">{pillar.name}</h3>
                    <Badge className={cn('text-[10px]', getPillarColor(pillar.color))}>
                      {pillar.coreEmotion}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-1">{pillar.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                    <span>{pillar.frequency}</span>
                    <span>&middot;</span>
                    <span>{pillar.bestPlatforms.join(', ')}</span>
                    <span>&middot;</span>
                    <span className="capitalize">{pillar.automationLevel} automation</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pillarSaving === pillar.slug && (
                    <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                  )}
                  <button
                    onClick={() => handleTogglePillar(pillar.slug)}
                    disabled={pillarSaving === pillar.slug}
                    className={cn(
                      'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
                      pillarStates[pillar.slug]
                        ? 'bg-violet-500'
                        : 'bg-zinc-700',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                        pillarStates[pillar.slug]
                          ? 'translate-x-[22px]'
                          : 'translate-x-0.5',
                      )}
                    />
                  </button>
                </div>
              </div>
              {i < PILLARS.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Task 3: Commit

```bash
git add -A
git commit -m "feat(web): add pipeline detail page with stats and run history, simplify settings to profile + pillars"
```

## Verification

After completing all tasks:
1. `pnpm -F @influenceai/web build` should succeed with no type errors
2. `/pipelines/github-trends` shows pipeline detail with stats, run history, and recent content
3. `/pipelines/signal-amplifier` and `/pipelines/release-radar` also work
4. `/pipelines/youtube-series` returns 404 (not implemented)
5. "Run Now" button on detail page triggers pipeline with toast feedback
6. "View all in library" link navigates to `/content?pipeline=github-trends`
7. `/settings` shows 2 sections: Profile (with sign out) and Content Pillars (with toggle switches)
8. Pillar toggles persist via the existing API
9. No remaining references to old tab-based settings UI
