# Phase 3: Content Review Workflow — Edit, Copy, Approve

**Date**: 2026-04-11
**Status**: Approved
**Depends on**: Phase 2 (UI Rebuild)
**Goal**: Full workflow for reviewing generated content — read it with its source context, edit inline, copy to clipboard for manual posting, approve or reject.

---

## The Core Workflow

```
Open pending item in Review page
  → See generated content alongside the source signal
  → Edit title or body if needed
  → Copy formatted text to clipboard
  → Approve (marks as done) or Reject (with reason)
  → Optionally mark as "Published" after pasting somewhere
  → Move to next item
```

This is the feature that makes the whole system useful. Everything before this (pipelines, signals, generation) feeds into this moment. Everything after (analytics, integrations) depends on content flowing through here.

---

## Content Detail Page

**Route**: `/review/[id]`

**Server component** that queries:
```typescript
// getContentItem uses .single() which throws on not-found (not returns null)
// Wrap in try/catch and call notFound() on error
try {
  const item = await getContentItem(id);
  // Returns content_items row joined with content_signals via signal_id
  // Already exists in apps/web/src/lib/queries/content.ts
} catch {
  return notFound();
}
```

### Layout — Two-Column

**Left column (65%): Content**

- **Platform badge**: LinkedIn / Twitter / Instagram icon + label
- **Title**: Displayed as `<h1>`. Click to edit → becomes an input field. Press Enter or click away to save.
- **Body**: Displayed as formatted text (preserving line breaks). Click to edit → becomes a textarea. Auto-grows to fit content.
- **"Save" button**: Appears when title or body has unsaved changes. Calls `PUT /api/content/[id]` with `{ title, body }`. Disappears after save.
- **Character count**: Shows below body when editing. Useful context: Twitter limit is 280 chars. Display as "X characters" with color warning when over 280 for Twitter platform items.

**Right column (35%): Context + Actions**

- **Source Signal card** (if `signal_id` exists):
  - Signal title
  - Signal URL (clickable, opens in new tab)
  - Signal summary (first 200 chars)
  - Source type badge (GitHub / RSS / HackerNews)
  - "View source →" external link

- **Metadata**:
  - Pipeline: name badge linking to `/pipelines/[slug]`
  - Quality score: number with color (green >=7, yellow 4-6, red <=3)
  - Created: full timestamp
  - Status: current status badge

- **Actions** (stacked vertically, full-width buttons):

  1. **"Copy to Clipboard"** (primary action, prominent blue button)
     - Copies `body` text to clipboard using `navigator.clipboard.writeText()`
     - Button text changes to "Copied!" for 2 seconds
     - After copying, a secondary "Mark as Published" link appears below

  2. **"Approve"** (green outline button)
     - Sets status to `approved`
     - Shows success toast
     - Navigates to next pending item (or back to `/` if none left)

  3. **"Reject"** (red outline button)
     - Expands to show a textarea for rejection reason
     - "Confirm Reject" button saves `{ status: 'rejected', rejectionReason }`
     - Navigates to next pending item

  4. **"Mark as Published"** (appears after copying, small text link)
     - Sets status to `published`, `published_at` to now
     - Just bookkeeping — no actual API call to any platform

- **Navigation**:
  - "← Back to Review" link at top — navigates to `/` (the Review page is the home route, not `/review`)
  - "← Previous" / "Next →" arrows to navigate between pending items without going back to the list

### Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `c` | Copy body to clipboard | When not editing |
| `a` | Approve | When not editing |
| `r` | Focus reject reason input | When not editing |
| `e` | Enter edit mode on body | When not editing |
| `Escape` | Cancel edit / close reject input | When editing |
| `j` / `k` or `←` / `→` | Previous / Next pending item | When not editing |

Shortcuts only active when no input/textarea is focused.

---

## API Changes

### Existing endpoint — extend `PUT /api/content/[id]`

**Current**: Accepts `{ status, body, rejectionReason }`

**Extend to also accept**:
- `publishedAt` (ISO string) — set published timestamp when marking as published

The route already exists at `apps/web/src/app/api/content/[id]/route.ts`. It already handles `title`, `body`, `status`, `scheduledAt`, and `rejectionReason` (lines 34-39). Just add the `publishedAt` → `published_at` mapping. The `updateContentStatus` function in `packages/database/src/queries/content-items.ts` also needs extending to support `title`, `body`, and `publishedAt` in its `extra` parameter.

### Existing endpoint — `GET /api/content/[id]`

