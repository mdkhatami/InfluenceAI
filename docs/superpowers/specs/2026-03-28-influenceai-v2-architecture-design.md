# InfluenceAI v2 — Architecture Redesign & Pipeline Engine

**Date:** 2026-03-28
**Status:** Draft — pending review
**Scope:** Full system refactor: pipeline engine, database layer, dashboard rethink, signal source integrations

---

## 1. Context & Goals

InfluenceAI is a solo-use AI influencer content management system. The current v1 is ~40% complete: polished dashboard UI with mock data, a working GitHub Trends proof-of-concept, well-designed database schema (not yet wired), and pluggable pillar/pipeline registries.

### What exists (v1)
- 7 content pillars defined in `packages/core/src/pillars/registry.ts`
- 8 pipeline definitions in `packages/core/src/pipelines/registry.ts`
- Next.js 15 dashboard with all pages (Command Center, Content Library, Pipelines, Review, Schedule, Analytics, Settings) — all rendering mock data
- Supabase Auth with email/password + email whitelist
- Database schema (6 tables) in migration file, not connected to UI
- GitHub Trends API route with LLM generation (not persisted to DB)
- LLM client (OpenAI SDK, LiteLLM-compatible)

### What this redesign achieves
1. **Reliable pipeline execution** — Trigger.dev orchestrates all pipelines with retries, logging, and step-level visibility
2. **Easy to extend** — Adding a new pipeline = 1 config + 2-3 functions. The engine handles everything else.
3. **Real data throughout** — Every dashboard page wired to Supabase. No mock data.
4. **6 signal sources** — GitHub, RSS, HackerNews, ArXiv, Reddit, Hugging Face
5. **3 output formats** — LinkedIn posts, Twitter threads, Instagram carousel outlines
6. **Editable prompts** — Prompt templates stored in DB, editable from Settings
7. **Human review gate** — All generated content goes through dashboard review before publishing

### Explicit non-goals (for now)
- Automated publishing to social platforms (manual copy-paste is acceptable)
- Multimedia generation (audio, video, images)
- Telegram bot for mobile review
- Multi-user / team features
- Twitter/X API integration (cost prohibitive at $100/mo)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INFLUENCEAI SYSTEM                           │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐  │
│  │  apps/web    │    │ packages/pipelines│    │    Trigger.dev    │  │
│  │             │    │                  │    │   (Orchestration)  │  │
│  │  Dashboard  │◄──►│  Pipeline Engine  │◄──►│  Scheduled Tasks  │  │
│  │  API Routes │    │  Step Definitions │    │  Retries, Logging │  │
│  │  Review UI  │    │  Engine Config    │    │  Run History      │  │
│  └──────┬──────┘    └────────┬─────────┘    └───────────────────┘  │
│         │                    │                                      │
│         ▼                    ▼                                      │
│  ┌─────────────┐    ┌──────────────────┐                           │
│  │  Supabase   │    │ packages/         │                           │
│  │             │    │  integrations     │                           │
│  │  Auth       │    │                  │                           │
│  │  Database   │    │  Signal Adapters  │ ← GitHub, RSS, HN,      │
│  │  Realtime   │    │  LLM Client      │   ArXiv, Reddit, HF     │
│  │             │    │  (OpenAI SDK)     │                           │
│  └─────────────┘    └──────────────────┘                           │
│                                                                     │
│  ┌─────────────┐    ┌──────────────────┐                           │
│  │ packages/   │    │ packages/        │                           │
│  │  core       │    │  database        │                           │
│  │             │    │                  │                           │
│  │  Types      │    │  Migrations      │                           │
│  │  Pillars    │    │  Client Helpers   │                           │
│  │  Registries │    │  RLS Policies     │                           │
│  └─────────────┘    └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Data flow for a pipeline run

