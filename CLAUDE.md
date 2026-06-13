# CLAUDE.md — InfluenceAI

## Project Overview

AI Influencer Content Management Dashboard. Solo-use tool for managing AI-focused content creation across LinkedIn, Instagram, YouTube, and Twitter with varying levels of automation.

## Architecture

Turborepo + pnpm monorepo deployed on **Vercel** (frontend) + **Supabase** (auth, database, realtime).

```
apps/
  web/              → Next.js 15 App Router (dashboard UI)
packages/
  core/             → Content types, pillar registry, pipeline registry
  database/         → Supabase migrations + query helpers + seed data
  integrations/     → LLM client, GitHub trending, RSS/HackerNews sources
  intelligence/     → Investigation swarm (6 domain agents) + synthesis
  creation/         → Angle generation, story arcs, voice-DNA learning, drafting
  pipelines/        → Pipeline engine (runner, dedup, relevance scoring) + tasks
  memory/           → Content memory (pgvector), trend collection/analysis, collisions
```

### Key Design Decisions
- **LiteLLM-compatible**: LLM client uses OpenAI SDK so it works with OpenAI, Azure, Anthropic (via LiteLLM proxy), or any OpenAI-compatible endpoint
- **Dark mode only**: zinc-950 background, zinc-900 cards, violet accents
- **Pillar/Pipeline registries**: Pluggable content pillar and automation pipeline definitions in `packages/core/src/`
- **Dual Supabase key support**: Accepts either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (new) or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy)

## Tech Stack

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Auth**: Supabase Auth (email/password, invite-only)
- **Database**: Supabase (PostgreSQL)
- **LLM**: OpenAI SDK pointing at configurable endpoint (OpenAI / Azure / LiteLLM)
- **Charts**: Recharts
- **Monorepo**: Turborepo + pnpm workspaces
- **Deployment**: Vercel (root directory: `apps/web`)

## Commands

```bash
pnpm install                        # Install all dependencies
pnpm dev                            # Run all apps in dev mode
pnpm build                          # Build all packages
pnpm -F @influenceai/web dev        # Run only the web app
pnpm -F @influenceai/web build      # Build only the web app

pnpm type-check                     # tsc --noEmit across the monorepo
pnpm lint                           # ESLint (next/core-web-vitals)
pnpm test                           # Vitest (package unit tests)
pnpm format                         # Prettier --write
```

CI runs `type-check → lint → test → build` on every PR (`.github/workflows/ci.yml`).

## Project Structure — Web App

```
apps/web/src/
  app/
    (auth)/login/         → Email/password login page
    (dashboard)/          → Protected dashboard pages (layout with sidebar)
      page.tsx            → Command Center (stats, charts, overview)
      content/            → Content library with filterable table
      pipelines/          → Pipeline cards + GitHub Trends detail page
      review/             → Review queue (approve/edit/reject)
      analytics/          → Charts, platform breakdown, pillar performance
      schedule/           → Week calendar view
      settings/           → Integrations, pillar toggles, general config
    api/
      content/            → Content CRUD endpoint
      pipelines/
        github-trends/    → GitHub trending repos → LLM content generation
    auth/callback/        → OAuth/magic-link callback handler
  components/
    dashboard/            → Sidebar, topbar, stats cards, activity feed
    ui/                   → shadcn/ui components (button, card, badge, etc.)
  lib/
    supabase/             → Browser and server Supabase clients
    utils.ts              → cn(), formatNumber(), color helpers
  middleware.ts           → Auth guard + email whitelist enforcement
```

## Content Pillars (7)

Defined in `packages/core/src/pillars/registry.ts`:
1. **breaking-ai-news** — First-to-report AI developments
2. **reshared-posts** — Curated community content with commentary
3. **strategy-career** — Career advice and industry strategy
4. **live-demos** — Technical demonstrations and tutorials
5. **hype-detector** — Critical analysis of AI claims
6. **inside-the-machine** — Technical deep-dives and explanations
7. **failure-lab** — Honest failure analysis and lessons learned

## Automation Pipelines (8 defined — 3 implemented)

