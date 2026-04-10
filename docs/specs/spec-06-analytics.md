# Phase 6: Analytics — Track Content Performance

**Priority**: Low (needs Phase 5 first)
**Depends on**: Phase 5 (Publishing)
**Goal**: Know which content performs well so pipelines can improve over time.

---

## Problem

The `content_analytics` table exists but has 0 rows. The Analytics page shows empty charts. Without publishing (Phase 5), there's nothing to measure.

---

## Features

### 1. Manual Engagement Entry

After publishing content manually (copy-paste), the operator can log engagement:
- Click "Log Engagement" on a published content item
- Enter: likes, comments, shares, impressions
- Saved to `content_analytics` table
- Linked to the content item by `content_item_id`

**Why manual first**: Most operators start by copy-pasting. They won't have API access to pull engagement data automatically.

### 2. Auto-Import from Platform APIs

If LinkedIn/Twitter are connected (Phase 5):
- Daily cron job fetches engagement metrics for published content
- Updates `content_analytics` rows automatically
- Only fetches for content published in the last 30 days

### 3. Analytics Dashboard

The existing Analytics page (`/analytics`) gets real data:
- **Top section**: Total published, total engagement, avg engagement per post
- **Chart 1**: Engagement over time (last 30 days)
- **Chart 2**: Performance by platform (LinkedIn vs Twitter vs Instagram)
- **Chart 3**: Performance by pillar (which content types get most engagement)
- **Table**: Top 10 performing posts

### 4. Pipeline ROI View

On each pipeline's detail page, show:
- Content generated vs content published vs content engaged
- Average quality score of generated content
- Which pipeline produces the best-performing content

---

## Database

The `content_analytics` table already exists with columns:
- `content_item_id`, `platform`, `impressions`, `likes`, `comments`, `shares`, `clicks`, `recorded_at`

No schema changes needed.

---

## Files

| Action | File |
|--------|------|
| Create | `apps/web/src/app/api/analytics/engagement/route.ts` (manual entry API) |
| Create | `apps/web/src/app/api/cron/fetch-engagement/route.ts` (auto-import cron) |
| Modify | `apps/web/src/app/(dashboard)/analytics/page.tsx` (wire to real data) |
| Modify | `apps/web/src/lib/queries/analytics.ts` (add engagement queries) |
| Create | `apps/web/src/components/dashboard/engagement-form.tsx` (manual entry form) |

---

## Testing

- Log engagement manually for a published item → appears in analytics
- Analytics charts show real data
- Performance by platform shows correct breakdown
- Auto-import (if connected) fetches and stores engagement data
