# Foundation + Pipeline Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation (types, DB, packages) and a working pipeline engine that can ingest signals, filter, generate content via LLM, save to Supabase, and surface in a review queue — proven end-to-end with the GitHub Trends pipeline.

**Architecture:** Trigger.dev orchestrates pipeline execution as scheduled tasks. Each pipeline is a config object + ingest/filter functions. A shared engine handles the run lifecycle (logging, dedup, multi-format generation, DB persistence). Supabase stores all data. The Next.js app provides API routes for manual triggers.

**Tech Stack:** TypeScript, Trigger.dev v3, Supabase (PostgreSQL), OpenAI SDK (LiteLLM-compatible), Vitest, pnpm monorepo with Turborepo.

**Scope:** Phases 1-2 of the v2 spec. Phases 3-6 (remaining adapters, dashboard wiring, settings, polish) will be separate plans.

**Reference:** `docs/superpowers/specs/2026-03-28-influenceai-v2-architecture-design.md`

---

## File Map

### New files

```
vitest.config.ts                                    → Root vitest config for monorepo
packages/core/src/types/signal.ts                   → Signal, SignalSource, ScoredSignal
packages/core/src/types/engine.ts                   → PipelineDefinition, RunResult, step types
packages/database/src/client.ts                     → Supabase client factory (server-side, for packages)
packages/database/src/queries/content-signals.ts    → Insert/query/dedup signals
packages/database/src/queries/content-items.ts      → Insert/query/update content items
packages/database/src/queries/pipeline-runs.ts      → Create/update pipeline runs + logs
packages/database/src/queries/prompt-templates.ts   → Fetch active templates
packages/database/src/index.ts                      → Package exports
packages/database/package.json                      → Add @supabase/supabase-js dependency
packages/database/tsconfig.json                     → TypeScript config
packages/database/supabase/migrations/00002_v2_schema_updates.sql → Schema changes
packages/integrations/src/sources/types.ts          → SignalAdapter interface
packages/integrations/src/sources/github.ts         → Refactored GitHub adapter
packages/integrations/src/llm/prompts.ts            → Prompt builder
packages/pipelines/package.json                     → New package
packages/pipelines/tsconfig.json                    → TypeScript config
packages/pipelines/src/index.ts                     → Package exports
packages/pipelines/src/engine/runner.ts             → Core runPipeline()
packages/pipelines/src/engine/dedup.ts              → Signal deduplication
packages/pipelines/src/tasks/github-trends.ts       → Trigger.dev task
packages/pipelines/src/trigger.config.ts            → Trigger.dev config
apps/web/src/app/api/pipelines/[id]/trigger/route.ts → Manual trigger endpoint
```

### Modified files

```
packages/core/src/content/types.ts                  → Add new status values, quality_score, etc.
packages/core/src/pipelines/types.ts                → Add PipelineRunStatus
packages/core/src/index.ts                          → Export new types
packages/core/package.json                          → Add vitest dev dep
packages/integrations/src/llm/client.ts             → Add withModel(), quality scoring
packages/integrations/src/index.ts                  → Export new sources
packages/integrations/package.json                  → Add vitest dev dep
apps/web/package.json                               → Add @influenceai/pipelines dep
turbo.json                                          → Add test task
package.json (root)                                 → Add test script, vitest
pnpm-workspace.yaml                                 → No change needed (packages/* already covered)
```

---

## Task 1: Set up Vitest for monorepo testing

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (root)
- Modify: `turbo.json`

- [ ] **Step 1: Install vitest at root**

```bash
pnpm add -Dw vitest
```

- [ ] **Step 2: Create root vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add test scripts to root package.json**

Add to `scripts` in root `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Add test task to turbo.json**

Add to `tasks` in `turbo.json`:

```json
"test": {
  "dependsOn": ["^build"],
  "cache": false
}
```

- [ ] **Step 5: Verify vitest runs (no tests yet)**

```bash
pnpm test
```

Expected: vitest runs, finds 0 test files, exits cleanly.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json turbo.json pnpm-lock.yaml
git commit -m "chore: set up vitest for monorepo testing"
```

---

## Task 2: Update core types for v2

**Files:**
- Create: `packages/core/src/types/signal.ts`
- Create: `packages/core/src/types/engine.ts`
- Modify: `packages/core/src/content/types.ts`
- Modify: `packages/core/src/pipelines/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create Signal types**

Create `packages/core/src/types/signal.ts`:

```typescript
export type SignalSource = 'github' | 'rss' | 'hackernews' | 'arxiv' | 'reddit' | 'huggingface';

export interface Signal {
  sourceType: SignalSource;
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  metadata: Record<string, unknown>;
  fetchedAt: Date;
}

export interface ScoredSignal extends Signal {
  score: number;
  scoreReason?: string;
}
```

- [ ] **Step 2: Create engine types**

Create `packages/core/src/types/engine.ts`:

```typescript
import type { Signal, ScoredSignal, SignalSource } from './signal';
import type { Platform } from '../content/types';

export type PipelineRunStatus = 'running' | 'completed' | 'partial_success' | 'failed';

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  pillar: string;
  platforms: Platform[];
  ingest: (config: Record<string, unknown>) => Promise<Signal[]>;
  filter: (signals: Signal[], config: Record<string, unknown>) => Promise<ScoredSignal[]>;
  generate: {
    model: string;
    filterModel?: string;
    maxTokens: number;
    temperature: number;
    topK: number;
  };
}

export interface PipelineRunResult {
  runId: string;
  pipelineId: string;
  status: PipelineRunStatus;
  signalsIngested: number;
  signalsFiltered: number;
  itemsGenerated: number;
  errors: string[];
  durationMs: number;
}

