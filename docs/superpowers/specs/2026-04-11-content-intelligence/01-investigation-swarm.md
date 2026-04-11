# Phase 1: Investigation Swarm

**Parent:** `00-master-spec.md`
**Layer:** 2 (Intelligence)
**Depends on:** Existing pipeline (Layer 1) — content_signals table
**Delivers:** Research briefs with cross-domain findings for each high-value signal

---

## Overview

When a high-value signal passes through the existing pipeline's ingest/dedup/filter steps, the Investigation Swarm dispatches up to 6 specialized agents in parallel. Each agent probes a different domain (tech, finance, geopolitics, industry, developer ecosystem, history). A Synthesis Agent merges their findings into a single Research Brief stored in the database.

---

## Package Structure

```
packages/intelligence/
  src/
    agents/
      base.ts               ← InvestigationAgent interface + shared utilities
      tech.ts                ← Tech Deep-Dive Agent
      finance.ts             ← Finance Agent
      geopolitics.ts         ← Geopolitics Agent
      industry.ts            ← Industry Impact Agent
      dev-ecosystem.ts       ← Developer Ecosystem Agent
      history.ts             ← Historical Pattern Agent
      registry.ts            ← Agent registry (enabled agents, config)
    dispatcher.ts            ← Swarm orchestrator (parallel dispatch + timeout)
    synthesis.ts             ← Merges agent briefs into ResearchBrief
    selector.ts              ← Determines which agents to run per signal
    types.ts                 ← All Phase 1 types (see master spec)
    index.ts                 ← Public API: dispatchSwarm()
  package.json               ← @influenceai/intelligence
  tsconfig.json
```

---

## Core Interface

Every investigation agent implements this interface:

```typescript
interface InvestigationAgent {
  id: string;                          // 'tech' | 'finance' | 'geopolitics' | etc.
  name: string;                        // Display name for UI/logs
  description: string;
  enabled: boolean;                    // Toggle per agent
  timeout: number;                     // Per-agent timeout in ms (default: 45000)

  investigate(
    signal: ScoredSignal,
    context?: InvestigationContext
  ): Promise<AgentBrief>;
}

interface InvestigationContext {
  relatedSignals?: ScoredSignal[];     // From signal clustering (future)
  contentHistory?: ContentMemoryEntry[]; // Past posts on this topic (Phase 3)
  trendData?: TrendDataPoint[];        // Historical trajectory (Phase 3)
}
```

The `context` parameter is optional and empty in Phase 1. Phase 3 populates it once Content Memory and Trend Trajectory exist. This is how phases connect without coupling.

---

## The 6 Investigation Agents

### 1. Tech Deep-Dive Agent (`tech.ts`)

**Always runs.** This is the most critical agent.

**What it does:**
- Fetches and reads the actual source content (README, paper abstract, changelog, blog post)
- Extracts specific claims: benchmarks, metrics, performance numbers
- Identifies limitations and known issues
- Compares against competitors when applicable

**Data sources:**
- GitHub API: README content (`GET /repos/{owner}/{repo}/readme`), open issues count, recent issue titles
- ArXiv API: paper abstract, authors, citation count
- HuggingFace API: model card, download count, benchmark scores
- Direct URL fetch: reads the linked page for any signal

**Implementation pattern:**
```typescript
async investigate(signal: ScoredSignal): Promise<AgentBrief> {
  // 1. Fetch source content based on signal.sourceType
  const sourceContent = await this.fetchSourceContent(signal);

  // 2. Use LLM to extract structured findings
  const extraction = await this.llm.generateJSON<TechExtraction>({
    systemPrompt: TECH_AGENT_SYSTEM_PROMPT,
    userPrompt: `Analyze this ${signal.sourceType} signal:\n\nTitle: ${signal.title}\nSummary: ${signal.summary}\nSource content:\n${sourceContent}\n\nExtract: specific claims with numbers, limitations, competitor comparisons, known issues.`,
    maxTokens: 800,
    temperature: 0.3,  // Low temp for factual extraction
  });

  // 3. Structure as AgentBrief
  return {
    agentId: 'tech',
    status: 'success',
    findings: extraction.findings,
    narrativeHooks: extraction.hooks,
    confidence: 0.9,  // Tech agent is almost always relevant
    sources: extraction.sources,
  };
}
```

