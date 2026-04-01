# Plan 2: Wire Dashboard with Real Supabase Data

**Date**: 2026-04-01  
**Status**: Not Started  
**Goal**: Replace all mock data in the dashboard with real Supabase queries

## Architecture Overview

- **Query Layer**: `apps/web/src/lib/queries/` - Reusable server-side query functions
- **Server Components**: Dashboard pages fetch data directly (no API routes for reads)
- **API Routes**: Only for mutations (approve, reject, edit content)
- **Server Client**: Use existing `apps/web/src/lib/supabase/server.ts` `createClient()`

## File Map

### New Files
- `apps/web/src/lib/queries/content.ts` - Content queries (items, stats, scheduling)
- `apps/web/src/lib/queries/pipelines.ts` - Pipeline run queries
- `apps/web/src/lib/queries/analytics.ts` - Analytics aggregations
- `apps/web/src/app/api/content/[id]/route.ts` - Content item GET/PUT endpoint
- `apps/web/src/components/dashboard/content-actions.tsx` - Client wrapper for approve/reject buttons
- `apps/web/src/components/dashboard/pipeline-trigger.tsx` - Client wrapper for Run Now button

### Modified Files
- `apps/web/src/app/(dashboard)/page.tsx` - Command Center
- `apps/web/src/app/(dashboard)/content/page.tsx` - Content Library
- `apps/web/src/app/(dashboard)/pipelines/page.tsx` - Pipelines
- `apps/web/src/app/(dashboard)/review/page.tsx` - Review Queue
- `apps/web/src/app/(dashboard)/schedule/page.tsx` - Schedule
- `apps/web/src/app/(dashboard)/analytics/page.tsx` - Analytics
- `apps/web/src/app/api/content/route.ts` - Content list endpoint

## Database Schema Reference

**content_items**:
- `id`, `title`, `body`, `pillar_slug`, `pipeline_slug`, `platform`, `format`
- `status` (pending_review | approved | scheduled | published | rejected | replaced)
- `quality_score`, `generation_model`, `token_usage` (jsonb)
- `signal_id`, `pipeline_run_id`, `rejection_reason`
- `created_at`, `updated_at`, `scheduled_at`

**pipeline_runs**:
- `id`, `pipeline_slug`, `pipeline_id`, `status` (running | completed | partial_success | failed)
- `signals_ingested`, `signals_filtered`, `items_generated`, `error`
- `trigger_task_id`, `created_at`, `completed_at`

**pipeline_logs**:
- `id`, `run_id`, `step`, `level`, `message`, `created_at`

**content_signals**:
- `id`, `source`, `source_type`, `external_id`, `title`, `url`, `summary`
- `metadata`, `scored_relevance`, `dedup_hash`, `ingested_at`

## Tasks

### Task 1: Create Content Query Module

- [ ] Create `apps/web/src/lib/queries/content.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export async function getContentItems(filters?: {
  status?: string;
  pillar?: string;
  platform?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from('content_items')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.pillar) {
    query = query.eq('pillar_slug', filters.pillar);
  }
  if (filters?.platform) {
    query = query.eq('platform', filters.platform);
  }
  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0 };
}

export async function getContentStats() {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [thisWeek, pendingReview, totalPublished] = await Promise.all([
    supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString()),
    supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    supabase
      .from('content_items')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published'),
  ]);

  return {
    contentThisWeek: thisWeek.count ?? 0,
    pendingReview: pendingReview.count ?? 0,
    totalPublished: totalPublished.count ?? 0,
  };
}

export async function getContentByPillar() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('pillar_slug');

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const item of data ?? []) {
    counts[item.pillar_slug] = (counts[item.pillar_slug] ?? 0) + 1;
  }
  return counts;
}

export async function getContentPerDay(days: number = 14) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('content_items')
    .select('created_at')
    .gte('created_at', since.toISOString())
    .order('created_at');

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const item of data ?? []) {
    const day = new Date(item.created_at).toISOString().split('T')[0];
    counts[day] = (counts[day] ?? 0) + 1;
  }

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    result.push({ date: key, count: counts[key] ?? 0 });
  }
  return result;
}

export async function getScheduledContent() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .in('status', ['approved', 'scheduled'])
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getRecentActivity(limit: number = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('id, title, pillar_slug, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getContentItem(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('*, content_signals(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] Commit: `feat(web): add content query functions for dashboard data`

### Task 2: Create Pipelines Query Module

- [ ] Create `apps/web/src/lib/queries/pipelines.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export async function getPipelineRunsToday() {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('pipeline_runs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());

  if (error) throw error;
  return count ?? 0;
}

export async function getLastRunPerPipeline() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const lastRuns: Record<string, any> = {};
  for (const run of data ?? []) {
    const slug = run.pipeline_slug ?? run.pipeline_id;
    if (!lastRuns[slug]) {
      lastRuns[slug] = run;
    }
  }
  return lastRuns;
}