```
Trigger.dev cron fires on schedule
  → Pipeline Engine loads PipelineDefinition config
  → Step 1: INGEST — Signal adapter fetches raw data from source
  → Step 2: FILTER — Score, rank, deduplicate signals
  → Step 3: GENERATE — LLM produces content per platform (LinkedIn, Twitter, Instagram)
  → [Step 3.5: CUSTOM — optional step for multimedia pipelines (future)]
  → Step 4: SAVE — Write to Supabase (content_signals, content_items, pipeline_runs, pipeline_logs)
  → Step 5: NOTIFY — Set content status to "pending_review"
  → Human reviews in dashboard → approve / edit / reject
  → PUBLISH — Manual for now (copy content to platform)
```

### Technology decisions

| Concern | Choice | Rationale |
|---|---|---|
| Pipeline orchestration | Trigger.dev (free tier) | Durable execution, retries, step visibility, 10 schedules free |
| Database + auth | Supabase (existing) | Already deployed, PostgreSQL, auth working |
| LLM | OpenAI SDK via LiteLLM-compatible endpoint | Supports OpenAI, Azure, Anthropic. Model-per-step config. |
| Frontend | Next.js 15 App Router (existing) | Already built, server components, Vercel deployment |
| Monorepo | Turborepo + pnpm (existing) | Add `packages/pipelines` to existing structure |
| Content formats | LinkedIn + Twitter + Instagram carousel outlines | Text-only for now, multimedia later |
| Review workflow | Dashboard-only (Telegram bot later) | Simplest to build, sufficient for solo use |

---

## 3. Monorepo Structure (After Refactor)

```
apps/
  web/                          → Next.js 15 dashboard + API routes
    src/
      app/
        (auth)/login/           → Email/password login
        (dashboard)/            → Protected dashboard pages
          page.tsx              → Command Center
          content/              → Content Library
          pipelines/            → Pipeline management + run history
          review/               → Review queue
          analytics/            → Performance analytics
          schedule/             → Content calendar
          settings/             → System configuration
        api/
          pipelines/
            [id]/trigger/       → Manual pipeline trigger endpoint
            [id]/runs/          → Pipeline run history endpoint
          content/              → Content CRUD
          signals/              → Signal browsing
          settings/             → Integration configs, pillar toggles
          prompt-templates/     → Prompt template CRUD
      components/
        dashboard/              → Layout, sidebar, topbar
        ui/                     → shadcn/ui components
      lib/
        supabase/               → Browser and server clients
        queries/                → Typed Supabase query functions

packages/
  core/                         → Types and registries
    src/
      types/
        content.ts              → ContentItem, ContentStatus, Platform, ContentFormat
        signal.ts               → Signal, SignalSource, ScoredSignal
        pipeline.ts             → PipelineDefinition, PipelineRun, PipelineStep, StepResult
        pillar.ts               → Pillar, PillarConfig
      pillars/
        registry.ts             → 7 pillar definitions (metadata only, prompts move to DB)
      pipelines/
        registry.ts             → 8 pipeline definition configs

  database/                     → Supabase schema and helpers
    supabase/
      migrations/
        00001_initial_schema.sql      → Existing base tables
        00002_v2_schema_updates.sql   → New tables + column additions
    src/
      client.ts                 → Shared Supabase client factory
      queries/                  → Typed query functions per table
        content-items.ts
        content-signals.ts
        pipeline-runs.ts
        pipeline-logs.ts
        prompt-templates.ts
        integration-configs.ts

  integrations/                 → External service adapters
    src/
      sources/
        github.ts               → GitHub trending repos fetcher
        rss.ts                  → RSS feed parser (AI company blogs)
        hackernews.ts           → HN top stories by score
        arxiv.ts                → ArXiv recent papers (cs.AI, cs.LG)
        reddit.ts               → Reddit AI subreddits
        huggingface.ts          → HF trending models/papers/spaces
        types.ts                → Shared Signal interface all adapters return
      llm/
        client.ts               → OpenAI SDK wrapper (model-per-step)
        prompts.ts              → Prompt builder (merges pillar template + signal data)

  pipelines/                    → NEW: Pipeline engine + Trigger.dev tasks
    src/
      engine/
        runner.ts               → Core runPipeline() function
        steps.ts                → Step executor with retry + logging
        dedup.ts                → Signal deduplication via content_signals
      tasks/
        register.ts             → Auto-registers all pipeline definitions as Trigger.dev tasks
        github-trends.ts        → Task config: ingest=github, filter=starVelocity
        signal-amplifier.ts     → Task config: ingest=reddit+hn, filter=engagementScore
        release-radar.ts        → Task config: ingest=rss, filter=recency+relevance
        arxiv-digest.ts         → Task config: ingest=arxiv, filter=citationScore
        weekly-strategy.ts      → Task config: ingest=hn+reddit+rss, filter=strategyRelevance
        huggingface-trends.ts   → Task config: ingest=huggingface, filter=trendingScore
        youtube-series.ts       → Task config: ingest=github+arxiv, filter=demoability
        infographic-factory.ts  → Task config: ingest=arxiv+hn, filter=dataRichness
      custom-steps/             → Future: voice synthesis, avatar gen, visual gen
      trigger.config.ts         → Trigger.dev project configuration
```