**Already exists** at `apps/web/src/app/api/content/[id]/route.ts` (lines 4-23). Returns the content item joined with `content_signals` via `.select('*, content_signals(*)')`. No changes needed — the page server component can use `getContentItem(id)` from `apps/web/src/lib/queries/content.ts` directly (no API call needed for server components).

### New: Navigation query

Add to `apps/web/src/lib/queries/content.ts`:

```typescript
export async function getAdjacentPendingItems(currentId: string): Promise<{
  previousId: string | null;
  nextId: string | null;
}> {
  // Get all pending_review items ordered by created_at DESC
  // Find current item's position
  // Return IDs of previous and next items
}
```

---

## Database Changes

### Extend `updateContentStatus` in `packages/database/src/queries/content-items.ts`

**Current signature** (in `packages/database/src/queries/content-items.ts`, line 48):
```typescript
export async function updateContentStatus(
  client: SupabaseClient,
  itemId: string,
  status: ContentStatus,  // NOTE: typed union from @influenceai/core, not a plain string
  extra?: { rejectionReason?: string; replacedById?: string; scheduledAt?: string }
)
```

`ContentStatus` includes: `'pending_review' | 'approved' | 'scheduled' | 'published' | 'rejected' | 'replaced'`. The `'published'` value is already valid.

**Extended**: Add `title`, `body`, `publishedAt` to the `extra` parameter:
```typescript
extra?: { 
  rejectionReason?: string; 
  replacedById?: string; 
  scheduledAt?: string;
  title?: string;
  body?: string;
  publishedAt?: string;
}
```

The function builds an update object from whatever fields are present in `extra`, then runs `.update()`.

No schema changes needed — all columns already exist in `content_items` (some via v2 migration `00002_v2_schema_updates.sql`: `quality_score`, `rejection_reason`, `pipeline_run_id`).

---

## Component Structure

### New

| Component | File | Type | Purpose |
|-----------|------|------|---------|
| Review Detail Page | `app/(dashboard)/review/[id]/page.tsx` | Server | Replaces Phase 2 minimal placeholder. Fetches item + signal, renders full two-column layout. |
| EditableTitle | `components/dashboard/editable-title.tsx` | Client | Click-to-edit title with save |
| EditableBody | `components/dashboard/editable-body.tsx` | Client | Click-to-edit textarea with save + char count |
| ReviewActions | `components/dashboard/review-actions.tsx` | Client | Copy, Approve, Reject, Mark Published buttons |
| SourceSignalCard | `components/dashboard/source-signal-card.tsx` | Server | Displays source signal context |
| KeyboardShortcuts | `components/dashboard/keyboard-shortcuts.tsx` | Client | Registers and handles keyboard shortcuts |

### Modified

| Component | File | Changes |
|-----------|------|---------|
| ContentCard | `components/dashboard/content-card.tsx` | Add "Review →" link to `/review/[id]` (from Phase 2) |
| content-actions.tsx | `components/dashboard/content-actions.tsx` | May be replaced by ReviewActions or kept for inline quick-actions |

---

## Files Summary

| Action | File |
|--------|------|
| **Rewrite** | `apps/web/src/app/(dashboard)/review/[id]/page.tsx` (replaces Phase 2 placeholder) |
| **Create** | `apps/web/src/components/dashboard/editable-title.tsx` |
| **Create** | `apps/web/src/components/dashboard/editable-body.tsx` |
| **Create** | `apps/web/src/components/dashboard/review-actions.tsx` |
| **Create** | `apps/web/src/components/dashboard/source-signal-card.tsx` |
| **Create** | `apps/web/src/components/dashboard/keyboard-shortcuts.tsx` |
| **Modify** | `apps/web/src/app/api/content/[id]/route.ts` (add GET, extend PUT) |
| **Modify** | `packages/database/src/queries/content-items.ts` (extend updateContentStatus) |
| **Modify** | `apps/web/src/lib/queries/content.ts` (add getAdjacentPendingItems) |
| **Modify** | `apps/web/src/components/dashboard/content-card.tsx` (add Review link) |

## Testing

1. Navigate to `/review/[valid-id]` — see content with source signal context
2. Click title → edit inline → save → verify DB updated
3. Click body → edit inline → save → verify DB updated
4. "Copy to Clipboard" → verify text is in clipboard
5. "Mark as Published" appears after copy → click → status changes to `published`
6. "Approve" → status changes, navigates to next pending item
7. "Reject" → enter reason → confirm → status changes, reason saved
8. Keyboard: press `c` → copies, press `a` → approves, press `j`/`k` → navigates
9. Navigate to `/review/[invalid-id]` → 404
10. All pending items reviewed → "All caught up!" message
11. Edit body on a Twitter item → character count shows, warns if > 280
