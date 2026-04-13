# Phase 1: Investigation Swarm — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 6 specialized investigation agents that research signals across domains (tech, finance, geopolitics, industry, dev ecosystem, history), dispatch them in parallel, and synthesize findings into a Research Brief stored in the database.

**Architecture:** New `packages/intelligence` package with agent interface, 6 agent implementations, parallel dispatcher with per-agent timeouts, LLM-powered synthesis, and graceful degradation. Communicates via `research_briefs` table — no direct coupling to other layers.

**Tech Stack:** TypeScript, OpenAI SDK (via LLMClient), Supabase (PostgreSQL), Vitest, MSW for external API mocking.

**Spec:** `docs/superpowers/specs/2026-04-11-content-intelligence/01-investigation-swarm.md`
**Testing:** `docs/superpowers/specs/2026-04-11-content-intelligence/07-cost-and-testing.md` (mock infrastructure patterns)
**Errata:** `docs/superpowers/specs/2026-04-11-content-intelligence/05-errata-and-fixes.md` (Fixes 1, 2, 7, 8, 10, 11, 18, 22)

---

## File Structure

```
packages/intelligence/
  package.json
  tsconfig.json
  src/
    types.ts                         ← All investigation types (AgentBrief, Finding, ResearchBrief, etc.)
    config.ts                        ← defaultSwarmConfig, SwarmConfig interface
    agents/
      base.ts                        ← InvestigationAgent interface, withTimeout(), isAllowedUrl()
      selector.ts                    ← selectAgents() — keyword-based agent selection
      tech.ts                        ← Tech Deep-Dive Agent (always runs)
      history.ts                     ← Historical Pattern Agent (always runs)
      finance.ts                     ← Finance Agent (conditional)
      dev-ecosystem.ts               ← Developer Ecosystem Agent (conditional)
      geopolitics.ts                 ← Geopolitics Agent (conditional)
      industry.ts                    ← Industry Impact Agent (conditional)
      registry.ts                    ← allAgents array, getAgent()
      data/
        company-tickers.json         ← Company name → stock ticker mapping
        eu-ai-act.json               ← EU AI Act articles by risk category
        tech-history.json            ← 50+ historical tech events with patterns
    dispatcher.ts                    ← dispatchSwarm() — parallel orchestration
    synthesis.ts                     ← synthesizeBriefs(), createFallbackBrief()
    index.ts                         ← Public API exports
    __tests__/
      agents/
        tech.test.ts
        history.test.ts
        finance.test.ts
        selector.test.ts
      synthesis.test.ts
      dispatcher.test.ts
    __mocks__/
      llm-mock.ts                    ← Mock LLMClient for tests
      api-handlers.ts                ← MSW handlers for external APIs
    __fixtures__/
      tech-agent-response.json
      history-agent-response.json
      finance-agent-response.json
      synthesis-response.json

packages/integrations/src/llm/client.ts   ← MODIFY: Fix 7 (maxTokens/temp forwarding in generateJSON), Fix 6 (add createEmbedding)

packages/database/supabase/migrations/
  00003_investigation_swarm.sql            ← NEW: investigation_runs, agent_briefs, research_briefs tables

apps/web/src/app/api/
  investigate/signal/[signalId]/route.ts   ← NEW: POST trigger investigation (Fix 19: separate route prefix)
  investigate/run/[runId]/status/route.ts  ← NEW: GET investigation status
  research-briefs/[signalId]/route.ts      ← NEW: GET research brief

packages/pipelines/src/engine/
  runner.ts                                ← MODIFY: add brief-aware generation path
  brief-prompt.ts                          ← NEW: buildPromptFromBrief()
  utils.ts                                 ← NEW: signalFromRow() (Fix 18)
```

---

### Task 1: Package scaffolding + types + LLM client fixes

**Files:**
- Create: `packages/intelligence/package.json`
- Create: `packages/intelligence/tsconfig.json`
- Create: `packages/intelligence/src/types.ts`
- Create: `packages/intelligence/src/config.ts`
- Create: `packages/intelligence/src/index.ts`
- Modify: `packages/integrations/src/llm/client.ts`
- Modify: `packages/integrations/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@influenceai/intelligence",
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

- [ ] **Step 2: Create tsconfig.json**

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

- [ ] **Step 3: Create types.ts**

Write `packages/intelligence/src/types.ts` with all investigation types from master spec `00-master-spec.md` Shared Types → Investigation Types section: `AgentBrief`, `Finding`, `SourceCitation`, `ResearchBrief`, `Connection`, `InvestigationAgent` interface, `InvestigationContext`, plus LLM extraction types for each agent (`TechExtraction`, `HistoryExtraction`, `FinanceExtraction`, `GeopoliticsExtraction`, `IndustryExtraction`, `DevEcoExtraction`, `SynthesisOutput`). Also define `InvestigationRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed'`.

- [ ] **Step 4: Create config.ts**

```typescript
// packages/intelligence/src/config.ts
export interface SwarmConfig {
  enabledAgents: string[];
  globalTimeout: number;
  maxConcurrent: number;
  triggerType?: 'batch' | 'manual'; // Fix 22
}

export const defaultSwarmConfig: SwarmConfig = {
  enabledAgents: ['tech', 'finance', 'geopolitics', 'industry', 'deveco', 'history'],
  globalTimeout: 90_000,
  maxConcurrent: 6,
};
```

