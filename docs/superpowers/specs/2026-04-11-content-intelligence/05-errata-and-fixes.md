# Errata & Fixes

**Parent:** `00-master-spec.md`
**Purpose:** Corrections to blocking and high-priority issues found during spec review. Each fix specifies what to change and in which phase spec.

---

## Blocking Issues (6) — Would crash on first run

### Fix 1: `research_briefs` table missing `signal` data

**Problem:** The `ResearchBrief` TypeScript type has `signal: ScoredSignal` (full object), but the DB table only stores `signal_id UUID`. When reading a brief back from DB, `brief.signal` is `undefined`, and every consumer (angle generator, draft generator) accesses `brief.signal.title` — runtime crash.

**Fix in `01-investigation-swarm.md` DB schema:**
```sql
-- ADD to research_briefs table
signal_data JSONB NOT NULL,        -- Full ScoredSignal object for offline access
```

**Fix in synthesis/dispatcher:** When storing the brief, include the signal:
```typescript
await storeResearchBrief(db, runId, { ...researchBrief, signalData: signal });
```

**Fix on read path:** All queries that read `research_briefs` must parse `signal_data` back into the `signal` field of the `ResearchBrief` object.

---

### Fix 2: `signalId` uses `signal.sourceId` (string) instead of DB UUID

**Problem:** `synthesizeBriefs()` and `createFallbackBrief()` set `signalId: signal.sourceId`. But `signal.sourceId` is a string like `"langchain-ai/langchain"`, and the FK column `signal_id UUID REFERENCES content_signals(id)` expects a UUID. Insert will fail.

**Fix:** The dispatcher must receive the internal DB `content_signals.id` UUID (looked up after the signal is upserted) and pass it through. The runner already calls `upsertSignalWithScore()` which returns the UUID. Use that:

```typescript
// In dispatcher, after upserting signal
const signalRow = await upsertSignalWithScore(db, signal, signal.score);
const dbSignalId = signalRow.id; // UUID from content_signals table

// Pass dbSignalId into synthesis and brief creation
researchBrief.signalId = dbSignalId;
```

**Affects:** `01-investigation-swarm.md` — dispatcher flow, synthesis, fallback brief.

---

### Fix 3: `voice_profiles.exemplar_post_ids` UUID[] vs `VoiceProfile.exemplarPosts` full objects

**Problem:** TypeScript type stores full post objects (with body text). DB stores only UUID array. `buildVoiceInjection()` accesses `.body` on exemplar posts — undefined at runtime.

**Fix option A (recommended):** Change the DB column to JSONB:
```sql
-- CHANGE in voice_profiles table
exemplar_posts JSONB DEFAULT '[]',   -- Store full ExemplarPost[] objects
-- REMOVE: exemplar_post_ids UUID[] DEFAULT '{}'
```

This avoids a JOIN on every draft generation. Voice profiles are updated infrequently (every 20 edits) so the storage cost is negligible.

**Also fix:** Add `editsAnalyzed: number` to the `VoiceProfile` TypeScript interface in `00-master-spec.md`:
```typescript
interface VoiceProfile {
  // ... existing fields
  editsAnalyzed: number;    // ADD: total edits processed by analyzer
}
```

**Affects:** `02-creation-engine.md` — DB schema, `00-master-spec.md` — VoiceProfile type.

---

### Fix 4: Overnight batch never persists drafts to `content_items`

**Problem:** Phase 4 overnight batch calls `createContent()` and checks `creation.draft` but never calls `insertContentItem()`. Drafts exist in memory but are never written to the database. `assembleDailyMenu()` queries `content_items WHERE status='pending_review'` and finds nothing.

**Fix in `04-daily-menu.md` overnight batch Step 6:**
```typescript
for (const brief of briefs) {
  const platforms = selectBestPlatforms(brief.signal, 2);
  for (const platform of platforms) {
    const creation = await createContent(brief, platform, { autoSelect: true }, db, llm);
    if (creation.draft) {
      // FIX: Actually persist the draft
      await insertContentItem(db, {
        title: creation.draft.title,
        body: creation.draft.body,
        pillarSlug: brief.signal.metadata?.pillar || 'breaking-ai-news',
        pipelineSlug: 'content-intelligence',
        platform,
        signalId: brief.signalId,
        qualityScore: creation.draft.qualityScore,
        status: 'pending_review',
        metadata: {
          angleType: creation.selectedAngle.angleType,
          storyArc: creation.storyArc.id,
          researchBriefId: brief.id,
          angleCardId: creation.selectedAngle.id,
        },
      });
      draftsGenerated++;
    }
  }
}
```