**Fallback:** If source content fetch fails, extract what we can from the signal's title + summary alone (partial status).

---

### 2. Finance Agent (`finance.ts`)

**Runs when signal matches:** company names, funding keywords, product launches by public companies.

**What it does:**
- Checks stock price movements for relevant companies
- Searches for recent funding rounds in the space
- Finds related analyst mentions or ratings
- Calculates market context (sector performance)

**Data sources:**
- Yahoo Finance API (free tier): stock quotes, price change %, market cap
  - Endpoint: `https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?range=5d&interval=1d`
- SEC EDGAR (free, public): recent AI-related 8-K filings
  - Endpoint: `https://efts.sec.gov/LATEST/search-index?q=%22artificial+intelligence%22&dateRange=custom&startdt={date}&enddt={date}`
- Crunchbase API (optional, paid): funding rounds, valuations
  - If no API key: skip funding data, brief is still valid

**Company-to-ticker mapping:** Maintained as a JSON file in the package:
```typescript
// agents/data/company-tickers.json
{
  "openai": null,           // Private, no ticker
  "anthropic": null,        // Private
  "google": "GOOGL",
  "microsoft": "MSFT",
  "meta": "META",
  "nvidia": "NVDA",
  "amazon": "AMZN",
  "apple": "AAPL",
  // ... 50+ AI-relevant companies
}
```

**Fallback:** If Yahoo Finance API fails, skip stock data. If signal mentions only private companies, report funding data only. If no financial relevance detected, return `confidence: 0.1` with empty findings.

---

### 3. Geopolitics Agent (`geopolitics.ts`)

**Runs when signal matches:** regulation keywords, country names, government entities, policy terms, export controls.

**What it does:**
- Checks signal against EU AI Act article database (local JSON)
- Searches recent US executive orders and NIST guidelines
- Identifies if the technology/technique has cross-border implications
- Finds parallel developments in China/UK/India

**Data sources:**
- EU AI Act database: maintained as a local JSON file with articles, risk categories, and key terms
  - `agents/data/eu-ai-act.json` — articles mapped to risk levels and affected technology types
- US government RSS feeds:
  - `https://www.whitehouse.gov/feed/` — executive orders
  - `https://www.nist.gov/news-events/news/rss.xml` — AI standards
- Policy think-tank blogs (RSS):
  - Brookings AI policy, CSET Georgetown, OECD AI Policy Observatory
- LLM analysis: when source data is fetched, use LLM to identify regulatory implications

**Implementation pattern:**
```typescript
async investigate(signal: ScoredSignal): Promise<AgentBrief> {
  // 1. Check EU AI Act database for relevant articles
  const euMatches = this.matchEUAIAct(signal);

  // 2. Fetch recent policy news from RSS feeds (last 7 days)
  const policyNews = await this.fetchPolicyFeeds();

  // 3. Use LLM to connect signal to policy landscape
  const analysis = await this.llm.generateJSON<GeopoliticsExtraction>({
    systemPrompt: GEOPOLITICS_AGENT_SYSTEM_PROMPT,
    userPrompt: `Signal: ${signal.title}\n${signal.summary}\n\nEU AI Act matches: ${JSON.stringify(euMatches)}\nRecent policy news: ${JSON.stringify(policyNews)}\n\nAnalyze: regulatory implications, cross-border issues, government responses.`,
    maxTokens: 600,
    temperature: 0.3,
  });

  return { agentId: 'geopolitics', status: 'success', findings: analysis.findings, ... };
}
```

**Fallback:** If RSS feeds fail, rely on EU AI Act database + LLM general knowledge. Return `confidence: 0.2` if no specific policy connection found.

---

### 4. Industry Impact Agent (`industry.ts`)

**Runs when signal matches:** enterprise keywords, SaaS, specific industry terms, "automate", "replace", "disrupt".