---

## 4. Pipeline Engine Design

### 4.1 PipelineDefinition contract

Every pipeline is a configuration object. The engine reads these to create Trigger.dev tasks.

```typescript
interface PipelineDefinition {
  id: string                           // unique slug: 'github-trends'
  name: string                         // display name: 'GitHub Trends Daily'
  description: string                  // human-readable purpose
  schedule: string                     // cron expression: '0 8 * * *'
  enabled: boolean                     // toggle on/off from dashboard
  pillar: PillarId                     // which content pillar this feeds
  platforms: Platform[]                // ['linkedin', 'twitter', 'instagram']

  // Pipeline-specific functions:
  ingest: IngestFn                     // () → Signal[]
  filter: FilterFn                     // (signals: Signal[]) → ScoredSignal[]

  // LLM generation config:
  generate: {
    model: string                      // 'gpt-4o' or 'claude-sonnet-4-6' via LiteLLM
    filterModel?: string               // optional cheaper model for filtering step
    maxTokens: number                  // per-generation call
    temperature: number
    topK: number                       // how many top signals to generate content for
  }

  // Optional custom steps for multimedia pipelines:
  customSteps?: CustomStep[]
}

// IngestConfig is adapter-specific: e.g., { language: 'en', since: 'daily' } for GitHub,
// { feedUrls: string[] } for RSS, { minScore: 100 } for HackerNews.
// Each adapter defines its own config shape.
interface IngestFn {
  (config: Record<string, unknown>): Promise<Signal[]>
}

// FilterConfig includes shared options like { topK: 5 } plus adapter-specific scoring params.
interface FilterFn {
  (signals: Signal[], config: Record<string, unknown>): Promise<ScoredSignal[]>
}

// ScoredSignal extends Signal with a numeric score and optional reason string.
interface ScoredSignal extends Signal {
  score: number
  scoreReason?: string
}

interface CustomStep {
  name: string
  after: 'ingest' | 'filter' | 'generate'  // insertion point
  // StepInput/StepOutput are generic containers: { signals, content, metadata }
  // Custom steps receive the output of the previous step and return enriched data.
  execute: (data: { signals?: Signal[], content?: ContentItem[], metadata: Record<string, unknown> }) => Promise<{ signals?: Signal[], content?: ContentItem[], metadata: Record<string, unknown> }>
  retries?: number
}
```

### 4.2 Engine runner

The engine executes pipelines through a standard step sequence. Each step is a Trigger.dev step (retryable, logged, observable).

