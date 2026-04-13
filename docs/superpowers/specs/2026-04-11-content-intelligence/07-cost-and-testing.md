# Cost Estimation & Testing Strategy

**Parent:** `00-master-spec.md`
**Purpose:** LLM cost model per operation, monthly budget projection, and complete e2e testing strategy with mock infrastructure.

---

## Part 1: LLM Call Catalog

Every LLM call in the system, with token estimates and frequency.

### Phase 1: Investigation Swarm

| Call ID | Component | Input Tokens | Output Tokens | Temp | Frequency |
|---------|-----------|-------------|---------------|------|-----------|
| P1-1 | Tech Agent | 2,250 | 800 | 0.3 | Always (1x/signal) |
| P1-2 | Geopolitics Agent | 1,100 | 600 | 0.3 | ~40% of signals |
| P1-3 | Industry Agent | 1,000 | 600 | 0.4 | ~50% of signals |
| P1-4 | History Agent | 1,100 | 500 | 0.5 | Always (1x/signal) |
| P1-5 | DevEco Agent | 1,100 | 600 | 0.3 | ~60% of signals |
| P1-6 | Finance Agent | 900 | 600 | 0.3 | ~30% of signals |
| P1-7 | Synthesis Agent | 1,250 | 1,000 | 0.4 | Always (1x/signal) |

### Phase 2: Creation Engine

| Call ID | Component | Input Tokens | Output Tokens | Temp | Frequency |
|---------|-----------|-------------|---------------|------|-----------|
| P2-1 | Angle Generator | 1,000 | 1,200 | 0.7 | 1x per brief × platform |
| P2-2 | Story Plan (step 1) | 770 | 400 | 0.4 | 1x per selected angle |
| P2-3 | Full Draft (step 2) | 1,100-1,400 | 1,500 | 0.7 | 1x per selected angle |
| P2-4 | Voice DNA Analyzer | 12,800 | 800 | 0.3 | ~3x per month |

### Phase 3: Persistent Intelligence

| Call ID | Component | Input Tokens | Output Tokens | Temp | Model | Frequency |
|---------|-----------|-------------|---------------|------|-------|-----------|
| P3-1 | Content Memory Extraction | 850 | 500 | 0.2 | GPT-4o | 1x per content item |
| P3-1b | Embedding Generation | 400 | — | — | text-embedding-3-small | 1x per content item |
| P3-2 | Collision Detector | 2,700 | 600 | 0.4 | GPT-4o | 1x per day |
| P3-3 | Entity Discovery | 120 | 100 | 0 | GPT-4o | ~0.5x per day |

### Phase 4: Daily Menu

| Call ID | Component | Input Tokens | Output Tokens | Temp | Frequency |
|---------|-----------|-------------|---------------|------|-----------|
| P4-1 | Callback Detection | 2,600 | 400 | 0.2 | 1x per day |

---

## Part 2: Cost Per Signal

A "typical" signal triggers 4 agents (Tech + History always, plus 2 conditional). Using GPT-4o pricing: **$2.50/1M input, $10/1M output**.

### Investigation Phase (per signal)

| Step | Input Cost | Output Cost | Total |
|------|-----------|-------------|-------|
| Tech Agent (2,250 in / 800 out) | $0.0056 | $0.0080 | $0.0136 |
| History Agent (1,100 / 500) | $0.0028 | $0.0050 | $0.0078 |
| DevEco Agent (1,100 / 600) | $0.0028 | $0.0060 | $0.0088 |
| Industry Agent (1,000 / 600) | $0.0025 | $0.0060 | $0.0085 |
| Synthesis (1,250 / 1,000) | $0.0031 | $0.0100 | $0.0131 |
| **Subtotal** | | | **$0.0518** |

### Creation Phase (per signal, 2 platforms)

| Step | Per Platform | × 2 Platforms |
|------|-------------|---------------|
| Angle Generator ($0.0145) | $0.0145 | $0.0290 |
| Story Plan ($0.0059) | $0.0059 | $0.0118 |
| Full Draft ($0.0178) | $0.0178 | $0.0355 |
| **Subtotal** | | **$0.0763** |

### Total Per Signal: **~$0.13**