export async function getRecentPipelineRuns(limit: number = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getPipelineSuccessRate() {
  const supabase = await createClient();

  const [total, success] = await Promise.all([
    supabase
      .from('pipeline_runs')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('pipeline_runs')
      .select('id', { count: 'exact', head: true })
      .in('status', ['completed', 'partial_success']),
  ]);

  const totalCount = total.count ?? 0;
  const successCount = success.count ?? 0;

  return totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
}

export async function getPipelineStats() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('items_generated, status');

  if (error) throw error;

  let totalGenerated = 0;
  let successCount = 0;
  let totalRuns = data?.length ?? 0;

  for (const run of data ?? []) {
    totalGenerated += run.items_generated ?? 0;
    if (run.status === 'completed' || run.status === 'partial_success') {
      successCount++;
    }
  }

  return {
    totalGenerated,
    totalRuns,
    successRate: totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0,
  };
}

export async function getPipelineLogs(runId: string, limit: number = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
```

- [ ] Commit: `feat(web): add pipeline query functions for runs and stats`

### Task 3: Create Analytics Query Module

- [ ] Create `apps/web/src/lib/queries/analytics.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export async function getAnalyticsStats(days: number = 30) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('content_items')
    .select('platform, pillar_slug, quality_score, token_usage, status, created_at')
    .gte('created_at', since.toISOString());

  if (error) throw error;

  const items = data ?? [];

  const byPlatform: Record<string, number> = {};
  const byPillar: Record<string, number> = {};
  let totalTokens = 0;
  let totalItems = items.length;
  let approvedCount = 0;
  let qualitySum = 0;
  let qualityCount = 0;

  for (const item of items) {
    byPlatform[item.platform] = (byPlatform[item.platform] ?? 0) + 1;
    byPillar[item.pillar_slug] = (byPillar[item.pillar_slug] ?? 0) + 1;

    if (item.token_usage) {
      const usage = item.token_usage as { totalTokens?: number };
      totalTokens += usage.totalTokens ?? 0;
    }

    if (item.status === 'approved' || item.status === 'published' || item.status === 'scheduled') {
      approvedCount++;
    }

    if (item.quality_score !== null) {
      qualitySum += item.quality_score;
      qualityCount++;
    }
  }

  return {
    totalItems,
    approvedCount,
    approvalRate: totalItems > 0 ? Math.round((approvedCount / totalItems) * 100) : 0,
    totalTokens,
    avgQuality: qualityCount > 0 ? Math.round((qualitySum / qualityCount) * 100) / 100 : 0,
    byPlatform,
    byPillar,
  };
}

export async function getContentTrends(days: number = 30) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('content_items')
    .select('created_at, status, quality_score')
    .gte('created_at', since.toISOString())
    .order('created_at');

  if (error) throw error;

  const dailyStats: Record<string, { total: number; approved: number; avgQuality: number; qualityCount: number }> = {};

  for (const item of data ?? []) {
    const day = new Date(item.created_at).toISOString().split('T')[0];
    if (!dailyStats[day]) {
      dailyStats[day] = { total: 0, approved: 0, avgQuality: 0, qualityCount: 0 };
    }
    dailyStats[day].total++;
    if (item.status === 'approved' || item.status === 'published' || item.status === 'scheduled') {
      dailyStats[day].approved++;
    }
    if (item.quality_score !== null) {
      dailyStats[day].avgQuality += item.quality_score;
      dailyStats[day].qualityCount++;
    }
  }

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    const stats = dailyStats[key] ?? { total: 0, approved: 0, avgQuality: 0, qualityCount: 0 };
    result.push({
      date: key,
      total: stats.total,
      approved: stats.approved,
      avgQuality: stats.qualityCount > 0 ? Math.round((stats.avgQuality / stats.qualityCount) * 100) / 100 : 0,
    });
  }

  return result;
}
```

- [ ] Commit: `feat(web): add analytics query functions for aggregations`

### Task 4: Create Content Item API Route

- [ ] Create `apps/web/src/app/api/content/[id]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('content_items')
      .select('*, content_signals(*)')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.status) update.status = body.status;
    if (body.body !== undefined) update.body = body.body;
    if (body.title !== undefined) update.title = body.title;
    if (body.scheduledAt !== undefined) update.scheduled_at = body.scheduledAt;
    if (body.rejectionReason !== undefined) update.rejection_reason = body.rejectionReason;

    const { data, error } = await supabase
      .from('content_items')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