export interface StepResult {
  stepName: string;
  status: 'success' | 'failed';
  durationMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedContent {
  text: string;
  qualityScore: number;
  platform: Platform;
  model: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

- [ ] **Step 3: Update ContentStatus in content/types.ts**

In `packages/core/src/content/types.ts`, replace the `ContentStatus` type:

```typescript
export type ContentStatus =
  | 'pending_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'replaced';
```

And add these fields to the `ContentItem` interface (add after the `metadata` field):

```typescript
  signalId?: string;
  pipelineRunId?: string;
  promptTemplateId?: string;
  generationModel?: string;
  qualityScore?: number;
  rejectionReason?: string;
  replacesId?: string;
  replacedById?: string;
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
```

- [ ] **Step 4: Add PipelineRunStatus to pipeline types**

In `packages/core/src/pipelines/types.ts`, add to the `PipelineStatus` type:

```typescript
export type PipelineStatus = 'idle' | 'running' | 'success' | 'failed' | 'disabled' | 'partial_success';
```

- [ ] **Step 5: Update core index.ts exports**

Replace `packages/core/src/index.ts`:

```typescript
export * from './content/types';
export * from './pillars/types';
export * from './pillars/registry';
export * from './pipelines/types';
export * from './pipelines/registry';
export * from './types/signal';
export * from './types/engine';
```

- [ ] **Step 6: Verify types compile**

```bash
pnpm -F @influenceai/core type-check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add Signal, engine types, update ContentStatus for v2"
```

---

## Task 3: Create database migration 00002

**Files:**
- Create: `packages/database/supabase/migrations/00002_v2_schema_updates.sql`

- [ ] **Step 1: Write the migration SQL**

Create `packages/database/supabase/migrations/00002_v2_schema_updates.sql`:

```sql
-- InfluenceAI v2 Schema Updates
-- Adds columns to existing tables and creates prompt_templates table

-- ============================================================
-- 1. content_signals: add source_type, dedup_hash, raw_data, scored_relevance
-- ============================================================

-- Add source_type enum column (default to existing 'source' column value pattern)
ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS dedup_hash text;
ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}';
ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS scored_relevance float;

-- Backfill source_type from existing source column
UPDATE content_signals SET source_type = source WHERE source_type IS NULL;

-- Create unique index on dedup_hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_signals_dedup_hash ON content_signals(dedup_hash) WHERE dedup_hash IS NOT NULL;

-- ============================================================
-- 2. content_items: add platform-level fields, quality score, regeneration tracking
-- ============================================================

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS pipeline_run_id uuid REFERENCES pipeline_runs(id);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS signal_id uuid REFERENCES content_signals(id);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS prompt_template_id uuid;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS generation_model text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS quality_score integer;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS token_usage jsonb;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS replaces_id uuid REFERENCES content_items(id);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS replaced_by_id uuid REFERENCES content_items(id);

-- Update status values: migrate old statuses to new ones
UPDATE content_items SET status = 'pending_review' WHERE status = 'in_review';
UPDATE content_items SET status = 'pending_review' WHERE status = 'draft';
UPDATE content_items SET status = 'rejected' WHERE status = 'archived';
UPDATE content_items SET status = 'approved' WHERE status = 'revision_requested';

-- Index on quality_score for review queue sorting
CREATE INDEX IF NOT EXISTS idx_content_items_quality ON content_items(quality_score DESC NULLS LAST) WHERE status = 'pending_review';

-- Index for pipeline run lookups
CREATE INDEX IF NOT EXISTS idx_content_items_pipeline_run ON content_items(pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;

-- ============================================================
-- 3. pipeline_runs: add trigger_task_id, counts, pipeline_id
-- ============================================================

ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS trigger_task_id text;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS signals_ingested integer DEFAULT 0;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS signals_filtered integer DEFAULT 0;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS pipeline_id text;

-- Backfill pipeline_id from pipeline_slug
UPDATE pipeline_runs SET pipeline_id = pipeline_slug WHERE pipeline_id IS NULL;

-- ============================================================
-- 4. integration_configs: add config_type
-- ============================================================

ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS config_type text DEFAULT 'api_key';

-- ============================================================
-- 5. New table: prompt_templates
-- ============================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pillar_id text NOT NULL,
  platform text NOT NULL,
  template_type text NOT NULL DEFAULT 'generation',
  system_prompt text NOT NULL,
  user_prompt_template text NOT NULL,
  model_override text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pillar_id, platform, template_type, version)
);

CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_prompt_templates_active
  ON prompt_templates(pillar_id, platform, template_type)
  WHERE is_active = true;

-- ============================================================
-- 6. RLS Policies (all tables)
-- ============================================================

ALTER TABLE content_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access (solo-use app)
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'content_signals', 'content_items', 'pipeline_runs',
    'pipeline_logs', 'content_analytics', 'integration_configs',
    'prompt_templates'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "auth_full_access" ON %I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      tbl
    );
  END LOOP;
END $$;

-- Also allow service_role to bypass RLS (for Trigger.dev server-side access)
-- This is handled by Supabase automatically when using the service_role key.
```

- [ ] **Step 2: Apply migration to Supabase**

Apply via Supabase dashboard (SQL Editor) or CLI. The migration uses `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` so it's safe to re-run.

- [ ] **Step 3: Commit**

```bash
git add packages/database/supabase/migrations/00002_v2_schema_updates.sql
git commit -m "feat(database): add v2 schema migration — new columns, prompt_templates, RLS"
```

---

## Task 4: Set up packages/database as a typed query layer

**Files:**
- Modify: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/queries/content-signals.ts`
- Create: `packages/database/src/queries/content-items.ts`
- Create: `packages/database/src/queries/pipeline-runs.ts`
- Create: `packages/database/src/queries/prompt-templates.ts`
- Create: `packages/database/src/index.ts`

- [ ] **Step 1: Update packages/database/package.json**

Replace `packages/database/package.json`:

```json
{
  "name": "@influenceai/database",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.47.0",
    "@influenceai/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/database/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create Supabase client factory**

Create `packages/database/src/client.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serverClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client for server-side use in packages (non-Next.js context).
 * Uses the service_role key for full access (bypasses RLS).
 * For Next.js server components/routes, use the app's own Supabase client instead.
 */
export function getServiceClient(): SupabaseClient {
  if (serverClient) return serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars'
    );
  }

  serverClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return serverClient;
}
```

- [ ] **Step 4: Create content-signals query module**

Create `packages/database/src/queries/content-signals.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { Signal, SignalSource } from '@influenceai/core';

export function computeDedupeHash(signal: { sourceType: SignalSource; sourceId: string; title: string }): string {
  return createHash('sha256')
    .update(`${signal.sourceType}:${signal.sourceId}:${signal.title}`)
    .digest('hex');
}

export async function insertSignals(
  client: SupabaseClient,
  signals: Signal[],
): Promise<{ inserted: string[]; duplicates: string[] }> {
  const inserted: string[] = [];
  const duplicates: string[] = [];

  for (const signal of signals) {
    const dedupHash = computeDedupeHash(signal);

    const { data, error } = await client
      .from('content_signals')
      .upsert(
        {
          source: signal.sourceType,
          source_type: signal.sourceType,
          external_id: signal.sourceId,
          title: signal.title,
          url: signal.url,
          summary: signal.summary,
          metadata: signal.metadata,
          raw_data: signal.metadata,
          dedup_hash: dedupHash,
          ingested_at: signal.fetchedAt.toISOString(),
        },
        { onConflict: 'dedup_hash', ignoreDuplicates: true },
      )
      .select('id')
      .single();

    if (error && error.code === '23505') {
      duplicates.push(signal.sourceId);
    } else if (data) {
      inserted.push(data.id);
    }
  }

  return { inserted, duplicates };
}

export async function findExistingHashes(
  client: SupabaseClient,
  hashes: string[],
): Promise<Set<string>> {
  const { data } = await client
    .from('content_signals')
    .select('dedup_hash')
    .in('dedup_hash', hashes);

  return new Set((data ?? []).map((row: { dedup_hash: string }) => row.dedup_hash));
}

export async function upsertSignalWithScore(
  client: SupabaseClient,
  signal: Signal,
  score: number,
): Promise<string> {
  const dedupHash = computeDedupeHash(signal);

  const { data, error } = await client
    .from('content_signals')
    .upsert(
      {
        source: signal.sourceType,
        source_type: signal.sourceType,
        external_id: signal.sourceId,
        title: signal.title,
        url: signal.url,
        summary: signal.summary,
        metadata: signal.metadata,
        raw_data: signal.metadata,
        dedup_hash: dedupHash,
        scored_relevance: score,
        ingested_at: signal.fetchedAt.toISOString(),
      },
      { onConflict: 'dedup_hash' },
    )
    .select('id')
    .single();

  if (error) throw new Error(`Failed to upsert signal: ${error.message}`);
  return data!.id;
}
```

- [ ] **Step 5: Create content-items query module**

Create `packages/database/src/queries/content-items.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Platform, ContentStatus } from '@influenceai/core';

export interface InsertContentItemParams {
  title: string;
  body: string;
  pillarSlug: string;
  pipelineSlug: string;
  platform: Platform;
  format: string;
  status: ContentStatus;
  signalId: string;
  pipelineRunId: string;
  promptTemplateId?: string;
  generationModel: string;
  qualityScore: number;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function insertContentItem(
  client: SupabaseClient,
  params: InsertContentItemParams,
): Promise<string> {
  const { data, error } = await client
    .from('content_items')
    .insert({
      title: params.title,
      body: params.body,
      pillar_slug: params.pillarSlug,
      pipeline_slug: params.pipelineSlug,
      platform: params.platform,
      format: params.format,
      status: params.status,
      signal_id: params.signalId,
      pipeline_run_id: params.pipelineRunId,
      prompt_template_id: params.promptTemplateId,
      generation_model: params.generationModel,
      quality_score: params.qualityScore,
      token_usage: params.tokenUsage,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to insert content item: ${error.message}`);
  return data!.id;
}

export async function updateContentStatus(
  client: SupabaseClient,
  itemId: string,
  status: ContentStatus,
  extra?: { rejectionReason?: string; replacedById?: string; scheduledAt?: string },
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (extra?.rejectionReason) update.rejection_reason = extra.rejectionReason;
  if (extra?.replacedById) update.replaced_by_id = extra.replacedById;
  if (extra?.scheduledAt) update.scheduled_at = extra.scheduledAt;

  const { error } = await client.from('content_items').update(update).eq('id', itemId);
  if (error) throw new Error(`Failed to update content item: ${error.message}`);
}
```

- [ ] **Step 6: Create pipeline-runs query module**

Create `packages/database/src/queries/pipeline-runs.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineRunStatus } from '@influenceai/core';

