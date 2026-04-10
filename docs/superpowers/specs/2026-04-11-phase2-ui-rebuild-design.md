# Phase 2: UI Rebuild — 4-Page Dashboard

**Date**: 2026-04-11
**Status**: Approved
**Depends on**: Phase 1 (Pipeline Intelligence)
**Goal**: Replace the 7-page dashboard with 4 focused pages. Every page shows real data or a proper empty state. No mock data anywhere.

---

## Current State

The dashboard has 7 pages in the sidebar:
1. **Command Center** (`/`) — 4 stats + 2 charts + pipeline grid + activity feed. Works but overwhelming.
2. **Content** (`/content`) — filterable table. Works with real data.
3. **Pipelines** (`/pipelines`) — pipeline cards. Works with real data.
4. **Review Queue** (`/review`) — tabs for pending/approved/rejected. Works with real data.
5. **Schedule** (`/schedule`) — calendar view. No data (nothing is ever scheduled).
6. **Analytics** (`/analytics`) — charts. No data (`content_analytics` is empty).
7. **Settings** (`/settings`) — 5 tabs. Profile is hardcoded. Most tabs unused.

Plus: `pipelines/github-trends/page.tsx` — detail page with 100% mock data.

## New Structure

4 pages + settings:

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | **Review** | `/` | Landing page. Pending content that needs attention. |
| 2 | **Content** | `/content` | Archive of all content. Searchable, filterable. |
| 3 | **Pipelines** | `/pipelines` | Pipeline health. Run Now buttons. |
| 4 | **Settings** | `/settings` | Profile + pillar toggles. |
| — | Pipeline Detail | `/pipelines/[slug]` | Run history + recent content for one pipeline. |
| — | Content Detail | `/review/[id]` | Review/edit a single content item. (Phase 3) |

## Pages Deleted

| Page | Route | Reason |
|------|-------|--------|
| Command Center | `/` (old) | Redundant — Review page replaces it as landing |
| Schedule | `/schedule` | No scheduling feature exists. Deleted entirely. |
| Analytics | `/analytics` | No analytics data. Deleted entirely. |
| GitHub Trends Detail | `/pipelines/github-trends` | 100% mock data. Replaced by generic `/pipelines/[slug]`. |

## Sidebar Navigation

```
[InfluenceAI logo]

Review           (ClipboardCheck icon)   → /
Content          (FileText icon)         → /content
Pipelines        (Workflow icon)         → /pipelines

[spacer]

Settings         (Settings icon)         → /settings

[user profile + sign out]
```

4 items. No confusion about where to go.

---

## Page Designs

### 1. Review Page (`/` — home)

**Purpose**: "What needs my attention?"

**Server component** that queries:
```typescript
const { items: pending, total: pendingTotal } = await getContentItems({ 
  status: 'pending_review', 
  limit: 50 
});
```

**Layout**:
- **Header**: "Review" title + badge showing `pendingTotal` count
- **Filter bar**: Dropdown filters for pipeline (github-trends / signal-amplifier / release-radar) and platform (linkedin / twitter / instagram). These filter the query.
- **Content card list**: One card per pending item. Each card shows:
  - Platform icon (LinkedIn blue / Twitter gray / Instagram gradient)
  - Title (text-zinc-100, font-medium)
  - Body preview — first 150 characters of `body` field (text-zinc-400)
  - Quality score badge (1-10, color-coded: green >=7, yellow 4-6, red <=3)
  - Pipeline name badge (small, text-zinc-500)
  - Relative time ("2 hours ago")
  - "Review →" button linking to `/review/[id]` (Phase 3 adds this page; until then, this links nowhere — see "Progressive Build" below)

- **Empty state**: `EmptyReviewQueue` component — "Review queue is empty. No content is waiting for review. All caught up!" with a "Go to Pipelines" action button.

**Progressive build note**: In Phase 2, the "Review →" button links to `/review/[id]`. Since Phase 3 creates that page, Phase 2 should include a minimal placeholder page at `apps/web/src/app/(dashboard)/review/[id]/page.tsx` that just shows the content body and a "Back" link. Phase 3 replaces this with the full two-column detail view. This way Phase 2 is independently useful.