- [ ] Commit: `feat(web): add content item GET/PUT/DELETE API route`

### Task 5: Create Content Actions Client Component

- [ ] Create `apps/web/src/components/dashboard/content-actions.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Edit2 } from 'lucide-react';

interface ContentActionsProps {
  contentId: string;
  currentStatus: string;
  currentBody?: string;
}

export function ContentActions({ contentId, currentStatus, currentBody }: ContentActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [editedBody, setEditedBody] = useState(currentBody ?? '');

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      router.refresh();
    } catch (error) {
      console.error('Failed to approve content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          rejectionReason: rejectionReason || 'No reason provided',
        }),
      });

      if (!response.ok) throw new Error('Failed to reject');

      setShowRejectDialog(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to reject content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editedBody }),
      });

      if (!response.ok) throw new Error('Failed to save');

      setShowEditDialog(false);
      router.refresh();
    } catch (error) {
      console.error('Failed to save edit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (currentStatus !== 'pending_review') {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={handleApprove}
          disabled={isLoading}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowEditDialog(true)}
          disabled={isLoading}
        >
          <Edit2 className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => setShowRejectDialog(true)}
          disabled={isLoading}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Reject
        </Button>
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Content</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this content (optional)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Content</DialogTitle>
            <DialogDescription>
              Make changes to the content body
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isLoading}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] Commit: `feat(web): add content actions client component for approve/reject/edit`

### Task 6: Create Pipeline Trigger Client Component

- [ ] Create `apps/web/src/components/dashboard/pipeline-trigger.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';

interface PipelineTriggerProps {
  pipelineSlug: string;
  disabled?: boolean;
}

