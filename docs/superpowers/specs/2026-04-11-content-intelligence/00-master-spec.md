# Content Intelligence System — Master Spec

**Date:** 2026-04-11
**Status:** Approved
**Goal:** Transform InfluenceAI from "signal in, generic draft out" to a cross-domain research + narrative content engine that produces posts no other influencer can replicate.

---

## Problem Statement

The current system ingests signals from GitHub/RSS/HackerNews, runs them through a template, and produces generic LLM drafts that sound like every other AI influencer. Three pain points:

1. **Depth & originality** — posts don't stand out; they read like everyone else's content
2. **Signal-to-post quality** — LLM drafts are too generic, requiring heavy manual rewriting
3. **Consistency & volume** — can't sustain 1+/day pace across platforms because creation takes too long

## Solution

A 4-layer intelligence system that sits between signal ingestion and content generation:

```
Layer 4: Daily Menu (Conversation Starter Factory)
  → Morning dashboard: curated, prioritized, actionable menu
  → Interactive "Investigate Now" for breaking news

Layer 3: Creation Engine
  → Angle-First Drafting: 4-5 angle cards per signal, you pick
  → Storytelling Engine: narrative arc wrapping (not report format)
  → Voice DNA: learns your style from every edit

Layer 2: Investigation Swarm
  → 6 specialized agents research each signal across domains
  → Tech, Finance, Geopolitics, Industry, DevEco, History
  → Synthesis Agent merges findings into a Research Brief

Layer 1.5: Persistent Intelligence (background, always running)
  → Content Memory: semantic index of everything you've published
  → Trend Trajectory: tracks metrics over time, detects phase changes
  → Perspective Mashup: finds cross-domain collisions

Layer 1: Existing Pipeline (unchanged)
  → Signal Ingestion → Dedup → Relevance Scoring → Filter
```

## Architecture Principles

### Decoupled layers communicating via database

Layers do NOT call each other directly. Each layer reads from a table and writes to a table. This means:
- Any layer can fail without breaking the system
- Any layer can be re-run independently
- Layers can be developed and deployed independently

```
Layer 1 writes → content_signals
Layer 2 reads content_signals, writes → research_briefs, investigation_runs
Layer 1.5 reads content_items, writes → content_memory, trend_data_points, collisions
Layer 3 reads research_briefs + voice_profiles, writes → angle_cards, content_items
Layer 4 reads everything, writes → daily_menus
```

### Graceful degradation

Every layer falls back to the layer below if it fails:

| Failure | Fallback |
|---------|----------|
| Investigation Swarm times out | Generate from raw signal data (current behavior) |
| Individual agent fails (e.g., Finance API down) | Brief assembled from other agents; `coverage` field records what contributed |
| Voice DNA has no data (day 1) | Use platform format templates (current behavior) |
| Trend Trajectory has no data for topic | Skip trajectory angle card; other angles still generated |
| Content Memory is empty | No callbacks or duplicate detection; system works, just less smart |
| Collision Detector finds nothing | No collision items in menu; not a failure |

### No circular dependencies

```
Layer 1 → depends on: external APIs only
Layer 2 → depends on: Layer 1 output (content_signals table)
Layer 1.5 → depends on: content_items (written by Layer 3) — background, async
Layer 3 → depends on: Layer 2 output (research_briefs), optionally Layer 1.5
Layer 4 → depends on: all outputs (read-only aggregation)
```

### Hybrid trigger model (Option C)

Two trigger modes using the same agents and code:

- **Batch (overnight):** Cron runs Layer 1→2→3→4 sequentially. Auto-selects best angle per platform. Results appear in morning Daily Menu.
- **Interactive ("Investigate Now"):** User clicks button on a signal. Same Layer 2→3 runs immediately. User selects angle manually. Progress streams to UI.

The only difference is timing and who selects the angle (auto vs. human).

---

## Shared Types

These types are used across multiple phases. Each phase spec references them.

### Signal Types (existing, unchanged)

