# Phase 3: Persistent Intelligence

**Parent:** `00-master-spec.md`
**Layer:** 1.5 (Background, always running)
**Depends on:** Phase 2 output (content_items with approved/published status)
**Delivers:** Content Memory (semantic search), Trend Trajectory (time-series analysis), Collision Detection (cross-domain story discovery)

---

## Overview

This layer runs in the background, continuously accumulating intelligence that all other layers can query. It has three independent components:

1. **Content Memory** — Semantic index of everything you've published (embeddings + entity extraction)
2. **Trend Trajectory** — Time-series tracking of technologies/companies with phase detection
3. **Collision Detection** — Cross-domain story discovery from recent signals

Each component is independently useful and independently deployable. They share no state with each other.

---

## Package Structure

```
packages/memory/
  src/
    content-memory/
      indexer.ts              ← Indexes new content items (embedding + extraction)
      queries.ts              ← Search functions (similar, by entity, predictions, gaps)
      types.ts
    trends/
      collector.ts            ← Daily data collection (GitHub, npm, HN, jobs)
      analyzer.ts             ← Phase detection, velocity, pattern matching
      types.ts
    collisions/
      detector.ts             ← Cross-domain collision detection
      types.ts
    index.ts                  ← Public API
  package.json                ← @influenceai/memory
  tsconfig.json
```

---

## Component 1: Content Memory

### Indexer

Triggered when a content_item transitions to `approved` or `published` status. Can also be run as a backfill job for existing content.

```typescript
async function indexContentItem(
  db: SupabaseClient,
  llm: LLMClient,
  contentItemId: string
): Promise<ContentMemoryEntry> {

  // 1. Fetch the content item
  const item = await db.from('content_items')
    .select('*')
    .eq('id', contentItemId)
    .single();

  // 2. Generate embedding
  const embedding = await generateEmbedding(llm, `${item.data.title}\n\n${item.data.body}`);

  // 3. Extract entities, topics, predictions, stances via LLM
  const extraction = await llm.generateJSON<ContentExtraction>({
    systemPrompt: CONTENT_EXTRACTION_SYSTEM_PROMPT,
    userPrompt: `
Title: ${item.data.title}
Body: ${item.data.body}
Platform: ${item.data.platform}

Extract:
1. Entities mentioned (companies, people, technologies, concepts, regulations) with sentiment
2. Topic tags (3-7 tags)
3. Any predictions made ("X will happen", "by 2027", etc.) with expressed confidence
4. Any stances taken ("skeptical of X", "bullish on Y", etc.)
`,
    maxTokens: 500,
    temperature: 0.2,
  });

  // 4. Store in content_memory
  const entry = {
    content_item_id: contentItemId,
    platform: item.data.platform,
    pillar_slug: item.data.pillar_slug,
    embedding,
    entities: extraction.entities,
    topics: extraction.topics,
    predictions: extraction.predictions.map(p => ({ ...p, status: 'open' })),
    stances: extraction.stances,
    published_at: item.data.updated_at,
  };

  await db.from('content_memory').upsert(entry, { onConflict: 'content_item_id' });
  return entry;
}

async function generateEmbedding(llm: LLMClient, text: string): Promise<number[]> {
  // Uses OpenAI-compatible embedding endpoint
  // Model: text-embedding-3-small (1536 dimensions, cheapest)
  // If LLM_BASE_URL points to LiteLLM, it routes to appropriate provider
  const response = await llm.client.embeddings.create({
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    input: text.substring(0, 8000), // Token limit safety
  });
  return response.data[0].embedding;
}

const CONTENT_EXTRACTION_SYSTEM_PROMPT = `Extract structured metadata from a social media post about AI/technology.

Output JSON with:
- entities: [{name, type: "company"|"person"|"technology"|"concept"|"regulation", sentiment: "positive"|"negative"|"neutral"}]
- topics: string[] (3-7 concise topic tags)
- predictions: [{statement, timeframe (if mentioned), confidence: "high"|"medium"|"low"}]
- stances: [{topic, position}]

Rules:
- Only extract entities actually mentioned, not implied
- Predictions must be forward-looking statements with verifiable outcomes
- Stances are opinions the author clearly expresses, not neutral mentions`;
```

### Query Functions

