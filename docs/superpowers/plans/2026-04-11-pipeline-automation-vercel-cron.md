# Pipeline Automation via Vercel Cron — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Trigger.dev with Vercel Cron Jobs so the 3 implemented pipelines (GitHub Trends, Signal Amplifier, Release Radar) actually run, generate content, and populate the dashboard with real data.

**Architecture:** Vercel Cron hits secured GET endpoints in `/api/cron/`. Each endpoint calls `runPipeline()` from `@influenceai/pipelines`, which handles ingestion, dedup, LLM generation, and DB writes via the service role key. The existing manual trigger route is updated to call `runPipeline()` directly instead of Trigger.dev.

**Tech Stack:** Next.js 15 API Routes, Vercel Cron, `@influenceai/pipelines` engine, Supabase service role client

---

### Task 1: Remove Trigger.dev Dependency

**Files:**
- Modify: `package.json:13-14` (root)
- Modify: `packages/pipelines/package.json:8`
- Modify: `packages/pipelines/src/index.ts`
- Delete: `packages/pipelines/src/trigger/github-trends-task.ts`

- [ ] **Step 1: Remove `@trigger.dev/sdk` from root `package.json`**

Edit `package.json` — remove the trigger.dev line from devDependencies:

```json
{
  "devDependencies": {
    "tsx": "^4.21.0",
    "turbo": "^2.4.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.2"
  }
}
```

- [ ] **Step 2: Remove `@trigger.dev/sdk` from `packages/pipelines/package.json`**

Edit `packages/pipelines/package.json` — remove from dependencies:

```json
{
  "dependencies": {
    "@influenceai/core": "workspace:*",
    "@influenceai/database": "workspace:*",
    "@influenceai/integrations": "workspace:*"
  }
}
```

- [ ] **Step 3: Clean up `packages/pipelines/src/index.ts`**

The index currently exports the engine, dedup, and all 3 pipeline definitions. It does NOT export the trigger task (good). Verify it looks like:

```ts
export { runPipeline } from './engine/runner';
export { deduplicateSignals } from './engine/dedup';
export { githubTrendsPipeline } from './tasks/github-trends';
export { signalAmplifierPipeline } from './tasks/signal-amplifier';
export { releaseRadarPipeline } from './tasks/release-radar';
```

No changes needed if it matches. The trigger task file is imported nowhere else.

- [ ] **Step 4: Delete the Trigger.dev task file**

Delete `packages/pipelines/src/trigger/github-trends-task.ts`.

- [ ] **Step 5: Run `pnpm install` to update lockfile**

Run: `pnpm install`
Expected: lockfile updates, no errors

- [ ] **Step 6: Run tests to verify nothing breaks**

Run: `pnpm test`
Expected: All 36 tests pass. The trigger task file had no tests.

- [ ] **Step 7: Commit**

```bash
git add package.json packages/pipelines/
git commit -m "refactor: remove Trigger.dev dependency

Replace with Vercel Cron (next task). The pipeline engine and
definitions remain unchanged."
```

---

### Task 2: Create Cron Route Helper and GitHub Trends Cron Route

**Files:**
- Create: `apps/web/src/app/api/cron/_lib/auth.ts`
- Create: `apps/web/src/app/api/cron/github-trends/route.ts`

- [ ] **Step 1: Create the shared cron auth helper**

Create `apps/web/src/app/api/cron/_lib/auth.ts`:

```ts
/**
 * Verifies that a request comes from Vercel Cron.
 * Vercel sends an `Authorization: Bearer <CRON_SECRET>` header.
 */
export function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // If CRON_SECRET is not set, deny all cron requests
    console.error('[cron] CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}
```

- [ ] **Step 2: Create the GitHub Trends cron route**

Create `apps/web/src/app/api/cron/github-trends/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { runPipeline, githubTrendsPipeline } from '@influenceai/pipelines';
import { verifyCronAuth } from '../_lib/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPipeline(githubTrendsPipeline);
    return NextResponse.json({
      pipeline: 'github-trends',
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error('[cron] github-trends failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Verify the route compiles**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/
git commit -m "feat: add Vercel Cron route for GitHub Trends pipeline

Secured with CRON_SECRET. Calls runPipeline() directly with
300s max duration for LLM generation."
```

---

### Task 3: Create Signal Amplifier and Release Radar Cron Routes