**What it does:**
- Maps the capability to affected industries and job roles
- Searches for company adoption announcements
- Checks job posting trends for related roles
- Identifies competing startups or products that may be disrupted

**Data sources:**
- Job board RSS/APIs:
  - HN "Who is Hiring" monthly threads (HN API, filter by keywords)
  - RemoteOK API (free): `https://remoteok.com/api?tag=ai`
- ProductHunt API: recent AI product launches
  - `https://api.producthunt.com/v2/api/graphql` (free tier)
- LLM analysis: maps capability to industry impact using domain knowledge

**Implementation pattern:**
```typescript
async investigate(signal: ScoredSignal): Promise<AgentBrief> {
  // 1. Extract capability from signal
  // 2. Search job postings for related terms
  // 3. Check ProductHunt for competing/related products
  // 4. LLM: map to industries, estimate disruption
  const analysis = await this.llm.generateJSON<IndustryExtraction>({
    systemPrompt: INDUSTRY_AGENT_SYSTEM_PROMPT,
    userPrompt: `Signal: ${signal.title}\n${signal.summary}\n\nJob data: ${JSON.stringify(jobData)}\nRelated products: ${JSON.stringify(products)}\n\nAnalyze: which industries affected, competing products, job market shifts.`,
    maxTokens: 600,
    temperature: 0.4,
  });

  return { agentId: 'industry', status: 'success', findings: analysis.findings, ... };
}
```

---

### 5. Developer Ecosystem Agent (`dev-ecosystem.ts`)

**Runs when signal matches:** GitHub repos, frameworks, SDKs, libraries, APIs, developer tools.

**What it does:**
- Tracks GitHub stars velocity (not just count — rate of change)
- Checks npm/PyPI download trends
- Reads top HackerNews and Reddit comments for developer sentiment
- Counts Stack Overflow questions as adoption signal

**Data sources:**
- GitHub API (existing `GITHUB_TOKEN`):
  - Star count, fork count, open issues, recent commit frequency
  - Star history via `GET /repos/{owner}/{repo}/stargazers` with `Accept: application/vnd.github.star+json` (includes starred_at timestamp)
- npm API (free, no auth): `https://api.npmjs.org/downloads/range/{period}/{package}`
- PyPI stats (free, no auth): `https://pypistats.org/api/packages/{package}/recent`
- HN API: search for mentions, read top comments
  - `https://hn.algolia.com/api/v1/search?query={term}&tags=comment&numericFilters=created_at_i>{timestamp}`
- Reddit API (requires `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`, optional):
  - Search subreddits (r/MachineLearning, r/LocalLLaMA, r/programming) for mentions

**Star velocity calculation:**
```typescript
function calculateStarVelocity(starHistory: { date: string; count: number }[]): {
  current: number;      // Stars per week (last 7 days)
  previous: number;     // Stars per week (7-14 days ago)
  acceleration: number; // current - previous (positive = speeding up)
} {
  // Group by week, calculate deltas
}
```

**Fallback:** If Reddit API unavailable (no keys), skip Reddit sentiment. HN + GitHub + npm are sufficient for a useful brief.

---

### 6. Historical Pattern Agent (`history.ts`)

**Always runs.** Historical parallels are always interesting and high-engagement.

**What it does:**
- Searches a curated tech history database for parallels
- Compares current signal's characteristics to past events
- Identifies "this was tried before" precedents
- Projects what happened next based on historical patterns

**Data source:** Primarily a local curated knowledge base, plus LLM.

**Tech history database:** `agents/data/tech-history.json`
```json
[
  {
    "id": "docker-2014",
    "name": "Docker adoption wave",
    "year": 2014,
    "category": "infrastructure",
    "pattern": "fast_developer_adoption",
    "keywords": ["container", "deployment", "infrastructure", "devops"],
    "trajectory": "rapid adoption → enterprise resistance (6mo) → consolidation (18mo) → standard (36mo)",
    "lessons": ["Developer love doesn't guarantee enterprise adoption", "Orchestration layer became the real value"]
  },
  // ... 200+ entries covering major tech events
]
```