```typescript
// 1. Find similar content (dedup + "have I covered this?")
async function findSimilarContent(
  db: SupabaseClient,
  embedding: number[],
  threshold: number = 0.8,
  limit: number = 5
): Promise<ContentMemoryEntry[]> {
  // Uses pgvector cosine similarity
  const { data } = await db.rpc('match_content_memory', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
  });
  return data;
}

// 2. Find by entity (what did I say about OpenAI before?)
async function findByEntity(
  db: SupabaseClient,
  entityName: string,
  entityType?: string
): Promise<ContentMemoryEntry[]> {
  // JSONB query on entities array
  const query = db.from('content_memory')
    .select('*')
    .contains('entities', [{ name: entityName }]);
  if (entityType) {
    query.contains('entities', [{ name: entityName, type: entityType }]);
  }
  return (await query.order('published_at', { ascending: false }).limit(10)).data;
}

// 3. Find open predictions (callback opportunities)
async function findOpenPredictions(
  db: SupabaseClient
): Promise<{ contentItemId: string; prediction: Prediction }[]> {
  // Fetch all content_memory entries that have open predictions
  const { data } = await db.from('content_memory')
    .select('content_item_id, predictions')
    .not('predictions', 'eq', '[]');

  return data.flatMap(row =>
    row.predictions
      .filter((p: Prediction) => p.status === 'open')
      .map((p: Prediction) => ({ contentItemId: row.content_item_id, prediction: p }))
  );
}

// 4. Find stances on a topic
async function findStances(
  db: SupabaseClient,
  topic: string
): Promise<Stance[]> {
  // Search stances JSONB for matching topic
  const { data } = await db.from('content_memory')
    .select('stances')
    .not('stances', 'eq', '[]');

  return data.flatMap(row =>
    row.stances.filter((s: Stance) =>
      s.topic.toLowerCase().includes(topic.toLowerCase())
    )
  );
}

// 5. Find coverage gaps (trending topics I haven't posted about recently)
async function findCoverageGaps(
  db: SupabaseClient,
  daysSinceLastPost: number = 14
): Promise<string[]> {
  const cutoff = new Date(Date.now() - daysSinceLastPost * 24 * 60 * 60 * 1000);

  // Get all topics from recent signals
  const recentSignalTopics = await db.from('content_signals')
    .select('metadata')
    .gte('ingested_at', cutoff.toISOString())
    .limit(100);

  // Get all topics from recent content
  const recentContentTopics = await db.from('content_memory')
    .select('topics')
    .gte('published_at', cutoff.toISOString());

  // Find signal topics not covered in content
  // This is a simplified version — actual implementation uses
  // topic embedding similarity, not exact string match
  const coveredTopics = new Set(recentContentTopics.data.flatMap(r => r.topics));
  // Return uncovered trending topics
  return []; // Actual implementation compares embeddings
}
```

### Supabase pgvector Function

```sql
-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION match_content_memory(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content_item_id uuid,
  platform text,
  pillar_slug text,
  entities jsonb,
  topics text[],
  predictions jsonb,
  stances jsonb,
  published_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.content_item_id,
    cm.platform,
    cm.pillar_slug,
    cm.entities,
    cm.topics,
    cm.predictions,
    cm.stances,
    cm.published_at,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM content_memory cm
  WHERE 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Component 2: Trend Trajectory

### Trend Collector (Daily Cron Job)

Runs once daily to collect metrics for all tracked entities.

```typescript
async function collectTrendData(
  db: SupabaseClient
): Promise<{ entitiesUpdated: number; errors: string[] }> {

  // 1. Get all active tracked entities
  const { data: entities } = await db.from('trend_entities')
    .select('*')
    .eq('is_active', true);

  const errors: string[] = [];

  // 2. For each entity, collect metrics from available sources
  for (const entity of entities) {
    try {
      const metrics: Record<string, number | null> = {};

      // GitHub (if entity has a repo association)
      if (entity.github_repo) {
        const gh = await fetchGitHubMetrics(entity.github_repo);
        metrics.githubStars = gh.stars;
        metrics.githubStarsDelta = gh.starsDelta;  // Last 7 days
        metrics.githubForks = gh.forks;
        metrics.githubOpenIssues = gh.openIssues;
      }

      // npm (if entity has a package name)
      if (entity.npm_package) {
        const npm = await fetchNpmDownloads(entity.npm_package);
        metrics.npmDownloads = npm.weeklyDownloads;
      }

      // PyPI (if entity has a package name)
      if (entity.pypi_package) {
        const pypi = await fetchPyPIDownloads(entity.pypi_package);
        metrics.pypiDownloads = pypi.weeklyDownloads;
      }

      // HackerNews mentions (search Algolia HN API)
      const hn = await fetchHNMentions(entity.name);
      metrics.hnMentions = hn.count;
      metrics.hnAvgScore = hn.avgScore;

      // Your post count (from content_memory)
      const posts = await db.from('content_memory')
        .select('id', { count: 'exact' })
        .contains('entities', [{ name: entity.name }]);
      metrics.yourPostCount = posts.count;

      // 3. Store data point
      await db.from('trend_data_points').upsert({
        entity_id: entity.id,
        measured_at: new Date().toISOString().split('T')[0], // Date only (one per day)
        metrics,
      }, { onConflict: 'entity_id,measured_at' });

    } catch (err) {
      errors.push(`${entity.name}: ${err.message}`);
    }
  }

  return { entitiesUpdated: entities.length - errors.length, errors };
}

