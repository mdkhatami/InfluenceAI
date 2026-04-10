# Phase 2: UI Simplification — Clear, Understandable Dashboard

**Priority**: High
**Depends on**: Phase 1 (UI Cleanup)
**Goal**: Every page has one clear purpose. No confusion about what's real.

---

## Design Philosophy

The current dashboard has too many cards, charts, and sections competing for attention. A solo operator doesn't need an enterprise analytics dashboard — they need to:

1. **See what pipelines produced** (Command Center)
2. **Review and approve content** (Review Queue)
3. **Check pipeline health** (Pipelines)
4. **Find past content** (Content Library)

Everything else is secondary.

---

## Page-by-Page Redesign

### 1. Command Center (`/`)

**Current**: 4 stat cards + engagement chart + content-by-pillar chart + recent activity feed + pipeline status
**Problem**: Too much info at once. Most stats are zeros (no analytics data). Charts are empty.

**Simplified**:
- **Top section**: 3 stat cards only
  - "Pending Review" (count from content_items where status=pending_review)
  - "Generated Today" (count from content_items created today)  
  - "Pipeline Runs Today" (count from pipeline_runs today)
- **Main section**: Recent activity feed (last 10 content items created, with pipeline source)
- **Remove**: Engagement chart (no data until Phase 6), content-by-pillar chart (not actionable), pipeline status cards (duplicates the Pipelines page)

**Rationale**: The Command Center answers ONE question: "What happened since I last looked?" Everything else has its own page.

### 2. Content Library (`/content`)

**Current**: Filterable table with status/search filters, pagination
**Status**: Already works with real data. Minor improvements needed.

**Changes**:
- Add `pipeline_slug` as a visible column (so you know which pipeline generated it)
- Show content `body` preview (first 100 chars) instead of just title
- Remove any columns that are always empty (e.g., `published_url` until Phase 5)
- Keep status filter and search — they work well

### 3. Pipelines (`/pipelines`)

**Current**: Cards showing last run status per pipeline. Works with real data.

**Changes**:
- Add a visible "Run Now" button on each card (calls `/api/pipelines/[id]/trigger`)
- Show last run time and status prominently
- Link each card to `/pipelines/[slug]` detail page (from Phase 1)
- Show cron schedule in human-readable form ("Daily at 8:00 AM UTC")
- Remove "active today" count if it's confusing — just show last run status

### 4. Review Queue (`/review`)

**Current**: Tabs for pending/approved/rejected with content cards. Works with real data.

**Changes**:
- Make the pending tab the default and most prominent
- Each card shows: title, platform icon, quality score badge, body preview
- Approve/Reject buttons directly on each card (already exists in content-actions.tsx)
- Add "Approve All" bulk action for convenience
- Show count badges on tabs

### 5. Schedule (`/schedule`)

**Current**: Week calendar view showing scheduled content.
**Problem**: No content is ever scheduled (status goes from pending_review → approved, but not to scheduled_at).

**Change for now**: Show a simple message "Scheduling will be available after Phase 3 (Content Review Workflow)" or hide this page entirely until it has data to show.

**Recommendation**: Hide from sidebar navigation until Phase 3 is complete. Less confusion.

### 6. Analytics (`/analytics`)

**Current**: Charts for engagement, trends, pipeline success.
**Problem**: `content_analytics` table is empty. Charts show nothing.

**Change for now**: Show empty state: "Analytics will appear here once content has been published and engagement data is collected."

**Recommendation**: Keep in sidebar but ensure the empty state is clear and not confusing.

### 7. Settings (`/settings`)

**Current**: Tabs for integrations, content pillars, preferences, prompt templates, profile.
**Status**: Partially working — pillar toggles and preferences save to DB.

**Changes**:
- Fix profile to show real user email (Phase 1)
- Keep integrations tab but show clear "Not connected" states
- Keep pillar toggles — they work
- Keep preferences — they work
- Remove prompt template editor for now (complex, rarely used by solo operator)

---

## Navigation Changes

**Current sidebar** (7 items):
1. Command Center
2. Content
3. Pipelines
4. Review Queue
5. Schedule
6. Analytics
7. Settings

**Simplified sidebar** (6 items — hide Schedule until Phase 3):
1. Command Center — "What's new?"
2. Review Queue — "What needs my attention?" (move up — most used)
3. Content — "All my content"
4. Pipelines — "Are my pipelines running?"
5. Analytics — "How is content performing?"
6. Settings — Configuration

**Rationale**: Review Queue is the most-used page for a solo operator. Move it higher.

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/app/(dashboard)/page.tsx` | Simplify to 3 stats + activity feed |
| `apps/web/src/app/(dashboard)/content/page.tsx` | Add pipeline_slug column, body preview |
| `apps/web/src/app/(dashboard)/pipelines/page.tsx` | Add "Run Now" button, human-readable schedule |
| `apps/web/src/app/(dashboard)/review/page.tsx` | Minor polish, bulk approve |
| `apps/web/src/app/(dashboard)/schedule/page.tsx` | Hide or show clear "coming soon" empty state |
| `apps/web/src/app/(dashboard)/analytics/page.tsx` | Ensure clean empty state |
| `apps/web/src/app/(dashboard)/settings/page.tsx` | Remove prompt template tab for now |
| `apps/web/src/components/dashboard/sidebar.tsx` | Reorder nav, optionally hide Schedule |
| `apps/web/src/components/dashboard/pipeline-trigger-button.tsx` | NEW: Reusable trigger button with loading state |

---

## Testing

- Every page loads without errors
- Pages with no data show clear empty states
- "Run Now" button on pipelines triggers successfully
- Review queue shows real pending content
- Command Center shows today's activity
- No mock data visible anywhere
