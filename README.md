# InfluenceAI

AI influencer **content command center** — an autonomous research-and-drafting
system for AI-focused content across LinkedIn, Instagram, YouTube, and X.

It ingests signals (GitHub Trending, RSS, HackerNews), runs a **6-agent
investigation swarm** to research them, learns your **voice DNA** from your edits,
drafts platform-ready posts, and surfaces a prioritized **daily menu** for review.
You approve and publish manually (copy / composer deep-links) — auto-publishing is
on the roadmap.

## Stack

Turborepo + pnpm · Next.js 15 (App Router) / React 19 · Tailwind v4 · Supabase
(Postgres + Auth + pgvector) · OpenAI-SDK LLM client (LiteLLM-compatible) ·
Recharts · Vercel.

## Monorepo layout

```
apps/web            Next.js dashboard
packages/core       Content types, pillar + pipeline registries
packages/database   Supabase migrations, query helpers, seeds
packages/integrations  LLM client, GitHub trending, RSS/HackerNews
packages/intelligence  Investigation swarm (6 domain agents) + synthesis
packages/creation   Angle generation, story arcs, voice-DNA, drafting
packages/pipelines  Pipeline engine (runner, dedup, relevance) + tasks
packages/memory     Content memory (pgvector), trends, collisions
```

## Quick start

```bash
pnpm install
cp .env.example .env.local        # fill in Supabase + LLM values
pnpm -F @influenceai/web dev      # http://localhost:3000
```

Apply the migrations in `packages/database/supabase/migrations/` to your Supabase
project, then invite yourself via Supabase Auth and add your email to
`ALLOWED_EMAILS`.

### Optional: local LiteLLM proxy

```bash
# set LITELLM_MASTER_KEY and ANTHROPIC_API_KEY in your .env first
docker compose up litellm        # exposes an OpenAI-compatible API on :4000
# then point LLM_BASE_URL=http://localhost:4000 and LLM_API_KEY=$LITELLM_MASTER_KEY
```

## Scripts

```bash
pnpm dev | build                 # all packages
pnpm type-check | lint | test    # CI runs these + build on every PR
pnpm format                      # Prettier
```

## Status

3 of 8 pipelines are live (github-trends, signal-amplifier, release-radar); the
rest show as "Coming soon". See [`docs/REVIEW_AND_ROADMAP.md`](docs/REVIEW_AND_ROADMAP.md)
for the full assessment and the prioritized roadmap. Project guide and conventions
are in [`CLAUDE.md`](CLAUDE.md).

## Deployment

Vercel with **Root Directory** `apps/web` and build command
`cd ../.. && pnpm -F @influenceai/web build`. Cron schedules are in
`apps/web/vercel.json`; set `CRON_SECRET` (the `/api/cron/*` routes reject requests
without it).