**Implementation pattern:**
```typescript
async investigate(signal: ScoredSignal): Promise<AgentBrief> {
  // 1. Keyword match signal against tech history database
  const candidates = this.findHistoricalCandidates(signal);

  // 2. Use LLM to evaluate which parallels are actually relevant
  const analysis = await this.llm.generateJSON<HistoryExtraction>({
    systemPrompt: HISTORY_AGENT_SYSTEM_PROMPT,
    userPrompt: `Signal: ${signal.title}\n${signal.summary}\n\nCandidate historical parallels:\n${JSON.stringify(candidates)}\n\nSelect the most relevant parallel. Explain the similarity and what happened next. If no strong parallel exists, say so.`,
    maxTokens: 500,
    temperature: 0.5,
  });

  return {
    agentId: 'history',
    status: analysis.hasParallel ? 'success' : 'partial',
    findings: analysis.findings,
    confidence: analysis.hasParallel ? 0.7 : 0.2,
    ...
  };
}
```

---

## Agent Selector

Not every signal needs all 6 agents. The selector picks which agents to dispatch based on signal content:

```typescript
const AGENT_TRIGGERS: Record<string, { keywords: string[]; alwaysRun: boolean }> = {
  tech:        { keywords: [], alwaysRun: true },
  finance:     { keywords: ['funding', 'acquisition', 'ipo', 'stock', 'valuation', 'revenue', 'raise', 'billion', 'million', '$', 'investor', ...COMPANY_NAMES], alwaysRun: false },
  geopolitics: { keywords: ['regulation', 'ban', 'export', 'china', 'eu', 'government', 'policy', 'law', 'congress', 'senate', 'compliance', 'gdpr', 'ai act', ...], alwaysRun: false },
  industry:    { keywords: ['enterprise', 'saas', 'disrupt', 'replace', 'automate', 'workflow', 'productivity', 'healthcare', 'legal', 'finance', ...], alwaysRun: false },
  deveco:      { keywords: ['github', 'npm', 'pypi', 'framework', 'sdk', 'library', 'api', 'developer', 'open-source', 'repo', ...], alwaysRun: false },
  history:     { keywords: [], alwaysRun: true },
};

function selectAgents(signal: ScoredSignal, enabledAgents: string[]): InvestigationAgent[] {
  return allAgents.filter(agent => {
    if (!enabledAgents.includes(agent.id)) return false;
    const config = AGENT_TRIGGERS[agent.id];
    if (config.alwaysRun) return true;
    const text = `${signal.title} ${signal.summary}`.toLowerCase();
    return config.keywords.some(kw => text.includes(kw.toLowerCase()));
  });
}
```

Minimum: Tech + History always run (2 agents).
Maximum: All 6 agents for a signal that touches every domain.
Typical: 3-4 agents per signal.

---

## Swarm Dispatcher

Orchestrates parallel agent execution with per-agent timeouts and graceful failure handling.