export async function createPipelineRun(
  client: SupabaseClient,
  params: { pipelineId: string; pipelineSlug: string; triggerTaskId?: string },
): Promise<string> {
  const { data, error } = await client
    .from('pipeline_runs')
    .insert({
      pipeline_slug: params.pipelineSlug,
      pipeline_id: params.pipelineId,
      status: 'running',
      trigger_task_id: params.triggerTaskId,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create pipeline run: ${error.message}`);
  return data!.id;
}

export async function completePipelineRun(
  client: SupabaseClient,
  runId: string,
  result: {
    status: PipelineRunStatus;
    signalsIngested: number;
    signalsFiltered: number;
    itemsGenerated: number;
    error?: string;
  },
): Promise<void> {
  const { error } = await client
    .from('pipeline_runs')
    .update({
      status: result.status,
      signals_ingested: result.signalsIngested,
      signals_filtered: result.signalsFiltered,
      items_generated: result.itemsGenerated,
      error: result.error,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) throw new Error(`Failed to complete pipeline run: ${error.message}`);
}

export async function logPipelineStep(
  client: SupabaseClient,
  runId: string,
  step: string,
  level: 'info' | 'warn' | 'error',
  message: string,
): Promise<void> {
  const { error } = await client
    .from('pipeline_logs')
    .insert({ run_id: runId, step, level, message });

  if (error) {
    console.error(`Failed to log pipeline step: ${error.message}`);
  }
}
```

- [ ] **Step 7: Create prompt-templates query module**

Create `packages/database/src/queries/prompt-templates.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Platform } from '@influenceai/core';

export interface PromptTemplate {
  id: string;
  pillarId: string;
  platform: Platform;
  templateType: string;
  systemPrompt: string;
  userPromptTemplate: string;
  modelOverride?: string;
}

export async function getActiveTemplate(
  client: SupabaseClient,
  pillarId: string,
  platform: Platform,
  templateType: string = 'generation',
): Promise<PromptTemplate | null> {
  const { data, error } = await client
    .from('prompt_templates')
    .select('*')
    .eq('pillar_id', pillarId)
    .eq('platform', platform)
    .eq('template_type', templateType)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    pillarId: data.pillar_id,
    platform: data.platform as Platform,
    templateType: data.template_type,
    systemPrompt: data.system_prompt,
    userPromptTemplate: data.user_prompt_template,
    modelOverride: data.model_override,
  };
}

export async function insertPromptTemplate(
  client: SupabaseClient,
  template: Omit<PromptTemplate, 'id'>,
): Promise<string> {
  const { data, error } = await client
    .from('prompt_templates')
    .insert({
      pillar_id: template.pillarId,
      platform: template.platform,
      template_type: template.templateType,
      system_prompt: template.systemPrompt,
      user_prompt_template: template.userPromptTemplate,
      model_override: template.modelOverride,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to insert prompt template: ${error.message}`);
  return data!.id;
}
```

- [ ] **Step 8: Create package index**

Create `packages/database/src/index.ts`:

```typescript
export { getServiceClient } from './client';
export * from './queries/content-signals';
export * from './queries/content-items';
export * from './queries/pipeline-runs';
export * from './queries/prompt-templates';
```

- [ ] **Step 9: Install dependencies**

```bash
pnpm install
pnpm -F @influenceai/database type-check
```

Expected: dependencies resolve, type-check passes.

- [ ] **Step 10: Commit**

```bash
git add packages/database/
git commit -m "feat(database): add typed query layer for signals, content, runs, templates"
```

---

## Task 5: Create packages/pipelines scaffold

**Files:**
- Create: `packages/pipelines/package.json`
- Create: `packages/pipelines/tsconfig.json`
- Create: `packages/pipelines/src/index.ts`

- [ ] **Step 1: Create package.json**

Create `packages/pipelines/package.json`:

```json
{
  "name": "@influenceai/pipelines",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@trigger.dev/sdk": "^3.0.0",
    "@influenceai/core": "workspace:*",
    "@influenceai/database": "workspace:*",
    "@influenceai/integrations": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `packages/pipelines/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create placeholder index**

Create `packages/pipelines/src/index.ts`:

```typescript
export { runPipeline } from './engine/runner';
```

- [ ] **Step 4: Add dependency from web app**

Add to `apps/web/package.json` dependencies:

```json
"@influenceai/pipelines": "workspace:*",
"@influenceai/database": "workspace:*"
```

- [ ] **Step 5: Install all dependencies**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add packages/pipelines/ apps/web/package.json pnpm-lock.yaml
git commit -m "feat: scaffold packages/pipelines with Trigger.dev SDK"
```

---

## Task 6: Build prompt builder

**Files:**
- Create: `packages/integrations/src/llm/prompts.ts`
- Test: `packages/integrations/src/llm/prompts.test.ts`

- [ ] **Step 1: Write failing test for prompt builder**

Create `packages/integrations/src/llm/prompts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildPrompt } from './prompts';
import type { Signal } from '@influenceai/core';

describe('buildPrompt', () => {
  const signal: Signal = {
    sourceType: 'github',
    sourceId: 'test/repo',
    title: 'test/repo: An amazing AI tool',
    summary: 'A tool that does amazing things with AI',
    url: 'https://github.com/test/repo',
    metadata: { stars: 1500, language: 'Python' },
    fetchedAt: new Date('2026-03-28'),
  };

  it('replaces template variables with signal data', () => {
    const template = {
      systemPrompt: 'You are an AI content writer for {{platform}}.',
      userPromptTemplate: 'Signal: {{signal_title}}\nSummary: {{signal_summary}}\nURL: {{signal_url}}',
    };

    const result = buildPrompt(template, signal, 'linkedin');

    expect(result.systemPrompt).toBe('You are an AI content writer for linkedin.');
    expect(result.userPrompt).toContain('test/repo: An amazing AI tool');
    expect(result.userPrompt).toContain('A tool that does amazing things with AI');
    expect(result.userPrompt).toContain('https://github.com/test/repo');
  });

  it('injects platform format instructions', () => {
    const template = {
      systemPrompt: 'Write content.',
      userPromptTemplate: 'Topic: {{signal_title}}\n\n{{platform_format}}',
    };

    const result = buildPrompt(template, signal, 'linkedin');

    expect(result.userPrompt).toContain('Hook line');
    expect(result.userPrompt).toContain('polarizing question');
  });

  it('handles twitter format instructions', () => {
    const template = {
      systemPrompt: 'Write content.',
      userPromptTemplate: '{{platform_format}}\nTopic: {{signal_title}}',
    };

    const result = buildPrompt(template, signal, 'twitter');

    expect(result.userPrompt).toContain('Thread format');
    expect(result.userPrompt).toContain('280 chars');
  });

  it('handles instagram carousel format', () => {
    const template = {
      systemPrompt: 'Write content.',
      userPromptTemplate: '{{platform_format}}\nTopic: {{signal_title}}',
    };

    const result = buildPrompt(template, signal, 'instagram');

    expect(result.userPrompt).toContain('Slide 1');
    expect(result.userPrompt).toContain('carousel');
  });

  it('includes signal metadata as JSON', () => {
    const template = {
      systemPrompt: 'Analyze.',
      userPromptTemplate: 'Data: {{signal_metadata}}',
    };

    const result = buildPrompt(template, signal, 'linkedin');

    expect(result.userPrompt).toContain('"stars":1500');
    expect(result.userPrompt).toContain('"language":"Python"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- packages/integrations/src/llm/prompts.test.ts
```

Expected: FAIL — module `./prompts` not found.

- [ ] **Step 3: Implement prompt builder**

Create `packages/integrations/src/llm/prompts.ts`:

```typescript
import type { Signal, Platform } from '@influenceai/core';

const PLATFORM_FORMATS: Record<string, string> = {
  linkedin: `Format: LinkedIn post.
- Hook line: bold claim, never start with "I'm excited to share..."
- 3-5 numbered insights, each a short paragraph
- End with a polarizing question to drive comments
- Total length: 1200-1500 characters`,

  twitter: `Format: Twitter/X thread.
- Tweet 1: hook statement, 280 chars max, must work standalone
- Tweets 2-5: one insight per tweet, each under 280 chars
- Last tweet: call-to-action
- Each tweet must be readable on its own`,

  instagram: `Format: Instagram carousel outline (text only — slides will be designed separately).
- Slide 1: bold visual claim with a number (e.g. "7 AI tools that...")
- Slides 2-7: one insight per slide, one sentence maximum
- Slide 8: your hot take or contrarian point
- Slide 9: CTA — "Save this. You'll need it."`,

  youtube: `Format: YouTube video script outline.
- Hook (first 15 seconds): bold claim or question
- Problem statement (30 seconds)
- 3-5 key points with demonstrations
- Results/conclusion
- Call-to-action (subscribe, comment)`,
};

export interface PromptTemplateInput {
  systemPrompt: string;
  userPromptTemplate: string;
}

export function buildPrompt(
  template: PromptTemplateInput,
  signal: Signal,
  platform: Platform,
): { systemPrompt: string; userPrompt: string } {
  const replacements: Record<string, string> = {
    '{{signal_title}}': signal.title,
    '{{signal_summary}}': signal.summary || '',
    '{{signal_url}}': signal.url,
    '{{signal_metadata}}': JSON.stringify(signal.metadata),
    '{{platform}}': platform,
    '{{platform_format}}': PLATFORM_FORMATS[platform] ?? '',
  };

  let systemPrompt = template.systemPrompt;
  let userPrompt = template.userPromptTemplate;

  for (const [key, value] of Object.entries(replacements)) {
    systemPrompt = systemPrompt.replaceAll(key, value);
    userPrompt = userPrompt.replaceAll(key, value);
  }

  return { systemPrompt, userPrompt };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- packages/integrations/src/llm/prompts.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Export from integrations**

Add to `packages/integrations/src/index.ts`:

```typescript
export { buildPrompt, type PromptTemplateInput } from './llm/prompts';
```

- [ ] **Step 6: Commit**

```bash
git add packages/integrations/src/llm/prompts.ts packages/integrations/src/llm/prompts.test.ts packages/integrations/src/index.ts
git commit -m "feat(integrations): add prompt builder with platform format instructions"
```

---

## Task 7: Enhance LLM client with quality scoring

**Files:**
- Modify: `packages/integrations/src/llm/client.ts`
- Test: `packages/integrations/src/llm/client.test.ts`

- [ ] **Step 1: Write failing test for generateWithQuality**

Create `packages/integrations/src/llm/client.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { LLMClient } from './client';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    content: 'Generated post about AI trends',
                    qualityScore: 8,
                  }),
                },
              },
            ],
            model: 'gpt-4o',
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          }),
        },
      };
    },
  };
});