- [ ] **Step 5: Fix LLM client — forward maxTokens/temperature in generateJSON (Fix 7)**

In `packages/integrations/src/llm/client.ts`, modify `generateJSON()` to forward `max_tokens` and `temperature`:

```typescript
async generateJSON<T>(params: LLMGenerateParams): Promise<T> {
  const response = await this.client.chat.completions.create({
    model: params.model ?? this.defaultModel,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    max_tokens: params.maxTokens ?? 1500,       // Fix 7: was missing
    temperature: params.temperature ?? 0.7,      // Fix 7: was missing
    response_format: { type: 'json_object' },
  });

  return JSON.parse(response.choices[0]?.message?.content ?? '{}') as T;
}
```

- [ ] **Step 6: Add createEmbedding method to LLMClient (Fix 6)**

Add below `generateWithQuality()` in `packages/integrations/src/llm/client.ts`:

```typescript
async createEmbedding(input: string, model?: string): Promise<number[]> {
  const response = await this.client.embeddings.create({
    model: model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    input: input.substring(0, 8000),
  });
  return response.data[0].embedding;
}
```

Export it from `packages/integrations/src/index.ts` (already covered by existing `LLMClient` export).

- [ ] **Step 7: Create index.ts stub**

```typescript
// packages/intelligence/src/index.ts
export * from './types';
export * from './config';
```

- [ ] **Step 8: Install dependencies and verify**

Run: `pnpm install`
Run: `cd packages/intelligence && pnpm exec tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add packages/intelligence/package.json packages/intelligence/tsconfig.json packages/intelligence/src/types.ts packages/intelligence/src/config.ts packages/intelligence/src/index.ts packages/integrations/src/llm/client.ts pnpm-lock.yaml
git commit -m "feat(intelligence): scaffold package, fix LLM client (Fix 6, 7)"
```

---

### Task 2: Agent base interface + selector + URL validation

**Files:**
- Create: `packages/intelligence/src/agents/base.ts`
- Create: `packages/intelligence/src/agents/selector.ts`
- Test: `packages/intelligence/src/__tests__/agents/selector.test.ts`

- [ ] **Step 1: Write selector test**

```typescript
// packages/intelligence/src/__tests__/agents/selector.test.ts
import { describe, it, expect } from 'vitest';
import { selectAgents } from '../agents/selector';
import type { ScoredSignal } from '@influenceai/core';

function mockSignal(overrides: Partial<ScoredSignal> = {}): ScoredSignal {
  return {
    sourceType: 'github', sourceId: 'test/repo', title: 'Test signal',
    summary: 'A test', url: 'https://example.com', metadata: {},
    fetchedAt: new Date(), score: 5, ...overrides,
  };
}

describe('selectAgents', () => {
  const allEnabled = ['tech', 'finance', 'geopolitics', 'industry', 'deveco', 'history'];

  it('always selects tech + history', () => {
    const agents = selectAgents(mockSignal({ title: 'Random news' }), allEnabled);
    const ids = agents.map(a => a.id);
    expect(ids).toContain('tech');
    expect(ids).toContain('history');
  });

  it('selects finance for funding keywords', () => {
    const agents = selectAgents(mockSignal({ title: 'OpenAI raises $10 billion in funding round' }), allEnabled);
    expect(agents.map(a => a.id)).toContain('finance');
  });

  it('selects geopolitics for regulation keywords', () => {
    const agents = selectAgents(mockSignal({ title: 'EU AI Act new compliance requirements' }), allEnabled);
    expect(agents.map(a => a.id)).toContain('geopolitics');
  });

  it('max 6 agents for fully triggering signal', () => {
    const agents = selectAgents(
      mockSignal({ title: 'OpenAI funding regulation github npm framework enterprise disruption' }),
      allEnabled,
    );
    expect(agents.length).toBeLessThanOrEqual(6);
  });

  it('respects enabledAgents filter', () => {
    const agents = selectAgents(mockSignal(), ['tech', 'history']);
    expect(agents.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/intelligence/src/__tests__/agents/selector.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement base.ts**

```typescript
// packages/intelligence/src/agents/base.ts
import type { ScoredSignal, AgentBrief, InvestigationContext } from '../types';