```typescript
async function runPipeline(definition: PipelineDefinition): Promise<PipelineRunResult> {
  // 1. Create pipeline_run record in Supabase (status: 'running')

  // 2. INGEST step
  //    - Call definition.ingest()
  //    - Save raw signals to content_signals table
  //    - Log step to pipeline_logs

  // 3. FILTER step
  //    - Call definition.filter(signals)
  //    - Deduplicate against previously seen signals (dedup_hash)
  //    - Take top K signals based on score
  //    - Log step

  // 4. GENERATE step (per signal, per platform)
  //    - Load prompt template from DB (fall back to pillar registry default)
  //    - For each top signal × each platform:
  //      - Build prompt: template + signal data + platform format instructions
  //      - Call LLM client with generation config
  //      - Save content_item (status: 'pending_review', platform, pillar, pipeline_run_id)
  //    - Log step with token usage

  // 5. Run any custom steps (if defined)

  // 6. FINALIZE
  //    - Update pipeline_run: status='completed', counts, duration
  //    - All content items are now visible in the review queue

  // On any step failure:
  //    - Trigger.dev retries the step (configurable per step)
  //    - If all retries exhausted: mark pipeline_run as 'failed', log error
  //    - Previously completed steps are NOT re-run (durable)
}
```

### 4.3 What the engine handles automatically

| Concern | Implementation |
|---|---|
| Task registration | `register.ts` iterates pipeline definitions → creates Trigger.dev scheduled tasks |
| Step retries | Each Trigger.dev step has configurable retry count (default: 2) |
| Logging | Every step writes to `pipeline_logs` with timing, status, error details |
| Run tracking | `pipeline_runs` record created at start, updated at end with counts and duration |
| Signal dedup | SHA-256 hash of `source_type + source_id + title` stored in `content_signals.dedup_hash` |
| Multi-format gen | Engine loops over `platforms[]` array, generates content per platform using platform-specific prompt template |
| Error isolation | Each step is independent. Ingest failure doesn't block a retry. Generate failure for one signal doesn't block others. |
| Model-per-step | Filter step uses `generate.filterModel` (cheap), generation uses `generate.model` (powerful) |

### 4.4 Adding a new pipeline (checklist)

1. **Write an ingest function** in `packages/integrations/src/sources/` — returns `Signal[]`
2. **Write a filter function** (or reuse existing scorer) — returns `ScoredSignal[]`
3. **Add prompt templates** to `prompt_templates` table (or use pillar defaults)
4. **Create a task config file** in `packages/pipelines/src/tasks/` — a `PipelineDefinition` object
5. **Register in pipeline registry** in `packages/core/src/pipelines/registry.ts`
6. Deploy — Trigger.dev picks up the new scheduled task automatically

### 4.5 Adding a custom step (for future multimedia pipelines)

```typescript
// Example: voice synthesis step for Auto-Podcast pipeline
const voiceSynthesisStep: CustomStep = {
  name: 'voice-synthesis',
  after: 'generate',
  retries: 1,
  execute: async (data) => {
    // data.content contains the generated podcast script
    const audioUrl = await elevenLabsClient.synthesize(data.content.text)
    return { ...data, audioUrl }
  }
}

// In pipeline definition:
const autoPodcastPipeline: PipelineDefinition = {
  // ... standard config ...
  customSteps: [voiceSynthesisStep]
}
```

---

## 5. Database Schema (v2)

### 5.1 Modified existing tables

**`content_signals`** — add columns:
- `source_type` — enum: `github | rss | hackernews | arxiv | reddit | huggingface`
- `dedup_hash` — text, unique index. SHA-256 of `source_type + source_id + title`. Prevents processing same signal twice.
- `raw_data` — JSONB. Source-specific metadata (star count, upvotes, author, etc.)
- `scored_relevance` — float. Score assigned by filter step.

**`content_items`** — add columns:
- `platform` — enum: `linkedin | twitter | instagram`
- `pipeline_run_id` — FK to `pipeline_runs.id`
- `signal_id` — FK to `content_signals.id` (which signal produced this content)
- `prompt_template_id` — FK to `prompt_templates.id` (which template was used)
- `generation_model` — text. Which LLM model generated this content.
- `token_usage` — JSONB. `{ promptTokens, completionTokens, totalTokens }`