---

### Fix 5: `daily_menu_items` table queried but never created

**Problem:** `assembleDailyMenu()` queries `db.from('daily_menu_items')` but the migration only creates `daily_menus` with items as JSONB. Runtime error.

**Fix:** Remove the `daily_menu_items` query from `assembleDailyMenu()`. Callback items should come from `detectCallbacks()` return value (passed as a parameter), not from a DB table:

```typescript
async function assembleDailyMenu(
  db: SupabaseClient,
  callbacks: CallbackItem[]   // ADD: passed from overnight batch Step 7
): Promise<DailyMenu> {
  // REMOVE: db.from('daily_menu_items').select(...)
  // USE: callbacks parameter directly
  callbacks.forEach(cb => {
    items.push({
      readiness: 'callback',
      type: 'prediction_check',
      title: `Your prediction "${cb.prediction.statement}" just ${cb.resolution}`,
      reason: cb.evidence,
      ...
    });
  });
}
```

**Also fix in `00-master-spec.md`:** Remove `daily_menu_items` from the Phase 4 table list. Only `daily_menus` exists.

---

### Fix 6: `llm.client` is private — Phase 3 embeddings can't access it

**Problem:** `generateEmbedding()` calls `llm.client.embeddings.create()` but `client` is a `private` field on `LLMClient`.

**Fix:** Add a public `embeddings()` method to `LLMClient`:

```typescript
// Add to packages/integrations/src/llm/client.ts
async createEmbedding(input: string, model?: string): Promise<number[]> {
  const response = await this.client.embeddings.create({
    model: model || process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    input: input.substring(0, 8000),
  });
  return response.data[0].embedding;
}
```

**Fix in `03-persistent-intelligence.md`:**
```typescript
// CHANGE from: llm.client.embeddings.create(...)
// TO:
const embedding = await llm.createEmbedding(`${item.data.title}\n\n${item.data.body}`);
```

---

## High-Priority Issues (12)

### Fix 7: `generateJSON()` silently drops `maxTokens` and `temperature`

**Problem:** Every agent relies on low temperature (0.3) for factual extraction, but the existing `generateJSON()` doesn't pass these params through.

**Fix:** Modify `LLMClient.generateJSON()` in `packages/integrations/src/llm/client.ts` to forward all params:
```typescript
async generateJSON<T>(params: LLMGenerateParams): Promise<T> {
  const response = await this.client.chat.completions.create({
    model: params.model || this.defaultModel,
    messages: [...],
    max_tokens: params.maxTokens || 1500,     // ADD
    temperature: params.temperature || 0.7,    // ADD
    response_format: { type: 'json_object' },
  });
  return JSON.parse(response.choices[0].message.content);
}
```

---

### Fix 8: `storeAgentBrief()` and `logStep()` not awaited in dispatcher

**Problem:** Inside `Promise.allSettled().then()`, DB writes are fire-and-forget. If they fail, the investigation status polling endpoint returns wrong data.

**Fix:** Await both calls:
```typescript
.then(async (brief) => {
  await storeAgentBrief(db, runId, brief);
  await logStep(db, runId, agent.id, 'info', `Completed: ${brief.findings.length} findings`);
  return brief;
})
```

---

### Fix 9: Multiple active voice profiles possible

**Problem:** `analyzeVoice()` creates a new profile with `is_active: true` but never deactivates the old one.

**Fix:** Add deactivation before insert:
```typescript
// Before storing new profile
await db.from('voice_profiles')
  .update({ is_active: false })
  .eq('is_active', true);

// Then insert new profile with is_active: true
await storeVoiceProfile(db, profile);
```

---

### Fix 10: 300s timeout insufficient for 5-signal overnight batch

**Problem:** 5 signals × ~90s per swarm dispatch (sequential) = 450s, exceeding the 300s Vercel function limit.

**Fix:** Two options:

**Option A (recommended):** Split overnight batch into chained function calls. The orchestrator dispatches one Vercel cron for each major step:
```
5:00 AM — /api/cron/pipeline-run        (runs pipelines, 120s max)
5:03 AM — /api/cron/investigate-batch    (investigates top 5 signals, 300s max)
5:08 AM — /api/cron/creation-batch       (generates angles + drafts, 300s max)
5:13 AM — /api/cron/intelligence-batch   (trends + collisions + callbacks, 120s max)
5:15 AM — /api/cron/menu-assemble        (assembles daily menu, 30s max)
```

Each step reads from DB (previous step's output) and writes to DB. No shared state. If one fails, the next steps still run with whatever data is available.

**Option B:** Process signals in parallel within the swarm (already done) AND run investigation + creation in parallel across signals using `Promise.allSettled()`:
```typescript
// Instead of sequential:
for (const signal of topSignals) { await investigate(signal); }

// Parallel:
await Promise.allSettled(topSignals.map(signal => investigateAndCreate(signal)));
```
This brings 5 signals from 450s to ~90s. Fits in 300s budget.

**Recommendation:** Use Option B for simplicity, with Option A as an upgrade if batch size grows beyond 5.

---

### Fix 11: SSRF risk in Tech Agent URL fetch

**Problem:** Tech Agent fetches `signal.url` directly. A malicious signal could point to internal network endpoints.

**Fix:** Add URL validation:
```typescript
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS
    if (parsed.protocol !== 'https:') return false;
    // Block internal IPs
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
    if (hostname.startsWith('169.254.')) return false; // AWS metadata
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;
    return true;
  } catch { return false; }
}
```

---

### Fix 12: Cron auth inlined without null guard

**Fix:** Use existing `verifyCronAuth()` utility from `apps/web/src/app/api/cron/_lib/auth.ts` instead of inlining the check.

---

### Fix 13: `content_memory` uses `updated_at` instead of `published_at`

**Fix in `03-persistent-intelligence.md`:**
```typescript
// CHANGE from: published_at: item.data.updated_at,
// TO:
published_at: item.data.published_at || item.data.updated_at,
```

---

### Fix 14: `Stance` type missing `lastExpressed` in Phase 3 extraction

**Fix:** Split into two types:
```typescript
// In content memory (extracted from posts, no timestamp needed)
interface ExtractedStance {
  topic: string;
  position: string;
}

// In voice profile (accumulated over time, has timestamp)
interface Stance extends ExtractedStance {
  confidence: number;
  lastExpressed: Date;
}
```

---

### Fix 15: `findingRefs` out-of-range produces undefined

**Fix:** Add bounds checking in angle generator:
```typescript
supportingFindings: raw.findingRefs
  .filter(ref => ref >= 0 && ref < brief.topFindings.length)
  .map(ref => brief.topFindings[ref]),
```

---

### Fix 16: `createContent()` returns `null!` — not type-safe

**Fix:** Change return type to a discriminated union:
```typescript
type CreationResult =
  | { phase: 'angles_only'; angleCards: AngleCard[] }
  | { phase: 'complete'; angleCards: AngleCard[]; selectedAngle: AngleCard; storyArc: StoryArc; draft: Draft };
```
Callers use `if (result.phase === 'complete')` instead of null-checking.

---

### Fix 17: Yahoo Finance endpoint is unofficial and fragile

**Fix:** Add a circuit breaker + alternative data source:
```typescript
// Primary: Yahoo Finance (unofficial, may break)
// Fallback: Alpha Vantage free tier (5 calls/min, 500/day) — env: ALPHA_VANTAGE_API_KEY
// Last resort: skip stock data, return confidence: 0.1

async function fetchStockData(ticker: string): Promise<StockData | null> {
  try {
    return await fetchYahooFinance(ticker);
  } catch {
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      return await fetchAlphaVantage(ticker);
    }
    return null; // Graceful skip
  }
}
```

Add `ALPHA_VANTAGE_API_KEY` to optional env vars in master spec.

---

### Fix 18: Undefined functions referenced across specs

The following utility functions are referenced but never defined. They must be implemented:

| Function | Location | Definition |
|----------|----------|------------|
| `signalFromRow(row)` | Used in Phase 4 | Maps DB snake_case row to `ScoredSignal` camelCase. Define in `packages/pipelines/src/engine/utils.ts` |
| `runDuePipelines(db, llm)` | Used in Phase 4 batch | Iterates pipeline registry, checks schedule, runs due pipelines. Define in `packages/pipelines/src/engine/scheduler.ts` |
| `selectBestPlatforms(signal, count)` | Used in Phase 4 batch | Returns top N platforms based on pillar→platform mapping from registry. Define in `packages/core/src/pillars/utils.ts` |
| `defaultSwarmConfig` | Used in Phase 4 | Exported constant from `packages/intelligence/src/config.ts`: `{ enabledAgents: ['tech','finance','geopolitics','industry','deveco','history'], globalTimeout: 90000, maxConcurrent: 6 }` |
| `CallbackItem` | Used in Phase 4 | Type: `{ type: 'callback'; prediction: { contentItemId: string; prediction: Prediction }; resolution: string; evidence: string }`. Add to `00-master-spec.md` shared types. |
| `generateId()` | Used everywhere | Use `crypto.randomUUID()` (built into Node 18+). No import needed. Document this convention. |

---

### Fix 19: API route path collision (`[signalId]` vs `[runId]`)

**Fix:** Use a single dynamic segment name `[id]` and differentiate by HTTP method and path:
```
POST /api/investigate/[id]          → trigger investigation (id = signalId)
GET  /api/investigate/[id]/status   → get investigation status (id = runId)
GET  /api/investigate/[id]/brief    → get research brief (id = signalId)
```

Or better — use separate route prefixes:
```
POST /api/investigate/signal/[signalId]   → trigger
GET  /api/investigate/run/[runId]/status  → status
GET  /api/research-briefs/[signalId]      → get brief
```

---

### Fix 20: `ivfflat` index broken below 1000 rows

**Fix:** Use `hnsw` index instead (works well from row 1):
```sql
CREATE INDEX idx_content_memory_embedding ON content_memory
  USING hnsw (embedding vector_cosine_ops);
```
HNSW has slightly higher build time but correct recall at any row count.

---

### Fix 21: `PLATFORM_FORMATS` not exported from integrations package

**Fix:** Export it from `packages/integrations/src/llm/prompts.ts`:
```typescript
export const PLATFORM_FORMATS: Record<string, string> = { ... };
```

And import in creation package:
```typescript
import { PLATFORM_FORMATS } from '@influenceai/integrations';
```

---

### Fix 22: `SwarmConfig` missing `triggerType` field

**Fix in `01-investigation-swarm.md`:**
```typescript
interface SwarmConfig {
  enabledAgents: string[];
  globalTimeout: number;
  maxConcurrent: number;
  triggerType?: 'batch' | 'manual';  // ADD: optional, defaults to 'batch'
}
```

---

### Fix 23: `coverage_gap` menu items never assembled

**Fix:** Add coverage gap assembly to `assembleDailyMenu()`:
```typescript
// After other item types, add coverage gaps
const gaps = await findCoverageGaps(db, 14);
gaps.forEach(topic => {
  items.push({
    readiness: 'trend_alert',  // Reuse trend_alert readiness
    type: 'coverage_gap',
    title: `You haven't posted about "${topic}" in 2+ weeks`,
    reason: 'This topic is trending but uncovered.',
    estimatedEffort: '5 min',
    platforms: ['linkedin'],
    pillar: '',
  });
});
```

And implement `findCoverageGaps()` properly (compare recent signal topics against content memory topics using embedding similarity, not exact match).

---

### Fix 24: `ProductHunt` requires OAuth token

**Fix:** Add `PRODUCTHUNT_TOKEN` to optional env vars in master spec. If not set, Industry Agent skips ProductHunt data (same pattern as optional Crunchbase key).

---

### Fix 25: Daily menu upsert changes primary key on re-run

**Fix:** Omit `id` from the upsert:
```typescript
await db.from('daily_menus').upsert({
  // REMOVE: id: menu.id,
  menu_date: today,
  generated_at: menu.generatedAt,
  items: menu.items,
  stats: menu.stats,
}, { onConflict: 'menu_date' });
```

Then read the generated ID back if needed.

---

### Fix 26: GET endpoint for similar content should use POST

**Fix:** Change from:
```
GET /api/memory/similar?embedding={base64}
```
To:
```
POST /api/memory/similar
Body: { embedding: number[], threshold?: number, limit?: number }
```