Full 6-agent signal: **~$0.15** (+$0.027 for Finance + Geopolitics)

---

## Part 3: Monthly Cost Estimate

### Assumptions
- 1 overnight batch/day (5 signals, 2 platforms each)
- 2 interactive investigations/day (1 signal, 2 platforms each)
- 30 days/month
- Voice analysis: 3x/month
- ~14 content items indexed per day

### Breakdown

| Category | Events/Month | Cost Each | Monthly |
|----------|-------------|-----------|---------|
| Overnight batches (5 signals × 30 days) | 150 signals | $0.13 | $19.50 |
| Batch overhead (collision + callback + trends) | 30 days | $0.023 | $0.69 |
| Interactive investigations | 60 signals | $0.13 | $7.80 |
| Content memory indexing (14/day × 30) | 420 items | $0.003 | $1.26 |
| Embeddings (420 items × 400 tokens) | 168K tokens | $0.02/1M | $0.003 |
| Voice DNA analysis | 3 runs | $0.04 | $0.12 |
| Entity discovery | ~15 entities | $0.0004 | $0.006 |
| **Monthly total** | | | **~$29** |

### Sensitivity Analysis

| Scenario | Monthly Cost |
|----------|-------------|
| Minimal: 3 signals/batch, 0 interactive, 1 platform | ~$8 |
| **Standard: as designed** | **~$29** |
| Heavy: 10 signals/batch, 5 interactive/day | ~$85 |
| Using Claude Sonnet (3x output cost vs GPT-4o) | ~$55 |
| Using GPT-4o-mini (~10x cheaper) for agents only | ~$12 |

### Cost Optimization Levers

1. **Use cheaper model for agents, expensive model for synthesis + drafts.** Agents do factual extraction (GPT-4o-mini is fine). Synthesis and drafts need quality (GPT-4o). Saves ~40%.
2. **Reduce agents per signal.** 3 agents instead of 4 saves ~25% of swarm cost.
3. **Cache agent results.** If the same entity (e.g., "OpenAI") appears in multiple signals within 24h, reuse the Finance/Geopolitics agent briefs.
4. **Batch embeddings.** Instead of 14 individual embedding calls/day, batch them into 1 call with multiple inputs.

---

## Part 4: Duration Estimates

### Per-Signal Investigation (wall clock)

| Step | Duration | Notes |
|------|----------|-------|
| Agent dispatch (parallel) | 5-15s | Bounded by slowest agent |
| External API calls (within agents) | 2-8s | GitHub, Yahoo Finance, HN, etc. |
| LLM calls per agent | 2-5s | GPT-4o typical latency |
| Synthesis LLM call | 3-5s | Larger output |
| Angle generation | 3-5s | Per platform |
| Story plan + draft | 5-8s | Two sequential LLM calls |
| **Total per signal** | **20-40s** | Parallel agents help significantly |

### Overnight Batch (Option B: parallel signals)

| Step | Duration | Notes |
|------|----------|-------|
| Pipeline runs (3 pipelines) | 30-60s | Existing, sequential |
| Investigation (5 signals, parallel) | 30-45s | Bounded by slowest signal |
| Creation (10 drafts, parallel per signal) | 40-60s | 2 platforms per signal |
| Trend collection + analysis | 20-30s | API calls to GitHub/npm/HN |
| Collision + callback detection | 10-15s | One LLM call each |
| Menu assembly | 2-5s | DB queries only |
| **Total batch** | **~150-220s** | Fits in 300s Vercel limit |

### Interactive Investigation (user-facing)

| Step | Duration | User Sees |
|------|----------|-----------|
| Agent dispatch start | 0s | Progress indicator appears |
| First agent completes | 5-8s | First checkmark in progress |
| All agents complete | 10-20s | Brief appears |
| Angle cards generated | 15-25s | Angle picker appears |
| User selects angle | (user time) | — |
| Draft generated | 20-33s from start | Draft preview appears |

**User wait time: ~25-35s** from click to seeing angle cards. Draft adds another 5-8s after selection.

---

## Part 5: E2E Testing Strategy

### Testing Principles