Design: one row per platform output. A single signal can produce 3 `content_items` (one per platform).

**`pipeline_runs`** — add columns:
- `trigger_task_id` — text. Trigger.dev run ID for deep-linking.
- `signals_ingested` — integer. Raw signal count before filtering.
- `signals_filtered` — integer. Signals that passed filter.
- `items_generated` — integer. Content items created.
- `pipeline_id` — text. Which pipeline definition ran.

**`integration_configs`** — add column:
- `config_type` — enum: `api_key | pillar_toggle | source_config | general`

### 5.2 New tables

**`pipeline_schedules`**

This table is the **dashboard's view** of pipeline schedules. Trigger.dev is the actual scheduler. When a user edits a schedule in the Settings page, the API route updates both this table and the Trigger.dev schedule via API. The `last_run_at` and `next_run_at` fields are updated after each pipeline run completes.

```sql
CREATE TABLE pipeline_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id TEXT NOT NULL UNIQUE,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`prompt_templates`**
```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id TEXT NOT NULL,
  platform TEXT NOT NULL,               -- 'linkedin' | 'twitter' | 'instagram'
  template_type TEXT NOT NULL DEFAULT 'generation',  -- 'generation' | 'filter' | 'summary'
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,    -- contains {{signal_title}}, {{signal_summary}}, etc.
  model_override TEXT,                   -- optional per-template model override
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pillar_id, platform, template_type, version)
);
```

### 5.3 RLS Policies

All tables: require `auth.uid() IS NOT NULL`. Solo-use, so any authenticated user has full access. No role-based restrictions needed now.

```sql
-- Applied to all tables:
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access"
  ON <table> FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

---

## 6. Signal Source Adapters

Each adapter implements a common interface and lives in `packages/integrations/src/sources/`.

```typescript
interface SignalAdapter {
  source: SignalSource                    // enum value
  fetch(config?: AdapterConfig): Promise<Signal[]>
}

interface Signal {
  sourceType: SignalSource
  sourceId: string                        // unique ID from source (repo name, article URL, etc.)
  title: string
  summary: string
  url: string
  metadata: Record<string, unknown>       // source-specific data
  fetchedAt: Date
}
```

### Adapter specifications

| Adapter | Source | Auth | Rate limit | Returns |
|---|---|---|---|---|
| **GitHub Trending** | Gitterapp API + HTML scrape fallback | Token (optional, higher limits) | 60 req/hr unauthenticated, 5000 with token | Top trending repos with stars, language, description |
| **RSS Feeds** | Configurable feed URLs (OpenAI blog, Anthropic blog, DeepMind blog, etc.) | None | N/A | Latest articles with title, summary, publish date |
| **HackerNews** | `https://hacker-news.firebaseio.com/v0/` | None | No limit | Top/best stories filtered by score > 100, AI-related keywords |
| **ArXiv** | `http://export.arxiv.org/api/query` | None | 1 req/3 sec | Recent cs.AI + cs.LG papers with title, abstract, authors |
| **Reddit** | `https://www.reddit.com/r/{sub}/hot.json` | None (public JSON) | Respect rate headers | Hot posts from r/MachineLearning, r/artificial, r/LocalLLaMA |
| **Hugging Face** | `https://huggingface.co/api/trending` | None | Reasonable | Trending models, papers, spaces with metadata |

### RSS feed list (default, configurable from Settings)

```
https://openai.com/blog/rss.xml
https://www.anthropic.com/news/rss.xml
https://blog.google/technology/ai/rss/
https://ai.meta.com/blog/rss/
https://mistral.ai/feed.xml
```

---

## 7. LLM Integration

### 7.1 Client architecture

Keep existing `LLMClient` class (OpenAI SDK wrapper). Add model-per-step support:

```typescript
class LLMClient {
  // Existing: single model from env
  static fromEnv(): LLMClient

  // New: create with specific model override
  static withModel(model: string): LLMClient

  // Existing methods
  generate(systemPrompt: string, userPrompt: string, options?: GenerateOptions): Promise<GenerateResult>
  generateJSON<T>(systemPrompt: string, userPrompt: string, schema: ZodSchema<T>): Promise<T>
}

interface GenerateOptions {
  model?: string          // override instance default
  maxTokens?: number
  temperature?: number
}

interface GenerateResult {
  content: string
  model: string
  usage: { promptTokens: number, completionTokens: number, totalTokens: number }
}
```

### 7.2 Prompt building

The prompt builder merges a template (from DB or pillar default) with signal data:

```typescript
function buildPrompt(template: PromptTemplate, signal: Signal, platform: Platform): {
  systemPrompt: string
  userPrompt: string
} {
  // Replace template variables:
  // {{signal_title}} → signal.title
  // {{signal_summary}} → signal.summary
  // {{signal_url}} → signal.url
  // {{signal_metadata}} → JSON.stringify(signal.metadata)
  // {{platform}} → platform name
  // {{platform_format}} → platform-specific format instructions
  // {{pillar_voice}} → pillar's core emotion and style guide
}
```

### 7.3 Platform format instructions

Built-in format guides per platform (not in DB, these are structural):

- **LinkedIn:** Hook line (bold claim, no "I'm excited to share"). 3-5 numbered insights. End with polarizing question. 1200-1500 chars.
- **Twitter:** Thread format. Tweet 1 = hook (280 chars max). 3-5 follow-up tweets with insights. Last tweet = CTA. Each tweet standalone-readable.
- **Instagram carousel:** Slide-by-slide outline. Slide 1 = bold visual claim + number. Slides 2-7 = one insight each, 1 sentence. Slide 8 = hot take. Slide 9 = CTA. Text only (human/tool creates visuals).

---

## 8. Dashboard Pages — Detailed Specifications

### 8.1 Command Center (Home)

**Purpose:** "What happened since I last checked?"

**Components:**
- **Pipeline health strip** — Row of 8 compact cards. Each shows: pipeline name, last run time (relative), status icon (green check / red X / yellow spinner), items generated in last run. Click → navigates to pipeline detail page.
- **Pending review badge** — Large count of items with status `pending_review`. Primary CTA linking to /review.
- **Today's content feed** — List of content_items created today, grouped by pipeline. Each shows: truncated content text (first 100 chars), pillar badge, platform icon, status badge.
- **Signal feed** — 20 most recent signals from `content_signals`, newest first. Shows source icon, title, score, which pipeline processed it (or "unprocessed" if no pipeline has claimed it).
- **Weekly summary stats** — Cards showing: generated (this week), approved, rejected, approval rate %. Comparison arrows vs last week.

**Data sources:** `pipeline_runs` (last run per pipeline), `content_items` (today, pending count), `content_signals` (recent), aggregation queries for weekly stats.

### 8.2 Content Library

**Purpose:** "What content do I have, and what state is it in?"

**Components:**
- **Filter bar** — Dropdowns for: status (all/draft/pending_review/approved/rejected/published), pillar (all + 7 options), platform (all/linkedin/twitter/instagram), date range picker, pipeline source.
- **Content table** — Columns: content preview (first 80 chars), pillar badge, platform icon, status badge, source signal title, created date, actions.
- **Expand row** — Click to expand: full content text, source signal details, prompt template used, model used, token usage.
- **Inline edit** — Click content text to edit directly. Save updates the content_item.
- **Bulk actions** — Select multiple rows → Approve all, Reject all, Delete.

**Data source:** `content_items` joined with `content_signals` and `prompt_templates`.

### 8.3 Pipelines

**Purpose:** "Are my pipelines healthy and producing good content?"

