# Phase 2 Part B: Review Page — ContentCard + Review Home + Review Detail Placeholder

**Date**: 2026-04-11
**Status**: Not Started
**Goal**: Build the new Review home page at `/` with filterable ContentCard list and a minimal review detail placeholder at `/review/[id]`.

## Architecture Overview

- **Review Home** (`/`): Server component fetching `pending_review` content, with pipeline + platform dropdown filters via search params
- **ContentCard**: Reusable card component showing title, body preview, platform icon, quality badge, pipeline badge, relative time, and "Review" link
- **Review Detail** (`/review/[id]`): Minimal placeholder showing full content body + back link (Phase 3 replaces with full review UI)
- **Filters**: URL search params — no client state needed, server component re-renders on param change

## File Map

### New Files
- `apps/web/src/components/dashboard/content-card.tsx` — reusable content card
- `apps/web/src/app/(dashboard)/review/[id]/page.tsx` — review detail placeholder

### Modified Files
- `apps/web/src/app/(dashboard)/page.tsx` — complete rewrite as Review page

## Database Schema Reference

**content_items**: `id`, `title`, `body`, `pillar_slug`, `pipeline_slug`, `platform`, `format`, `status`, `quality_score`, `created_at`

## Tasks

### Task 1: Create ContentCard Component

- [ ] Create `apps/web/src/components/dashboard/content-card.tsx`

A server-friendly presentational component (no `'use client'`) that renders a content item as a card. Uses existing `Badge`, `Card` from shadcn/ui, `getRelativeTime` and `getPillarColor` from utils, and `PILLARS` from core. Links to `/review/[id]` for pending items.

```typescript
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, getPillarColor, getRelativeTime } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Star,
  ArrowRight,
} from 'lucide-react';

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const platformColors: Record<string, string> = {
  linkedin: 'text-blue-400',
  instagram: 'text-pink-400',
  youtube: 'text-red-400',
  twitter: 'text-zinc-300',
};

interface ContentCardProps {
  item: {
    id: string;
    title: string;
    body: string | null;
    platform: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    quality_score: number | null;
    status: string;
    created_at: string;
  };
}

export function ContentCard({ item }: ContentCardProps) {
  const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
  const PlatformIcon = platformIcons[item.platform] ?? FileText;
  const platformColor = platformColors[item.platform] ?? 'text-zinc-400';

  const bodyPreview = item.body
    ? item.body.length > 150
      ? item.body.slice(0, 150) + '...'
      : item.body
    : null;

  const pipelineLabel = item.pipeline_slug
    ? item.pipeline_slug
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    : null;

  return (
    <Card className="transition-all duration-200 hover:border-zinc-700">
      <CardContent className="p-5">
        {/* Top row: badges */}
        <div className="flex flex-wrap items-center gap-2">
          {pipelineLabel && (
            <Badge variant="secondary" className="text-xs">
              {pipelineLabel}
            </Badge>
          )}
          {pillar && (
            <Badge className={cn('text-xs', getPillarColor(pillar.color))}>
              {pillar.name.split(' \u2192')[0]}
            </Badge>
          )}
          {item.quality_score !== null && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Star className="h-3 w-3" />
              {item.quality_score}/10
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <PlatformIcon className={cn('h-3.5 w-3.5', platformColor)} />
            <span className="text-xs text-zinc-500 capitalize">{item.platform}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-3 text-base font-semibold text-zinc-50 line-clamp-1">
          {item.title}
        </h3>

        {/* Body preview */}
        {bodyPreview && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400 line-clamp-3">
            {bodyPreview}
          </p>
        )}

        {/* Footer: time + action */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {getRelativeTime(item.created_at)}
          </span>
          <Link
            href={`/review/${item.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
          >
            Review
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Task 2: Rewrite Home Page as Review Page

- [ ] Rewrite `apps/web/src/app/(dashboard)/page.tsx`

Complete rewrite. This becomes the Review home page — a server component that fetches pending content with optional `pipeline` and `platform` filters from search params. Uses `ContentCard` for each item.

The 3 implemented pipeline slugs (`github-trends`, `signal-amplifier`, `release-radar`) are used for the pipeline filter dropdown. Platform options are `linkedin`, `instagram`, `youtube`, `twitter`.

```typescript
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getContentItems } from '@/lib/queries/content';
import { ContentCard } from '@/components/dashboard/content-card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Inbox } from 'lucide-react';

const PIPELINE_OPTIONS = [
  { value: '', label: 'All Pipelines' },
  { value: 'github-trends', label: 'GitHub Trends' },
  { value: 'signal-amplifier', label: 'Signal Amplifier' },
  { value: 'release-radar', label: 'Release Radar' },
];

const PLATFORM_OPTIONS = [
  { value: '', label: 'All Platforms' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
];

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const pipeline = params.pipeline || undefined;
  const platform = params.platform || undefined;

  let items: Array<{
    id: string;
    title: string;
    body: string | null;
    platform: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    quality_score: number | null;
    status: string;
    created_at: string;
  }> = [];
  let total = 0;

  try {
    const result = await getContentItems({
      status: 'pending_review',
      pipeline,
      platform,
      limit: 50,
    });
    items = result.items;
    total = result.total;
  } catch {
    // Fallback to empty on error
  }

  function buildFilterUrl(key: string, value: string) {
    const p = new URLSearchParams();
    if (key === 'pipeline' && value) p.set('pipeline', value);
    else if (pipeline) p.set('pipeline', pipeline);
    if (key === 'platform' && value) p.set('platform', value);
    else if (platform) p.set('platform', platform);
    const qs = p.toString();
    return qs ? `/?${qs}` : '/';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Review Queue</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {total} item{total !== 1 ? 's' : ''} pending review
          </p>
        </div>
        {total > 0 && (
          <Badge variant="warning" className="text-sm">
            {total} pending
          </Badge>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pipeline filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500">Pipeline</label>
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {PIPELINE_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildFilterUrl('pipeline', opt.value)}
                className={
                  (pipeline ?? '') === opt.value
                    ? 'rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-50'
                    : 'rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-300'
                }
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500">Platform</label>
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {PLATFORM_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildFilterUrl('platform', opt.value)}
                className={
                  (platform ?? '') === opt.value
                    ? 'rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-50'
                    : 'rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-300'
                }
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Content List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 py-16">
          <Inbox className="h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-400">No content pending review</p>
          <p className="mt-1 text-xs text-zinc-500">
            Run a pipeline to generate content, or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Task 3: Create Review Detail Placeholder

- [ ] Create `apps/web/src/app/(dashboard)/review/[id]/page.tsx`

Minimal server component that fetches a single content item and displays its full body with a "Back to Review" link. This is a placeholder that Phase 3 replaces with the full review UI (approve/reject/edit actions).

```typescript
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getContentItem } from '@/lib/queries/content';
import { cn, getPillarColor, getRelativeTime } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  ArrowLeft,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Star,
} from 'lucide-react';

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