export interface InvestigationAgent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  timeout: number;
  investigate(signal: ScoredSignal, context?: InvestigationContext): Promise<AgentBrief>;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Fix 11: SSRF protection for URL fetching
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const h = parsed.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return false;
    if (h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.')) return false;
    if (h.endsWith('.internal') || h.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Implement selector.ts**

Write `packages/intelligence/src/agents/selector.ts` following the spec in `01-investigation-swarm.md` Agent Selector section. Import `allAgents` from `./registry` (create a stub that returns empty array for now). Use the `AGENT_TRIGGERS` map with keyword arrays and `alwaysRun` flags. The `selectAgents(signal, enabledAgents)` function filters agents by enabled list, then by keyword match or alwaysRun flag.

- [ ] **Step 5: Create registry stub**

```typescript
// packages/intelligence/src/agents/registry.ts
import type { InvestigationAgent } from './base';

// Agents are registered as they're implemented
export const allAgents: InvestigationAgent[] = [];

export function getAgent(id: string): InvestigationAgent | undefined {
  return allAgents.find(a => a.id === id);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run packages/intelligence/src/__tests__/agents/selector.test.ts`
Expected: PASS (tech + history always selected via alwaysRun; others via keywords)

- [ ] **Step 7: Commit**

```bash
git add packages/intelligence/src/agents/
git commit -m "feat(intelligence): agent base interface, selector, URL validation"
```

---

### Task 3: Tech Agent

**Files:**
- Create: `packages/intelligence/src/agents/tech.ts`
- Create: `packages/intelligence/src/__mocks__/llm-mock.ts`
- Create: `packages/intelligence/src/__mocks__/api-handlers.ts`
- Create: `packages/intelligence/src/__fixtures__/tech-agent-response.json`
- Test: `packages/intelligence/src/__tests__/agents/tech.test.ts`
- Modify: `packages/intelligence/src/agents/registry.ts` — register tech agent

- [ ] **Step 1: Create LLM mock + API handlers + fixture**

Create `packages/intelligence/src/__mocks__/llm-mock.ts` — a mock `LLMClient` that routes `generateJSON` calls to fixture files based on system prompt content (see `07-cost-and-testing.md` Mock Infrastructure section for the pattern).

Create `packages/intelligence/src/__mocks__/api-handlers.ts` — MSW handlers for GitHub API (`GET /repos/*/readme`, `GET /repos/*`), HN Algolia, npm, PyPI (see `07-cost-and-testing.md` External API Mock section).

Create `packages/intelligence/src/__fixtures__/tech-agent-response.json`:
```json
{
  "findings": [
    { "type": "fact", "headline": "Achieves 95% accuracy on MMLU", "detail": "Model surpasses GPT-4 on standard benchmarks with 3x fewer parameters", "importance": "high" },
    { "type": "comparison", "headline": "3x cheaper inference than GPT-4", "detail": "At $0.50/1M tokens vs $2.50/1M for GPT-4", "importance": "high" },
    { "type": "fact", "headline": "Apache 2.0 license", "detail": "Fully open source, no usage restrictions", "importance": "medium" }
  ],
  "hooks": ["The benchmark king just got dethroned — and by an open-source model", "What happens when the cheapest option is also the best?"],
  "sources": [{ "title": "Model README", "url": "https://github.com/test/repo", "source": "github", "accessedAt": "2026-04-11T00:00:00Z" }]
}
```

- [ ] **Step 2: Write tech agent test**

```typescript
// packages/intelligence/src/__tests__/agents/tech.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../__mocks__/api-handlers';
import { createMockLLMClient } from '../__mocks__/llm-mock';
import { TechAgent } from '../agents/tech';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

describe('TechAgent', () => {
  const agent = new TechAgent(createMockLLMClient());

  it('produces at least 1 finding on valid GitHub signal', async () => {
    const signal = { sourceType: 'github' as const, sourceId: 'test/repo', title: 'New LLM framework',
      summary: 'An open-source LLM', url: 'https://github.com/test/repo', metadata: {}, fetchedAt: new Date(), score: 7 };
    const brief = await agent.investigate(signal);
    expect(brief.status).toBe('success');
    expect(brief.findings.length).toBeGreaterThan(0);
    expect(brief.agentId).toBe('tech');
  });

  it('returns partial status when source fetch fails', async () => {
    server.use(/* override GitHub handler to return 500 */);
    const signal = { sourceType: 'github' as const, sourceId: 'fail/repo', title: 'Broken', summary: 'test',
      url: 'https://github.com/fail/repo', metadata: {}, fetchedAt: new Date(), score: 5 };
    const brief = await agent.investigate(signal);
    expect(brief.status).toBe('partial');
  });

  it('never throws — always returns AgentBrief', async () => {
    const signal = { sourceType: 'rss' as const, sourceId: 'x', title: '', summary: '', url: '', metadata: {}, fetchedAt: new Date(), score: 1 };
    const brief = await agent.investigate(signal);
    expect(brief).toHaveProperty('agentId', 'tech');
    expect(brief).toHaveProperty('status');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run packages/intelligence/src/__tests__/agents/tech.test.ts`
Expected: FAIL — TechAgent not found

- [ ] **Step 4: Implement Tech Agent**

Write `packages/intelligence/src/agents/tech.ts` following spec `01-investigation-swarm.md` Tech Agent section. Key methods:
- `fetchSourceContent(signal)` — branches on `signal.sourceType`: github (fetch README via API), arxiv (fetch abstract), huggingface (model card), default (fetch URL with `isAllowedUrl` check — Fix 11)
- `investigate(signal)` — fetches source content, calls `llm.generateJSON<TechExtraction>()` with `TECH_AGENT_SYSTEM_PROMPT`, wraps in AgentBrief. On fetch failure: use signal title+summary only, return `status: 'partial'`. Never throws — catch all errors, return failed brief.

Register in `registry.ts`: push new `TechAgent(LLMClient.fromEnv())` into `allAgents`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run packages/intelligence/src/__tests__/agents/tech.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/intelligence/src/agents/tech.ts packages/intelligence/src/__mocks__/ packages/intelligence/src/__fixtures__/ packages/intelligence/src/__tests__/agents/tech.test.ts packages/intelligence/src/agents/registry.ts
git commit -m "feat(intelligence): tech agent with tests and mock infrastructure"
```

---

### Task 4: History Agent + data file

**Files:**
- Create: `packages/intelligence/src/agents/history.ts`
- Create: `packages/intelligence/src/agents/data/tech-history.json`
- Create: `packages/intelligence/src/__fixtures__/history-agent-response.json`
- Test: `packages/intelligence/src/__tests__/agents/history.test.ts`
- Modify: `packages/intelligence/src/agents/registry.ts`

- [ ] **Step 1: Create tech-history.json**

Create `packages/intelligence/src/agents/data/tech-history.json` with at least 50 entries. Each entry: `{ id, name, year, category, pattern, keywords[], trajectory, lessons[] }`. Categories: infrastructure, ml, social, mobile, cloud, security, web. See spec `01-investigation-swarm.md` History Agent section for format.

- [ ] **Step 2: Create fixture + write test**

Create `packages/intelligence/src/__fixtures__/history-agent-response.json`:
```json
{
  "hasParallel": true,
  "findings": [
    { "type": "comparison", "headline": "Docker adoption pattern (2014)", "detail": "Docker saw rapid developer adoption followed by 6 months of enterprise resistance, then consolidation. This follows the same trajectory.", "importance": "high" }
  ],
  "hooks": ["History doesn't repeat, but it rhymes — and this rhymes with Docker 2014"],
  "confidence": 0.7
}
```

Write test `packages/intelligence/src/__tests__/agents/history.test.ts`:
- `matches signal to history entry by keyword`
- `returns hasParallel=false when no good match`
- `returns confidence > 0.5 when parallel found`

- [ ] **Step 3: Implement History Agent**

Write `packages/intelligence/src/agents/history.ts`. Key methods:
- `findHistoricalCandidates(signal)` — keyword match signal title+summary against tech-history.json entries, return top 5 by keyword overlap count
- `investigate(signal)` — find candidates, call `llm.generateJSON<HistoryExtraction>()` asking LLM to evaluate which parallels are relevant. If `hasParallel`, return `status: 'success'` with `confidence: 0.7`. Otherwise `status: 'partial'` with `confidence: 0.2`.

Register in registry.

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run packages/intelligence/src/__tests__/agents/history.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/intelligence/src/agents/history.ts packages/intelligence/src/agents/data/tech-history.json packages/intelligence/src/__fixtures__/history-agent-response.json packages/intelligence/src/__tests__/agents/history.test.ts packages/intelligence/src/agents/registry.ts
git commit -m "feat(intelligence): history agent with 50+ tech history entries"
```

---

### Task 5: Finance + DevEco Agents

**Files:**
- Create: `packages/intelligence/src/agents/finance.ts`
- Create: `packages/intelligence/src/agents/dev-ecosystem.ts`
- Create: `packages/intelligence/src/agents/data/company-tickers.json`
- Create: `packages/intelligence/src/__fixtures__/finance-agent-response.json`
- Create: `packages/intelligence/src/__fixtures__/deveco-agent-response.json`
- Test: `packages/intelligence/src/__tests__/agents/finance.test.ts`
- Modify: `packages/intelligence/src/agents/registry.ts`

- [ ] **Step 1: Create company-tickers.json**

```json
{
  "openai": null, "anthropic": null, "google": "GOOGL", "microsoft": "MSFT",
  "meta": "META", "nvidia": "NVDA", "amazon": "AMZN", "apple": "AAPL",
  "tesla": "TSLA", "ibm": "IBM", "intel": "INTC", "amd": "AMD",
  "salesforce": "CRM", "adobe": "ADBE", "palantir": "PLTR",
  "snowflake": "SNOW", "datadog": "DDOG", "mongodb": "MDB",
  "cloudflare": "NET", "crowdstrike": "CRWD"
}
```

- [ ] **Step 2: Create fixtures + write finance test**

Write `packages/intelligence/src/__tests__/agents/finance.test.ts`:
- `maps company name to ticker via JSON lookup`
- `skips stock data for private companies`
- `handles Yahoo Finance API failure gracefully` (returns partial, never throws)

- [ ] **Step 3: Implement Finance Agent**

Write `packages/intelligence/src/agents/finance.ts` following spec. Key methods:
- `findTicker(signal)` — scan signal title+summary for company names in company-tickers.json
- `fetchStockData(ticker)` — call Yahoo Finance, fallback to Alpha Vantage if env var set (Fix 17), otherwise return null
- `investigate(signal)` — find ticker, fetch stock data, call LLM to analyze financial angle. `confidence: 0.1` if no financial relevance found.

- [ ] **Step 4: Implement DevEco Agent**

Write `packages/intelligence/src/agents/dev-ecosystem.ts` following spec. Key methods:
- `fetchGitHubMetrics(repo)` — stars, forks, issues (uses existing `GITHUB_TOKEN`)
- `fetchNpmDownloads(pkg)` / `fetchPyPIDownloads(pkg)` — weekly downloads
- `fetchHNMentions(term)` — HN Algolia search last 7 days
- `investigate(signal)` — aggregate metrics, call LLM to analyze developer adoption signals

Register both in registry.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run packages/intelligence/src/__tests__/agents/finance.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/intelligence/src/agents/finance.ts packages/intelligence/src/agents/dev-ecosystem.ts packages/intelligence/src/agents/data/company-tickers.json packages/intelligence/src/__fixtures__/finance-agent-response.json packages/intelligence/src/__fixtures__/deveco-agent-response.json packages/intelligence/src/__tests__/agents/finance.test.ts packages/intelligence/src/agents/registry.ts
git commit -m "feat(intelligence): finance + dev ecosystem agents"
```

---

### Task 6: Geopolitics + Industry Agents

**Files:**
- Create: `packages/intelligence/src/agents/geopolitics.ts`
- Create: `packages/intelligence/src/agents/industry.ts`
- Create: `packages/intelligence/src/agents/data/eu-ai-act.json`
- Modify: `packages/intelligence/src/agents/registry.ts`

- [ ] **Step 1: Create eu-ai-act.json**

Create `packages/intelligence/src/agents/data/eu-ai-act.json` with 20+ article entries. Each entry: `{ article, title, riskLevel: "unacceptable"|"high"|"limited"|"minimal", keywords[], summary }`. Cover key articles: Art. 5 (prohibited practices), Art. 6 (high-risk), Art. 52 (transparency), etc.

- [ ] **Step 2: Implement Geopolitics Agent**

Write `packages/intelligence/src/agents/geopolitics.ts` following spec. Key methods:
- `matchEUAIAct(signal)` — keyword match against eu-ai-act.json
- `fetchPolicyFeeds()` — fetch RSS from whitehouse.gov, nist.gov (last 7 days). Graceful failure — return empty array if feeds fail.
- `investigate(signal)` — match EU AI Act, fetch policy news, call LLM to analyze regulatory implications. `confidence: 0.2` if no specific policy connection.

- [ ] **Step 3: Implement Industry Agent**

Write `packages/intelligence/src/agents/industry.ts` following spec. Key methods:
- `fetchHNHiring(keywords)` — search HN "Who is Hiring" threads
- `fetchProductHunt()` — only if `PRODUCTHUNT_TOKEN` set (Fix 24), otherwise skip
- `investigate(signal)` — aggregate job/product data, call LLM to analyze industry disruption. Optional ProductHunt.

Register both in registry.

- [ ] **Step 4: Verify all agents registered**

Run: `cd packages/intelligence && pnpm exec tsc --noEmit`
Expected: No errors. Registry should have 6 agents.

- [ ] **Step 5: Commit**

```bash
git add packages/intelligence/src/agents/geopolitics.ts packages/intelligence/src/agents/industry.ts packages/intelligence/src/agents/data/eu-ai-act.json packages/intelligence/src/agents/registry.ts
git commit -m "feat(intelligence): geopolitics + industry agents"
```

---

### Task 7: Dispatcher

**Files:**
- Create: `packages/intelligence/src/dispatcher.ts`
- Test: `packages/intelligence/src/__tests__/dispatcher.test.ts`

- [ ] **Step 1: Write dispatcher test**

```typescript
// packages/intelligence/src/__tests__/dispatcher.test.ts
import { describe, it, expect, vi } from 'vitest';
import { dispatchSwarm } from '../dispatcher';
import { createMockLLMClient } from '../__mocks__/llm-mock';
import type { ScoredSignal } from '@influenceai/core';

// Mock DB client
const mockDb = {
  from: vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue({ data: {} }),
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: {} }) }),
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'run-1' } }) }) }),
  }),
};