**Components:**
- **Pipeline grid** — 8 cards (existing layout). Updated to show real data: last run status, next scheduled run, total runs, success rate percentage, avg items per run.
- **Pipeline detail page** (click into a pipeline):
  - **Run history table** — Last 20 runs. Columns: started, duration, status, signals ingested, signals filtered, items generated. Click to expand step-level logs from `pipeline_logs`.
  - **Manual trigger button** — POST to `/api/pipelines/[id]/trigger`. This API route calls `trigger.dev/sdk` to invoke the pipeline's Trigger.dev task on-demand (outside its normal cron schedule). Useful for testing and breaking news.
  - **Configuration panel** — Shows and allows editing: schedule (cron), enabled toggle, target platforms, signal source config, LLM model.

**Data sources:** `pipeline_runs`, `pipeline_logs`, `pipeline_schedules`.

### 8.4 Review Queue

**Purpose:** "What needs my approval right now?"

**Components:**
- **Tabs:** Pending (count badge) | Approved | Rejected
- **Review card** per item:
  - Full content text (formatted for readability)
  - Source signal context box (title, summary, URL — what triggered this content)
  - Metadata row: pillar badge, platform icon, pipeline name, model used, generated timestamp
  - Action buttons: Approve, Edit + Approve, Reject (with optional reason), Regenerate (re-runs LLM on same signal with same or different template)
- **Keyboard shortcuts** — j/k navigate between items, a = approve, e = edit, r = reject
- **Empty state** — "All caught up" message when no pending items

**Data source:** `content_items` filtered by status, joined with `content_signals`.

### 8.5 Schedule

**Purpose:** "What's going out when?"

**Components:**
- **Week calendar view** — 7 columns (days), rows divided into time slots (morning, midday, evening).
- **Platform swim lanes** — Within each day, content grouped by platform (LinkedIn / Twitter / Instagram) with platform-colored indicators.
- **Content cards** — Approved content placed in time slots. Shows: truncated text, pillar badge, platform icon.
- **Drag to reschedule** — Move cards between time slots (updates `scheduled_at` in content_items).
- **Auto-suggest** — When approving content, suggest optimal time based on platform best practices: LinkedIn 8-10 AM weekdays, Twitter distributed through day, Instagram 11 AM-1 PM and 7-9 PM.

**Data source:** `content_items` where status = `approved` or `scheduled`, ordered by `scheduled_at`.

### 8.6 Analytics

**Purpose:** "What's working and what isn't?"

**Components:**
- **Pipeline efficiency** — Per-pipeline bar chart: signals ingested vs. content approved ratio. Answers "which pipelines produce content I actually use?"
- **Pillar breakdown** — Pie chart: content volume per pillar. Are some pillars overrepresented?
- **Prompt template effectiveness** — Table: template name, times used, approval rate, rejection rate. Answers "which prompts produce content I like?"
- **Source quality** — Per-source (GitHub/RSS/HN/ArXiv/Reddit/HF) metrics: signals fetched, content generated from source, approval rate. Answers "which sources give the best raw material?"
- **Volume trends** — Line chart over 30 days: generated, approved, rejected, published. Trend direction indicators.
- **Model usage** — Token consumption per model, cost estimate (user configures $/token in settings).

**Data source:** Aggregation queries on `content_items`, `pipeline_runs`, `content_signals`, `prompt_templates`.

Note: engagement metrics from social platforms (likes, comments, shares) are deferred until publishing integration is built. The `content_analytics` table exists for this but remains empty for now.

### 8.7 Settings

**Purpose:** "How do I configure the system?"

**Sections:**

**Integrations:**
- Card per service: LLM endpoint, GitHub, Supabase (read-only, show connection status).
- Each card: name, status indicator (connected/error/not configured), configure button.
- Configure opens a form to set API key / URL / token. Saved to `integration_configs` (encrypted in production via Supabase Vault).

**Pillar Configuration:**
- Toggle switches for each of the 7 pillars (enable/disable). Saved to `integration_configs` with `config_type = pillar_toggle`.
- Disabling a pillar prevents pipelines that feed it from generating content.

**Prompt Template Editor:**
- Select pillar → select platform → see current template (system prompt + user prompt template).
- Live preview: render the template with a sample signal to see what the LLM would receive.
- Edit and save → creates new version in `prompt_templates` (old version kept, `is_active` set to false).
- Reset to default → restores the pillar registry's built-in template.

