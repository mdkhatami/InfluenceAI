# Phase 3: Persistent Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three background intelligence components: Content Memory (semantic search over published content via pgvector), Trend Trajectory (time-series tracking with phase detection), and Collision Detection (cross-domain story discovery). These accumulate intelligence that all other layers can query.

**Architecture:** New `packages/memory` package with three independent components sharing no state. Reads from `content_items` and `content_signals`, writes to `content_memory`, `trend_*`, and `collisions` tables. Triggered by cron jobs and content status changes.

**Tech Stack:** TypeScript, Supabase (pgvector extension), OpenAI SDK (embeddings + LLM), Vitest, MSW.

**Spec:** `docs/superpowers/specs/2026-04-11-content-intelligence/03-persistent-intelligence.md`
**Errata:** Fixes 6 (createEmbedding — already done in Phase 1), 13 (published_at), 14 (ExtractedStance), 20 (HNSW index), 26 (POST for similar content)

---

## File Structure

```
packages/memory/
  package.json
  tsconfig.json
  src/
    types.ts                           ← ContentMemoryEntry, TrendEntity, TrendAnalysis, Collision, etc.
    content-memory/
      indexer.ts                       ← indexContentItem() — embedding + entity extraction
      queries.ts                       ← findSimilarContent(), findByEntity(), findOpenPredictions(), findStances(), findCoverageGaps()
    trends/
      collector.ts                     ← collectTrendData() — daily metric collection
      analyzer.ts                      ← analyzeTrends() — phase detection, velocity, pattern matching
      discovery.ts                     ← discoverNewEntities() — auto-track frequently mentioned entities
    collisions/
      detector.ts                      ← detectCollisions() — entity overlap + LLM-assisted
    index.ts
    __tests__/
      content-memory/indexer.test.ts
      content-memory/queries.test.ts
      trends/collector.test.ts
      trends/analyzer.test.ts
      collisions/detector.test.ts
    __fixtures__/
      memory-extraction-response.json
      collision-response.json

packages/database/supabase/migrations/
  00005_persistent_intelligence.sql     ← NEW: content_memory (pgvector), trend_entities, trend_data_points, trend_analyses, collisions

apps/web/src/app/api/
  memory/
    index/[contentItemId]/route.ts      ← NEW: POST index a content item
    similar/route.ts                    ← NEW: POST find similar content (Fix 26: POST not GET)
    entity/[name]/route.ts              ← NEW: GET content by entity
    predictions/route.ts                ← NEW: GET open predictions
  trends/
    route.ts                            ← NEW: GET all trends
    [entityId]/route.ts                 ← NEW: GET single trend detail
    collect/route.ts                    ← NEW: POST trigger collection
    analyze/route.ts                    ← NEW: POST trigger analysis
    entities/route.ts                   ← NEW: POST add entity to track
  collisions/
    route.ts                            ← NEW: GET recent collisions
    [id]/status/route.ts                ← NEW: POST update collision status
  cron/
    trend-collect/route.ts              ← NEW: daily trend collection cron
    trend-analyze/route.ts              ← NEW: daily trend analysis cron
    collision-detect/route.ts           ← NEW: daily collision detection cron
```

---

### Task 1: Package scaffolding + types

**Files:**
- Create: `packages/memory/package.json`
- Create: `packages/memory/tsconfig.json`
- Create: `packages/memory/src/types.ts`
- Create: `packages/memory/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@influenceai/memory",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@influenceai/core": "workspace:*",
    "@influenceai/database": "workspace:*",
    "@influenceai/integrations": "workspace:*"
  },
  "devDependencies": {
    "msw": "^2.7.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json** (same pattern as other packages)

- [ ] **Step 3: Create types.ts**

Write all Persistent Intelligence types from master spec `00-master-spec.md`: `ContentMemoryEntry`, `Entity`, `Prediction`, `ExtractedStance` (Fix 14 — separate from full `Stance`), `TrendEntity`, `TrendAnalysis`, `Collision`, `ContentExtraction` (LLM output type), `RawCollision`, `EntityMeta`.

- [ ] **Step 4: Create index.ts stub + install**

Run: `pnpm install && cd packages/memory && pnpm exec tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add packages/memory/
git commit -m "feat(memory): scaffold persistent intelligence package"
```

---

### Task 2: Database migration (pgvector + all tables)

**Files:**
- Create: `packages/database/supabase/migrations/00005_persistent_intelligence.sql`

- [ ] **Step 1: Write migration**

Follow spec `03-persistent-intelligence.md` Database Schema section with these fixes:

```sql
-- Migration: 00005_persistent_intelligence.sql

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Content Memory with vector embeddings
CREATE TABLE content_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE UNIQUE,
  platform TEXT,
  pillar_slug TEXT,
  embedding vector(1536),
  entities JSONB DEFAULT '[]',
  topics TEXT[] DEFAULT '{}',
  predictions JSONB DEFAULT '[]',
  stances JSONB DEFAULT '[]',          -- Uses ExtractedStance (Fix 14), not full Stance
  platform_metrics JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fix 20: Use HNSW index instead of IVFFlat (works from row 1)
