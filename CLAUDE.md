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
  database/         → Supabase migrations
  integrations/     → LLM client, GitHub trending, social APIs
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
```

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

## Automation Pipelines (8)

Defined in `packages/core/src/pipelines/registry.ts`:
1. **github-trends** — Monitor trending repos → generate content (MVP)
2. **signal-amplifier** — Aggregate AI news signals
3. **release-radar** — Track major AI model/tool releases
4. **youtube-series** — Generate YouTube content series
5. **weekly-strategy** — Weekly strategy post generation
6. **auto-podcast** — Automated podcast content
7. **infographic-factory** — Data visualization content
8. **digital-twin** — AI persona content generation

## Database

6 tables in Supabase (migration: `packages/database/supabase/migrations/00001_initial_schema.sql`):
- `content_signals` — Raw signals from sources (GitHub, news, etc.)
- `content_items` — Generated content pieces
- `pipeline_runs` — Pipeline execution history
- `pipeline_logs` — Step-by-step execution logs
- `content_analytics` — Engagement metrics per content item
- `integration_configs` — API keys and integration settings

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
| `ALLOWED_EMAILS` | Recommended | Vercel env vars |
| `GITHUB_TOKEN` | Optional | Vercel env vars |

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