// Data source fetchers

async function fetchGitHubMetrics(repo: string): Promise<{
  stars: number; starsDelta: number; forks: number; openIssues: number;
}> {
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
  });
  const data = await response.json();

  // Star delta requires comparing with stored value from last week
  // Simplified: use the stargazers endpoint with timestamps
  return {
    stars: data.stargazers_count,
    starsDelta: 0, // Computed from previous data point during analysis
    forks: data.forks_count,
    openIssues: data.open_issues_count,
  };
}

async function fetchNpmDownloads(pkg: string): Promise<{ weeklyDownloads: number }> {
  const response = await fetch(`https://api.npmjs.org/downloads/point/last-week/${pkg}`);
  const data = await response.json();
  return { weeklyDownloads: data.downloads };
}

async function fetchPyPIDownloads(pkg: string): Promise<{ weeklyDownloads: number }> {
  const response = await fetch(`https://pypistats.org/api/packages/${pkg}/recent`);
  const data = await response.json();
  return { weeklyDownloads: data.data.last_week };
}

async function fetchHNMentions(term: string): Promise<{ count: number; avgScore: number }> {
  const weekAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const response = await fetch(
    `https://hn.algolia.com/api/v1/search?query="${term}"&tags=story&numericFilters=created_at_i>${weekAgo}`
  );
  const data = await response.json();
  const scores = data.hits.map((h: any) => h.points || 0);
  return {
    count: data.nbHits,
    avgScore: scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0,
  };
}
```

### Trend Analyzer

Runs after data collection. Computes velocity, acceleration, phase, and pattern matches.

```typescript
async function analyzeTrends(
  db: SupabaseClient
): Promise<TrendAnalysis[]> {

  const { data: entities } = await db.from('trend_entities')
    .select('*')
    .eq('is_active', true);

  const analyses: TrendAnalysis[] = [];

  for (const entity of entities) {
    // Fetch last 12 weeks of data points
    const { data: points } = await db.from('trend_data_points')
      .select('*')
      .eq('entity_id', entity.id)
      .order('measured_at', { ascending: true })
      .limit(84); // 12 weeks of daily data

    if (points.length < 14) continue; // Need at least 2 weeks of data

    // Compute primary metric (pick best available)
    const metricKey = selectPrimaryMetric(entity, points);
    const values = points.map(p => ({
      date: p.measured_at,
      value: p.metrics[metricKey] ?? 0,
    }));

    // Velocity: average weekly change over last 2 weeks
    const velocity = computeVelocity(values);

    // Acceleration: change in velocity (this week vs last week)
    const acceleration = computeAcceleration(values);

    // Phase detection
    const phase = detectPhase(velocity, acceleration, values);

    // Pattern matching against historical patterns
    const patternMatch = matchHistoricalPattern(values, entity.type);

    // Content coverage signal
    const yourPosts = points[points.length - 1]?.metrics.yourPostCount ?? 0;
    const signal = computeContentSignal(phase, velocity, yourPosts);

    const analysis: TrendAnalysis = {
      entityId: entity.id,
      entityName: entity.name,
      phase,
      velocity,
      acceleration,
      patternMatch,
      signal,
      chartData: values.slice(-28), // Last 4 weeks for chart
      analyzedAt: new Date(),
    };

    await db.from('trend_analyses').upsert({
      entity_id: entity.id,
      ...analysis,
    }, { onConflict: 'entity_id' }); // One analysis per entity, updated daily

    analyses.push(analysis);
  }

  return analyses;
}