```typescript
interface SwarmConfig {
  enabledAgents: string[];     // Default: all 6
  globalTimeout: number;       // Default: 90000 (90 sec)
  maxConcurrent: number;       // Default: 6 (all parallel)
}

async function dispatchSwarm(
  signal: ScoredSignal,
  config: SwarmConfig,
  db: SupabaseClient,
  llm: LLMClient
): Promise<ResearchBrief> {

  // 1. Create investigation_run record
  const runId = await createInvestigationRun(db, signal.sourceId, config);

  // 2. Select agents
  const agents = selectAgents(signal, config.enabledAgents);
  await logStep(db, runId, 'dispatch', 'info', `Dispatching ${agents.length} agents: ${agents.map(a => a.id).join(', ')}`);

  // 3. Dispatch all in parallel with individual timeouts
  const results = await Promise.allSettled(
    agents.map(agent =>
      withTimeout(
        agent.investigate(signal),
        agent.timeout
      ).then(brief => {
        // Store individual brief in DB
        storeAgentBrief(db, runId, brief);
        logStep(db, runId, agent.id, 'info', `Completed: ${brief.findings.length} findings`);
        return brief;
      })
    )
  );

  // 4. Separate successes from failures
  const briefs: AgentBrief[] = [];
  const failures: string[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      briefs.push(result.value);
    } else {
      const reason = result.reason?.message || 'Unknown error';
      failures.push(`${agents[i].id}: ${reason}`);
      logStep(db, runId, agents[i].id, 'error', reason);
    }
  });

  // 5. Graceful degradation: if zero agents succeeded, create fallback brief
  if (briefs.length === 0) {
    await logStep(db, runId, 'synthesis', 'warn', 'All agents failed — using fallback brief');
    const fallback = createFallbackBrief(signal);
    await storeResearchBrief(db, runId, fallback);
    await completeInvestigationRun(db, runId, 'failed', { dispatched: agents.length, succeeded: 0, failed: failures.length });
    return fallback;
  }

  // 6. Synthesis: merge all briefs into one ResearchBrief
  const researchBrief = await synthesizeBriefs(signal, briefs, llm);
  researchBrief.coverage = {
    dispatched: agents.length,
    succeeded: briefs.length,
    failed: failures.length,
    agents: briefs.map(b => b.agentId),
  };

  // 7. Store and finalize
  await storeResearchBrief(db, runId, researchBrief);
  const status = failures.length === 0 ? 'completed' : 'partial';
  await completeInvestigationRun(db, runId, status, researchBrief.coverage);
  await logStep(db, runId, 'synthesis', 'info', `Brief assembled: ${researchBrief.topFindings.length} top findings from ${briefs.length} agents`);

  return researchBrief;
}
```

### `withTimeout` utility

```typescript
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent timed out after ${ms}ms`)), ms)
    ),
  ]);
}
```

---

## Synthesis Agent

Takes all successful agent briefs and produces a unified ResearchBrief. This is a single LLM call.

```typescript
async function synthesizeBriefs(
  signal: ScoredSignal,
  briefs: AgentBrief[],
  llm: LLMClient
): Promise<ResearchBrief> {

  const allFindings = briefs.flatMap(b => b.findings);
  const allHooks = briefs.flatMap(b => b.narrativeHooks);

  const synthesis = await llm.generateJSON<SynthesisOutput>({
    systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
    userPrompt: `
Signal: "${signal.title}"
Summary: ${signal.summary}

Agent findings by domain:
${briefs.map(b => `\n--- ${b.agentId.toUpperCase()} (confidence: ${b.confidence}) ---\n${b.findings.map(f => `[${f.importance}] ${f.headline}: ${f.detail}`).join('\n')}`).join('\n')}

Narrative hooks from agents:
${allHooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Tasks:
1. Rank the top 5-7 findings by importance across all domains
2. Identify cross-domain connections (findings from different agents that relate to each other)
3. Suggest 3-5 content angles based on the findings
4. Pick the single most surprising or unusual finding (best hook material)
`,
    maxTokens: 1000,
    temperature: 0.4,
  });

  return {
    id: generateId(),
    signalId: signal.sourceId,
    signal,
    topFindings: synthesis.rankedFindings,
    connections: synthesis.connections,
    suggestedAngles: synthesis.angles,
    unusualFact: synthesis.unusualFact,
    agentBriefs: briefs,
    coverage: { dispatched: 0, succeeded: 0, failed: 0, agents: [] }, // Filled by dispatcher
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
  };
}

const SYNTHESIS_SYSTEM_PROMPT = `You are a research synthesis agent. You receive findings from multiple domain-specific investigation agents and your job is to:
1. Rank findings by importance and newsworthiness
2. Identify connections between findings from DIFFERENT domains (these are the most valuable insights)
3. Suggest content angles that leverage the cross-domain findings
4. Identify the single most surprising fact (best for hooks and opening lines)

Output JSON with: rankedFindings[], connections[], angles[], unusualFact.
Each connection should reference which domains it links and explain why they're related.`;
```

### Fallback Brief (when all agents fail)

```typescript
function createFallbackBrief(signal: ScoredSignal): ResearchBrief {
  return {
    id: generateId(),
    signalId: signal.sourceId,
    signal,
    topFindings: [{
      type: 'fact',
      headline: signal.title,
      detail: signal.summary,
      importance: 'medium',
    }],
    connections: [],
    suggestedAngles: ['Report the news with your analysis'],
    unusualFact: signal.title,
    agentBriefs: [],
    coverage: { dispatched: 0, succeeded: 0, failed: 0, agents: [] },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  };
}
```

---

## Database Schema

```sql
-- Migration: 00003_investigation_swarm.sql

