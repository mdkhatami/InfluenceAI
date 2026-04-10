# Phase 3: Content Review Workflow

**Priority**: High
**Depends on**: Phase 2 (UI Simplification)
**Goal**: Complete workflow from generated content → reviewed → scheduled → ready to publish

---

## The Core Loop

This is the main feature of InfluenceAI. Everything else exists to feed this loop:

```
Pipeline generates content (status: pending_review)
  → Operator reviews in Review Queue
  → Approve (status: approved, optionally set scheduled_at)
  → OR Edit → Approve
  → OR Reject with reason (status: rejected)
  → OR Regenerate (triggers new LLM call with feedback)
```

---

## Features

### 1. Content Detail View

**Route**: `/review/[id]`

Full-screen view of a single content item:
- **Title** (editable inline)
- **Body** (rich text editor or textarea, editable)
- **Platform** badge (linkedin, twitter, instagram)
- **Quality score** badge
- **Source signal** link (what triggered this content)
- **Pipeline** that generated it
- **Created date**

**Actions**:
- "Approve" button → sets status to `approved`
- "Approve & Schedule" button → sets status to `approved` + sets `scheduled_at`
- "Reject" button → opens reason input, sets status to `rejected` with `rejection_reason`
- "Save Edits" button → updates title/body without changing status
- "Back to Queue" link

### 2. Inline Editing

On the review card in the queue OR on the detail page:
- Click title to edit
- Click body to edit
- Save changes via `PUT /api/content/[id]`
- Keep the original `generation_model` and `signal_id` — just update the text

### 3. Schedule Content

When approving, optionally pick a date/time:
- Simple date picker (not a full calendar — just "when should this go out?")
- Sets `scheduled_at` on the content item
- Scheduled content appears on the Schedule page (Phase 2 can then unhide it)

### 4. Reject with Reason

- Text input for why the content was rejected
- Stored in `rejection_reason` column
- Rejected items visible in the "Rejected" tab of Review Queue
- Option to "Regenerate" from a rejected item (future: passes reason as feedback to LLM)

### 5. Bulk Actions

On the Review Queue page:
- Checkbox on each card
- "Approve Selected" button
- "Reject Selected" button (with shared reason)
- Select All / Deselect All

---

## API Changes

### Existing (already works):
- `PUT /api/content/[id]` — updates status, body, title
- `GET /api/content` — lists content with filters

### New:
- `GET /api/content/[id]` — get single content item with signal data (for detail view)
- `PUT /api/content/[id]` — extend to support: `scheduled_at`, `rejection_reason`, `title`, `body` updates
- `POST /api/content/bulk` — bulk status update (approve/reject multiple items)

---

## Database Changes

None — all needed columns already exist:
- `scheduled_at` (timestamp, nullable)
- `rejection_reason` (text, nullable) 
- `status` (text: pending_review, approved, rejected, published)
- `title`, `body` (text, editable)

---

## Files

| Action | File |
|--------|------|
| Create | `apps/web/src/app/(dashboard)/review/[id]/page.tsx` (content detail view) |
| Modify | `apps/web/src/app/(dashboard)/review/page.tsx` (add bulk actions, checkboxes) |
| Modify | `apps/web/src/components/dashboard/content-actions.tsx` (add schedule, reject reason) |
| Modify | `apps/web/src/app/api/content/[id]/route.ts` (extend PUT, add GET) |
| Create | `apps/web/src/app/api/content/bulk/route.ts` (bulk actions) |
| Modify | `apps/web/src/lib/queries/content.ts` (add getContentItem with signal join) |

---

## Testing

- Open a pending item → edit title → save → verify title updated in DB
- Approve an item → verify status changes to `approved`
- Approve with schedule date → verify `scheduled_at` is set
- Reject with reason → verify `rejection_reason` saved
- Bulk approve 3 items → all 3 change status
- Schedule page shows approved items with `scheduled_at`