### 2. Content Page (`/content`)

**Purpose**: "Find any content I've generated"

**Server component** that queries:
```typescript
const { items, total } = await getContentItems({ 
  status: statusFilter || undefined,
  search: searchQuery || undefined,
  limit: 20, 
  offset: page * 20 
});
```

**Layout**:
- **Header**: "Content" title + total count
- **Filter bar**: Status dropdown (All / Pending / Approved / Rejected / Published), search input, platform filter
- **Table**: Columns:
  - Title (link to `/review/[id]` when Phase 3 exists)
  - Platform (icon)
  - Pipeline (badge: github-trends / signal-amplifier / release-radar)
  - Status (color-coded badge)
  - Quality (number)
  - Created (relative time)
- **Pagination**: Previous / Next with page count

- **Empty state**: `EmptyContent` component — "No content yet. Content will appear here once your pipelines generate their first drafts."

### 3. Pipelines Page (`/pipelines`)

**Purpose**: "Are my pipelines healthy? Can I run one now?"

**Server component** that queries:
```typescript
const lastRuns = await getLastRunPerPipeline();
const stats = await getPipelineStats();
```

Also uses `PIPELINES` from `@influenceai/core` for pipeline metadata (name, description, icon, schedule).

**Layout**:
- **Header**: "Pipelines" title + "X runs today" subtitle
- **Pipeline cards** (one per active pipeline — only show the 3 that have implementations):
  - Pipeline name + description
  - Schedule in human-readable form: parse cron → "Daily at 8:00 AM UTC"
  - Last run: status badge (completed/failed/running) + relative time ("3 hours ago")
  - Last run metrics: "5 signals → 3 items" (from `signals_ingested` and `items_generated`)
  - **"Run Now" button** — client component, calls `POST /api/pipelines/[id]/trigger`
    - Shows spinner while running (can take 10-30s)
    - On success: toast "Done — X signals, Y items generated"
    - On error: toast with error message
  - **"View Details →"** link to `/pipelines/[slug]`

- **Empty state**: `EmptyPipelines` — "No pipeline runs yet. Trigger a pipeline manually or wait for the next scheduled run."

**Note**: Only show the 3 implemented pipelines (github-trends, signal-amplifier, release-radar), not all 8 from the registry. The other 5 (youtube-series, weekly-strategy, auto-podcast, infographic-factory, digital-twin) have no implementation.

### 4. Settings Page (`/settings`)

**Purpose**: Minimal configuration.

**Two sections** (no tabs — just stacked sections):

**Section 1: Profile**
- User email from Supabase auth: `const { data: { user } } = await supabase.auth.getUser()`
- Avatar (gradient fallback)
- Sign out button

**Section 2: Content Pillars**
- Toggle switches for each of the 7 pillars
- Uses existing `PILLARS` from `@influenceai/core` for names/descriptions
- Saves to `integration_configs` table via existing `/api/settings/pillar-toggles` endpoint
- This already works — no changes needed to the toggle logic

**Removed tabs**: Integrations (not needed — manual posting), Prompt Templates (advanced), Preferences (timezone/model live in env vars).

---

## Pipeline Detail Page (`/pipelines/[slug]`)

**Purpose**: Drill into one pipeline's history and output.

**Route**: Dynamic — `/pipelines/github-trends`, `/pipelines/signal-amplifier`, `/pipelines/release-radar`

**New query functions needed** (add to `apps/web/src/lib/queries/pipelines.ts`):

```typescript
export async function getPipelineRuns(slug: string, limit: number = 20) {
  // SELECT * FROM pipeline_runs WHERE pipeline_slug = slug ORDER BY started_at DESC LIMIT limit
}

export async function getPipelineContentItems(slug: string, limit: number = 10) {
  // SELECT * FROM content_items WHERE pipeline_slug = slug ORDER BY created_at DESC LIMIT limit
}
```

**Layout**:
- **Header**: Pipeline name + description (from `PIPELINE_MAP.get(slug)`), cron schedule badge, "Run Now" button
- **Stats row** (3 cards):
  - Total runs (count from `pipeline_runs` for this slug)
  - Success rate (completed / total * 100)
  - Items generated (sum of `items_generated` from all runs)