describe('LLMClient', () => {
  const client = new LLMClient({ baseUrl: 'http://test', apiKey: 'test', model: 'gpt-4o' });

  it('generates content with quality score via generateWithQuality', async () => {
    const result = await client.generateWithQuality({
      systemPrompt: 'Write a post.',
      userPrompt: 'Topic: AI trends',
    });

    expect(result.content).toBe('Generated post about AI trends');
    expect(result.qualityScore).toBe(8);
    expect(result.model).toBe('gpt-4o');
    expect(result.usage).toBeDefined();
    expect(result.usage!.totalTokens).toBe(150);
  });

  it('creates client with model override via withModel', () => {
    const overridden = LLMClient.withModel('claude-sonnet-4-6');
    expect(overridden).toBeInstanceOf(LLMClient);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- packages/integrations/src/llm/client.test.ts
```

Expected: FAIL — `generateWithQuality` not found.

- [ ] **Step 3: Add generateWithQuality and withModel to LLMClient**

In `packages/integrations/src/llm/client.ts`, add the `static withModel` method after the existing `static fromEnv()`:

```typescript
  static withModel(model: string): LLMClient {
    return new LLMClient({
      baseUrl: process.env.LLM_BASE_URL || 'http://localhost:4000',
      apiKey: process.env.LLM_API_KEY || '',
      model,
    });
  }
```

Add the `generateWithQuality` method after the existing `generateJSON` method:

```typescript
  async generateWithQuality(params: LLMGenerateParams): Promise<LLMGenerateResult & { qualityScore: number }> {
    const qualitySystemSuffix = `\n\nIMPORTANT: Respond with a JSON object containing two fields:
- "content": the generated content text
- "qualityScore": your honest self-assessment of the content quality from 1 to 10 (10 = excellent, would definitely approve; 1 = low quality, should be rejected)

Respond ONLY with valid JSON.`;

    const response = await this.client.chat.completions.create({
      model: params.model ?? this.defaultModel,
      messages: [
        { role: 'system', content: params.systemPrompt + qualitySystemSuffix },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens ?? 2000,
      temperature: params.temperature ?? 0.7,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    let parsed: { content?: string; qualityScore?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { content: raw, qualityScore: 5 };
    }

    return {
      content: parsed.content ?? raw,
      qualityScore: Math.min(10, Math.max(1, parsed.qualityScore ?? 5)),
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- packages/integrations/src/llm/client.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/integrations/src/llm/client.ts packages/integrations/src/llm/client.test.ts
git commit -m "feat(llm): add generateWithQuality for quality scoring, withModel factory"
```

---

## Task 8: Refactor GitHub adapter to SignalAdapter interface

**Files:**
- Create: `packages/integrations/src/sources/types.ts`
- Create: `packages/integrations/src/sources/github.ts`
- Test: `packages/integrations/src/sources/github.test.ts`

- [ ] **Step 1: Create SignalAdapter interface**

Create `packages/integrations/src/sources/types.ts`:

```typescript
import type { Signal, SignalSource } from '@influenceai/core';

export interface AdapterConfig {
  maxAge?: number; // max age in hours, signals older than this are dropped
  [key: string]: unknown;
}

export interface SignalAdapter {
  source: SignalSource;
  fetch(config?: AdapterConfig): Promise<Signal[]>;
}
```

- [ ] **Step 2: Write failing test for GitHub signal adapter**

Create `packages/integrations/src/sources/github.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { GitHubSignalAdapter } from './github';
import type { Signal } from '@influenceai/core';

// Mock the existing fetchTrendingRepos
vi.mock('../github/client', () => ({
  fetchTrendingRepos: vi.fn().mockResolvedValue([
    {
      name: 'ai-tool',
      fullName: 'org/ai-tool',
      description: 'An AI tool for developers',
      url: 'https://github.com/org/ai-tool',
      language: 'Python',
      stars: 2000,
      starsToday: 150,
      forks: 100,
    },
    {
      name: 'web-framework',
      fullName: 'org/web-framework',
      description: 'A web framework',
      url: 'https://github.com/org/web-framework',
      language: 'JavaScript',
      stars: 500,
      starsToday: 20,
      forks: 50,
    },
  ]),
  scoreRepos: vi.fn().mockImplementation((repos) => repos),
}));

describe('GitHubSignalAdapter', () => {
  const adapter = new GitHubSignalAdapter();

  it('has source type "github"', () => {
    expect(adapter.source).toBe('github');
  });

  it('returns Signal[] from fetch', async () => {
    const signals = await adapter.fetch();

    expect(signals.length).toBe(2);
    expect(signals[0].sourceType).toBe('github');
    expect(signals[0].sourceId).toBe('org/ai-tool');
    expect(signals[0].title).toBe('org/ai-tool: An AI tool for developers');
    expect(signals[0].url).toBe('https://github.com/org/ai-tool');
    expect(signals[0].metadata).toHaveProperty('stars', 2000);
  });

  it('sets fetchedAt to a recent date', async () => {
    const signals = await adapter.fetch();
    const now = Date.now();
    const fetchedAt = signals[0].fetchedAt.getTime();

    expect(now - fetchedAt).toBeLessThan(5000);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test -- packages/integrations/src/sources/github.test.ts
```

Expected: FAIL — module `./github` not found.

- [ ] **Step 4: Implement GitHub signal adapter**

Create `packages/integrations/src/sources/github.ts`:

```typescript
import type { Signal } from '@influenceai/core';
import type { SignalAdapter, AdapterConfig } from './types';
import { fetchTrendingRepos, scoreRepos, type GitHubTrendsOptions } from '../github/client';

export class GitHubSignalAdapter implements SignalAdapter {
  source = 'github' as const;

  async fetch(config?: AdapterConfig): Promise<Signal[]> {
    const options: GitHubTrendsOptions = {
      language: (config?.language as string) ?? '',
      since: (config?.since as 'daily' | 'weekly' | 'monthly') ?? 'daily',
    };

    const repos = await fetchTrendingRepos(options);
    const scored = scoreRepos(repos);

    return scored.map((repo) => ({
      sourceType: 'github' as const,
      sourceId: repo.fullName,
      title: `${repo.fullName}: ${repo.description ?? 'No description'}`,
      summary: repo.description ?? '',
      url: repo.url,
      metadata: {
        stars: repo.stars,
        starsToday: repo.starsToday,
        language: repo.language,
        forks: repo.forks,
      },
      fetchedAt: new Date(),
    }));
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test -- packages/integrations/src/sources/github.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 6: Export from integrations**

Add to `packages/integrations/src/index.ts`:

```typescript
export { type SignalAdapter, type AdapterConfig } from './sources/types';
export { GitHubSignalAdapter } from './sources/github';
```

- [ ] **Step 7: Commit**

```bash
git add packages/integrations/src/sources/
git commit -m "feat(integrations): add SignalAdapter interface, refactor GitHub to adapter pattern"
```

---

## Task 9: Build signal deduplication module

**Files:**
- Create: `packages/pipelines/src/engine/dedup.ts`
- Test: `packages/pipelines/src/engine/dedup.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/pipelines/src/engine/dedup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deduplicateSignals } from './dedup';
import type { Signal } from '@influenceai/core';
import { computeDedupeHash } from '@influenceai/database';

describe('deduplicateSignals', () => {
  const signals: Signal[] = [
    {
      sourceType: 'github',
      sourceId: 'org/repo-a',
      title: 'org/repo-a: Great tool',
      summary: 'A great tool',
      url: 'https://github.com/org/repo-a',
      metadata: {},
      fetchedAt: new Date(),
    },
    {
      sourceType: 'github',
      sourceId: 'org/repo-b',
      title: 'org/repo-b: Another tool',
      summary: 'Another tool',
      url: 'https://github.com/org/repo-b',
      metadata: {},
      fetchedAt: new Date(),
    },
  ];

  it('filters out signals whose hashes exist in the known set', () => {
    const hashA = computeDedupeHash(signals[0]);
    const existingHashes = new Set([hashA]);

    const result = deduplicateSignals(signals, existingHashes);

    expect(result.length).toBe(1);
    expect(result[0].sourceId).toBe('org/repo-b');
  });

  it('returns all signals when no existing hashes', () => {
    const result = deduplicateSignals(signals, new Set());
    expect(result.length).toBe(2);
  });

  it('returns empty when all are duplicates', () => {
    const hashes = new Set(signals.map((s) => computeDedupeHash(s)));
    const result = deduplicateSignals(signals, hashes);
    expect(result.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- packages/pipelines/src/engine/dedup.test.ts
```

Expected: FAIL — module `./dedup` not found.

- [ ] **Step 3: Implement dedup**

Create `packages/pipelines/src/engine/dedup.ts`:

```typescript
import type { Signal } from '@influenceai/core';
import { computeDedupeHash } from '@influenceai/database';

export function deduplicateSignals(signals: Signal[], existingHashes: Set<string>): Signal[] {
  return signals.filter((signal) => {
    const hash = computeDedupeHash(signal);
    return !existingHashes.has(hash);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- packages/pipelines/src/engine/dedup.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/pipelines/src/engine/dedup.ts packages/pipelines/src/engine/dedup.test.ts
git commit -m "feat(pipelines): add signal deduplication module"
```

---

## Task 10: Build pipeline engine runner

**Files:**
- Create: `packages/pipelines/src/engine/runner.ts`
- Test: `packages/pipelines/src/engine/runner.test.ts`

This is the core of the system. The runner executes a pipeline definition through the standard step sequence.

- [ ] **Step 1: Write failing test for runPipeline**

Create `packages/pipelines/src/engine/runner.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline } from './runner';
import type { PipelineDefinition, Signal, ScoredSignal } from '@influenceai/core';

// Mock database module
vi.mock('@influenceai/database', () => ({
  getServiceClient: vi.fn().mockReturnValue({}),
  createPipelineRun: vi.fn().mockResolvedValue('run-123'),
  completePipelineRun: vi.fn().mockResolvedValue(undefined),
  logPipelineStep: vi.fn().mockResolvedValue(undefined),
  findExistingHashes: vi.fn().mockResolvedValue(new Set()),
  upsertSignalWithScore: vi.fn().mockResolvedValue('signal-123'),
  insertContentItem: vi.fn().mockResolvedValue('item-123'),
  getActiveTemplate: vi.fn().mockResolvedValue(null),
  computeDedupeHash: vi.fn().mockReturnValue('hash-123'),
}));

// Mock LLM client
vi.mock('@influenceai/integrations', () => ({
  LLMClient: {
    fromEnv: vi.fn().mockReturnValue({
      generateWithQuality: vi.fn().mockResolvedValue({
        content: 'Generated content for LinkedIn',
        qualityScore: 8,
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    }),
    withModel: vi.fn().mockReturnValue({
      generateWithQuality: vi.fn().mockResolvedValue({
        content: 'Generated content',
        qualityScore: 7,
        model: 'gpt-4o-mini',
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
      }),
    }),
  },
  buildPrompt: vi.fn().mockReturnValue({
    systemPrompt: 'You are a writer.',
    userPrompt: 'Write about this topic.',
  }),
}));

const mockSignals: Signal[] = [
  {
    sourceType: 'github',
    sourceId: 'org/ai-tool',
    title: 'org/ai-tool: Amazing AI tool',
    summary: 'An amazing AI tool',
    url: 'https://github.com/org/ai-tool',
    metadata: { stars: 2000 },
    fetchedAt: new Date(),
  },
];

const mockScoredSignals: ScoredSignal[] = [
  { ...mockSignals[0], score: 95, scoreReason: 'High relevance' },
];

const mockDefinition: PipelineDefinition = {
  id: 'github-trends',
  name: 'GitHub Trends Daily',
  description: 'Test pipeline',
  schedule: '0 8 * * *',
  enabled: true,
  pillar: 'breaking-ai-news',
  platforms: ['linkedin', 'twitter'],
  ingest: vi.fn().mockResolvedValue(mockSignals),
  filter: vi.fn().mockResolvedValue(mockScoredSignals),
  generate: {
    model: 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.7,
    topK: 3,
  },
};

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a PipelineRunResult with correct structure', async () => {
    const result = await runPipeline(mockDefinition);

    expect(result).toHaveProperty('runId', 'run-123');
    expect(result).toHaveProperty('pipelineId', 'github-trends');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('signalsIngested');
    expect(result).toHaveProperty('signalsFiltered');
    expect(result).toHaveProperty('itemsGenerated');
    expect(result).toHaveProperty('durationMs');
  });

  it('calls ingest and filter functions from the definition', async () => {
    await runPipeline(mockDefinition);

    expect(mockDefinition.ingest).toHaveBeenCalled();
    expect(mockDefinition.filter).toHaveBeenCalled();
  });

  it('generates content for each platform', async () => {
    const result = await runPipeline(mockDefinition);

    // 1 signal × 2 platforms = 2 content items
    expect(result.itemsGenerated).toBe(2);
  });

  it('marks run as completed on success', async () => {
    const result = await runPipeline(mockDefinition);
    expect(result.status).toBe('completed');
  });

  it('marks run as failed when ingest throws', async () => {
    const failDef = {
      ...mockDefinition,
      ingest: vi.fn().mockRejectedValue(new Error('API down')),
    };

    const result = await runPipeline(failDef);
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- packages/pipelines/src/engine/runner.test.ts
```

Expected: FAIL — module `./runner` not found.

- [ ] **Step 3: Implement the pipeline runner**

Create `packages/pipelines/src/engine/runner.ts`:

```typescript
import type { PipelineDefinition, PipelineRunResult, PipelineRunStatus, ScoredSignal } from '@influenceai/core';
import {
  getServiceClient,
  createPipelineRun,
  completePipelineRun,
  logPipelineStep,
  findExistingHashes,
  upsertSignalWithScore,
  insertContentItem,
  getActiveTemplate,
  computeDedupeHash,
} from '@influenceai/database';
import { LLMClient, buildPrompt } from '@influenceai/integrations';
import { deduplicateSignals } from './dedup';
import { getPillar } from '@influenceai/core';

export async function runPipeline(definition: PipelineDefinition): Promise<PipelineRunResult> {
  const startTime = Date.now();
  const db = getServiceClient();
  let runId: string;
  const errors: string[] = [];

  // Create pipeline run record
  try {
    runId = await createPipelineRun(db, {
      pipelineId: definition.id,
      pipelineSlug: definition.id,
    });
  } catch (err) {
    return {
      runId: '',
      pipelineId: definition.id,
      status: 'failed',
      signalsIngested: 0,
      signalsFiltered: 0,
      itemsGenerated: 0,
      errors: [`Failed to create run record: ${err}`],
      durationMs: Date.now() - startTime,
    };
  }

  let signalsIngested = 0;
  let signalsFiltered = 0;
  let itemsGenerated = 0;

  try {
    // STEP 1: INGEST
    await logPipelineStep(db, runId, 'ingest', 'info', 'Starting signal ingestion');
    const rawSignals = await definition.ingest({});
    signalsIngested = rawSignals.length;
    await logPipelineStep(db, runId, 'ingest', 'info', `Ingested ${rawSignals.length} signals`);

    // STEP 2: DEDUP
    const hashes = rawSignals.map((s) => computeDedupeHash(s));
    const existingHashes = await findExistingHashes(db, hashes);
    const newSignals = deduplicateSignals(rawSignals, existingHashes);
    await logPipelineStep(db, runId, 'dedup', 'info', `${newSignals.length} new signals after dedup (${rawSignals.length - newSignals.length} duplicates)`);

    if (newSignals.length === 0) {
      await logPipelineStep(db, runId, 'dedup', 'info', 'No new signals — skipping generation');
      await completePipelineRun(db, runId, {
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
      });
      return {
        runId,
        pipelineId: definition.id,
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    // STEP 3: FILTER
    await logPipelineStep(db, runId, 'filter', 'info', 'Starting signal filtering');
    const scoredSignals = await definition.filter(newSignals, {});
    const topSignals = scoredSignals.slice(0, definition.generate.topK);
    signalsFiltered = topSignals.length;
    await logPipelineStep(db, runId, 'filter', 'info', `Filtered to top ${topSignals.length} signals`);

    // STEP 4: GENERATE (per signal, per platform — sequential)
    await logPipelineStep(db, runId, 'generate', 'info', `Generating content for ${topSignals.length} signals × ${definition.platforms.length} platforms`);
    const llm = definition.generate.model
      ? LLMClient.withModel(definition.generate.model)
      : LLMClient.fromEnv();

    const pillar = getPillar(definition.pillar);

    for (const signal of topSignals) {
      // Save signal to DB
      let signalId: string;
      try {
        signalId = await upsertSignalWithScore(db, signal, (signal as ScoredSignal).score ?? 0);
      } catch (err) {
        errors.push(`Failed to save signal ${signal.sourceId}: ${err}`);
        continue;
      }

      for (const platform of definition.platforms) {
        try {
          // Get prompt template (DB first, fallback to pillar default)
          const dbTemplate = await getActiveTemplate(db, definition.pillar, platform);
          const template = dbTemplate ?? {
            systemPrompt: pillar?.promptTemplates?.default ?? 'You are an AI content writer.',
            userPromptTemplate: `{{platform_format}}\n\nSignal: {{signal_title}}\nSummary: {{signal_summary}}\nURL: {{signal_url}}\nMetadata: {{signal_metadata}}`,
          };

          const { systemPrompt, userPrompt } = buildPrompt(
            { systemPrompt: template.systemPrompt, userPromptTemplate: template.userPromptTemplate },
            signal,
            platform,
          );

          const result = await llm.generateWithQuality({
            systemPrompt,
            userPrompt,
            maxTokens: definition.generate.maxTokens,
            temperature: definition.generate.temperature,
          });

          await insertContentItem(db, {
            title: signal.title.slice(0, 200),
            body: result.content,
            pillarSlug: definition.pillar,
            pipelineSlug: definition.id,
            platform,
            format: platform === 'twitter' ? 'thread' : platform === 'instagram' ? 'carousel' : 'text_post',
            status: 'pending_review',
            signalId,
            pipelineRunId: runId,
            promptTemplateId: dbTemplate?.id,
            generationModel: result.model,
            qualityScore: result.qualityScore,
            tokenUsage: result.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          });

          itemsGenerated++;
        } catch (err) {
          errors.push(`Failed to generate for ${signal.sourceId}/${platform}: ${err}`);
          await logPipelineStep(db, runId, 'generate', 'error', `Failed: ${signal.sourceId}/${platform}: ${err}`);
        }
      }
    }

    await logPipelineStep(db, runId, 'generate', 'info', `Generated ${itemsGenerated} content items`);

    // STEP 5: FINALIZE
    const status: PipelineRunStatus =
      errors.length === 0 ? 'completed' : itemsGenerated > 0 ? 'partial_success' : 'failed';

    await completePipelineRun(db, runId, {
      status,
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });

    return {
      runId,
      pipelineId: definition.id,
      status,
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);

    await logPipelineStep(db, runId!, 'runner', 'error', `Pipeline failed: ${errorMsg}`);
    await completePipelineRun(db, runId!, {
      status: 'failed',
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      error: errorMsg,
    });

    return {
      runId: runId!,
      pipelineId: definition.id,
      status: 'failed',
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      errors,
      durationMs: Date.now() - startTime,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- packages/pipelines/src/engine/runner.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Update packages/pipelines/src/index.ts**

```typescript
export { runPipeline } from './engine/runner';
export { deduplicateSignals } from './engine/dedup';
```

- [ ] **Step 6: Commit**

```bash
git add packages/pipelines/src/
git commit -m "feat(pipelines): implement pipeline engine runner with dedup, quality scoring, partial failure"
```

---

## Task 11: Create GitHub Trends pipeline definition

**Files:**
- Create: `packages/pipelines/src/tasks/github-trends.ts`

- [ ] **Step 1: Create the pipeline definition**

Create `packages/pipelines/src/tasks/github-trends.ts`:

```typescript
import type { PipelineDefinition, Signal, ScoredSignal } from '@influenceai/core';
import { GitHubSignalAdapter } from '@influenceai/integrations';

const adapter = new GitHubSignalAdapter();

const AI_KEYWORDS = ['ai', 'llm', 'gpt', 'machine-learning', 'deep-learning', 'transformer', 'neural', 'diffusion', 'agent', 'rag', 'embedding', 'langchain', 'openai', 'anthropic'];

async function ingest(): Promise<Signal[]> {
  return adapter.fetch({ since: 'daily' });
}

async function filter(signals: Signal[]): Promise<ScoredSignal[]> {
  return signals
    .map((signal) => {
      let score = 0;
      const meta = signal.metadata as { stars?: number; starsToday?: number; language?: string };

      // Star velocity is the primary signal
      score += (meta.starsToday ?? 0) * 2;
      score += Math.log10((meta.stars ?? 1) + 1) * 10;

      // AI-relevant language boost
      const lang = (meta.language ?? '').toLowerCase();
      if (['python', 'jupyter notebook'].includes(lang)) score += 20;
      if (['typescript', 'rust'].includes(lang)) score += 10;

      // AI keyword boost from title/summary
      const text = `${signal.title} ${signal.summary}`.toLowerCase();
      const matches = AI_KEYWORDS.filter((kw) => text.includes(kw));
      score += matches.length * 15;

      const scoreReason = [
        `stars_today=${meta.starsToday ?? 0}`,
        `lang=${meta.language ?? 'unknown'}`,
        `ai_keywords=${matches.length}`,
      ].join(', ');

      return { ...signal, score, scoreReason };
    })
    .sort((a, b) => b.score - a.score);
}

export const githubTrendsPipeline: PipelineDefinition = {
  id: 'github-trends',
  name: 'GitHub Trends Daily Digest',
  description: 'Fetches trending GitHub repos, scores by AI relevance, generates content for LinkedIn/Twitter/Instagram',
  schedule: '0 8 * * *',
  enabled: true,
  pillar: 'breaking-ai-news',
  platforms: ['linkedin', 'twitter', 'instagram'],
  ingest,
  filter,
  generate: {
    model: process.env.LLM_MODEL || 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.7,
    topK: 3,
  },
};
```

- [ ] **Step 2: Export from index**

Update `packages/pipelines/src/index.ts`:

```typescript
export { runPipeline } from './engine/runner';
export { deduplicateSignals } from './engine/dedup';
export { githubTrendsPipeline } from './tasks/github-trends';
```

- [ ] **Step 3: Type-check**

```bash
pnpm -F @influenceai/pipelines type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/pipelines/src/
git commit -m "feat(pipelines): add GitHub Trends pipeline definition with AI relevance scoring"
```

---

## Task 12: Set up Trigger.dev project configuration

**Files:**
- Create: `trigger.config.ts` (at monorepo root)
- Create: `packages/pipelines/src/trigger/github-trends-task.ts`

- [ ] **Step 1: Create Trigger.dev config at monorepo root**

Create `trigger.config.ts`:

```typescript
import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID!,
  runtime: 'node',
  logLevel: 'log',
  dirs: ['packages/pipelines/src/trigger'],
});
```

- [ ] **Step 2: Install Trigger.dev SDK at root**

```bash
pnpm add -Dw @trigger.dev/sdk
```

- [ ] **Step 3: Create the Trigger.dev task for GitHub Trends**

Create `packages/pipelines/src/trigger/github-trends-task.ts`:

```typescript
import { task, schedules } from '@trigger.dev/sdk/v3';
import { runPipeline } from '../engine/runner';
import { githubTrendsPipeline } from '../tasks/github-trends';

export const githubTrendsTask = task({
  id: 'github-trends-pipeline',
  retry: { maxAttempts: 2 },
  run: async () => {
    const result = await runPipeline(githubTrendsPipeline);

    return {
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    };
  },
});

export const githubTrendsSchedule = schedules.task({
  id: 'github-trends-daily',
  task: githubTrendsTask.id,
  cron: '0 8 * * *',
});
```

- [ ] **Step 4: Commit**

```bash
git add trigger.config.ts packages/pipelines/src/trigger/ pnpm-lock.yaml
git commit -m "feat: set up Trigger.dev config and GitHub Trends scheduled task"
```

---

## Task 13: Build manual trigger API route

**Files:**
- Create: `apps/web/src/app/api/pipelines/[id]/trigger/route.ts`

- [ ] **Step 1: Create the API route**

Create `apps/web/src/app/api/pipelines/[id]/trigger/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Map pipeline IDs to Trigger.dev task IDs
  const taskMap: Record<string, string> = {
    'github-trends': 'github-trends-pipeline',
  };

  const taskId = taskMap[id];
  if (!taskId) {
    return NextResponse.json(
      { error: `Unknown pipeline: ${id}` },
      { status: 404 },
    );
  }

  try {
    const handle = await tasks.trigger(taskId, {});

    return NextResponse.json({
      success: true,
      pipelineId: id,
      triggerRunId: handle.id,
      message: `Pipeline ${id} triggered successfully`,
    });
  } catch (error) {
    console.error(`Failed to trigger pipeline ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger pipeline' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/pipelines/\[id\]/trigger/route.ts
git commit -m "feat(web): add manual pipeline trigger API route"
```

---

## Task 14: Seed prompt templates from pillar registry

**Files:**
- Create: `packages/database/src/seed/prompt-templates.ts`

- [ ] **Step 1: Create the seed script**

Create `packages/database/src/seed/prompt-templates.ts`:

```typescript
import { PILLARS } from '@influenceai/core';
import { getServiceClient } from '../client';
import { insertPromptTemplate } from '../queries/prompt-templates';
import type { Platform } from '@influenceai/core';

const PLATFORMS: Platform[] = ['linkedin', 'twitter', 'instagram'];

const PLATFORM_SYSTEM_PROMPTS: Record<Platform, string> = {
  linkedin: 'You are an AI content strategist writing for LinkedIn. Your tone is professional but bold. You write for engineers, executives, and AI practitioners.',
  twitter: 'You are an AI content strategist writing Twitter/X threads. Your tone is punchy, direct, and scroll-stopping. Every tweet must work standalone.',
  instagram: 'You are an AI content strategist designing Instagram carousel outlines. Structure content as slide-by-slide text (visuals will be designed separately).',
  youtube: 'You are an AI content strategist writing YouTube video script outlines. Focus on hooks, demonstrations, and clear takeaways.',
};

export async function seedPromptTemplates(): Promise<number> {
  const db = getServiceClient();
  let count = 0;

  for (const pillar of PILLARS) {
    for (const platform of PLATFORMS) {
      try {
        await insertPromptTemplate(db, {
          pillarId: pillar.slug,
          platform,
          templateType: 'generation',
          systemPrompt: `${PLATFORM_SYSTEM_PROMPTS[platform]}\n\nContent pillar: "${pillar.name}" — Core emotion: ${pillar.coreEmotion}.\n${pillar.description}`,
          userPromptTemplate: `${pillar.promptTemplates.default?.replace('{{input}}', '{{signal_title}}\\n{{signal_summary}}') ?? ''}\n\n{{platform_format}}\n\nSignal title: {{signal_title}}\nSignal summary: {{signal_summary}}\nSignal URL: {{signal_url}}\nSignal data: {{signal_metadata}}`,
        });
        count++;
      } catch (err) {
        // Skip duplicates (unique constraint on pillar_id + platform + template_type + version)
        console.log(`Template for ${pillar.slug}/${platform} already exists, skipping`);
      }
    }
  }

  return count;
}

// Run directly: npx tsx packages/database/src/seed/prompt-templates.ts
if (process.argv[1]?.endsWith('prompt-templates.ts')) {
  seedPromptTemplates()
    .then((count) => console.log(`Seeded ${count} prompt templates`))
    .catch(console.error);
}
```

- [ ] **Step 2: Add tsx for running seed scripts**

```bash
pnpm add -Dw tsx
```

- [ ] **Step 3: Add seed script to root package.json**

Add to root `package.json` scripts:

```json
"seed:templates": "tsx packages/database/src/seed/prompt-templates.ts"
```

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/seed/ package.json pnpm-lock.yaml
git commit -m "feat(database): add prompt template seeder from pillar registry defaults"
```

---

## Task 15: End-to-end verification

This task verifies the full pipeline works: trigger → ingest → filter → generate → save → review queue.

- [ ] **Step 1: Verify environment variables**

Ensure these are set in `.env.local` (or Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
LLM_BASE_URL=<your-llm-endpoint>
LLM_API_KEY=<your-llm-api-key>
LLM_MODEL=<your-model>
TRIGGER_SECRET_KEY=<from-trigger-dev-dashboard>
TRIGGER_PROJECT_ID=<from-trigger-dev-dashboard>
```

- [ ] **Step 2: Apply database migration**

Run `00002_v2_schema_updates.sql` via Supabase SQL Editor or CLI.

- [ ] **Step 3: Seed prompt templates**

```bash
pnpm seed:templates
```

Expected: `Seeded 21 prompt templates` (7 pillars × 3 platforms).

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: all tests pass (prompts, LLM client, GitHub adapter, dedup, runner).

- [ ] **Step 5: Start Trigger.dev dev**

```bash
npx trigger dev
```

Expected: connects to Trigger.dev cloud, registers `github-trends-pipeline` task.

- [ ] **Step 6: Test manual trigger via API**

In a separate terminal with the dev server running:

```bash
curl -X POST http://localhost:3000/api/pipelines/github-trends/trigger
```

Expected response:

```json
{
  "success": true,
  "pipelineId": "github-trends",
  "triggerRunId": "<some-id>",
  "message": "Pipeline github-trends triggered successfully"
}
```

- [ ] **Step 7: Verify data in Supabase**

Check in Supabase dashboard:

1. `pipeline_runs` — should have a new row with `pipeline_slug = 'github-trends'`, status `completed` or `partial_success`
2. `content_signals` — should have new GitHub trending repo entries
3. `content_items` — should have new rows with `status = 'pending_review'`, `quality_score` set, `platform` = linkedin/twitter/instagram
4. `pipeline_logs` — should have step-by-step log entries

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: complete foundation + pipeline engine — end-to-end verified"
```

---

## Summary

After completing all 15 tasks, you will have:

1. **Vitest** configured for monorepo-wide testing
2. **Updated core types** — Signal, ScoredSignal, PipelineDefinition, PipelineRunResult, GeneratedContent
3. **Database migration** — new columns on existing tables, prompt_templates table, RLS policies
4. **Typed query layer** — `@influenceai/database` with functions for signals, content items, pipeline runs, templates
5. **New packages/pipelines** — pipeline engine with runner, dedup, Trigger.dev integration
6. **Prompt builder** — merges templates with signal data and platform format instructions
7. **LLM quality scoring** — `generateWithQuality()` returns content + self-assessed quality (1-10)
8. **GitHub adapter** — refactored to `SignalAdapter` interface pattern
9. **GitHub Trends pipeline** — end-to-end: ingest trending repos → score by AI relevance → generate LinkedIn/Twitter/Instagram content → save to Supabase → appear in review queue
10. **Manual trigger API** — POST `/api/pipelines/[id]/trigger` to run any pipeline on demand
11. **Prompt template seeder** — populates DB with default templates from pillar registry

**Next plans to write:**
- Plan 2: Remaining signal source adapters (RSS, HN, ArXiv, Reddit, HuggingFace) + pipeline definitions
- Plan 3: Dashboard wiring (replace all mock data with Supabase queries)
- Plan 4: Settings, configuration UI, and polish