```typescript
type SignalSource = 'github' | 'rss' | 'hackernews' | 'arxiv' | 'reddit' | 'huggingface';
type Platform = 'linkedin' | 'instagram' | 'youtube' | 'twitter';

interface Signal {
  sourceType: SignalSource;
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  metadata: Record<string, unknown>;
  fetchedAt: Date;
}

interface ScoredSignal extends Signal {
  score: number;
  scoreReason?: string;
}
```

### Investigation Types (Phase 1)

```typescript
interface AgentBrief {
  agentId: string;
  status: 'success' | 'partial' | 'failed';
  findings: Finding[];
  narrativeHooks: string[];
  confidence: number;            // 0-1
  sources: SourceCitation[];
  rawData?: Record<string, unknown>;
}

interface Finding {
  type: 'fact' | 'comparison' | 'prediction' | 'contradiction' | 'trend';
  headline: string;
  detail: string;
  importance: 'high' | 'medium' | 'low';
  data?: Record<string, unknown>;
}

interface SourceCitation {
  title: string;
  url: string;
  source: string;
  accessedAt: Date;
}

interface ResearchBrief {
  id: string;
  signalId: string;
  signal: ScoredSignal;
  topFindings: Finding[];
  connections: Connection[];
  suggestedAngles: string[];
  unusualFact: string;
  agentBriefs: AgentBrief[];
  coverage: {
    dispatched: number;
    succeeded: number;
    failed: number;
    agents: string[];
  };
  createdAt: Date;
  expiresAt: Date;
}

interface Connection {
  findingA: Finding;
  findingB: Finding;
  relationship: string;
  narrativeHook: string;
}
```

### Creation Types (Phase 2)

```typescript
type AngleType =
  | 'contrarian' | 'practical' | 'prediction'
  | 'historical_parallel' | 'hidden_connection' | 'career_impact'
  | 'unraveling' | 'david_vs_goliath' | 'financial_signal'
  | 'geopolitical_chess';

interface AngleCard {
  id: string;
  researchBriefId: string;
  angleType: AngleType;
  hook: string;
  thesis: string;
  supportingFindings: Finding[];
  domainSource: string;
  estimatedEngagement: 'high' | 'medium' | 'low';
  reasoning: string;
  status: 'generated' | 'selected' | 'dismissed';
  createdAt: Date;
}

interface StoryArc {
  id: string;
  name: string;
  structure: StoryBeat[];
  bestFor: AngleType[];
  platformFit: Record<Platform, number>;
}

interface StoryBeat {
  name: string;
  instruction: string;
  maxLength: string;
}

interface VoiceProfile {
  id: string;
  version: number;
  confidence: number;
  editsAnalyzed: number;          // Fix 3: total edits processed by analyzer
  styleRules: StyleRule[];
  vocabularyPreferences: { preferred: string[]; avoided: string[] };
  openingPatterns: string[];
  ctaPatterns: string[];
  toneDescriptor: string;
  stances: Stance[];
  exemplarPosts: ExemplarPost[];  // Fix 3: stored as JSONB, not UUID[]
  updatedAt: Date;
}

interface StyleRule {
  rule: string;
  evidence: string;
  strength: number;
}

// Fix 14: Split into ExtractedStance (from content memory) and Stance (in voice profile)
interface ExtractedStance {
  topic: string;
  position: string;
}

interface Stance extends ExtractedStance {
  confidence: number;
  lastExpressed: Date;
}

interface ExemplarPost {
  contentItemId: string;
  platform: Platform;
  title: string;
  body: string;
  qualityScore: number;
  editDistance: number;
}
```

### Persistent Intelligence Types (Phase 3)