- **Run history table**: Status badge, started_at, duration (computed from started_at to completed_at), signals ingested, items generated. Most recent 20 runs.
- **Recent content**: Last 10 content items from this pipeline. Title, platform icon, status badge, quality score.

- **404 handling**: If `slug` doesn't match an implemented pipeline, return `notFound()`.

---

## Components

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `PipelineTriggerButton` | `components/dashboard/pipeline-trigger-button.tsx` | Client component. "Run Now" with loading state. Calls `POST /api/pipelines/[id]/trigger` (route already exists at `apps/web/src/app/api/pipelines/[id]/trigger/route.ts`). |
| `ContentCard` | `components/dashboard/content-card.tsx` | Reusable card for Review and Content pages. Shows title, body preview, platform, quality, pipeline, time. |

### Modified Components

| Component | File | Changes |
|-----------|------|---------|
| `Sidebar` | `components/dashboard/sidebar.tsx` | 4 nav items (Review, Content, Pipelines, Settings). Remove Command Center, Schedule, Analytics. Reorder. Change icons. |

### Deleted Components/Pages

| File | Reason |
|------|--------|
| `app/(dashboard)/page.tsx` | Replaced by Review as home page |
| `app/(dashboard)/schedule/page.tsx` | No scheduling feature |
| `app/(dashboard)/analytics/page.tsx` | No analytics data |
| `app/(dashboard)/analytics/analytics-charts.tsx` | Part of deleted analytics |
| `app/(dashboard)/pipelines/github-trends/page.tsx` | 100% mock, replaced by `[slug]` |

**Note**: The old `page.tsx` (Command Center) is replaced by the new Review page at the same route `/`. This is a full rewrite of the file, not an edit.

---

## Files Summary

| Action | File |
|--------|------|
| **Create** | `apps/web/src/app/(dashboard)/page.tsx` (new Review page replacing Command Center) |
| **Create** | `apps/web/src/app/(dashboard)/review/[id]/page.tsx` (minimal content view — replaced by Phase 3) |
| **Create** | `apps/web/src/app/(dashboard)/pipelines/[slug]/page.tsx` |
| **Create** | `apps/web/src/components/dashboard/pipeline-trigger-button.tsx` |
| **Create** | `apps/web/src/components/dashboard/content-card.tsx` |
| **Modify** | `apps/web/src/app/(dashboard)/content/page.tsx` (add pipeline column, body preview) |
| **Modify** | `apps/web/src/app/(dashboard)/pipelines/page.tsx` (add Run Now, show only 3 pipelines) |
| **Modify** | `apps/web/src/app/(dashboard)/settings/page.tsx` (strip to profile + pillars) |
| **Modify** | `apps/web/src/components/dashboard/sidebar.tsx` (4 nav items) |
| **Modify** | `apps/web/src/lib/queries/pipelines.ts` (add getPipelineRuns, getPipelineContentItems) |
| **Modify** | `apps/web/src/app/(dashboard)/layout.tsx` (update routeMeta for new pages) |
| **Delete** | `apps/web/src/app/(dashboard)/schedule/page.tsx` |
| **Delete** | `apps/web/src/app/(dashboard)/analytics/page.tsx` |
| **Delete** | `apps/web/src/app/(dashboard)/analytics/analytics-charts.tsx` |
| **Delete** | `apps/web/src/app/(dashboard)/pipelines/github-trends/page.tsx` |

## Testing

1. Sidebar shows exactly 4 items: Review, Content, Pipelines, Settings
2. `/` shows the Review page with pending content cards
3. Review page with no pending content shows empty state
4. `/content` shows all content with filters working
5. `/pipelines` shows 3 pipeline cards with real last-run data
6. "Run Now" triggers pipeline, shows spinner, displays result toast
7. `/pipelines/github-trends` shows real run history and content
8. `/pipelines/nonexistent` returns 404
9. `/settings` shows real user email and working pillar toggles
10. `/schedule`, `/analytics` return 404 (deleted)
11. No mock data visible anywhere in the UI
