# Phase 5: Publishing — Get Content Out to Social Platforms

**Priority**: Medium
**Depends on**: Phase 3 (Review Workflow)
**Goal**: Approved content can be published to LinkedIn and Twitter, or copied for manual posting.

---

## Approach

Start simple: **copy-to-clipboard** for manual posting, then add API publishing.

Most solo operators will want to review content one more time before it goes live. Don't auto-publish without explicit action.

---

## Features (in order of implementation)

### 1. Copy to Clipboard

Simplest possible "publishing":
- "Copy" button on each approved content item
- Formats the content for the target platform (e.g., adds hashtags for Twitter, trims to 280 chars)
- Operator pastes into LinkedIn/Twitter manually
- After copying, button changes to "Mark as Published"
- "Mark as Published" sets status to `published`, records `published_at`

**Why this first**: Zero API setup, works immediately, teaches the operator the workflow.

### 2. LinkedIn Publishing (API)

LinkedIn API integration:
- OAuth2 connection flow in Settings
- Store access token in `integration_configs`
- "Publish to LinkedIn" button on approved content
- Creates a post via LinkedIn API
- Stores `published_url` on the content item
- Sets status to `published`

**API**: LinkedIn Marketing API — `POST /ugcPosts` or Community Management API
**Scopes**: `w_member_social` (for personal posts)

### 3. Twitter/X Publishing (API)

Twitter API v2 integration:
- OAuth2 connection flow in Settings  
- Store access token in `integration_configs`
- "Publish to Twitter" button on approved content
- Creates a tweet via Twitter API
- Auto-trims to 280 characters (or shows warning)
- Stores `published_url`

**API**: Twitter API v2 — `POST /2/tweets`
**Scopes**: `tweet.write`, `users.read`

### 4. Publishing Status Tracking

Content status flow becomes:
```
pending_review → approved → published
                         → scheduled → published (future: auto-publish at scheduled_at)
```

New fields used:
- `published_at` — when it was actually published
- `published_url` — link to the live post
- `status: 'published'` — final state

---

## Settings Integration Page

In Settings > Integrations tab:
- LinkedIn card: "Not connected" / "Connected as [name]" with Connect/Disconnect buttons
- Twitter card: "Not connected" / "Connected as @handle" with Connect/Disconnect buttons
- Each shows last sync time, token expiry

**OAuth callback routes**:
- `/api/integrations/linkedin/callback`
- `/api/integrations/twitter/callback`

---

## Files

| Action | File |
|--------|------|
| Modify | `apps/web/src/components/dashboard/content-actions.tsx` (add Copy, Publish buttons) |
| Create | `apps/web/src/app/api/integrations/linkedin/route.ts` (OAuth start) |
| Create | `apps/web/src/app/api/integrations/linkedin/callback/route.ts` (OAuth callback) |
| Create | `apps/web/src/app/api/integrations/twitter/route.ts` |
| Create | `apps/web/src/app/api/integrations/twitter/callback/route.ts` |
| Create | `apps/web/src/app/api/content/[id]/publish/route.ts` (publish action) |
| Create | `packages/integrations/src/linkedin/client.ts` (LinkedIn API client) |
| Create | `packages/integrations/src/twitter/client.ts` (Twitter API client) |
| Modify | `apps/web/src/app/(dashboard)/settings/page.tsx` (connection UI) |

---

## Testing

- Copy button works → content copied to clipboard → mark as published
- LinkedIn OAuth flow connects successfully
- Publishing to LinkedIn creates a real post
- Published content shows URL link back to the live post
- Twitter OAuth flow connects
- Publishing to Twitter creates a tweet
- Content status progression: pending_review → approved → published