```typescript
interface ContentMemoryEntry {
  id: string;
  contentItemId: string;
  platform: Platform;
  pillar: string;
  embedding: number[];
  entities: Entity[];
  topics: string[];
  predictions: Prediction[];
  stances: Stance[];
  platformMetrics?: { views?: number; likes?: number; comments?: number };
  publishedAt: Date;
}

interface Entity {
  name: string;
  type: 'company' | 'person' | 'technology' | 'concept' | 'regulation';
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface Prediction {
  statement: string;
  timeframe?: string;
  confidence: string;
  status: 'open' | 'correct' | 'wrong' | 'partially_correct';
  resolvedAt?: Date;
  resolutionNote?: string;
}

interface TrendEntity {
  id: string;
  name: string;
  type: 'technology' | 'company' | 'concept';
  trackingSince: Date;
}

interface TrendAnalysis {
  entityId: string;
  entityName: string;
  phase: 'emerging' | 'accelerating' | 'peak' | 'decelerating' | 'plateau' | 'declining';
  velocity: number;
  acceleration: number;
  patternMatch?: { historicalParallel: string; similarity: number; whatHappenedNext: string };
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  chartData: { date: string; value: number }[];
  analyzedAt: Date;
}

interface Collision {
  id: string;
  type: 'tech_finance' | 'tech_politics' | 'tech_culture' | 'tech_history' | 'cross_industry';
  signalA: { id: string; title: string; domain: string };
  signalB: { id: string; title: string; domain: string };
  connectionNarrative: string;
  storyPotential: 'high' | 'medium' | 'low';
  suggestedAngle: AngleType;
  createdAt: Date;
}
```

### Daily Menu Types (Phase 4)

```typescript
type MenuItemReadiness =
  | 'ready_to_post' | 'pick_an_angle' | 'story_seed'
  | 'callback' | 'trend_alert';

type MenuItemType =
  | 'researched_signal' | 'collision' | 'callback'
  | 'prediction_check' | 'trend_change' | 'coverage_gap';

interface DailyMenu {
  id: string;
  date: string;
  generatedAt: Date;
  items: DailyMenuItem[];
  stats: {
    signalsProcessed: number;
    briefsGenerated: number;
    draftsReady: number;
    callbacksFound: number;
    trendAlerts: number;
    collisionsDetected: number;
  };
}

interface DailyMenuItem {
  id: string;
  priority: number;
  readiness: MenuItemReadiness;
  type: MenuItemType;
  title: string;
  reason: string;
  signalId?: string;
  researchBriefId?: string;
  angleCards?: AngleCard[];
  draftId?: string;
  collisionId?: string;
  predictionId?: string;
  trendAnalysisId?: string;
  estimatedEffort: string;
  platforms: Platform[];
  pillar: string;
}

// Fix 18: CallbackItem type (used in Phase 4 overnight batch + menu assembly)
interface CallbackItem {
  type: 'callback';
  prediction: { contentItemId: string; prediction: Prediction };
  resolution: 'correct' | 'wrong' | 'partial';
  evidence: string;
}

// Fix 16: Discriminated union for createContent() return (replaces null! return)
type CreationResult =
  | { phase: 'angles_only'; angleCards: AngleCard[] }
  | { phase: 'complete'; angleCards: AngleCard[]; selectedAngle: AngleCard; storyArc: StoryArc; draft: Draft };

interface Draft {
  title: string;
  body: string;
  qualityScore: number;
  model: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}
```

---

## Phase Breakdown

| Phase | Spec | What It Delivers | Depends On |
|-------|------|-----------------|------------|
| 1 | `01-investigation-swarm.md` | 6 investigation agents + dispatcher + synthesis + research briefs | Existing pipeline (Layer 1) |
| 2 | `02-creation-engine.md` | Angle cards + Storytelling Engine + Voice DNA | Phase 1 output (research_briefs) |
| 3 | `03-persistent-intelligence.md` | Content Memory + Trend Trajectory + Collision Detection | Phase 2 output (content_items) |
| 4 | `04-daily-menu.md` | Morning menu UI + Interactive investigate mode + overnight batch | Phases 1-3 |

**Each phase is independently shippable.** After Phase 1 alone, the system already produces dramatically better content than today. Each subsequent phase adds a new capability.

