# Pipeline Automation via Vercel Cron

**Date**: 2026-04-11
**Status**: Proposed
**Approach**: Replace Trigger.dev with Vercel Cron Jobs for pipeline scheduling

---

## Context

The InfluenceAI system has a fully built pipeline engine (`packages/pipelines/src/engine/runner.ts`) that handles signal ingestion, dedup, LLM content generation, and DB writes. Three pipeline definitions exist (GitHub Trends, Signal Amplifier, Release Radar). However, **no pipeline has ever run in production** because:

1. The scheduling layer (Trigger.dev) was never configured
2. Required env vars (`SUPABASE_SERVICE_ROLE_KEY`, `LLM_*`) are missing from Vercel
3. The direct API route (`/api/pipelines/github-trends`) doesn't use the pipeline engine

## Decision

Replace Trigger.dev with Vercel Cron Jobs. The pipeline engine runs inline in Vercel Functions (Fluid Compute, 300s timeout). No external services needed.

## Architecture

```
Vercel Cron (schedule)
  → /api/cron/github-trends     (daily 8am UTC)
  → /api/cron/signal-amplifier   (every 6 hours)
  → /api/cron/release-radar      (daily 10am UTC)
      │
      ▼
  runPipeline(pipelineDefinition)
      │
      ├─ ingest() → fetch signals from sources
      ├─ dedup()  → hash-check against content_signals
      ├─ filter() → score and rank top signals
      ├─ generate() → LLM content per signal per platform
      │     └─ uses prompt_templates from DB
      └─ finalize() → update pipeline_runs status
          │
          ▼
    Supabase writes:
      content_signals (new signals)
      content_items   (generated content, status=pending_review)
      pipeline_runs   (execution record)
      pipeline_logs   (step-by-step logs)
```

### Cron Route Security

Vercel Cron sends an `Authorization: Bearer <CRON_SECRET>` header. Each cron route verifies this before executing.

```ts
// /api/cron/github-trends/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const result = await runPipeline(githubTrendsPipeline);
  return Response.json(result);
}
```

### Vercel Config

```json
{
  "crons": [
    { "path": "/api/cron/github-trends", "schedule": "0 8 * * *" },
    { "path": "/api/cron/signal-amplifier", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/release-radar", "schedule": "0 10 * * *" }
  ]
}
```

### Manual Trigger

The existing pipeline trigger button in the dashboard calls `/api/pipelines/[id]/trigger`. This route will be updated to call `runPipeline()` directly instead of going through Trigger.dev.

## Bug Fixes (Included in Scope)

### 1. Login Redirect 404

**Issue**: Middleware redirects to `/login?redirect=/` but the URL gets double-encoded as `/login%3Fredirect=%2F`, returning 404.

**Fix**: The middleware code constructs the URL correctly via `new URL('/login', request.url)` + `searchParams.set()`. The `%3F` encoding suggests the query string is being folded into the path segment during the redirect. Root cause investigation required during implementation — likely a Next.js 15 middleware redirect encoding issue. Fix may involve using `loginUrl.toString()` explicitly or adjusting how the redirect URL is passed.

### 2. Build-Time Dynamic Server Errors

**Issue**: Pages using Supabase server client throw `DYNAMIC_SERVER_USAGE` during static generation.

**Fix**: Add `export const dynamic = 'force-dynamic'` to dashboard pages that fetch from Supabase. This tells Next.js to skip static generation for these pages, eliminating the noisy error logs.

### 3. Environment Warning Spam

**Issue**: `logEnvValidation()` runs on every middleware invocation despite `hasLogged` guard. In serverless, each cold start resets the module state.

**Fix**: Accept this is expected in serverless (logs once per cold start). Reduce noise by downgrading optional vars to debug level or removing them from middleware, moving validation to a dedicated health endpoint.

### 4. Pipeline Trigger Route

**Issue**: `/api/pipelines/[id]/trigger` only maps `github-trends` and uses Trigger.dev SDK.

**Fix**: Replace with direct `runPipeline()` calls. Add mappings for `signal-amplifier` and `release-radar`.

## Environment Variables Required

| Variable | Purpose | Action |
|----------|---------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Pipeline engine DB writes (bypasses RLS) | Add to Vercel |
| `LLM_BASE_URL` | LLM API endpoint | Add to Vercel |
| `LLM_API_KEY` | LLM authentication | Add to Vercel |
| `LLM_MODEL` | Model to use for generation | Add to Vercel |
| `CRON_SECRET` | Secure cron endpoints | Add to Vercel |
| `GITHUB_TOKEN` | GitHub API rate limit (60 → 5000/hr) | Add to Vercel (optional) |
| `ALLOWED_EMAILS` | Auth whitelist | Add to Vercel (optional) |

## Dependency Changes

### Remove
- `@trigger.dev/sdk` from `packages/pipelines/package.json`
- `packages/pipelines/src/trigger/github-trends-task.ts`

### Add
- `vercel.json` cron configuration (or add to existing)
- 3 new cron route files in `apps/web/src/app/api/cron/`

## Files to Create/Modify

### Create
- `apps/web/src/app/api/cron/github-trends/route.ts`
- `apps/web/src/app/api/cron/signal-amplifier/route.ts`
- `apps/web/src/app/api/cron/release-radar/route.ts`
- `apps/web/vercel.json` (cron config)

### Modify
- `apps/web/src/app/api/pipelines/[id]/trigger/route.ts` — replace Trigger.dev with direct calls
- `apps/web/src/app/(dashboard)/page.tsx` — add `export const dynamic = 'force-dynamic'`
- `apps/web/src/app/(dashboard)/analytics/page.tsx` — add dynamic export
- `apps/web/src/app/(dashboard)/review/page.tsx` — add dynamic export
- `apps/web/src/app/(dashboard)/schedule/page.tsx` — add dynamic export
- `apps/web/src/app/(dashboard)/content/page.tsx` — add dynamic export
- `apps/web/src/middleware.ts` — remove `logEnvValidation()` call
- `packages/pipelines/package.json` — remove `@trigger.dev/sdk`
- `packages/pipelines/src/index.ts` — remove trigger re-exports

### Delete
- `packages/pipelines/src/trigger/github-trends-task.ts`

## Testing Plan

1. **Unit**: Existing 36 tests must still pass after changes
2. **Local E2E**: Call each cron route locally with proper auth header, verify DB writes
3. **Production**: Deploy, manually trigger via Vercel dashboard or curl, verify:
   - `pipeline_runs` has new rows
   - `content_signals` has ingested signals
   - `content_items` has generated content with `status=pending_review`
   - `pipeline_logs` has step-by-step entries
   - Dashboard shows real data (not zeros)
4. **Scheduled**: Wait for first cron fire, verify automatic execution

## Success Criteria

- All 3 pipelines can be triggered manually and produce content in Supabase
- Cron schedules fire automatically and produce content
- Dashboard shows real content counts, pipeline statuses, and activity feed
- No mock data anywhere in the dashboard
- Login flow works without 404
- Build logs are clean (no DYNAMIC_SERVER_USAGE errors)
