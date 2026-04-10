# Phase 3 — Part C: Review Detail Page + Keyboard Shortcuts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the full review detail page at `/review/[id]` with a two-column layout, keyboard shortcuts for power-user workflow, and a "Review" link from the review queue cards.

**Architecture:** The detail page is a server component that fetches the content item + adjacent pending IDs, then renders the client components from Part B. A separate client component handles keyboard shortcuts. The existing review queue card gets a link to the detail page.

**Tech Stack:** Next.js 15 App Router (server components + client components), Tailwind CSS v4, lucide-react icons

**Prerequisites:** Part A and Part B must be completed first.

---

### Task 1: Create `KeyboardShortcuts` component

**Files:**
- Create: `apps/web/src/components/dashboard/keyboard-shortcuts.tsx`

- [ ] **Step 1: Create the KeyboardShortcuts client component**

Create `apps/web/src/components/dashboard/keyboard-shortcuts.tsx` with the following content:

```tsx
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface KeyboardShortcutsProps {
  contentId: string;
  nextId: string | null;
  previousId: string | null;
  body: string;
}

export function KeyboardShortcuts({
  contentId,
  nextId,
  previousId,
  body,
}: KeyboardShortcutsProps) {
  const router = useRouter();

  const isInputFocused = useCallback(() => {
    const tag = document.activeElement?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }, []);

  const navigateNext = useCallback(() => {
    if (nextId) {
      router.push(`/review/${nextId}`);
    } else {
      toast.info('No more items in queue');
    }
  }, [nextId, router]);

  const navigatePrev = useCallback(() => {
    if (previousId) {
      router.push(`/review/${previousId}`);
    } else {
      toast.info('Already at the first item');
    }
  }, [previousId, router]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  }, [body]);

  const handleApprove = useCallback(async () => {
    try {
      const response = await fetch(`/api/content/${contentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!response.ok) throw new Error('Failed to approve');
      toast.success('Content approved');
      if (nextId) {
        router.push(`/review/${nextId}`);
      } else {
        router.push('/review');
      }
    } catch {
      toast.error('Failed to approve content');
    }
  }, [contentId, nextId, router]);

  const handleEdit = useCallback(() => {
    // Trigger the editable body's edit mode via the DOM hook set in EditableBody
    const el = document.getElementById('editable-body-trigger') as
      | (HTMLElement & { __startEditing?: () => void })
      | null;
    if (el?.__startEditing) {
      el.__startEditing();
    }
  }, []);

  const handleFocusReject = useCallback(() => {
    // Click the reject button to expand it, then focus the textarea
    const rejectButton = document.querySelector(
      '[data-review-action="reject"]',
    ) as HTMLButtonElement | null;
    if (rejectButton) {
      rejectButton.click();
      // Small delay to let the textarea render
      setTimeout(() => {
        const textarea = document.querySelector(
          '[data-review-action="reject-reason"]',
        ) as HTMLTextAreaElement | null;
        textarea?.focus();
      }, 100);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input or textarea
      if (isInputFocused()) {
        // Escape should still work to cancel editing
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'c':
          e.preventDefault();
          handleCopy();
          break;
        case 'a':
          e.preventDefault();
          handleApprove();
          break;
        case 'r':
          e.preventDefault();
          handleFocusReject();
          break;
        case 'e':
          e.preventDefault();
          handleEdit();
          break;
        case 'j':
        case 'ArrowRight':
          e.preventDefault();
          navigateNext();
          break;
        case 'k':
        case 'ArrowLeft':
          e.preventDefault();
          navigatePrev();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    isInputFocused,
    handleCopy,
    handleApprove,
    handleFocusReject,
    handleEdit,
    navigateNext,
    navigatePrev,
  ]);

  // Render keyboard hints bar at bottom of screen
  return (
    <div className="fixed bottom-0 left-64 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-6 px-4 py-2">
        {[
          { key: 'c', label: 'Copy' },
          { key: 'a', label: 'Approve' },
          { key: 'r', label: 'Reject' },
          { key: 'e', label: 'Edit' },
          { key: 'k/\u2190', label: 'Prev' },
          { key: 'j/\u2192', label: 'Next' },
          { key: 'Esc', label: 'Cancel' },
        ].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {key}
            </kbd>
            <span className="text-[11px] text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update ReviewActions to add data attributes for keyboard shortcut targeting**

Open `apps/web/src/components/dashboard/review-actions.tsx` (created in Part B) and make two small additions:

1. On the Reject `<Button>`, add the attribute `data-review-action="reject"`:

Find:
```tsx
            className="w-full border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
```

Replace with:
```tsx
            className="w-full border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            data-review-action="reject"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
```

2. On the rejection `<Textarea>`, add the attribute `data-review-action="reject-reason"`:

Find:
```tsx
              <Textarea
                placeholder="Why are you rejecting this content? (optional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="border-zinc-700 bg-zinc-900 text-sm"
              />
```

Replace with:
```tsx
              <Textarea
                placeholder="Why are you rejecting this content? (optional)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="border-zinc-700 bg-zinc-900 text-sm"
                data-review-action="reject-reason"
              />
```

- [ ] **Step 3: Verify the component compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 2: Rewrite the review detail page

**Files:**
- Create: `apps/web/src/app/(dashboard)/review/[id]/page.tsx` (new file — this directory does not exist yet)

- [ ] **Step 1: Create the directory**

Run:
```bash
mkdir -p /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI/apps/web/src/app/\(dashboard\)/review/\[id\]
```

- [ ] **Step 2: Create the review detail page**

Create `apps/web/src/app/(dashboard)/review/[id]/page.tsx` with the following content:

```tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getContentItem, getAdjacentPendingItems } from '@/lib/queries/content';
import { EditableTitle } from '@/components/dashboard/editable-title';
import { EditableBody } from '@/components/dashboard/editable-body';
import { ReviewActions } from '@/components/dashboard/review-actions';
import { SourceSignalCard } from '@/components/dashboard/source-signal-card';
import { KeyboardShortcuts } from '@/components/dashboard/keyboard-shortcuts';
import { Badge } from '@/components/ui/badge';
import { getStatusColor } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import { PIPELINES } from '@influenceai/core';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  Star,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const platformLabels: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
};

function getQualityColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-red-400';
}

function getQualityBg(score: number): string {
  if (score >= 8) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 6) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // getContentItem uses .single() which throws on not-found
  let item;
  try {
    item = await getContentItem(id);
  } catch {
    notFound();
  }

  if (!item) notFound();

  const { previousId, nextId } = await getAdjacentPendingItems(id);

  const PlatformIcon = platformIcons[item.platform] ?? Linkedin;
  const platformLabel = platformLabels[item.platform] ?? item.platform;
  const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
  const pipeline = PIPELINES.find((p) => p.slug === item.pipeline_slug);
  const signal = item.content_signals ?? null;

  return (
    <div className="pb-16">
      {/* Top navigation bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/review"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Review Queue
        </Link>

        <div className="flex items-center gap-2">
          {previousId ? (
            <Link
              href={`/review/${previousId}`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-600">
              <ChevronLeft className="h-3 w-3" />
              Previous
            </span>
          )}
          {nextId ? (
            <Link
              href={`/review/${nextId}`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-600">
              Next
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* === Left column (65%): Content === */}
        <div className="space-y-4">
          {/* Platform badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1">
              <PlatformIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">
                {platformLabel}
              </span>
            </div>
            {pillar && (
              <Badge variant="secondary" className="text-xs">
                {pillar.name}
              </Badge>
            )}
          </div>

          {/* Editable Title */}
          <EditableTitle initialTitle={item.title} contentId={item.id} />

          {/* Editable Body */}
          <EditableBody
            initialBody={item.body ?? ''}
            contentId={item.id}
            platform={item.platform}
          />
        </div>

        {/* === Right column (35%): Metadata + Actions === */}
        <div className="space-y-4">
          {/* Source Signal */}
          <SourceSignalCard signal={signal} />

          {/* Metadata card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-400">Details</h3>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Status</span>
              <Badge
                className={`text-xs ${getStatusColor(item.status)}`}
              >
                {item.status.replace(/_/g, ' ')}
              </Badge>
            </div>

            {/* Pipeline */}
            {pipeline && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Pipeline</span>
                <Link
                  href={`/pipelines/${item.pipeline_slug}`}
                  className="text-xs text-violet-400 transition-colors hover:text-violet-300"
                >
                  {pipeline.name}
                </Link>
              </div>
            )}

            {/* Quality Score */}
            {item.quality_score !== null && item.quality_score !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Quality Score</span>
                <div
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${getQualityBg(item.quality_score)}`}
                >
                  <Star
                    className={`h-3 w-3 ${getQualityColor(item.quality_score)}`}
                  />
                  <span
                    className={`text-xs font-semibold ${getQualityColor(item.quality_score)}`}
                  >
                    {item.quality_score}/10
                  </span>
                </div>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Created</span>
              <div className="flex items-center gap-1 text-xs text-zinc-300">
                <Clock className="h-3 w-3 text-zinc-500" />
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            </div>

            {/* Generation model */}
            {item.generation_model && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Model</span>
                <span className="text-xs text-zinc-300">
                  {item.generation_model}
                </span>
              </div>
            )}

            {/* Token usage */}
            {item.token_usage && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Tokens</span>
                <span className="text-xs text-zinc-300">
                  {typeof item.token_usage === 'object' &&
                  item.token_usage !== null &&
                  'totalTokens' in item.token_usage
                    ? (
                        item.token_usage as { totalTokens: number }
                      ).totalTokens.toLocaleString()
                    : '-'}
                </span>
              </div>
            )}
          </div>

          {/* Review Actions */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <h3 className="text-sm font-medium text-zinc-400">Actions</h3>
            <ReviewActions
              contentId={item.id}
              currentStatus={item.status}
              nextId={nextId}
              body={item.body ?? ''}
            />
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts (renders the hints bar) */}
      <KeyboardShortcuts
        contentId={item.id}
        nextId={nextId}
        previousId={previousId}
        body={item.body ?? ''}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify the page compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 3: Add "Review" link to review queue cards

**Files:**
- Modify: `apps/web/src/app/(dashboard)/review/review-card.tsx` (lines 71-73, the title area)

- [ ] **Step 1: Add a Link import and "Review" link to ReviewCard**

Open `apps/web/src/app/(dashboard)/review/review-card.tsx`.

First, add the Link import. Find:

```tsx
import {
  Clock,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react';
```

Replace with:

```tsx
import {
  Clock,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  ChevronDown,
  ChevronUp,
  Star,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
```

Then, find the title line (line 73):

```tsx
        <h3 className="mt-3 text-lg font-semibold text-zinc-50">{item.title}</h3>
```

Replace with:

```tsx
        <div className="mt-3 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-zinc-50">{item.title}</h3>
          <Link
            href={`/review/${item.id}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-violet-400 transition-colors hover:border-violet-500/50 hover:bg-violet-500/10"
          >
            Review
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
```

- [ ] **Step 2: Verify the page compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 4: Update dashboard layout to recognize review detail routes

**Files:**
- Modify: `apps/web/src/app/(dashboard)/layout.tsx` (lines 9-17, `routeMeta`)

- [ ] **Step 1: Add review detail route meta**

Open `apps/web/src/app/(dashboard)/layout.tsx`. The `routeMeta` object currently has static keys. The detail page won't match `/review` exactly, so the topbar will fall back to the default title. This is fine for now — the detail page has its own "Back to Review Queue" link and breadcrumb. No changes needed.

However, if the title bar showing "InfluenceAI" instead of something meaningful bothers you, you can update the layout to detect review detail routes. Since the layout is a `'use client'` component with `usePathname()`, add one line:

Find:

```tsx
  const meta = routeMeta[pathname] || { title: 'InfluenceAI' };
```

Replace with:

```tsx
  const meta = routeMeta[pathname]
    || (pathname.startsWith('/review/') ? { title: 'Content Review', subtitle: 'Content' } : null)
    || { title: 'InfluenceAI' };
```

- [ ] **Step 2: Verify the layout compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 5: Commit

```bash
git add apps/web/src/components/dashboard/keyboard-shortcuts.tsx \
       apps/web/src/components/dashboard/review-actions.tsx \
       apps/web/src/app/\(dashboard\)/review/\[id\]/page.tsx \
       apps/web/src/app/\(dashboard\)/review/review-card.tsx \
       apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "feat(review): add review detail page with keyboard shortcuts

- Two-column layout: editable content left, metadata + actions right
- Keyboard shortcuts: c=copy, a=approve, r=reject, e=edit, j/k=nav
- Review link on queue cards for quick access to detail view
- Route meta for review detail pages in dashboard layout

Phase 3 Part C"
```