### Cross-Cutting Specs

| Spec | Purpose |
|------|---------|
| `05-errata-and-fixes.md` | 6 blocking + 20 high-priority corrections to Phase 1-4 specs (must be applied during implementation) |
| `06-ui-comprehensive.md` | Full UI specification: 7 page designs, 30 new components, navigation updates, design standards |
| `07-cost-and-testing.md` | LLM cost model (~$29/month), duration estimates, 154-test e2e strategy with mock infrastructure |

---

## New Package Structure

```
packages/
  intelligence/              ← NEW: Investigation Swarm (Phase 1)
    src/
      agents/                ← Individual investigation agents
      dispatcher.ts          ← Swarm orchestrator
      synthesis.ts           ← Brief merger
      types.ts               ← Shared agent types
  creation/                  ← NEW: Creation Engine (Phase 2)
    src/
      angles/                ← Angle generator + types
      storytelling/          ← Story arc engine
      voice/                 ← Voice DNA tracker + analyzer
      types.ts
  memory/                    ← NEW: Persistent Intelligence (Phase 3)
    src/
      content-memory.ts      ← Semantic indexing + queries
      trends.ts              ← Trend data collector + analyzer
      collisions.ts          ← Cross-domain collision detector
      types.ts
  pipelines/                 ← EXISTING: modified to call intelligence layer
  integrations/              ← EXISTING: new source adapters added here
  core/                      ← EXISTING: shared types added
  database/                  ← EXISTING: new migrations per phase
```

---

## New Database Tables (by phase)

### Phase 1: Investigation Swarm
- `investigation_runs` — tracks swarm execution per signal
- `agent_briefs` — individual agent outputs
- `research_briefs` — merged synthesis output

### Phase 2: Creation Engine
- `angle_cards` — generated angle options per brief
- `content_edits` — before/after tracking for Voice DNA
- `voice_profiles` — extracted style rules and exemplars

### Phase 3: Persistent Intelligence
- `content_memory` — semantic embeddings + entity/prediction extraction (pgvector)
- `trend_entities` — tracked entities
- `trend_data_points` — time-series metrics
- `trend_analyses` — computed phase/velocity/pattern data
- `collisions` — detected cross-domain connections

### Phase 4: Daily Menu
- `daily_menus` — generated menu per day (items stored as JSONB array, Fix 5)

---

## Environment Variables (new)

| Variable | Phase | Purpose |
|----------|-------|---------|
| `YAHOO_FINANCE_API_KEY` | 1 | Finance Agent — stock data |
| `CRUNCHBASE_API_KEY` | 1 | Finance Agent — funding data (optional) |
| `REDDIT_CLIENT_ID` | 1 | DevEco Agent — Reddit sentiment |
| `REDDIT_CLIENT_SECRET` | 1 | DevEco Agent — Reddit sentiment |
| `EMBEDDING_MODEL` | 3 | Content Memory — embedding model (default: text-embedding-3-small) |
| `ALPHA_VANTAGE_API_KEY` | 1 | Finance Agent — stock data fallback (optional, Fix 17) |
| `PRODUCTHUNT_TOKEN` | 1 | Industry Agent — ProductHunt data (optional, Fix 24) |

All other data sources (GitHub, HN, RSS, ArXiv, npm, PyPI, SEC EDGAR) are free/public APIs using existing `GITHUB_TOKEN` or no auth.

---

## Success Criteria

1. **Depth**: Every generated post cites at least 2 specific facts from investigation agents (not just signal title)
2. **Originality**: System generates 4-5 distinct angles per signal; no two posts on the same signal use the same angle
3. **Voice**: After 20+ edits, Voice DNA confidence > 0.3 and draft edit distance decreases measurably
4. **Volume**: Daily Menu presents 5-7 actionable items each morning; 2-3 are "ready to post" requiring < 30 seconds each
5. **Robustness**: Any single agent/layer failure does not prevent content generation; system degrades gracefully