CREATE INDEX idx_content_memory_embedding ON content_memory
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_content_memory_published ON content_memory(published_at DESC);

-- pgvector similarity search RPC function
CREATE OR REPLACE FUNCTION match_content_memory(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid, content_item_id uuid, platform text, pillar_slug text,
  entities jsonb, topics text[], predictions jsonb, stances jsonb,
  published_at timestamptz, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT cm.id, cm.content_item_id, cm.platform, cm.pillar_slug,
    cm.entities, cm.topics, cm.predictions, cm.stances, cm.published_at,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM content_memory cm
  WHERE 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END; $$;

-- Trend tables
CREATE TABLE trend_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  github_repo TEXT,
  npm_package TEXT,
  pypi_package TEXT,
  tracking_since TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trend_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES trend_entities(id) ON DELETE CASCADE,
  measured_at DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, measured_at)
);
CREATE INDEX idx_trend_data_entity_date ON trend_data_points(entity_id, measured_at DESC);

CREATE TABLE trend_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES trend_entities(id) ON DELETE CASCADE UNIQUE,
  phase TEXT,
  velocity FLOAT DEFAULT 0,
  acceleration FLOAT DEFAULT 0,
  pattern_match JSONB,
  signal TEXT DEFAULT 'hold',
  chart_data JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_trend_analyses_signal ON trend_analyses(signal);

-- Collisions
CREATE TABLE collisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  signal_a JSONB NOT NULL,
  signal_b JSONB NOT NULL,
  connection_narrative TEXT NOT NULL,
  story_potential TEXT DEFAULT 'medium',
  suggested_angle TEXT,
  status TEXT DEFAULT 'detected',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_collisions_status ON collisions(status);
CREATE INDEX idx_collisions_created ON collisions(created_at DESC);