**Pipeline Schedules:**
- Table of all 8 pipelines with: name, cron expression (editable), enabled toggle, last run, next run.
- Cron expression helper: dropdown presets (daily 8 AM, twice daily, weekly Monday, etc.) + manual cron input.

**Signal Source Configuration:**
- RSS feeds: add/remove feed URLs.
- Reddit: configure which subreddits to monitor.
- ArXiv: configure which categories (cs.AI, cs.LG, cs.CL, etc.).
- HackerNews: minimum score threshold.
- GitHub: language filter, minimum stars.

---

## 9. Content Lifecycle

A piece of content moves through these states:

```
Signal ingested (content_signals)
  → Pipeline filters signal (scored, ranked)
  → LLM generates content (content_items, status: 'pending_review')
  → Human reviews in dashboard
      → APPROVE → status: 'approved' → appears in Schedule
      → EDIT + APPROVE → content updated, status: 'approved'
      → REJECT → status: 'rejected' (with optional reason)
      → REGENERATE → new LLM call, new content_item created, old one marked 'replaced'
  → Approved content scheduled (status: 'scheduled', scheduled_at set)
  → Human publishes manually (status: 'published', published_at set)
```

### Status enum

```typescript
type ContentStatus =
  | 'pending_review'   // generated, waiting for human review
  | 'approved'         // reviewed and approved, ready to schedule
  | 'scheduled'        // assigned a publish time
  | 'published'        // manually published to platform
  | 'rejected'         // reviewed and rejected
  | 'replaced'         // superseded by a regenerated version
```

---

## 10. Phased Implementation Plan (High Level)

### Phase 1: Foundation Refactor
- Restructure monorepo (add `packages/pipelines`, reorganize `packages/integrations`)
- Update database schema (migration 00002)
- Add RLS policies
- Set up `packages/database` client helpers and typed query functions
- Set up Trigger.dev project and configuration

### Phase 2: Pipeline Engine
- Build the core engine (`runPipeline`, step executor, logging, dedup)
- Implement the `PipelineDefinition` contract and type system
- Wire engine to Supabase (save signals, content items, run logs)
- Build the first pipeline end-to-end: GitHub Trends (already partially built)
- Verify: trigger manually → ingests signals → filters → generates 3-format content → saves to DB → visible in review

### Phase 3: Signal Source Adapters
- Implement remaining 5 adapters: RSS, HackerNews, ArXiv, Reddit, Hugging Face
- Build remaining pipeline task configs (each one wires adapter + filter + pillar)
- Set up Trigger.dev schedules for all enabled pipelines

### Phase 4: Dashboard Wiring
- Replace all mock data with Supabase queries
- Implement each page per the specifications in Section 8
- Build API routes for: content CRUD, pipeline management, settings, prompt templates
- Add keyboard shortcuts to review queue

### Phase 5: Settings & Configuration
- Build prompt template editor with live preview
- Build integration config management
- Build pipeline schedule management
- Build signal source configuration

### Phase 6: Polish & Reliability
- Error boundaries on all pages
- Loading and empty states
- Rate limiting on external API calls
- Environment validation at startup
- Supabase Vault for secret encryption in production

---

## 11. Future Phases (Out of Scope for v2)

These are documented for future reference but explicitly not part of this implementation:

- **Automated publishing** — Buffer API or native LinkedIn/Twitter/Instagram APIs
- **Telegram bot** — Mobile review notifications with inline approve/reject
- **Multimedia generation** — ElevenLabs (voice), HeyGen (avatar), Canva (carousels), DALL-E (images)
- **Engagement analytics** — Pull metrics from published content via platform APIs
- **Twitter/X signal source** — API cost ($100/mo) makes this a later addition
- **Multi-user** — Role-based access, team review workflows
- **A/B testing** — Compare prompt templates by measuring approval rates over time