1. **All LLM calls are mocked** in unit and integration tests — $0 token cost
2. **External APIs mocked** via MSW (Mock Service Worker)
3. **One smoke test suite** uses real LLM — gated by env var, runs on main branch CI only
4. **Each phase is independently testable** — seed input table, assert output table
5. **Phase handoff tests** verify the contract between layers

### Mock Infrastructure

#### LLM Mock (`packages/intelligence/src/__mocks__/llm-mock.ts`)

```typescript
// Routes to fixture JSON based on system prompt content
export function createMockLLMClient(): LLMClient {
  return {
    generateJSON: vi.fn().mockImplementation((params) => {
      if (params.systemPrompt.includes('research synthesis'))
        return import('../__fixtures__/synthesis-response.json');
      if (params.systemPrompt.includes('content strategist'))
        return import('../__fixtures__/angle-response.json');
      if (params.systemPrompt.includes('content extraction'))
        return import('../__fixtures__/memory-extraction-response.json');
      // ... one fixture per LLM call type
      return { content: 'mock response', qualityScore: 7 };
    }),
    generateWithQuality: vi.fn().mockResolvedValue({
      content: 'Mock draft content about AI...',
      qualityScore: 8,
      model: 'gpt-4o',
      usage: { promptTokens: 500, completionTokens: 800, totalTokens: 1300 },
    }),
    createEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  };
}
```

