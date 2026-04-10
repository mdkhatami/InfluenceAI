# InfluenceAI — Feature Spec Overview

**Date**: 2026-04-11
**Goal**: Clean, simple dashboard that shows real data and supports the full content workflow.

---

## Current State (after pipeline automation work)

### What's working:
- 3 pipelines run in production (github-trends, signal-amplifier, release-radar)
- Vercel Cron fires daily, content is generated and stored in Supabase
- 6 of 8 dashboard pages query real Supabase data
- Auth works (email/password, invite-only)
- Empty state components exist and are used

### What's broken or fake:
- **GitHub Trends detail page** — 100% hardcoded mock data (fake runs, fake content, fake stats)
- **Settings profile** — hardcoded email "operator@influenceai.dev"
- **Content quality** — signals from non-AI sources (chimpanzee wars, WireGuard) due to poor filtering
- **No publishing** — content stays at `pending_review` forever, no way to actually publish
- **No analytics data** — `content_analytics` table is empty, charts show zeros
- **Pipeline detail pages** — only GitHub Trends has a detail page (mock), others have none

### Database counts:
| Table | Rows | Notes |
|-------|------|-------|
| content_items | 13 | All `pending_review` |
| content_signals | 6 | From 3 pipeline runs |
| pipeline_runs | 5 | 3 completed, 2 failed |
| pipeline_logs | 32 | Step-by-step traces |
| content_analytics | 0 | Not implemented |
| integration_configs | 0 | No integrations configured |

---

## Spec Plan Phases

Each phase is a standalone spec with its own implementation plan. They should be done **in order** — each builds on the previous.

### Phase 1: UI Cleanup (spec-01-ui-cleanup.md)
Remove mock data, fix broken pages, ensure empty states work.
- Remove GitHub Trends detail mock data → show real pipeline runs/content
- Fix Settings profile to use real Supabase user
- Verify all pages handle empty data gracefully
- **Estimated scope**: Small (3-5 files)

### Phase 2: UI Simplification (spec-02-ui-simplification.md)
Rethink the UI for clarity. Reduce complexity.
- Simplify Command Center — fewer cards, clearer purpose
- Make pipeline page actionable (trigger buttons, status)
- Clean up content library — better columns, clearer status
- Improve review queue — focus on the review workflow
- **Estimated scope**: Medium (8-12 files)

### Phase 3: Content Review Workflow (spec-03-review-workflow.md)
The core feature: review, edit, approve, reject generated content.
- Full content detail/edit view
- Approve → schedule flow
- Reject with reason → regenerate option
- Bulk actions (approve all, reject all)
- **Estimated scope**: Medium (5-8 files)

### Phase 4: Pipeline Intelligence (spec-04-pipeline-intelligence.md)
Better signal filtering and content quality.
- AI relevance filtering (stop ingesting non-AI news)
- Pipeline configuration UI (edit schedules, filters)
- Pipeline run detail view with logs
- Manual trigger from UI with feedback
- **Estimated scope**: Medium (6-10 files)

### Phase 5: Publishing (spec-05-publishing.md)
Actually publish content to social platforms.
- LinkedIn API integration
- Twitter/X API integration  
- Copy-to-clipboard for manual posting
- Publishing status tracking
- **Estimated scope**: Large (10-15 files)

### Phase 6: Analytics (spec-06-analytics.md)
Track content performance after publishing.
- Manual engagement data entry (likes, comments, shares)
- Auto-import from platform APIs (if connected)
- Content performance dashboard
- Pipeline ROI metrics
- **Estimated scope**: Medium (5-8 files)

---

## Design Principles

1. **Show real data or nothing** — never fake numbers, never mock content
2. **Simple over complex** — if a feature isn't implemented, don't show a placeholder UI for it
3. **Progressive disclosure** — show summary first, details on click
4. **One action per screen** — each page has one clear purpose
5. **Empty states guide action** — "No content yet. Run a pipeline to get started."