const signal: ScoredSignal = {
  sourceType: 'github', sourceId: 'test/repo', title: 'AI framework',
  summary: 'New open-source AI framework with funding implications',
  url: 'https://github.com/test/repo', metadata: {}, fetchedAt: new Date(), score: 7,
};

describe('dispatchSwarm', () => {
  it('dispatches selected agents in parallel', async () => {
    const brief = await dispatchSwarm(signal, 'signal-uuid-1', { enabledAgents: ['tech', 'history'], globalTimeout: 30000, maxConcurrent: 6 }, mockDb as any, createMockLLMClient());
    expect(brief.coverage.dispatched).toBeGreaterThanOrEqual(2);
    expect(brief.topFindings.length).toBeGreaterThan(0);
  });

  it('returns fallback brief when all agents fail', async () => {
    const brief = await dispatchSwarm(signal, 'signal-uuid-1', { enabledAgents: [], globalTimeout: 5000, maxConcurrent: 6 }, mockDb as any, createMockLLMClient());
    expect(brief.topFindings[0].headline).toBe(signal.title);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run packages/intelligence/src/__tests__/dispatcher.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement dispatcher**

Write `packages/intelligence/src/dispatcher.ts` following spec `01-investigation-swarm.md` Swarm Dispatcher section. Key points:
- `dispatchSwarm(signal, dbSignalId, config, db, llm)` — note: takes `dbSignalId` (UUID from content_signals) not `signal.sourceId` (Fix 2)
- Creates `investigation_runs` record
- Calls `selectAgents(signal, config.enabledAgents)`
- Dispatches via `Promise.allSettled()` with `withTimeout()` per agent
- In `.then()` callback: `await storeAgentBrief()` and `await logStep()` (Fix 8: must await both)
- Separates fulfilled/rejected results
- If zero succeeded: `createFallbackBrief(signal)` (from synthesis.ts)
- Otherwise: `synthesizeBriefs(signal, briefs, llm)` (from synthesis.ts)
- Stores research brief with `signal_data: signal` (Fix 1: store full signal object as JSONB)
- Returns ResearchBrief

DB helper functions (`createInvestigationRun`, `storeAgentBrief`, `storeResearchBrief`, `completeInvestigationRun`, `logStep`) should be defined in the same file or a separate `db.ts` — they use `db.from('table').insert(...)` / `.update(...)` pattern.

- [ ] **Step 4: Run test**

Run: `pnpm vitest run packages/intelligence/src/__tests__/dispatcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/intelligence/src/dispatcher.ts packages/intelligence/src/__tests__/dispatcher.test.ts
git commit -m "feat(intelligence): swarm dispatcher with parallel execution + timeouts"
```

---

### Task 8: Synthesis + fallback

**Files:**
- Create: `packages/intelligence/src/synthesis.ts`
- Create: `packages/intelligence/src/__fixtures__/synthesis-response.json`
- Test: `packages/intelligence/src/__tests__/synthesis.test.ts`

- [ ] **Step 1: Create fixture + write test**

Create `packages/intelligence/src/__fixtures__/synthesis-response.json`:
```json
{
  "rankedFindings": [
    { "type": "fact", "headline": "95% MMLU accuracy with 3x fewer params", "detail": "First open model to match GPT-4", "importance": "high" },
    { "type": "comparison", "headline": "Docker-like adoption trajectory", "detail": "Star velocity matches Docker 2014 growth", "importance": "high" }
  ],
  "connections": [
    { "findingA": { "type": "fact", "headline": "Open source", "detail": "Apache 2.0", "importance": "high" },
      "findingB": { "type": "comparison", "headline": "Docker parallel", "detail": "Same trajectory", "importance": "high" },
      "relationship": "Open-source disruption pattern", "narrativeHook": "The last time an open-source project grew this fast, it became Docker" }
  ],
  "angles": ["contrarian: why this matters more than GPT-5", "historical: the Docker parallel nobody sees"],
  "unusualFact": "The model was trained on 10% of GPT-4's compute budget"
}
```

Write test `packages/intelligence/src/__tests__/synthesis.test.ts`:
- `ranks findings by importance`
- `identifies cross-domain connections`
- `handles 2-6 agent briefs`
- `createFallbackBrief returns valid brief from signal alone`

- [ ] **Step 2: Implement synthesis.ts**

Write `packages/intelligence/src/synthesis.ts` following spec `01-investigation-swarm.md` Synthesis Agent section:
- `synthesizeBriefs(signal, briefs, llm)` — merges all agent briefs, calls `llm.generateJSON<SynthesisOutput>()` with `SYNTHESIS_SYSTEM_PROMPT`, returns `ResearchBrief`
- `createFallbackBrief(signal)` — creates minimal brief from signal title+summary when all agents fail

- [ ] **Step 3: Run test**

Run: `pnpm vitest run packages/intelligence/src/__tests__/synthesis.test.ts`
Expected: PASS

- [ ] **Step 4: Update index.ts exports**

```typescript
// packages/intelligence/src/index.ts
export * from './types';
export * from './config';
export { dispatchSwarm } from './dispatcher';
export { synthesizeBriefs, createFallbackBrief } from './synthesis';
export { selectAgents } from './agents/selector';
export { allAgents } from './agents/registry';
```

- [ ] **Step 5: Commit**

```bash
git add packages/intelligence/src/synthesis.ts packages/intelligence/src/__fixtures__/synthesis-response.json packages/intelligence/src/__tests__/synthesis.test.ts packages/intelligence/src/index.ts
git commit -m "feat(intelligence): synthesis agent + fallback brief"
```

---

### Task 9: Database migration

**Files:**
- Create: `packages/database/supabase/migrations/00003_investigation_swarm.sql`

- [ ] **Step 1: Write migration**

Create `packages/database/supabase/migrations/00003_investigation_swarm.sql` following spec `01-investigation-swarm.md` Database Schema section. Key additions to the spec schema:
- `research_briefs` must include `signal_data JSONB NOT NULL` column (Fix 1)
- Use `UNIQUE(signal_id)` on `research_briefs` to prevent duplicate investigations
- All three tables get RLS policies matching the existing pattern (allow authenticated CRUD)

See the full SQL in spec section "Database Schema" — copy it, then apply Fix 1 by adding the `signal_data` column.

- [ ] **Step 2: Verify SQL syntax**

Run: `cat packages/database/supabase/migrations/00003_investigation_swarm.sql | head -5`
Expected: `-- Migration: 00003_investigation_swarm.sql`

- [ ] **Step 3: Commit**

```bash
git add packages/database/supabase/migrations/00003_investigation_swarm.sql
git commit -m "feat(database): add investigation_runs, agent_briefs, research_briefs tables"
```

---

### Task 10: API routes

**Files:**
- Create: `apps/web/src/app/api/investigate/signal/[signalId]/route.ts`
- Create: `apps/web/src/app/api/investigate/run/[runId]/status/route.ts`
- Create: `apps/web/src/app/api/research-briefs/[signalId]/route.ts`

- [ ] **Step 1: Implement POST /api/investigate/signal/[signalId]**

Follow the API pattern from existing cron routes:
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { dispatchSwarm, defaultSwarmConfig } from '@influenceai/intelligence';

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ signalId: string }> }
) {
  const { signalId } = await params;
  const supabase = await createClient();

  // Fetch signal
  const { data: signal, error } = await supabase
    .from('content_signals').select('*').eq('id', signalId).single();
  if (error || !signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }

  // Check if already investigated
  const { data: existing } = await supabase
    .from('research_briefs').select('id').eq('signal_id', signalId).single();
  if (existing) {
    return NextResponse.json({ researchBriefId: existing.id, status: 'already_investigated' });
  }

  // Dispatch swarm — use signal.id (UUID) not signal.source_id (Fix 2)
  const llm = LLMClient.fromEnv();
  const scoredSignal = { ...signal, score: signal.scored_relevance ?? 0 };
  const brief = await dispatchSwarm(scoredSignal, signal.id, { ...defaultSwarmConfig, triggerType: 'manual' }, supabase, llm);

  return NextResponse.json({
    runId: brief.id, // investigation run ID
    researchBriefId: brief.id,
    status: brief.coverage.failed > 0 ? 'partial' : 'completed',
    coverage: brief.coverage,
  });
}
```

- [ ] **Step 2: Implement GET /api/investigate/run/[runId]/status**

Follow spec `04-daily-menu.md` API Route section for status polling. Returns agent-by-agent progress from `agent_briefs` table.

- [ ] **Step 3: Implement GET /api/research-briefs/[signalId]**

Simple query: fetch from `research_briefs` by `signal_id`, parse `signal_data` JSON back into the response (Fix 1).

- [ ] **Step 4: Type-check**

Run: `pnpm -F @influenceai/web build`
Expected: Build succeeds (or at least type-check passes)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/investigate/ apps/web/src/app/api/research-briefs/
git commit -m "feat(api): investigation trigger, status polling, and research brief endpoints"
```

---

### Task 11: Utility functions (Fix 18)

**Files:**
- Create: `packages/pipelines/src/engine/utils.ts`

- [ ] **Step 1: Implement signalFromRow**

```typescript
// packages/pipelines/src/engine/utils.ts
import type { ScoredSignal } from '@influenceai/core';

/** Maps a DB snake_case content_signals row to a ScoredSignal camelCase object */
export function signalFromRow(row: Record<string, unknown>): ScoredSignal {
  return {
    sourceType: row.source_type as ScoredSignal['sourceType'],
    sourceId: row.source_id as string,
    title: row.title as string,
    summary: (row.summary ?? row.description ?? '') as string,
    url: (row.url ?? '') as string,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    fetchedAt: new Date(row.ingested_at as string),
    score: (row.scored_relevance as number) ?? 0,
    scoreReason: row.score_reason as string | undefined,
  };
}

/** Returns top N platforms based on pillar config. Default: linkedin + twitter. */
export function selectBestPlatforms(
  signal: ScoredSignal,
  count: number,
): string[] {
  // Simple default — can be enhanced with pillar-specific mapping
  const defaults = ['linkedin', 'twitter', 'instagram', 'youtube'];
  return defaults.slice(0, count);
}
```

- [ ] **Step 2: Export from pipelines index**

Add to `packages/pipelines/src/index.ts`:
```typescript
export { signalFromRow, selectBestPlatforms } from './engine/utils';
```

- [ ] **Step 3: Commit**

```bash
git add packages/pipelines/src/engine/utils.ts packages/pipelines/src/index.ts
git commit -m "feat(pipelines): add signalFromRow + selectBestPlatforms utils (Fix 18)"
```

---

### Task 12: Pipeline runner integration

**Files:**
- Create: `packages/pipelines/src/engine/brief-prompt.ts`
- Modify: `packages/pipelines/src/engine/runner.ts`
- Modify: `packages/pipelines/package.json` (add `@influenceai/intelligence` dependency)

- [ ] **Step 1: Add intelligence dependency to pipelines package**

Add `"@influenceai/intelligence": "workspace:*"` to `packages/pipelines/package.json` dependencies.

Run: `pnpm install`

- [ ] **Step 2: Create buildPromptFromBrief**

```typescript
// packages/pipelines/src/engine/brief-prompt.ts
import { buildPrompt } from '@influenceai/integrations';
import type { ResearchBrief } from '@influenceai/intelligence';
import type { Platform } from '@influenceai/core';

export function buildPromptFromBrief(
  template: { systemPrompt: string; userPromptTemplate: string },
  brief: ResearchBrief,
  platform: Platform,
): { systemPrompt: string; userPrompt: string } {
  // Start with existing template variable replacement
  const { systemPrompt, userPrompt: baseUserPrompt } = buildPrompt(template, brief.signal, platform);

  let userPrompt = baseUserPrompt;

  // Append research findings
  userPrompt += '\n\n--- RESEARCH FINDINGS ---\n';
  userPrompt += brief.topFindings
    .map(f => `[${f.importance.toUpperCase()}] ${f.headline}: ${f.detail}`)
    .join('\n');

  if (brief.connections.length > 0) {
    userPrompt += '\n\n--- CROSS-DOMAIN CONNECTIONS ---\n';
    userPrompt += brief.connections.map(c => c.narrativeHook).join('\n');
  }

  userPrompt += `\n\nMost surprising finding (use as hook): ${brief.unusualFact}`;
  userPrompt += '\n\nIMPORTANT: Your post MUST cite at least 2 specific facts from the research findings above. Do not write generic commentary.';

  return { systemPrompt, userPrompt };
}
```

- [ ] **Step 3: Modify runner.ts to use brief-aware generation**

In `packages/pipelines/src/engine/runner.ts`, modify the STEP 4 (GENERATE) section. After `upsertSignalWithScore()` returns `signalId`, attempt to dispatch the investigation swarm. If swarm succeeds, use `buildPromptFromBrief()` instead of `buildPrompt()`. If swarm fails or times out, fall back to the existing `buildPrompt()` behavior (graceful degradation).

```typescript
// Add import at top:
import { dispatchSwarm, defaultSwarmConfig } from '@influenceai/intelligence';
import { buildPromptFromBrief } from './brief-prompt';

// Inside the signal loop, after upsertSignalWithScore:
let researchBrief;
try {
  researchBrief = await dispatchSwarm(signal, signalId, defaultSwarmConfig, db, llm);
} catch (err) {
  errors.push(`Swarm failed for ${signal.sourceId}: ${err}`);
  // Fall through — researchBrief stays undefined, use old path
}

// In the platform loop:
const { systemPrompt, userPrompt } = researchBrief
  ? buildPromptFromBrief(template, researchBrief, platform)
  : buildPrompt(template, signal, platform);
```

- [ ] **Step 4: Run existing tests**

Run: `pnpm vitest run`
Expected: All existing tests still pass (runner changes are additive)

- [ ] **Step 5: Commit**

```bash
git add packages/pipelines/package.json packages/pipelines/src/engine/brief-prompt.ts packages/pipelines/src/engine/runner.ts pnpm-lock.yaml
git commit -m "feat(pipelines): integrate investigation swarm into pipeline runner"
```

---

### Task 13: Integration tests

**Files:**
- Create: `packages/intelligence/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// packages/intelligence/src/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../__mocks__/api-handlers';
import { createMockLLMClient } from '../__mocks__/llm-mock';
import { dispatchSwarm } from '../dispatcher';
import { defaultSwarmConfig } from '../config';
import type { ScoredSignal } from '@influenceai/core';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

// In-memory DB mock
const mockDb = { /* ... create mock Supabase client per 07-cost-and-testing.md */ };

const signal: ScoredSignal = {
  sourceType: 'github', sourceId: 'langchain-ai/langchain',
  title: 'LangChain raises $25M Series A',
  summary: 'LLM framework LangChain secured funding. GitHub stars growing 500/week. EU considering framework regulation.',
  url: 'https://github.com/langchain-ai/langchain', metadata: {}, fetchedAt: new Date(), score: 8,
};

describe('Full investigation integration', () => {
  it('dispatches multiple agents and produces a research brief', async () => {
    const brief = await dispatchSwarm(signal, 'uuid-123', defaultSwarmConfig, mockDb as any, createMockLLMClient());

    // Should have dispatched tech + history (always) + finance (funding keyword) + deveco (github keyword)
    expect(brief.coverage.dispatched).toBeGreaterThanOrEqual(4);
    expect(brief.coverage.succeeded).toBeGreaterThanOrEqual(1);
    expect(brief.topFindings.length).toBeGreaterThan(0);
    expect(brief.suggestedAngles.length).toBeGreaterThan(0);
    expect(brief.unusualFact).toBeTruthy();
  });

  it('handles mixed agent success/failure gracefully', async () => {
    // Use config with only tech + a non-existent agent
    const brief = await dispatchSwarm(signal, 'uuid-123', { enabledAgents: ['tech', 'history'], globalTimeout: 10000, maxConcurrent: 2 }, mockDb as any, createMockLLMClient());
    expect(brief.coverage.succeeded).toBeGreaterThanOrEqual(1);
    expect(brief.topFindings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run all intelligence tests**

Run: `pnpm vitest run packages/intelligence/`
Expected: All PASS

- [ ] **Step 3: Run full test suite**

Run: `pnpm vitest run`
Expected: All PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add packages/intelligence/src/__tests__/integration.test.ts
git commit -m "test(intelligence): integration tests for full swarm dispatch"
```

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Package scaffold + types + LLM fixes | Type-check only |
| 2 | Agent base + selector | 5 selector tests |
| 3 | Tech Agent | 3 agent tests |
| 4 | History Agent | 3 agent tests |
| 5 | Finance + DevEco Agents | 3 finance tests |
| 6 | Geopolitics + Industry Agents | Type-check |
| 7 | Dispatcher | 2 dispatcher tests |
| 8 | Synthesis + fallback | 4 synthesis tests |
| 9 | DB migration | SQL validation |
| 10 | API routes | Build check |
| 11 | Utility functions: signalFromRow, selectBestPlatforms (Fix 18) | — |
| 12 | Pipeline runner integration | Existing tests pass |
| 13 | Integration tests | 2 integration tests |

**Total: ~22 tests, ~13 commits**