-- Investigation run tracking (one per signal investigated)
CREATE TABLE investigation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES content_signals(id),
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'running' | 'completed' | 'partial' | 'failed'
  agents_dispatched INTEGER DEFAULT 0,
  agents_succeeded INTEGER DEFAULT 0,
  agents_failed INTEGER DEFAULT 0,
  agents_list TEXT[],             -- Which agents were dispatched
  trigger_type TEXT DEFAULT 'batch',  -- 'batch' | 'manual'
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_investigation_runs_signal ON investigation_runs(signal_id);
CREATE INDEX idx_investigation_runs_status ON investigation_runs(status);

-- Individual agent outputs
CREATE TABLE agent_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_run_id UUID REFERENCES investigation_runs(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,         -- 'tech' | 'finance' | etc.
  status TEXT NOT NULL,           -- 'success' | 'partial' | 'failed'
  findings JSONB DEFAULT '[]',
  narrative_hooks JSONB DEFAULT '[]',
  confidence FLOAT DEFAULT 0,
  sources JSONB DEFAULT '[]',
  raw_data JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_briefs_run ON agent_briefs(investigation_run_id);

-- Merged research briefs (one per investigation run)
CREATE TABLE research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_run_id UUID REFERENCES investigation_runs(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES content_signals(id),
  top_findings JSONB NOT NULL DEFAULT '[]',
  connections JSONB DEFAULT '[]',
  suggested_angles JSONB DEFAULT '[]',
  unusual_fact TEXT,
  coverage JSONB,                -- {dispatched, succeeded, failed, agents[]}
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_research_briefs_signal ON research_briefs(signal_id);
CREATE INDEX idx_research_briefs_expires ON research_briefs(expires_at);

-- RLS policies (match existing pattern)
ALTER TABLE investigation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON investigation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON investigation_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON investigation_runs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read" ON agent_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON agent_briefs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated read" ON research_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON research_briefs FOR INSERT TO authenticated WITH CHECK (true);
```

---

## API Routes

### Trigger investigation for a specific signal

```
POST /api/investigate/{signalId}

Request: (no body needed — signal data is in DB)

Response:
{
  "runId": "uuid",
  "signalId": "uuid",
  "status": "completed" | "partial" | "failed",
  "coverage": { "dispatched": 4, "succeeded": 3, "failed": 1, "agents": ["tech","finance","history"] },
  "researchBriefId": "uuid",
  "durationMs": 12340
}
```

### Get research brief for a signal

```
GET /api/research-briefs/{signalId}

Response: ResearchBrief (full JSON including all findings, connections, angles)
```

### Get investigation run details (for UI progress)

```
GET /api/investigate/{runId}/status

Response:
{
  "runId": "uuid",
  "status": "running",
  "agents": [
    { "id": "tech", "status": "success", "durationMs": 3200 },
    { "id": "finance", "status": "success", "durationMs": 5100 },
    { "id": "geopolitics", "status": "running" },
    { "id": "history", "status": "pending" }
  ]
}
```

---

## Integration with Existing Pipeline Runner

The existing `runPipeline()` function in `packages/pipelines/src/engine/runner.ts` is modified at the generate step:

```typescript
// BEFORE (current): signal → direct LLM generation
// AFTER (Phase 1): signal → investigation swarm → research brief → (Phase 2 takes over)

// In runner.ts, the generate step changes to:
for (const signal of topSignals) {
  // Step 4a: Run investigation swarm (NEW)
  const brief = await dispatchSwarm(signal, swarmConfig, db, llm);

  // Step 4b: Generate content from research brief (replaces old direct generation)
  // In Phase 1: simple brief-aware generation
  // In Phase 2: angle cards + storytelling engine takes over
  for (const platform of definition.platforms) {
    const template = await getActiveTemplate(db, definition.pillar, platform);
    const prompt = buildPromptFromBrief(template, brief, platform); // NEW function
    const result = await llm.generateWithQuality({ ... });
    await insertContentItem(db, { ... });
  }
}
```

The key change: `buildPrompt(template, signal, platform)` becomes `buildPromptFromBrief(template, brief, platform)`. The brief contains the signal plus all research findings. The LLM now has much richer context to work with.

```typescript
function buildPromptFromBrief(
  template: PromptTemplate,
  brief: ResearchBrief,
  platform: Platform
): { systemPrompt: string; userPrompt: string } {
  // Start with existing template variable replacement
  let { systemPrompt, userPrompt } = buildPrompt(template, brief.signal, platform);

  // Append research findings to user prompt
  userPrompt += `\n\n--- RESEARCH FINDINGS ---\n`;
  userPrompt += brief.topFindings.map(f =>
    `[${f.importance.toUpperCase()}] ${f.headline}: ${f.detail}`
  ).join('\n');

  if (brief.connections.length > 0) {
    userPrompt += `\n\n--- CROSS-DOMAIN CONNECTIONS ---\n`;
    userPrompt += brief.connections.map(c => c.narrativeHook).join('\n');
  }

  userPrompt += `\n\nMost surprising finding (use as hook): ${brief.unusualFact}`;
  userPrompt += `\n\nIMPORTANT: Your post MUST cite at least 2 specific facts from the research findings above. Do not write generic commentary.`;

  return { systemPrompt, userPrompt };
}
```

---

## Agent Data Files

Static data files maintained in the package:

```
packages/intelligence/src/agents/data/
  company-tickers.json      ← 50+ AI company name → stock ticker mapping
  eu-ai-act.json            ← EU AI Act articles, risk categories, keywords
  tech-history.json          ← 200+ historical tech events with patterns
```

These are version-controlled and updated manually as needed. They don't require external APIs.

---

## Testing Strategy

Each agent is independently testable with mock signal input:

```typescript
// Example test: tech agent with a GitHub signal
describe('TechAgent', () => {
  it('extracts benchmarks from README', async () => {
    const signal = mockSignal({ sourceType: 'github', title: 'New LLM framework' });
    const brief = await techAgent.investigate(signal);
    expect(brief.status).toBe('success');
    expect(brief.findings.length).toBeGreaterThan(0);
  });

  it('returns partial status when source fetch fails', async () => {
    // Mock GitHub API failure
    const brief = await techAgent.investigate(signal);
    expect(brief.status).toBe('partial');
  });
});

// Dispatcher integration test
describe('Swarm Dispatcher', () => {
  it('handles mixed agent success/failure', async () => {
    // Mock: tech succeeds, finance fails, history succeeds
    const brief = await dispatchSwarm(signal, config, db, llm);
    expect(brief.coverage.succeeded).toBe(2);
    expect(brief.coverage.failed).toBe(1);
    expect(brief.topFindings.length).toBeGreaterThan(0);
  });

  it('returns fallback brief when all agents fail', async () => {
    const brief = await dispatchSwarm(signal, allFailConfig, db, llm);
    expect(brief.topFindings[0].headline).toBe(signal.title);
  });
});
```

---

## Implementation Steps (for planning phase)

1. Create `packages/intelligence` package with types and base interface
2. Implement Tech Agent (most critical, always runs)
3. Implement Historical Pattern Agent (always runs, uses local data only)
4. Implement Developer Ecosystem Agent (uses existing GitHub + HN adapters)
5. Implement Finance Agent (new API: Yahoo Finance)
6. Implement Geopolitics Agent (new data: EU AI Act JSON + policy RSS)
7. Implement Industry Agent (ProductHunt + job data)
8. Implement Swarm Dispatcher with parallel execution + timeouts
9. Implement Synthesis Agent (LLM merge step)
10. Create DB migration for investigation tables
11. Create API routes (trigger, status, get brief)
12. Modify pipeline runner to use briefs instead of raw signals
13. Tests for each agent + dispatcher integration tests