**Files:**
- Create: `apps/web/src/app/api/cron/signal-amplifier/route.ts`
- Create: `apps/web/src/app/api/cron/release-radar/route.ts`

- [ ] **Step 1: Create the Signal Amplifier cron route**

Create `apps/web/src/app/api/cron/signal-amplifier/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { runPipeline, signalAmplifierPipeline } from '@influenceai/pipelines';
import { verifyCronAuth } from '../_lib/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPipeline(signalAmplifierPipeline);
    return NextResponse.json({
      pipeline: 'signal-amplifier',
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error('[cron] signal-amplifier failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create the Release Radar cron route**

Create `apps/web/src/app/api/cron/release-radar/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { runPipeline, releaseRadarPipeline } from '@influenceai/pipelines';
import { verifyCronAuth } from '../_lib/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPipeline(releaseRadarPipeline);
    return NextResponse.json({
      pipeline: 'release-radar',
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error('[cron] release-radar failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/
git commit -m "feat: add Vercel Cron routes for Signal Amplifier and Release Radar"
```

---

### Task 4: Add Vercel Cron Configuration

**Files:**
- Create: `apps/web/vercel.json`

- [ ] **Step 1: Create `apps/web/vercel.json`**

The Vercel root directory is `apps/web`, so `vercel.json` goes here:

```json
{
  "crons": [
    {
      "path": "/api/cron/github-trends",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/signal-amplifier",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/release-radar",
      "schedule": "0 10 * * *"
    }
  ]
}
```

Schedules:
- GitHub Trends: daily at 8:00 UTC
- Signal Amplifier: every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Release Radar: daily at 10:00 UTC

- [ ] **Step 2: Commit**

```bash
git add apps/web/vercel.json
git commit -m "feat: add Vercel Cron schedules for 3 pipelines

GitHub Trends daily 8am, Signal Amplifier every 6h,
Release Radar daily 10am (all UTC)."
```

---

### Task 5: Update Manual Pipeline Trigger Route

**Files:**
- Modify: `apps/web/src/app/api/pipelines/[id]/trigger/route.ts`

- [ ] **Step 1: Replace Trigger.dev SDK with direct `runPipeline()` calls**

Replace the entire contents of `apps/web/src/app/api/pipelines/[id]/trigger/route.ts`:

```ts
import { NextResponse } from 'next/server';
import {
  runPipeline,
  githubTrendsPipeline,
  signalAmplifierPipeline,
  releaseRadarPipeline,
} from '@influenceai/pipelines';
import type { PipelineDefinition } from '@influenceai/core';

const pipelineMap: Record<string, PipelineDefinition> = {
  'github-trends': githubTrendsPipeline,
  'signal-amplifier': signalAmplifierPipeline,
  'release-radar': releaseRadarPipeline,
};

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const definition = pipelineMap[id];
  if (!definition) {
    return NextResponse.json(
      { error: `Unknown pipeline: ${id}. Available: ${Object.keys(pipelineMap).join(', ')}` },
      { status: 404 },
    );
  }

  try {
    const result = await runPipeline(definition);
    return NextResponse.json({
      success: result.status !== 'failed',
      pipelineId: id,
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error(`[trigger] Pipeline ${id} failed:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/pipelines/
git commit -m "feat: replace Trigger.dev with direct runPipeline() in trigger route

Maps all 3 pipelines (github-trends, signal-amplifier, release-radar).
300s max duration for LLM generation."
```

---

### Task 6: Fix Build-Time Dynamic Server Errors

**Issue:** Dashboard pages throw `DYNAMIC_SERVER_USAGE` during static generation because they call Supabase server client (which uses `cookies()`). Adding `export const dynamic = 'force-dynamic'` tells Next.js to skip static generation.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx:1`
- Modify: `apps/web/src/app/(dashboard)/analytics/page.tsx:1`
- Modify: `apps/web/src/app/(dashboard)/review/page.tsx:1`
- Modify: `apps/web/src/app/(dashboard)/schedule/page.tsx:1`
- Modify: `apps/web/src/app/(dashboard)/content/page.tsx:1`

- [ ] **Step 1: Add `dynamic` export to Command Center page**

Add at the top of `apps/web/src/app/(dashboard)/page.tsx` (before the imports):

```ts
export const dynamic = 'force-dynamic';
```

- [ ] **Step 2: Add `dynamic` export to Analytics page**

Add at the top of `apps/web/src/app/(dashboard)/analytics/page.tsx` (before the imports):

```ts
export const dynamic = 'force-dynamic';
```

- [ ] **Step 3: Add `dynamic` export to Review page**

Add at the top of `apps/web/src/app/(dashboard)/review/page.tsx` (before the imports):

```ts
export const dynamic = 'force-dynamic';
```

- [ ] **Step 4: Add `dynamic` export to Schedule page**

Add at the top of `apps/web/src/app/(dashboard)/schedule/page.tsx` (before the imports):

```ts
export const dynamic = 'force-dynamic';
```

- [ ] **Step 5: Add `dynamic` export to Content Library page**

Add at the top of `apps/web/src/app/(dashboard)/content/page.tsx` (before the imports):

```ts
export const dynamic = 'force-dynamic';
```

- [ ] **Step 6: Build to verify clean output**

Run: `pnpm -F @influenceai/web build`
Expected: Build succeeds with NO `Failed to fetch analytics data` or `DYNAMIC_SERVER_USAGE` errors in output. All dashboard pages show as `ƒ` (dynamic).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/
git commit -m "fix: add force-dynamic to dashboard pages

Eliminates noisy DYNAMIC_SERVER_USAGE errors during build.
These pages use cookies() via Supabase and must be dynamic."
```

---

### Task 7: Fix Environment Warning Spam in Middleware

**Issue:** `logEnvValidation()` in middleware logs warnings for every optional env var on every cold start, flooding runtime logs.

**Files:**
- Modify: `apps/web/src/middleware.ts:3,6`

- [ ] **Step 1: Remove `logEnvValidation()` from middleware**

Edit `apps/web/src/middleware.ts`:

Remove the import on line 3:
```ts
// DELETE: import { logEnvValidation } from '@/lib/env';
```

Remove the call on line 6:
```ts
// DELETE: logEnvValidation();
```

The resulting middleware should start:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
```

The env validation still exists in `@/lib/env.ts` and can be called from a health endpoint if needed later.

- [ ] **Step 2: Type-check**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "fix: remove env validation from middleware

Reduces runtime log noise. Optional env warnings were flooding
Vercel logs on every cold start."
```

---

### Task 8: Fix Login Redirect 404

**Issue:** Middleware redirects unauthenticated users to `/login?redirect=/` but the URL appears as `/login%3Fredirect=%2F` in logs, returning 404.

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Investigate the redirect encoding**

The current code at line 50-52:

```ts
const loginUrl = new URL('/login', request.url);
loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
return NextResponse.redirect(loginUrl);
```

This constructs the URL correctly. The issue is that `NextResponse.redirect()` may be receiving a URL object where the query string gets re-encoded when the Location header is set. The fix is to pass the string representation explicitly:

Edit `apps/web/src/middleware.ts` — replace lines 50-52:

```ts
  if (!user && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl.toString());
  }
```

The key change: `NextResponse.redirect(loginUrl)` → `NextResponse.redirect(loginUrl.toString())`. This ensures the URL is serialized as a string before being passed to the redirect, preventing double-encoding of the query string.

- [ ] **Step 2: Type-check**

Run: `pnpm -F @influenceai/web type-check`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "fix: prevent double-encoding in login redirect URL

Pass URL as string to NextResponse.redirect() to avoid
query string being encoded into the path segment."
```

---

### Task 9: Add Environment Variables to Vercel

**This task requires user input — the actual secret values.**

**Files:** None (Vercel dashboard / CLI)

- [ ] **Step 1: Gather required values**

The user needs to provide:

| Variable | Value source |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → `service_role` key |
| `LLM_BASE_URL` | LLM provider endpoint (e.g., `https://api.openai.com/v1`) |
| `LLM_API_KEY` | LLM provider API key |
| `LLM_MODEL` | Model name (e.g., `gpt-4o`) |
| `CRON_SECRET` | Any random string (generate with `openssl rand -hex 32`) |
| `GITHUB_TOKEN` | GitHub Settings → Developer Settings → Personal Access Tokens (optional) |
| `ALLOWED_EMAILS` | Comma-separated email whitelist, e.g. `mdkhatami@gmail.com` (optional) |

- [ ] **Step 2: Add variables via Vercel CLI or dashboard**

For each variable, run:
```bash
vercel env add VARIABLE_NAME production
```

Or add via Vercel Dashboard → Project → Settings → Environment Variables.

All variables should be set for the **Production** environment. `CRON_SECRET` must also be available in Production since that's where crons run.

- [ ] **Step 3: Verify by triggering a redeploy**

After adding env vars, trigger a new deployment:
```bash
git push origin main
```

Or use Vercel dashboard → Deployments → Redeploy.

---

### Task 10: Deploy and Verify End-to-End

**Files:** None (testing and verification)

- [ ] **Step 1: Run all tests locally**

Run: `pnpm test`
Expected: All tests pass (should be 36, minus any trigger task tests if they existed)

- [ ] **Step 2: Build locally**

Run: `pnpm -F @influenceai/web build`
Expected: Clean build, no `DYNAMIC_SERVER_USAGE` errors, no `Failed to fetch` errors

- [ ] **Step 3: Push and verify Vercel deployment**

```bash
git push origin main
```

Wait for deployment to reach READY state.

- [ ] **Step 4: Test login flow**

1. Open `https://influence-ai-web.vercel.app/` in browser
2. Should redirect to `/login?redirect=/` (NOT `/login%3Fredirect=%2F`)
3. Log in with `mdkhatami@gmail.com`
4. Should land on Command Center

- [ ] **Step 5: Manually trigger GitHub Trends pipeline**

Navigate to the Pipelines page in the dashboard. Click "Run" on GitHub Trends. Wait for it to complete (may take 30-60s for LLM generation).

Alternatively, use curl:
```bash
curl -X POST https://influence-ai-web.vercel.app/api/pipelines/github-trends/trigger
```

Expected response:
```json
{
  "success": true,
  "pipelineId": "github-trends",
  "status": "completed",
  "signalsIngested": 25,
  "signalsFiltered": 3,
  "itemsGenerated": 9
}
```

- [ ] **Step 6: Verify data in Supabase**

Check tables via Supabase Dashboard or SQL:

```sql
SELECT count(*) FROM content_signals;        -- Should be > 0
SELECT count(*) FROM content_items;          -- Should be > 0
SELECT count(*) FROM pipeline_runs;          -- Should be 1
SELECT count(*) FROM pipeline_logs;          -- Should be > 0
SELECT status, count(*) FROM content_items GROUP BY status;  -- Should show pending_review
```

- [ ] **Step 7: Verify dashboard shows real data**

1. Command Center: stats should show non-zero Content This Week, Pipeline Runs Today, Pending Review
2. Content Library: should list generated content items
3. Review Queue: Pending tab should have items
4. Pipelines: GitHub Trends should show "Last run succeeded" with timestamp

- [ ] **Step 8: Test Signal Amplifier and Release Radar**

Trigger each manually:
```bash
curl -X POST https://influence-ai-web.vercel.app/api/pipelines/signal-amplifier/trigger
curl -X POST https://influence-ai-web.vercel.app/api/pipelines/release-radar/trigger
```

Verify each produces data in the same tables.

- [ ] **Step 9: Verify Vercel runtime logs are clean**

Check Vercel Dashboard → Project → Logs:
- No more `ENVIRONMENT WARNINGS` spam
- Cron route calls should show 200 responses
- No 404 on login redirect

---

## Summary of Changes

| Action | File/Location | What |
|--------|---------------|------|
| Delete | `packages/pipelines/src/trigger/github-trends-task.ts` | Remove Trigger.dev task |
| Remove dep | `package.json`, `packages/pipelines/package.json` | Remove `@trigger.dev/sdk` |
| Create | `apps/web/src/app/api/cron/_lib/auth.ts` | Cron auth helper |
| Create | `apps/web/src/app/api/cron/github-trends/route.ts` | GitHub Trends cron |
| Create | `apps/web/src/app/api/cron/signal-amplifier/route.ts` | Signal Amplifier cron |
| Create | `apps/web/src/app/api/cron/release-radar/route.ts` | Release Radar cron |
| Create | `apps/web/vercel.json` | Cron schedules |
| Modify | `apps/web/src/app/api/pipelines/[id]/trigger/route.ts` | Direct `runPipeline()` |
| Modify | 5 dashboard pages | Add `force-dynamic` |
| Modify | `apps/web/src/middleware.ts` | Remove env validation, fix redirect |
| Env vars | Vercel dashboard | 5 required + 2 optional |