-- RLS policies (all tables)
ALTER TABLE content_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE collisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated all" ON content_memory FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all" ON trend_entities FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all" ON trend_data_points FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all" ON trend_analyses FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated all" ON collisions FOR ALL TO authenticated USING (true);
```

- [ ] **Step 2: Commit**

```bash
git add packages/database/supabase/migrations/00005_persistent_intelligence.sql
git commit -m "feat(database): add pgvector content_memory, trend tables, collisions"
```

---

### Task 3: Content Memory indexer

**Files:**
- Create: `packages/memory/src/content-memory/indexer.ts`
- Create: `packages/memory/src/__fixtures__/memory-extraction-response.json`
- Test: `packages/memory/src/__tests__/content-memory/indexer.test.ts`

- [ ] **Step 1: Create fixture**

```json
{
  "entities": [
    { "name": "LangChain", "type": "technology", "sentiment": "positive" },
    { "name": "OpenAI", "type": "company", "sentiment": "neutral" }
  ],
  "topics": ["LLM frameworks", "developer tools", "open source", "AI infrastructure"],
  "predictions": [
    { "statement": "LangChain will dominate the LLM orchestration space by 2027", "timeframe": "2027", "confidence": "medium" }
  ],
  "stances": [
    { "topic": "open source AI", "position": "strongly in favor of open weights" }
  ]
}
```

- [ ] **Step 2: Write indexer test**

```typescript
describe('Content Memory Indexer', () => {
  it('generates embedding via llm.createEmbedding()', async () => {
    const entry = await indexContentItem(mockDb, mockLlm, 'item-1');
    expect(mockLlm.createEmbedding).toHaveBeenCalled();
    expect(entry.embedding).toBeDefined();
  });

  it('extracts entities, topics, predictions, stances', async () => {
    const entry = await indexContentItem(mockDb, mockLlm, 'item-1');
    expect(entry.entities.length).toBeGreaterThan(0);
    expect(entry.topics.length).toBeGreaterThanOrEqual(3);
  });

  it('upserts on conflict — no duplicates', async () => {
    await indexContentItem(mockDb, mockLlm, 'item-1');
    await indexContentItem(mockDb, mockLlm, 'item-1');
    // Verify upsert was called with onConflict: 'content_item_id'
    expect(mockDb.from('content_memory').upsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: 'content_item_id' })
    );
  });

  it('uses published_at not updated_at (Fix 13)', async () => {
    const entry = await indexContentItem(mockDb, mockLlm, 'item-1');
    expect(entry.published_at).toBe(mockItem.published_at);
  });
});
```

- [ ] **Step 3: Implement indexer.ts**

Follow spec `03-persistent-intelligence.md` Indexer section:
- `indexContentItem(db, llm, contentItemId)` — fetch content item, call `llm.createEmbedding()` (Fix 6 — uses the public method added in Phase 1), call `llm.generateJSON<ContentExtraction>()` for entity/topic/prediction/stance extraction, upsert to `content_memory`.
- Fix 13: use `item.data.published_at || item.data.updated_at` for the `published_at` field.
- Stances use `ExtractedStance` type (Fix 14: no confidence/lastExpressed fields).

- [ ] **Step 4: Run test**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/memory/src/content-memory/indexer.ts packages/memory/src/__tests__/content-memory/indexer.test.ts packages/memory/src/__fixtures__/memory-extraction-response.json
git commit -m "feat(memory): content memory indexer with embedding + entity extraction"
```

---

### Task 4: Content Memory queries

**Files:**
- Create: `packages/memory/src/content-memory/queries.ts`
- Test: `packages/memory/src/__tests__/content-memory/queries.test.ts`

- [ ] **Step 1: Write query tests**

```typescript
describe('Content Memory Queries', () => {
  it('findSimilarContent calls RPC with correct params', async () => {
    await findSimilarContent(mockDb, mockEmbedding, 0.8, 5);
    expect(mockDb.rpc).toHaveBeenCalledWith('match_content_memory', {
      query_embedding: mockEmbedding, match_threshold: 0.8, match_count: 5,
    });
  });

  it('findByEntity returns matching entries', async () => {
    const results = await findByEntity(mockDb, 'OpenAI');
    expect(results.length).toBeGreaterThan(0);
  });

  it('findOpenPredictions returns only open status', async () => {
    const results = await findOpenPredictions(mockDb);
    results.forEach(r => expect(r.prediction.status).toBe('open'));
  });
});
```

- [ ] **Step 2: Implement queries.ts**

Follow spec `03-persistent-intelligence.md` Query Functions section:
- `findSimilarContent(db, embedding, threshold, limit)` — calls `db.rpc('match_content_memory', ...)`
- `findByEntity(db, entityName, entityType?)` — JSONB contains query on entities array
- `findOpenPredictions(db)` — fetch entries with non-empty predictions, filter for `status: 'open'`
- `findStances(db, topic)` — JSONB search on stances
- `findCoverageGaps(db, daysSinceLastPost)` — compare signal topics vs content topics

- [ ] **Step 3: Run test + commit**

```bash
git add packages/memory/src/content-memory/queries.ts packages/memory/src/__tests__/content-memory/queries.test.ts
git commit -m "feat(memory): content memory query functions (similar, entity, predictions)"
```

---

### Task 5: Trend Collector

**Files:**
- Create: `packages/memory/src/trends/collector.ts`
- Test: `packages/memory/src/__tests__/trends/collector.test.ts`

- [ ] **Step 1: Write collector tests**