function detectPhase(
  velocity: number,
  acceleration: number,
  values: { date: string; value: number }[]
): TrendAnalysis['phase'] {
  const recent = values.slice(-7);
  const avgRecent = recent.reduce((sum, v) => sum + v.value, 0) / recent.length;
  const maxEver = Math.max(...values.map(v => v.value));

  if (avgRecent < 10) return 'emerging';
  if (velocity > 0 && acceleration > 0) return 'accelerating';
  if (velocity > 0 && acceleration <= 0) return 'peak';
  if (velocity < 0 && acceleration < 0) return 'decelerating';
  if (Math.abs(velocity) < avgRecent * 0.02) return 'plateau'; // < 2% weekly change
  if (velocity < 0) return 'declining';
  return 'emerging';
}

function computeContentSignal(
  phase: string,
  velocity: number,
  yourPostCount: number
): TrendAnalysis['signal'] {
  // High velocity + low coverage = opportunity
  // Declining + well-covered = don't bother
  if (phase === 'accelerating' && yourPostCount < 2) return 'strong_buy';
  if (phase === 'accelerating') return 'buy';
  if (phase === 'peak' && yourPostCount < 3) return 'buy';
  if (phase === 'peak') return 'hold';
  if (phase === 'decelerating') return 'sell'; // Unless contrarian angle
  if (phase === 'declining') return 'strong_sell';
  return 'hold';
}
```

### Auto-Entity Discovery

Entities to track are automatically discovered from signals and content:

```typescript
async function discoverNewEntities(
  db: SupabaseClient,
  llm: LLMClient
): Promise<TrendEntity[]> {
  // 1. Get entities mentioned in recent content_memory entries
  const { data: recentMemory } = await db.from('content_memory')
    .select('entities')
    .gte('published_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .limit(50);

  // 2. Count entity mentions
  const entityCounts = new Map<string, number>();
  recentMemory.forEach(row =>
    row.entities.forEach((e: Entity) => {
      const key = `${e.name}::${e.type}`;
      entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
    })
  );

  // 3. Entities mentioned 3+ times in last 2 weeks that aren't tracked yet
  const { data: existingEntities } = await db.from('trend_entities').select('name');
  const existingNames = new Set(existingEntities.map(e => e.name));

  const newEntities: TrendEntity[] = [];
  for (const [key, count] of entityCounts) {
    if (count < 3) continue;
    const [name, type] = key.split('::');
    if (existingNames.has(name)) continue;

    // Use LLM to determine tracking metadata (GitHub repo, npm package, etc.)
    const meta = await llm.generateJSON<EntityMeta>({
      systemPrompt: 'Given a technology/company name, identify its GitHub repo (if any) and npm/PyPI package name (if any).',
      userPrompt: `Entity: ${name} (type: ${type}). What is the main GitHub repo and npm/PyPI package?`,
      maxTokens: 100,
      temperature: 0,
    });

    const entity = {
      name,
      type,
      github_repo: meta.githubRepo,
      npm_package: meta.npmPackage,
      pypi_package: meta.pypiPackage,
      tracking_since: new Date(),
      is_active: true,
    };

    await db.from('trend_entities').insert(entity);
    newEntities.push(entity);
  }

  return newEntities;
}
```

---

## Component 3: Collision Detection

### Detector

Runs daily after signals are ingested. Looks for cross-domain connections.

```typescript
async function detectCollisions(
  db: SupabaseClient,
  llm: LLMClient
): Promise<Collision[]> {

  // 1. Get recent signals (last 48 hours) grouped by source type
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const { data: signals } = await db.from('content_signals')
    .select('*')
    .gte('ingested_at', cutoff.toISOString())
    .order('scored_relevance', { ascending: false })
    .limit(30); // Top 30 signals by relevance

  if (signals.length < 2) return [];

  // 2. Method 1: Entity overlap across different source types
  const entityCollisions = findEntityOverlapCollisions(signals);

  // 3. Method 2: LLM-assisted connection detection
  //    Send top signals to LLM and ask for non-obvious connections
  const llmCollisions = await llm.generateJSON<{ collisions: RawCollision[] }>({
    systemPrompt: COLLISION_DETECTOR_SYSTEM_PROMPT,
    userPrompt: `
Recent signals (last 48 hours):
${signals.map((s, i) => `[${i}] (${s.source_type}) ${s.title}: ${s.summary}`).join('\n')}

Find pairs of signals that are secretly part of the same story. Look for:
- Tech event + financial market reaction
- Technology + regulatory/political implication
- Two events in different domains caused by the same underlying shift
- Historical pattern repeating in a new domain

Only report HIGH-CONFIDENCE connections. Don't force connections that don't exist.
`,
    maxTokens: 600,
    temperature: 0.4,
  });

  // 4. Store collisions
  const collisions: Collision[] = [
    ...entityCollisions,
    ...llmCollisions.collisions.map(raw => ({
      id: generateId(),
      type: raw.type,
      signalA: { id: signals[raw.indexA].id, title: signals[raw.indexA].title, domain: signals[raw.indexA].source_type },
      signalB: { id: signals[raw.indexB].id, title: signals[raw.indexB].title, domain: signals[raw.indexB].source_type },
      connectionNarrative: raw.narrative,
      storyPotential: raw.potential,
      suggestedAngle: raw.angle,
      createdAt: new Date(),
    })),
  ];

  for (const collision of collisions) {
    await db.from('collisions').insert(collision);
  }

  return collisions;
}

function findEntityOverlapCollisions(signals: any[]): Collision[] {
  const collisions: Collision[] = [];

  // Group signals by source type
  const bySource = new Map<string, typeof signals>();
  signals.forEach(s => {
    const group = bySource.get(s.source_type) || [];
    group.push(s);
    bySource.set(s.source_type, group);
  });

  // Look for entity mentions across different source types
  // Simplified: check if the same company/technology name appears
  // in signals from different sources
  const sourceTypes = Array.from(bySource.keys());
  for (let i = 0; i < sourceTypes.length; i++) {
    for (let j = i + 1; j < sourceTypes.length; j++) {
      const groupA = bySource.get(sourceTypes[i])!;
      const groupB = bySource.get(sourceTypes[j])!;

      for (const a of groupA) {
        for (const b of groupB) {
          const overlap = findTextOverlap(a.title + ' ' + a.summary, b.title + ' ' + b.summary);
          if (overlap.length > 0) {
            collisions.push({
              id: generateId(),
              type: classifyCollisionType(sourceTypes[i], sourceTypes[j]),
              signalA: { id: a.id, title: a.title, domain: sourceTypes[i] },
              signalB: { id: b.id, title: b.title, domain: sourceTypes[j] },
              connectionNarrative: `Both mention: ${overlap.join(', ')}`,
              storyPotential: 'medium',
              suggestedAngle: 'hidden_connection',
              createdAt: new Date(),
            });
          }
        }
      }
    }
  }

  return collisions;
}

const COLLISION_DETECTOR_SYSTEM_PROMPT = `You detect hidden connections between news signals from different domains.

A "collision" is when two apparently unrelated events are actually part of the same story. Examples:
- A tech company raises $5B (tech signal) + EU announces AI regulation deadline (policy signal) → The raise was timed to beat regulation
- Open-source model matches GPT-4 (tech signal) + NVDA stock drops 3% (finance signal) → Market pricing in commoditization risk
- New AI tool automates legal review (tech signal) + Legal tech startup lays off 30% (industry signal) → Same disruption wave

Output JSON: { collisions: [{ indexA, indexB, type, narrative, potential: "high"|"medium"|"low", angle }] }
Only include genuine connections. Empty array is fine if nothing connects.`;
```

---

## Database Schema

```sql
-- Migration: 00005_persistent_intelligence.sql

-- Enable vector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Content Memory (semantic index of published content)
CREATE TABLE content_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE UNIQUE,
  platform TEXT,
  pillar_slug TEXT,
  embedding vector(1536),
  entities JSONB DEFAULT '[]',
  topics TEXT[] DEFAULT '{}',
  predictions JSONB DEFAULT '[]',
  stances JSONB DEFAULT '[]',
  platform_metrics JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity index
CREATE INDEX idx_content_memory_embedding ON content_memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_content_memory_published ON content_memory(published_at DESC);

-- pgvector similarity search function
CREATE OR REPLACE FUNCTION match_content_memory(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content_item_id uuid,
  platform text,
  pillar_slug text,
  entities jsonb,
  topics text[],
  predictions jsonb,
  stances jsonb,
  published_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.content_item_id,
    cm.platform,
    cm.pillar_slug,
    cm.entities,
    cm.topics,
    cm.predictions,
    cm.stances,
    cm.published_at,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM content_memory cm
  WHERE 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trend Entities (what we're tracking over time)
CREATE TABLE trend_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,              -- 'technology' | 'company' | 'concept'
  github_repo TEXT,                -- e.g., 'langchain-ai/langchain'
  npm_package TEXT,                -- e.g., 'langchain'
  pypi_package TEXT,               -- e.g., 'langchain'
  tracking_since TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trend Data Points (time-series metrics)
CREATE TABLE trend_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES trend_entities(id) ON DELETE CASCADE,
  measured_at DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, measured_at)
);

CREATE INDEX idx_trend_data_entity_date ON trend_data_points(entity_id, measured_at DESC);

-- Trend Analyses (computed phase/velocity per entity)
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

-- Cross-Domain Collisions
CREATE TABLE collisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  signal_a JSONB NOT NULL,
  signal_b JSONB NOT NULL,
  connection_narrative TEXT NOT NULL,
  story_potential TEXT DEFAULT 'medium',
  suggested_angle TEXT,
  status TEXT DEFAULT 'detected',   -- 'detected' | 'used' | 'dismissed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_collisions_status ON collisions(status);
CREATE INDEX idx_collisions_created ON collisions(created_at DESC);

-- RLS policies
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

---

## API Routes

### Content Memory

```
POST /api/memory/index/{contentItemId}
  → Indexes a specific content item (manual trigger or backfill)

GET /api/memory/similar?embedding={base64}&threshold=0.8&limit=5
  → Find similar content (used by other layers)

GET /api/memory/entity/{name}
  → Find all content mentioning an entity

GET /api/memory/predictions?status=open
  → List all open predictions (for callback detection)
```

### Trends

```
GET /api/trends
  → List all tracked entities with latest analysis

GET /api/trends/{entityId}
  → Full trend data for one entity (chart data, phase, velocity)

POST /api/trends/collect
  → Trigger daily data collection (cron or manual)

POST /api/trends/analyze
  → Trigger trend analysis (runs after collection)

POST /api/trends/entities
  Body: { name, type, githubRepo?, npmPackage?, pypiPackage? }
  → Manually add an entity to track
```

### Collisions

```
GET /api/collisions?status=detected&limit=10
  → Get recent unprocessed collisions

POST /api/collisions/{id}/status
  Body: { status: 'used' | 'dismissed' }
  → Mark a collision as used or dismissed
```

---

## Cron Jobs

```
# Daily at 4:00 AM — collect trend data
POST /api/cron/trend-collect

# Daily at 4:30 AM — analyze trends + discover new entities
POST /api/cron/trend-analyze

# Daily at 5:00 AM — detect collisions from last 48h of signals
POST /api/cron/collision-detect

# On content status change — index to content memory
# (Triggered by database webhook or API middleware, not cron)
```

---

## Integration Points

### How other layers query this component

Layer 2 (Investigation Swarm) populates `InvestigationContext`:
```typescript
// Before dispatching swarm, enrich context with memory data
const context: InvestigationContext = {
  contentHistory: await findByEntity(db, extractMainEntity(signal)),
  trendData: await getTrendData(db, extractMainEntity(signal)),
};
const brief = await dispatchSwarm(signal, config, db, llm, context);
```

Layer 3 (Creation Engine) checks for duplicate coverage:
```typescript
// Before generating angles, check if we've covered this
const similar = await findSimilarContent(db, signalEmbedding, 0.85);
if (similar.length > 0) {
  // Add note to angle generator: "You've covered similar topics before"
  // Suggest follow-up or contrarian angle instead of fresh take
}
```

Layer 4 (Daily Menu) assembles callback items:
```typescript
// Check for resolved predictions
const predictions = await findOpenPredictions(db);
// Match predictions against recent signals to detect resolutions
```

---

## Implementation Steps (for planning phase)

1. Create `packages/memory` package with types
2. Enable pgvector extension in Supabase
3. Create DB migration for all Phase 3 tables
4. Implement Content Memory indexer (embedding + extraction)
5. Implement pgvector similarity search RPC function
6. Implement Content Memory query functions (similar, entity, predictions, gaps)
7. Implement Trend Collector (GitHub, npm, PyPI, HN data fetchers)
8. Implement Trend Analyzer (velocity, acceleration, phase detection)
9. Implement auto-entity discovery
10. Implement Collision Detector (entity overlap + LLM-assisted)
11. Create API routes for memory, trends, collisions
12. Create cron routes for daily trend collection + collision detection
13. Add content memory indexing hook to content status change flow
14. Tests for each component
