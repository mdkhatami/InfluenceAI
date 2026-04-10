# Phase 3 — Part A: Backend (API + Query Changes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the database query layer and API route to support the full review workflow — editable title/body, publishedAt tracking, and prev/next navigation through the pending review queue.

**Architecture:** `updateContentStatus` in `@influenceai/database` gains three new optional fields (`title`, `body`, `publishedAt`). The `PUT /api/content/[id]` route adds `publishedAt` mapping. A new server-side query `getAdjacentPendingItems` returns prev/next IDs for keyboard navigation.

**Tech Stack:** Supabase (PostgreSQL), Next.js 15 API Routes, TypeScript strict mode

---

### Task 1: Extend `updateContentStatus` with `title`, `body`, `publishedAt`

**Files:**
- Modify: `packages/database/src/queries/content-items.ts` (lines 48-61)

- [ ] **Step 1: Update the `extra` parameter type and function body**

Open `packages/database/src/queries/content-items.ts` and replace the entire `updateContentStatus` function (lines 48-61) with this version that adds `title`, `body`, and `publishedAt` to the optional `extra` parameter:

```ts
export async function updateContentStatus(
  client: SupabaseClient,
  itemId: string,
  status: ContentStatus,
  extra?: {
    rejectionReason?: string;
    replacedById?: string;
    scheduledAt?: string;
    title?: string;
    body?: string;
    publishedAt?: string;
  },
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (extra?.rejectionReason) update.rejection_reason = extra.rejectionReason;
  if (extra?.replacedById) update.replaced_by_id = extra.replacedById;
  if (extra?.scheduledAt) update.scheduled_at = extra.scheduledAt;
  if (extra?.title !== undefined) update.title = extra.title;
  if (extra?.body !== undefined) update.body = extra.body;
  if (extra?.publishedAt) update.published_at = extra.publishedAt;

  const { error } = await client.from('content_items').update(update).eq('id', itemId);
  if (error) throw new Error(`Failed to update content item: ${error.message}`);
}
```

Note: `title` and `body` use `!== undefined` checks (not truthy) so that setting them to empty string is valid. `publishedAt` uses truthy check since empty-string published dates are meaningless.

- [ ] **Step 2: Verify the file compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/database exec tsc --noEmit
```

Expected: No type errors.

---

### Task 2: Add `publishedAt` mapping in `PUT /api/content/[id]`

**Files:**
- Modify: `apps/web/src/app/api/content/[id]/route.ts` (line 39, inside the PUT handler)

- [ ] **Step 1: Add publishedAt mapping after the rejectionReason line**

In `apps/web/src/app/api/content/[id]/route.ts`, find this line (line 39):

```ts
    if (body.rejectionReason !== undefined) update.rejection_reason = body.rejectionReason;
```

Add the following line immediately after it:

```ts
    if (body.publishedAt !== undefined) update.published_at = body.publishedAt;
```

The full block (lines 34-40) should now read:

```ts
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) update.status = body.status;
    if (body.body !== undefined) update.body = body.body;
    if (body.title !== undefined) update.title = body.title;
    if (body.scheduledAt !== undefined) update.scheduled_at = body.scheduledAt;
    if (body.rejectionReason !== undefined) update.rejection_reason = body.rejectionReason;
    if (body.publishedAt !== undefined) update.published_at = body.publishedAt;
```

- [ ] **Step 2: Verify the route compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors (the route uses `Record<string, unknown>` so any string key is valid).

---

### Task 3: Add `getAdjacentPendingItems` query

**Files:**
- Modify: `apps/web/src/lib/queries/content.ts` (append after line 120)

- [ ] **Step 1: Add the `getAdjacentPendingItems` function**

Append the following function at the end of `apps/web/src/lib/queries/content.ts` (after the closing brace of `getContentItem` on line 120):

```ts

export async function getAdjacentPendingItems(currentId: string): Promise<{
  previousId: string | null;
  nextId: string | null;
}> {
  const supabase = await createClient();

  // Fetch all pending_review item IDs ordered by newest first (same order as review queue)
  const { data } = await supabase
    .from('content_items')
    .select('id')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  const items = data ?? [];
  const idx = items.findIndex((item) => item.id === currentId);

  // If not found in pending list (e.g., already approved), return nulls
  if (idx === -1) {
    return { previousId: null, nextId: null };
  }

  return {
    previousId: idx > 0 ? items[idx - 1].id : null,
    nextId: idx < items.length - 1 ? items[idx + 1].id : null,
  };
}
```

- [ ] **Step 2: Verify the query file compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 4: Install sonner for toast notifications

**Files:**
- Modify: `apps/web/package.json` (add dependency)
- Modify: `apps/web/src/app/layout.tsx` (add Toaster)

Sonner is required by the client components in Part B and Part C. Install it now so subsequent parts can use `toast()` without additional setup.

- [ ] **Step 1: Install sonner**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web add sonner
```

Expected: `sonner` appears in `apps/web/package.json` dependencies.

- [ ] **Step 2: Add the Toaster component to the root layout**

Open `apps/web/src/app/layout.tsx` and replace it with:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from 'sonner';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'InfluenceAI — AI Content Command Center',
  description: 'Manage, automate, and scale your AI influencer content across all platforms.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark", "font-sans", geist.variable)}>
      <body className="font-sans antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid #27272a',
              color: '#fafafa',
            },
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify the layout compiles**

Run:
```bash
cd /Users/A117905666/projects/cloudride/AI_Server/InfluenceAI && pnpm -F @influenceai/web exec tsc --noEmit
```

Expected: No type errors.

---

### Task 5: Commit

```bash
git add packages/database/src/queries/content-items.ts \
       apps/web/src/app/api/content/\[id\]/route.ts \
       apps/web/src/lib/queries/content.ts \
       apps/web/src/app/layout.tsx \
       apps/web/package.json \
       pnpm-lock.yaml
git commit -m "feat(review): extend backend for review workflow

- Add title, body, publishedAt to updateContentStatus extra param
- Add publishedAt mapping in PUT /api/content/[id] route
- Add getAdjacentPendingItems query for prev/next navigation
- Install sonner and add Toaster to root layout

Phase 3 Part A"
```