```typescript
describe('Trend Collector', () => {
  it('fetches GitHub metrics for entities with repo', async () => {
    const result = await collectTrendData(mockDb);
    expect(result.entitiesUpdated).toBeGreaterThan(0);
  });

  it('skips GitHub for entities without repo', async () => {
    // Entity with no github_repo should still get HN data
  });

  it('handles PyPI API failure gracefully', async () => {
    server.use(/* override PyPI handler to 500 */);
    const result = await collectTrendData(mockDb);
    // Should not throw, should report error
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('stores one data point per entity per day (upsert)', async () => {
    await collectTrendData(mockDb);
    await collectTrendData(mockDb);
    // Second call should upsert, not insert duplicate
  });
});
```

- [ ] **Step 2: Implement collector.ts**

Follow spec `03-persistent-intelligence.md` Trend Collector section:
- `collectTrendData(db)` — fetch active `trend_entities`, for each: collect GitHub metrics (if `github_repo`), npm downloads (if `npm_package`), PyPI downloads (if `pypi_package`), HN mentions (always). Upsert to `trend_data_points` with `onConflict: 'entity_id,measured_at'`.
- Individual fetchers: `fetchGitHubMetrics(repo)`, `fetchNpmDownloads(pkg)`, `fetchPyPIDownloads(pkg)`, `fetchHNMentions(term)`. Each uses `fetch()` with error handling — failure returns null, doesn't crash.

- [ ] **Step 3: Run test + commit**

```bash
git add packages/memory/src/trends/collector.ts packages/memory/src/__tests__/trends/collector.test.ts
git commit -m "feat(memory): trend data collector (GitHub, npm, PyPI, HN)"
```

---

### Task 6: Trend Analyzer + Entity Discovery

**Files:**
- Create: `packages/memory/src/trends/analyzer.ts`
- Create: `packages/memory/src/trends/discovery.ts`
- Test: `packages/memory/src/__tests__/trends/analyzer.test.ts`

- [ ] **Step 1: Write analyzer tests**

```typescript
describe('Trend Analyzer', () => {
  it('phase detection: accelerating when velocity > 0 and acceleration > 0', () => {
    expect(detectPhase(10, 5, mockValues)).toBe('accelerating');
  });

  it('phase detection: declining when velocity < 0', () => {
    expect(detectPhase(-5, -2, mockValues)).toBe('declining');
  });

  it('content signal: accelerating + uncovered = strong_buy', () => {
    expect(computeContentSignal('accelerating', 10, 0)).toBe('strong_buy');
  });

  it('skips entity with < 14 data points', async () => {
    // Mock entity with only 7 data points
    const analyses = await analyzeTrends(mockDbWith7Points);
    expect(analyses).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement analyzer.ts**

Follow spec `03-persistent-intelligence.md` Trend Analyzer section:
- `analyzeTrends(db)` — for each active entity with >= 14 data points: compute velocity, acceleration, phase, pattern match, content signal. Upsert to `trend_analyses`.
- `detectPhase(velocity, acceleration, values)` — logic from spec
- `computeVelocity(values)` / `computeAcceleration(values)` — weekly averages
- `computeContentSignal(phase, velocity, yourPostCount)` — maps to strong_buy/buy/hold/sell/strong_sell

- [ ] **Step 3: Implement discovery.ts**

Follow spec `03-persistent-intelligence.md` Auto-Entity Discovery section:
- `discoverNewEntities(db, llm)` — count entity mentions in recent `content_memory`, entities mentioned 3+ times in 2 weeks that aren't tracked get auto-added. Use LLM to determine GitHub repo / npm package associations.

- [ ] **Step 4: Run test + commit**

```bash
git add packages/memory/src/trends/analyzer.ts packages/memory/src/trends/discovery.ts packages/memory/src/__tests__/trends/analyzer.test.ts
git commit -m "feat(memory): trend analyzer with phase detection + auto-entity discovery"
```

---

### Task 7: Collision Detector

**Files:**
- Create: `packages/memory/src/collisions/detector.ts`
- Create: `packages/memory/src/__fixtures__/collision-response.json`
- Test: `packages/memory/src/__tests__/collisions/detector.test.ts`

- [ ] **Step 1: Create fixture + write test**

`collision-response.json`:
```json
{
  "collisions": [
    { "indexA": 0, "indexB": 3, "type": "tech_finance", "narrative": "OpenAI's model release coincides with NVDA stock drop — market pricing in commoditization", "potential": "high", "angle": "hidden_connection" }
  ]
}
```

Tests:
- `entity overlap detection across source types`
- `empty array for < 2 signals`
- `LLM collision detection with top 30 signals`

- [ ] **Step 2: Implement detector.ts**

Follow spec `03-persistent-intelligence.md` Collision Detection section:
- `detectCollisions(db, llm)` — fetch top 30 signals from last 48h, run entity overlap detection (`findEntityOverlapCollisions`), then LLM-assisted detection (`llm.generateJSON`). Store results in `collisions` table.
- `findEntityOverlapCollisions(signals)` — group by source type, find text overlap between signals from different sources
- `classifyCollisionType(sourceA, sourceB)` — maps source pair to collision type

- [ ] **Step 3: Run test + commit**

```bash
git add packages/memory/src/collisions/ packages/memory/src/__tests__/collisions/ packages/memory/src/__fixtures__/collision-response.json
git commit -m "feat(memory): collision detector with entity overlap + LLM-assisted detection"
```

---

### Task 8: API routes + cron routes

**Files:**
- Create all API routes listed in File Structure
- Create cron routes for daily collection/analysis/detection

- [ ] **Step 1: Implement memory API routes**

`POST /api/memory/index/[contentItemId]` — calls `indexContentItem(db, llm, contentItemId)`
`POST /api/memory/similar` (Fix 26: POST not GET) — accepts `{ embedding, threshold?, limit? }` in body, calls `findSimilarContent()`
`GET /api/memory/entity/[name]` — calls `findByEntity(db, name)`
`GET /api/memory/predictions?status=open` — calls `findOpenPredictions(db)`

- [ ] **Step 2: Implement trends API routes**

`GET /api/trends` — list all entities with latest analysis (join `trend_entities` + `trend_analyses`)
`GET /api/trends/[entityId]` — full trend detail with chart data
`POST /api/trends/collect` — manual trigger for `collectTrendData()`
`POST /api/trends/analyze` — manual trigger for `analyzeTrends()`
`POST /api/trends/entities` — add entity to track (insert into `trend_entities`)

- [ ] **Step 3: Implement collision API routes**

`GET /api/collisions?status=detected&limit=10` — fetch recent collisions
`POST /api/collisions/[id]/status` — update status to 'used' or 'dismissed'

- [ ] **Step 4: Implement cron routes**

Follow existing pattern from `apps/web/src/app/api/cron/github-trends/route.ts`:

```typescript
// apps/web/src/app/api/cron/trend-collect/route.ts
import { NextResponse } from 'next/server';
import { verifyCronAuth } from '../_lib/auth';
import { collectTrendData } from '@influenceai/memory';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = await createClient();
    const result = await collectTrendData(supabase);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

