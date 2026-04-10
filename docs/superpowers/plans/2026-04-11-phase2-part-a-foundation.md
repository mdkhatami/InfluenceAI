# Phase 2 Part A: Foundation — Delete Old Pages, Sidebar, Layout, Query Updates

**Date**: 2026-04-11
**Status**: Not Started
**Goal**: Remove deprecated pages, simplify sidebar to 4 nav items, add prefix matching to layout, extend query layer with pipeline filter and new pipeline queries.

## Architecture Overview

- **Sidebar**: 4 items (Review, Content, Pipelines, Settings) — down from 7
- **Layout**: `getRouteMeta()` function with prefix matching for dynamic routes
- **Query Layer**: Add `pipeline` filter to `getContentItems`, add `getPipelineRuns` and `getPipelineContentItems`
- **Deletions**: 6 orphaned files from old UI (review queue, schedule, analytics, github-trends detail)

## File Map

### Deleted Files
- `apps/web/src/app/(dashboard)/review/page.tsx`
- `apps/web/src/app/(dashboard)/review/review-card.tsx`
- `apps/web/src/app/(dashboard)/schedule/page.tsx`
- `apps/web/src/app/(dashboard)/analytics/page.tsx`
- `apps/web/src/app/(dashboard)/analytics/analytics-charts.tsx`
- `apps/web/src/app/(dashboard)/pipelines/github-trends/page.tsx`

### Modified Files
- `apps/web/src/components/dashboard/sidebar.tsx`
- `apps/web/src/app/(dashboard)/layout.tsx`
- `apps/web/src/lib/queries/content.ts`
- `apps/web/src/lib/queries/pipelines.ts`

## Database Schema Reference

**content_items**: `id`, `title`, `body`, `pillar_slug`, `pipeline_slug`, `platform`, `format`, `status`, `quality_score`, `created_at`, `updated_at`, `scheduled_at`, `signal_id`, `pipeline_run_id`

**pipeline_runs**: `id`, `pipeline_slug`, `pipeline_id`, `status` (running | completed | partial_success | failed), `signals_ingested`, `signals_filtered`, `items_generated`, `error`, `created_at`, `completed_at`

## Tasks

### Task 1: Delete Old Pages

Delete the 6 files that are being replaced or removed in the UI rebuild.

```bash
git rm apps/web/src/app/\(dashboard\)/review/page.tsx
git rm apps/web/src/app/\(dashboard\)/review/review-card.tsx
git rm apps/web/src/app/\(dashboard\)/schedule/page.tsx
git rm apps/web/src/app/\(dashboard\)/analytics/page.tsx
git rm apps/web/src/app/\(dashboard\)/analytics/analytics-charts.tsx
git rm apps/web/src/app/\(dashboard\)/pipelines/github-trends/page.tsx
```

### Task 2: Rewrite Sidebar to 4 Nav Items

- [ ] Rewrite `apps/web/src/components/dashboard/sidebar.tsx`

Replace the 7-item navigation with a clean 4-item sidebar: Review (home), Content, Pipelines, Settings. Use violet accent colors instead of blue to match the design system.

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardCheck,
  FileText,
  Workflow,
  Settings,
  Sparkles,
  User,
  LogOut,
} from 'lucide-react';

const navItems = [
  { label: 'Review', icon: ClipboardCheck, href: '/' },
  { label: 'Content', icon: FileText, href: '/content' },
  { label: 'Pipelines', icon: Workflow, href: '/pipelines' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

interface UserInfo {
  email: string;
  name: string;
  avatarUrl?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);

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
        // Supabase not configured — show default
      }
    }
    loadUser();
  }, []);

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

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          InfluenceAI
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-zinc-800 text-zinc-50 border-l-2 border-violet-500 pl-[10px]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-violet-400' : '')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Area */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-9 w-9 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
              <User className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-50 truncate">
              {user?.name || 'AI Operator'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">
              {user?.email || 'Not signed in'}
            </p>
          </div>
          {user && (
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
```

### Task 3: Update Layout with Prefix Matching

- [ ] Rewrite `apps/web/src/app/(dashboard)/layout.tsx`

Replace the static `routeMeta` lookup with a `getRouteMeta()` function that supports prefix matching for dynamic routes like `/pipelines/[slug]` and `/review/[id]`.

```typescript
'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ErrorBoundary } from '@/components/error-boundary';

const routeMeta: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Review', subtitle: 'Pending Content' },
  '/content': { title: 'Content', subtitle: 'Library' },
  '/pipelines': { title: 'Pipelines', subtitle: 'Automation' },
  '/settings': { title: 'Settings', subtitle: 'Configuration' },
};

function getRouteMeta(pathname: string) {
  if (routeMeta[pathname]) return routeMeta[pathname];
  if (pathname.startsWith('/pipelines/')) return { title: 'Pipelines', subtitle: 'Detail' };
  if (pathname.startsWith('/review/')) return { title: 'Review', subtitle: 'Detail' };
  return { title: 'InfluenceAI' };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = getRouteMeta(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-64">
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <ScrollArea className="flex-1">
          <main className="p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
```

### Task 4: Add Pipeline Filter to Content Query

- [ ] Modify `apps/web/src/lib/queries/content.ts`

Add `pipeline` to the filter interface and apply it as an `.eq('pipeline_slug', filters.pipeline)` condition.

The updated `getContentItems` function signature and filter block:

```typescript
export async function getContentItems(filters?: {
  status?: string;
  pillar?: string;
  platform?: string;
  pipeline?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from('content_items')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.pillar) query = query.eq('pillar_slug', filters.pillar);
  if (filters?.platform) query = query.eq('platform', filters.platform);
  if (filters?.pipeline) query = query.eq('pipeline_slug', filters.pipeline);
  if (filters?.search) query = query.ilike('title', `%${filters.search}%`);

  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0 };
}
```

No other functions in `content.ts` change.

### Task 5: Add Pipeline Run and Content Queries

- [ ] Add two new functions to `apps/web/src/lib/queries/pipelines.ts`

Append these two functions after the existing `getPipelineLogs` function:

```typescript
export async function getPipelineRuns(slug: string, limit: number = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('pipeline_slug', slug)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPipelineContentItems(slug: string, limit: number = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('id, title, platform, status, quality_score, created_at')
    .eq('pipeline_slug', slug)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

### Task 6: Commit

```bash
git add -A
git commit -m "refactor(web): delete old pages, simplify sidebar to 4 nav items, add prefix matching to layout, extend query layer with pipeline filter"
```

## Verification

After completing all tasks:
1. `pnpm -F @influenceai/web build` should succeed with no type errors
2. Sidebar shows exactly 4 items: Review, Content, Pipelines, Settings
3. Navigating to `/pipelines/github-trends` shows topbar "Pipelines / Detail"
4. No broken imports from deleted files (review-card, schedule, analytics, github-trends)