#### External API Mock (`packages/intelligence/src/__mocks__/api-handlers.ts`)

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // GitHub
  http.get('https://api.github.com/repos/*/readme', () =>
    HttpResponse.json({ content: btoa('# Mock README\nThis is a test.') })),
  http.get('https://api.github.com/repos/*', () =>
    HttpResponse.json({ stargazers_count: 45000, forks_count: 3200, open_issues_count: 89 })),

  // Yahoo Finance
  http.get('https://query1.finance.yahoo.com/*', () =>
    HttpResponse.json({ chart: { result: [{ meta: { regularMarketPrice: 425.50 } }] } })),

  // HackerNews Algolia
  http.get('https://hn.algolia.com/api/v1/search*', () =>
    HttpResponse.json({ hits: [{ title: 'Mock HN story', points: 250 }], nbHits: 15 })),

  // npm
  http.get('https://api.npmjs.org/downloads/*', () =>
    HttpResponse.json({ downloads: 12000 })),

  // PyPI
  http.get('https://pypistats.org/api/*', () =>
    HttpResponse.json({ data: { last_week: 8500 } })),
];
```

#### DB Mock (for unit tests)

```typescript
// In-memory Supabase mock for unit tests
// For integration tests: use Supabase local dev stack
export function createMockSupabaseClient() {
  const store = new Map<string, any[]>();
  return {
    from: (table: string) => ({
      select: (cols?: string) => ({
        eq: (col: string, val: any) => ({
          single: () => ({ data: store.get(table)?.find(r => r[col] === val) }),
          order: () => ({ limit: (n: number) => ({ data: store.get(table)?.filter(r => r[col] === val).slice(0, n) }) }),
        }),
        gte: () => ({ order: () => ({ limit: () => ({ data: store.get(table) || [] }) }) }),
        limit: (n: number) => ({ data: (store.get(table) || []).slice(0, n) }),
      }),
      insert: (row: any) => { store.set(table, [...(store.get(table) || []), row]); return { data: row }; },
      upsert: (row: any) => { store.set(table, [...(store.get(table) || []), row]); return { data: row }; },
      update: (vals: any) => ({ eq: () => ({ data: vals }) }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: [] }),
  };
}
```

### Fixture Files

```
packages/intelligence/src/__fixtures__/
  tech-agent-response.json          — TechExtraction with 3 findings
  history-agent-response.json       — HistoryExtraction with 1 parallel match
  finance-agent-response.json       — FinanceExtraction with stock data
  deveco-agent-response.json        — DevEcoExtraction with npm/GitHub data
  synthesis-response.json           — SynthesisOutput: 5 ranked findings, 2 connections
  angle-response.json               — 5 diverse angle cards
  story-plan-response.json          — Beat-by-beat plan for Detective arc
  draft-with-quality.json           — { content: "full post...", qualityScore: 8 }
  memory-extraction-response.json   — Entities, topics, predictions, stances
  collision-response.json           — 2 detected collisions
  callback-response.json            — 1 resolved prediction
  voice-analysis-response.json      — StyleRules, vocabulary, tone, stances
```

---

### Test Suites by Phase

#### Suite 1: Investigation Swarm (~35 tests, ~45s)

```
Unit: agents/tech.test.ts
  ✓ extracts benchmarks from GitHub README content
  ✓ returns partial status when GitHub fetch fails
  ✓ produces at least 1 finding on valid input
  ✓ never throws — always returns AgentBrief

Unit: agents/history.test.ts
  ✓ matches signal to history entry by keyword
  ✓ returns hasParallel=false when no good match
  ✓ returns confidence > 0.5 when parallel found

Unit: agents/finance.test.ts
  ✓ maps company name to ticker via JSON lookup
  ✓ skips stock data for private companies
  ✓ handles Yahoo Finance API failure gracefully

Unit: agents/selector.test.ts
  ✓ always selects tech + history
  ✓ selects finance for funding keywords
  ✓ selects geopolitics for regulation keywords
  ✓ max 6 agents for fully triggering signal

Unit: synthesis.test.ts
  ✓ ranks findings by importance
  ✓ identifies cross-domain connections
  ✓ handles 2-6 agent briefs

Integration: dispatcher.test.ts
  ✓ dispatches selected agents in parallel
  ✓ handles mixed success/failure
  ✓ returns fallback brief when all fail
  ✓ respects per-agent timeout
  ✓ stores agent_briefs in DB
  ✓ stores investigation_run with status
  ✓ stores research_brief in DB

API: api/investigate.test.ts
  ✓ POST returns runId + briefId on success
  ✓ POST returns 404 for unknown signalId
  ✓ returns already_investigated for duplicate
  ✓ GET /status returns agent progress array
```

#### Suite 2: Creation Engine (~40 tests, ~55s)

```
Unit: angles/generator.test.ts
  ✓ generates exactly 5 angle cards
  ✓ all 5 have different angleType values
  ✓ each references valid finding indices
  ✓ handles out-of-range findingRefs (bounds check)
  ✓ autoSelectAngle picks highest engagement
  ✓ autoSelectAngle uses platform preference tiebreaker

Unit: storytelling/arcs.test.ts
  ✓ contrarian → Detective on LinkedIn
  ✓ prediction → Prophet on LinkedIn
  ✓ historical_parallel → Historian on YouTube
  ✓ fallback to Detective when no match

Unit: storytelling/engine.test.ts
  ✓ story plan produces beats matching arc structure
  ✓ full draft produces non-empty body
  ✓ qualityScore between 1-10
  ✓ voice injection added when confidence >= 0.3
  ✓ voice injection skipped when confidence < 0.3

Unit: voice/tracker.test.ts
  ✓ inserts edit when distance >= 10
  ✓ skips when distance < 10

Unit: voice/analyzer.test.ts
  ✓ throws when fewer than 5 edits
  ✓ confidence scales with edit count
  ✓ deactivates previous profile before insert
  ✓ marks edits as analyzed

Unit: voice/injector.test.ts
  ✓ returns empty string when confidence < 0.3
  ✓ includes only strong rules (strength >= 0.5)
  ✓ includes max 3 exemplar posts

Integration: pipeline.test.ts
  ✓ batch mode: returns selectedAngle + draft
  ✓ interactive: returns angleCards only when no selection
  ✓ stores angle_cards in DB
  ✓ draft stored as content_item pending_review
```

#### Suite 3: Persistent Intelligence (~30 tests, ~45s)

```
Unit: content-memory/indexer.test.ts
  ✓ generates embedding via createEmbedding()
  ✓ extracts entities, topics, predictions, stances
  ✓ upserts on conflict (no duplicates)
  ✓ uses published_at (not updated_at)

Unit: content-memory/queries.test.ts
  ✓ findSimilarContent calls RPC with correct params
  ✓ findByEntity returns matching entries
  ✓ findOpenPredictions returns only open status

Unit: trends/collector.test.ts
  ✓ fetches GitHub metrics for entities with repo
  ✓ skips GitHub for entities without repo
  ✓ handles PyPI API failure gracefully
  ✓ stores one data point per entity per day

Unit: trends/analyzer.test.ts
  ✓ phase detection: accelerating, peak, declining
  ✓ content signal: accelerating + uncovered = strong_buy
  ✓ skips entity with < 14 data points

Unit: collisions/detector.test.ts
  ✓ entity overlap detection across source types
  ✓ empty array for < 2 signals
  ✓ LLM collision detection with top 30 signals
```

#### Suite 4: Daily Menu & Batch (~25 tests, ~40s)

```
Unit: daily-menu.test.ts
  ✓ ready_to_post items score 80+ priority
  ✓ collision items get +15 bonus
  ✓ prediction_check get +20 bonus
  ✓ sorted by priority descending
  ✓ capped at 10 items
  ✓ stats reflect correct counts

Unit: callbacks.test.ts
  ✓ empty when no open predictions
  ✓ matches prediction against recent signals
  ✓ returns resolution status (correct/wrong/partial)

Integration: batch.test.ts
  ✓ full batch: 3 signals → briefs → drafts → menu
  ✓ drafts persisted to content_items (Fix #4 verified)
  ✓ menu has ready_to_post items
  ✓ handles step failure gracefully (continues to next step)
  ✓ completes within 60s (with mocks)

Integration: interactive.test.ts
  ✓ POST investigate → returns brief + angle cards
  ✓ second call returns cached brief
  ✓ POST creation/draft → draft in DB
```

#### Suite 5: Full E2E + Degradation (~20 tests, ~5 min)

```
e2e/full-pipeline.test.ts
  ✓ Signal → Swarm → Brief → Angles → Draft → Review → Memory Index
  ✓ All DB tables populated correctly along the way
  ✓ Menu reflects overnight batch results

e2e/degradation.test.ts
  ✓ All agents fail → fallback brief → creation continues
  ✓ Finance agent fails → 5-agent brief assembled
  ✓ Content memory indexing fails → batch continues
  ✓ Collision detection fails → empty collisions, batch continues

e2e/phase-handoffs.test.ts
  ✓ Phase 1 output valid input to Phase 2
  ✓ Phase 2 output triggers Phase 3 indexing
  ✓ Phase 3 trend_analyses appear in Phase 4 menu
  ✓ Phase 3 collisions appear in Phase 4 menu
```

#### Suite 6: Smoke Test — Real LLM (~$0.03/run, 5 min)

Gated by `SMOKE_TEST=true` env var. Runs on main branch CI only.

```
smoke/real-llm.test.ts
  ✓ Real signal → Tech + History → Synthesis → 1 angle → 1 draft
  ✓ Draft is non-empty, quality_score parseable
  ✓ Agent briefs have findings
  ✓ Token usage within ±20% of estimates
```

---

### Test Summary

| Suite | Tests | Duration | LLM Cost |
|-------|-------|----------|----------|
| Phase 1: Swarm | ~35 | 45s | $0 |
| Phase 2: Creation | ~40 | 55s | $0 |
| Phase 3: Intelligence | ~30 | 45s | $0 |
| Phase 4: Menu + Batch | ~25 | 40s | $0 |
| E2E + Degradation | ~20 | 5 min | $0 |
| Smoke (real LLM) | 4 | 5 min | ~$0.03 |
| **Total** | **~154** | **~12 min** | **~$0.03** |

### CI Configuration

```yaml
# Run on every PR
test:
  run: pnpm vitest --project packages/intelligence packages/creation packages/memory
  # All mocked, ~10 min, $0

# Run on main branch only
test-smoke:
  if: github.ref == 'refs/heads/main'
  env: SMOKE_TEST=true
  run: pnpm vitest --project packages/intelligence/smoke
  # Real LLM, ~5 min, ~$0.03/run
```

### Dependencies to Add

```json
// devDependencies across packages
{
  "vitest": "^3.x",
  "msw": "^2.x",
  "@vitest/coverage-v8": "^3.x"
}
```

MSW handles all HTTP mocking. No need for `nock` or other libraries. The mock LLM client is a simple vi.fn() wrapper — no special library needed.