Same pattern for `trend-analyze` and `collision-detect` cron routes.

- [ ] **Step 5: Update index.ts exports**

Export all public functions from `packages/memory/src/index.ts`.

- [ ] **Step 6: Build check**

Run: `pnpm -F @influenceai/web build`
Expected: Succeeds

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/memory/ apps/web/src/app/api/trends/ apps/web/src/app/api/collisions/ apps/web/src/app/api/cron/trend-collect/ apps/web/src/app/api/cron/trend-analyze/ apps/web/src/app/api/cron/collision-detect/ packages/memory/src/index.ts
git commit -m "feat(api): memory, trends, collisions endpoints + cron routes"
```

---

### Task 9: Integration test

**Files:**
- Create: `packages/memory/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

Test the full flow: index a content item → find it via similar search → verify entity extraction → verify predictions queryable.

Also test: trend collector → analyzer → phase detection chain.

- [ ] **Step 2: Run all memory tests**

Run: `pnpm vitest run packages/memory/`
Expected: All PASS

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add packages/memory/src/__tests__/integration.test.ts
git commit -m "test(memory): integration tests for content memory + trend pipeline"
```

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Package scaffold + types | Type-check |
| 2 | DB migration (pgvector) | SQL validation |
| 3 | Content Memory indexer | 4 indexer tests |
| 4 | Content Memory queries | 3 query tests |
| 5 | Trend Collector | 4 collector tests |
| 6 | Trend Analyzer + Discovery | 4 analyzer tests |
| 7 | Collision Detector | 3 detector tests |
| 8 | API routes + cron routes | Build check |
| 9 | Integration test | 2 integration tests |

**Total: ~20 tests, ~9 commits**