const statusVariants: Record<string, 'default' | 'warning' | 'success' | 'destructive' | 'secondary'> = {
  pending_review: 'warning',
  approved: 'success',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let item: {
    id: string;
    title: string;
    body: string | null;
    platform: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    quality_score: number | null;
    status: string;
    created_at: string;
  } | null = null;

  try {
    item = await getContentItem(id);
  } catch {
    notFound();
  }

  if (!item) notFound();

  const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
  const PlatformIcon = platformIcons[item.platform] ?? FileText;

  const pipelineLabel = item.pipeline_slug
    ? item.pipeline_slug
        .split('-')
        .map((w: string) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Review
      </Link>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant={statusVariants[item.status] ?? 'secondary'}>
              {statusLabels[item.status] ?? item.status}
            </Badge>
            {pipelineLabel && (
              <Badge variant="secondary" className="text-xs">
                {pipelineLabel}
              </Badge>
            )}
            {pillar && (
              <Badge className={cn('text-xs', getPillarColor(pillar.color))}>
                {pillar.name.split(' \u2192')[0]}
              </Badge>
            )}
            {item.quality_score !== null && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Star className="h-3 w-3" />
                {item.quality_score}/10
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl">{item.title}</CardTitle>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <div className="flex items-center gap-1">
              <PlatformIcon className="h-3.5 w-3.5" />
              <span className="capitalize">{item.platform}</span>
            </div>
            <span>{getRelativeTime(item.created_at)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {item.body ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {item.body}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic">No content body available.</p>
          )}
        </CardContent>
      </Card>

      {/* Placeholder action note */}
      <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
        <p className="text-sm text-zinc-500">
          Full review actions (approve, edit, reject) coming in Phase 3.
        </p>
      </div>
    </div>
  );
}
```

### Task 4: Commit

```bash
git add -A
git commit -m "feat(web): add Review home page with ContentCard and filterable pending queue"
```

## Verification

After completing all tasks:
1. `pnpm -F @influenceai/web build` should succeed
2. `/` shows the Review Queue with pending content cards
3. Pipeline and platform filter pills work (URL search params update, list re-filters)
4. Empty state shows when no pending content matches filters
5. Clicking "Review ->" on a card navigates to `/review/[id]` with full content body
6. Back link on detail page returns to `/`