Defined in `packages/core/src/pipelines/registry.ts`. Implementations live in
`packages/pipelines/src/tasks/`. **Three pipelines are live; the other five are
registry metadata only and surface in the UI as "Coming soon".**

Implemented (run via Vercel Cron + manual trigger):
1. **github-trends** — Monitor trending repos → generate content
2. **signal-amplifier** — Aggregate AI news signals (RSS + HackerNews)
3. **release-radar** — Track major AI model/tool releases

Coming soon (metadata only): **youtube-series**, **weekly-strategy**,
**auto-podcast**, **infographic-factory**, **digital-twin**.

## Publishing model

There is **no automated social posting** (`published_at`/`published_url` are set
manually). The review flow ends with **copy-to-clipboard + per-platform composer
deep links** (X intent prefill; clipboard + open for LinkedIn/Instagram/YouTube)
and a "Mark as published" action. Auto-publish is a post-MVP item.

## Database

~19 tables across 6 migrations in `packages/database/supabase/migrations/`:
- `00001_initial_schema.sql` — `content_signals`, `content_items`,
  `pipeline_runs`, `pipeline_logs`, `content_analytics`, `integration_configs`
- `00002_v2_schema_updates.sql` — `prompt_templates`; column additions; RLS
  (authenticated-user policies) enabled on the base tables
- `00003_investigation_swarm.sql` — `investigation_runs`, `agent_briefs`,
  `research_briefs`, `investigation_logs`
- `00004_creation_engine.sql` — `angle_cards`, `content_edits`, `voice_profiles`
- `00005_persistent_intelligence.sql` — `content_memory` (pgvector/HNSW),
  `trend_entities`, `trend_data_points`, `trend_analyses`, `collisions`
- `00006_daily_menu.sql` — `daily_menus`

> Note: `content_analytics` is not yet populated (no publishing → no engagement
> metrics). The Analytics page is built from `content_items` + `pipeline_runs`.
> Migration `00002` uses `CREATE POLICY IF NOT EXISTS`, which is not valid
> Postgres syntax — apply policies via the Supabase dashboard if a fresh
> migration run errors there.

## Auth

- **Method**: Supabase Auth with email/password (invite-only)
- **Setup**: Invite users from Supabase Dashboard → Authentication → Users → Invite User
- **Whitelist**: `ALLOWED_EMAILS` env var (comma-separated) enforced in middleware
- **Important**: Set Site URL in Supabase Auth → URL Configuration to your Vercel domain

## Environment Variables

See `.env.example` for all variables. Key ones for Vercel:

| Variable | Required | Where |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Vercel env vars |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Vercel env vars |
| `LLM_BASE_URL` | For pipelines | Vercel env vars |
| `LLM_API_KEY` | For pipelines | Vercel env vars |
| `LLM_MODEL` | For pipelines | Vercel env vars |
| `CRON_SECRET` | For cron (prod) | Vercel env vars — `/api/cron/*` fail closed without it |
| `ALLOWED_EMAILS` | Recommended | Vercel env vars |
| `GITHUB_TOKEN` | Optional | Vercel env vars |
| `ERROR_WEBHOOK_URL` | Optional | Slack/Discord webhook for cron failure alerts |
| `LITELLM_MASTER_KEY` | Local proxy only | `.env` for docker-compose LiteLLM |

`NEXT_PUBLIC_` vars are exposed to the browser — only Supabase publishable key needs this prefix.

## Vercel Deployment

- **Root Directory**: `apps/web`
- **Build Command**: `cd ../.. && pnpm -F @influenceai/web build`
- **Install Command**: (default)
- **Output Directory**: (default — Next.js auto-detected)

## Coding Conventions

- TypeScript strict mode
- Tailwind CSS v4 (uses `@theme` block, not `tailwind.config`)
- shadcn/ui components in `apps/web/src/components/ui/`
- Server components by default; `'use client'` only when needed
- Supabase server client for server components/API routes; browser client for client components
- Explicit type annotations on Supabase `cookiesToSet` parameters (TypeScript strict)