export function PipelineTrigger({ pipelineSlug, disabled }: PipelineTriggerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleTrigger = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pipelines/${pipelineSlug}/trigger`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to trigger pipeline');
      }

      // Refresh the page to show updated status
      router.refresh();
    } catch (error) {
      console.error('Failed to trigger pipeline:', error);
      alert('Failed to trigger pipeline. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="default"
      onClick={handleTrigger}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Play className="h-4 w-4 mr-1" />
          Run Now
        </>
      )}
    </Button>
  );
}
```

- [ ] Commit: `feat(web): add pipeline trigger client component`

### Task 7: Wire Command Center Page

- [ ] Read `apps/web/src/app/(dashboard)/page.tsx`
- [ ] Update to fetch real data from query functions
- [ ] Keep existing UI structure, replace data sources

**Key changes**:
- Import query functions: `getContentStats`, `getPipelineRunsToday`, `getContentPerDay`, `getContentByPillar`, `getRecentActivity`, `getPipelineSuccessRate`
- Wrap queries in try/catch with fallback to zeros
- Replace mock stats with real counts
- Replace mock chart data with real per-day data
- Map pillar_slug to display names using PILLARS registry
- Replace mock activity feed with real recent items

**Expected structure**:
```typescript
import { getContentStats, getContentPerDay, getContentByPillar, getRecentActivity } from '@/lib/queries/content';
import { getPipelineRunsToday, getPipelineSuccessRate } from '@/lib/queries/pipelines';
import { PILLARS } from '@influenceai/core/pillars';

export default async function CommandCenter() {
  let stats, perDayData, byPillar, activity, runsToday, successRate;

  try {
    [stats, perDayData, byPillar, activity, runsToday, successRate] = await Promise.all([
      getContentStats(),
      getContentPerDay(14),
      getContentByPillar(),
      getRecentActivity(10),
      getPipelineRunsToday(),
      getPipelineSuccessRate(),
    ]);
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    // Fallback to zeros
    stats = { contentThisWeek: 0, pendingReview: 0, totalPublished: 0 };
    perDayData = [];
    byPillar = {};
    activity = [];
    runsToday = 0;
    successRate = 0;
  }

  // Map pillar slugs to display names
  const pillarData = Object.entries(byPillar).map(([slug, count]) => ({
    name: PILLARS[slug]?.name ?? slug,
    count,
  }));

  // ... rest of the UI using real data
}
```

- [ ] Commit: `feat(web): wire Command Center with real Supabase data`

### Task 8: Wire Content Library Page

- [ ] Read `apps/web/src/app/(dashboard)/content/page.tsx`
- [ ] Convert to Server Component that calls `getContentItems()`
- [ ] Extract tab/filter UI into client component if needed

**Key changes**:
- Read `searchParams` for status, search, page
- Call `getContentItems({ status, search, limit: 20, offset })`
- Replace mockContent with real items
- Map pillar_slug to display name using PILLARS registry
- Map platform to emoji/label
- Update status tabs to use v2 status values (pending_review, approved, scheduled, published, rejected)
- Add pagination using total count

**Expected structure**:
```typescript
import { getContentItems } from '@/lib/queries/content';
import { PILLARS } from '@influenceai/core/pillars';

export default async function ContentLibrary({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? 'all';
  const search = params.search ?? '';
  const page = parseInt(params.page ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { items, total } = await getContentItems({
    status: status === 'all' ? undefined : status,
    search: search || undefined,
    limit,
    offset,
  });

  // ... render table with items
  // Use PILLARS[item.pillar_slug]?.name for display
}
```

- [ ] Commit: `feat(web): wire Content Library with real Supabase queries`

### Task 9: Wire Pipelines Page

- [ ] Read `apps/web/src/app/(dashboard)/pipelines/page.tsx`
- [ ] Replace hardcoded runtime data with `getLastRunPerPipeline()`
- [ ] Wire Run Now button using PipelineTrigger component

**Key changes**:
- Import `getLastRunPerPipeline`, `getPipelineStats`
- Fetch last run data for each pipeline
- Calculate total runs today, success rate, items generated
- Use PipelineTrigger component for Run Now button
- Show last run status, time, items generated

**Expected structure**:
```typescript
import { getLastRunPerPipeline, getPipelineStats } from '@/lib/queries/pipelines';
import { PIPELINES } from '@influenceai/core/pipelines';
import { PipelineTrigger } from '@/components/dashboard/pipeline-trigger';

export default async function PipelinesPage() {
  const [lastRuns, stats] = await Promise.all([
    getLastRunPerPipeline(),
    getPipelineStats(),
  ]);

  // ... render pipeline cards
  // Use lastRuns[pipeline.slug] for status/time
  // Use <PipelineTrigger pipelineSlug={pipeline.slug} /> for button
}
```

- [ ] Commit: `feat(web): wire Pipelines page with real run data and trigger button`

### Task 10: Wire Review Queue Page

- [ ] Read `apps/web/src/app/(dashboard)/review/page.tsx`
- [ ] Replace mock items with `getContentItems({ status: 'pending_review' })`
- [ ] Wire approve/reject/edit using ContentActions component

**Key changes**:
- Fetch pending_review items
- Use ContentActions component for action buttons
- Show quality_score as badge
- Display pillar name from PILLARS registry
- Add router.refresh() after actions (handled in component)

**Expected structure**:
```typescript
import { getContentItems } from '@/lib/queries/content';
import { ContentActions } from '@/components/dashboard/content-actions';
import { PILLARS } from '@influenceai/core/pillars';

export default async function ReviewQueue() {
  const { items } = await getContentItems({ status: 'pending_review', limit: 50 });

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          {/* ... display item details */}
          <ContentActions
            contentId={item.id}
            currentStatus={item.status}
            currentBody={item.body}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] Commit: `feat(web): wire Review Queue with real data and approve/reject actions`

### Task 11: Wire Schedule Page

- [ ] Read `apps/web/src/app/(dashboard)/schedule/page.tsx`
- [ ] Replace mock scheduledItems with `getScheduledContent()`
- [ ] Group by scheduled_at date

**Key changes**:
- Fetch approved/scheduled items
- Group by scheduled_at date (or created_at if not scheduled)
- Keep calendar layout
- Show pillar name, platform, status

**Expected structure**:
```typescript
import { getScheduledContent } from '@/lib/queries/content';
import { PILLARS } from '@influenceai/core/pillars';

export default async function SchedulePage() {
  const items = await getScheduledContent();

  // Group by date
  const byDate: Record<string, typeof items> = {};
  for (const item of items) {
    const date = item.scheduled_at
      ? new Date(item.scheduled_at).toISOString().split('T')[0]
      : new Date(item.created_at).toISOString().split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(item);
  }

  // ... render calendar with grouped items
}
```

- [ ] Commit: `feat(web): wire Schedule page with real Supabase data`

### Task 12: Wire Analytics Page

- [ ] Read `apps/web/src/app/(dashboard)/analytics/page.tsx`
- [ ] Replace mock analytics with real aggregations
- [ ] Use `getAnalyticsStats()`, `getContentTrends()`, `getPipelineSuccessRate()`

**Key changes**:
- Fetch analytics stats for last 30 days
- Show total items, approval rate, tokens used, avg quality
- Show items by platform (pie chart)
- Show items by pillar (bar chart)
- Show content per day (line chart)
- Show pipeline success rate

**Expected structure**:
```typescript
import { getAnalyticsStats, getContentTrends } from '@/lib/queries/analytics';
import { getPipelineSuccessRate } from '@/lib/queries/pipelines';
import { PILLARS } from '@influenceai/core/pillars';

export default async function AnalyticsPage() {
  const [stats, trends, pipelineSuccess] = await Promise.all([
    getAnalyticsStats(30),
    getContentTrends(30),
    getPipelineSuccessRate(),
  ]);

  // Map pillar slugs to names
  const pillarData = Object.entries(stats.byPillar).map(([slug, count]) => ({
    name: PILLARS[slug]?.name ?? slug,
    count,
  }));

  // ... render charts with real data
}
```

- [ ] Commit: `feat(web): wire Analytics page with real aggregation data`

### Task 13: Update Content List API Route

- [ ] Read `apps/web/src/app/api/content/route.ts`
- [ ] Replace mock data with `getContentItems()` call

**Key changes**:
- Parse searchParams for filters
- Call getContentItems with filters
- Return real data

```typescript
import { NextResponse } from 'next/server';
import { getContentItems } from '@/lib/queries/content';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const pillar = searchParams.get('pillar') ?? undefined;
    const platform = searchParams.get('platform') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const result = await getContentItems({
      status,
      pillar,
      platform,
      search,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}
```

- [ ] Commit: `feat(web): update content API to return real Supabase data`

### Task 14: Add Loading and Error States

- [ ] Create `apps/web/src/app/(dashboard)/loading.tsx` (optional, for Suspense)
- [ ] Add error boundaries where appropriate
- [ ] Add empty states for pages with no data

Example loading component:
```typescript
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-zinc-400">Loading dashboard...</span>
      </div>
    </div>
  );
}
```

- [ ] Commit: `feat(web): add loading and error states to dashboard`

### Task 15: Test End-to-End

- [ ] Start local dev server
- [ ] Verify Command Center shows real data
- [ ] Verify Content Library pagination and filters work
- [ ] Verify Pipelines page shows last runs
- [ ] Test Run Now button (should trigger pipeline)
- [ ] Test approve/reject in Review Queue
- [ ] Verify Schedule page shows approved items
- [ ] Verify Analytics shows aggregations
- [ ] Check console for any errors
- [ ] Test with empty database (should show zeros/empty states)

- [ ] Commit: `test(web): verify dashboard wiring end-to-end`

## Testing Checklist

- [ ] Command Center displays real stats (content this week, pending review, published)
- [ ] Command Center shows real per-day chart (14 days)
- [ ] Command Center shows real pillar distribution
- [ ] Content Library filters by status (pending_review, approved, etc.)
- [ ] Content Library search works
- [ ] Content Library pagination works
- [ ] Pipelines page shows last run status for each pipeline
- [ ] Pipelines Run Now button triggers pipeline
- [ ] Review Queue shows pending items
- [ ] Review Queue approve button works (status → approved)
- [ ] Review Queue reject button works (status → rejected)
- [ ] Review Queue edit button saves changes
- [ ] Schedule page shows approved/scheduled items grouped by date
- [ ] Analytics shows real total items, approval rate, tokens
- [ ] Analytics shows platform/pillar breakdowns
- [ ] Empty states display when no data exists

## Notes

- All dashboard pages are Server Components by default
- Client interactivity (buttons, tabs, dialogs) is extracted into `'use client'` components
- Query functions throw errors — pages should wrap in try/catch with fallback
- API routes handle mutations (PUT, POST, DELETE)
- Server components handle reads (no API routes needed)
- Use `router.refresh()` after mutations to re-fetch server data
- All timestamps should use ISO 8601 format
- Quality scores are 0-1 floats (display as 0-100%)
- Token usage is JSONB: `{ promptTokens, completionTokens, totalTokens }`

## Success Criteria

- Dashboard displays real data from Supabase
- No mock data remains in any dashboard page
- Approve/reject actions work and update database
- Pipeline trigger button creates new pipeline run
- All queries handle errors gracefully
- Empty states show when no data exists
- Performance is acceptable (< 1s page load for typical data volumes)
