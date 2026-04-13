# Phase 4: Daily Menu & Interactive Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tie Phases 1-3 together into two user-facing workflows: a Morning Menu (overnight batch cron producing a prioritized dashboard) and an Interactive "Investigate Now" flow (real-time investigation with angle selection). Build all UI components for the new dashboard experience.

**Architecture:** Orchestration routes in `apps/web/api/`, UI components in `apps/web/components/`, new dashboard pages. Reads from all Phase 1-3 tables (read-only aggregation). Writes to `daily_menus` table. No new packages — this phase lives entirely in `apps/web`.

**Tech Stack:** Next.js 15 App Router, React, Tailwind CSS v4, shadcn/ui, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-11-content-intelligence/04-daily-menu.md`
**UI Spec:** `docs/superpowers/specs/2026-04-11-content-intelligence/06-ui-comprehensive.md`
**Errata:** Fixes 4 (persist drafts), 5 (no daily_menu_items table), 10 (parallel signals), 12 (cron auth), 23 (coverage gaps), 25 (upsert PK)

---

## File Structure

```
packages/database/supabase/migrations/
  00006_daily_menu.sql                              ← NEW: daily_menus table

apps/web/src/
  app/
    (dashboard)/
      page.tsx                                       ← MODIFY: show Daily Menu as primary view
      signals/
        page.tsx                                     ← NEW: Signal Inbox page
      investigate/
        [signalId]/
          page.tsx                                   ← NEW: Interactive investigation flow page
      trends/
        page.tsx                                     ← NEW: Trends dashboard page
    api/
      daily-menu/
        route.ts                                     ← NEW: GET today's menu / POST regenerate
      cron/
        overnight-batch/
          route.ts                                   ← NEW: Full overnight orchestration (8 steps)
  components/
    dashboard/
      daily-menu/
        menu-container.tsx                           ← NEW: Daily menu layout (server component)
        menu-header.tsx                              ← NEW: Stats bar + generation time
        menu-item-card.tsx                           ← NEW: Item card (5 readiness variants)
        angle-picker.tsx                             ← NEW: Expandable angle card selection
      investigation/
        investigation-progress.tsx                   ← NEW: Agent progress indicator (polling)
        research-brief-view.tsx                      ← NEW: Brief summary display
      signals/
        signal-inbox.tsx                             ← NEW: Signal list with "Investigate" buttons
  lib/
    queries/
      daily-menu.ts                                  ← NEW: assembleDailyMenu(), calculatePriority()
      callbacks.ts                                   ← NEW: detectCallbacks()
```

---

### Task 1: Database migration

**Files:**
- Create: `packages/database/supabase/migrations/00006_daily_menu.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration: 00006_daily_menu.sql

-- Daily menus (one per day, items as JSONB — Fix 5: no separate daily_menu_items table)
CREATE TABLE daily_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  items JSONB NOT NULL DEFAULT '[]',
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_menus_date ON daily_menus(menu_date DESC);

ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated all" ON daily_menus FOR ALL TO authenticated USING (true);
```

- [ ] **Step 2: Commit**

```bash
git add packages/database/supabase/migrations/00006_daily_menu.sql
git commit -m "feat(database): add daily_menus table"
```

---

### Task 2: Menu assembly + priority scoring

**Files:**
- Create: `apps/web/src/lib/queries/daily-menu.ts`
- Create: `apps/web/src/lib/queries/callbacks.ts`

- [ ] **Step 1: Write callback detection**

```typescript
// apps/web/src/lib/queries/callbacks.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { LLMClient } from '@influenceai/integrations';
import { findOpenPredictions } from '@influenceai/memory';

export interface CallbackItem {
  type: 'callback';
  prediction: { contentItemId: string; prediction: { statement: string; timeframe?: string; confidence: string; status: string } };
  resolution: 'correct' | 'wrong' | 'partial';
  evidence: string;
}

export async function detectCallbacks(db: SupabaseClient, llm: LLMClient): Promise<CallbackItem[]> {
  const predictions = await findOpenPredictions(db);
  if (predictions.length === 0) return [];

  const { data: recentSignals } = await db.from('content_signals')
    .select('title, summary')
    .gte('ingested_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(30);

  if (!recentSignals?.length) return [];

  const result = await llm.generateJSON<{ resolved: { predictionIndex: number; status: 'correct' | 'wrong' | 'partially_correct'; evidence: string }[] }>({
    systemPrompt: 'Check if any of these predictions have been resolved by recent events.',
    userPrompt: `Open predictions:\n${predictions.map((p, i) => `[${i}] "${p.prediction.statement}"`).join('\n')}\n\nRecent signals:\n${recentSignals.map(s => `- ${s.title}: ${s.summary}`).join('\n')}\n\nOutput JSON: { resolved: [{ predictionIndex, status, evidence }] }`,
    maxTokens: 400,
    temperature: 0.2,
  });

  return result.resolved.map(r => ({
    type: 'callback' as const,
    prediction: predictions[r.predictionIndex],
    resolution: r.status === 'partially_correct' ? 'partial' : r.status,
    evidence: r.evidence,
  }));
}
```

- [ ] **Step 2: Write menu assembly**

Create `apps/web/src/lib/queries/daily-menu.ts` following spec `04-daily-menu.md` Daily Menu Assembly section with these fixes:

- Fix 5: Do NOT query `daily_menu_items` table. Pass callbacks as parameter.
- Fix 23: Add coverage gap items from `findCoverageGaps()`.
- Fix 25: Omit `id` from the upsert — let Postgres generate it:

```typescript
export async function assembleDailyMenu(
  db: SupabaseClient,
  callbacks: CallbackItem[] = [],
): Promise<DailyMenu> {
  const today = new Date().toISOString().split('T')[0];

  // Fetch all inputs in parallel
  const [readyDrafts, angleCards, trendAlerts, collisions] = await Promise.all([
    db.from('content_items').select('*')
      .eq('status', 'pending_review')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('quality_score', { ascending: false }).limit(10),
    db.from('angle_cards').select('*')
      .eq('status', 'generated')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    db.from('trend_analyses').select('*, trend_entities!inner(name, type)')
      .in('signal', ['strong_buy', 'buy'])
      .gte('analyzed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    db.from('collisions').select('*')
      .eq('status', 'detected')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('story_potential', { ascending: false }),
  ]);

  const items: DailyMenuItem[] = [];

  // Build items from each source (see spec for full mapping)
  // ... ready drafts → readiness: 'ready_to_post'
  // ... angle card groups → readiness: 'pick_an_angle'
  // ... callbacks (passed as param, Fix 5) → readiness: 'callback'
  // ... trend alerts → readiness: 'trend_alert'
  // ... collisions → readiness: 'story_seed'
  // ... coverage gaps (Fix 23) → readiness: 'trend_alert', type: 'coverage_gap'

  // Calculate priorities and sort
  items.forEach(item => { item.priority = calculatePriority(item); });
  items.sort((a, b) => b.priority - a.priority);

  const menu = { /* ... build DailyMenu object ... */ };

  // Fix 25: Omit id from upsert
  await db.from('daily_menus').upsert({
    menu_date: today,
    generated_at: menu.generatedAt,
    items: menu.items,
    stats: menu.stats,
  }, { onConflict: 'menu_date' });

  return menu;
}

export function calculatePriority(item: DailyMenuItem): number {
  let score = 0;
  const baseScores = { ready_to_post: 80, callback: 70, story_seed: 60, trend_alert: 50, pick_an_angle: 40 };
  score += baseScores[item.readiness] ?? 30;
  if (item.type === 'collision') score += 15;
  if (item.type === 'prediction_check') score += 20;
  if (item.angleCards?.some(a => a.estimatedEngagement === 'high')) score += 10;
  return score;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/queries/daily-menu.ts apps/web/src/lib/queries/callbacks.ts
git commit -m "feat(menu): daily menu assembly with priority scoring + callback detection"
```

---

### Task 3: Overnight batch orchestration

**Files:**
- Create: `apps/web/src/app/api/cron/overnight-batch/route.ts`
- Modify: `apps/web/vercel.json` — add overnight batch cron

- [ ] **Step 1: Implement overnight batch route**

Follow spec `04-daily-menu.md` Overnight Batch Orchestration section with fixes:

```typescript
import { NextResponse } from 'next/server';
import { verifyCronAuth } from '../_lib/auth'; // Fix 12: use existing util
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { dispatchSwarm, defaultSwarmConfig } from '@influenceai/intelligence';
import { createContent } from '@influenceai/creation';
import { collectTrendData, analyzeTrends, detectCollisions } from '@influenceai/memory';
import { assembleDailyMenu } from '@/lib/queries/daily-menu';
import { detectCallbacks } from '@/lib/queries/callbacks';
import { insertContentItem } from '@influenceai/database';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await createClient();
  const llm = LLMClient.fromEnv();
  const results = { startedAt: new Date(), steps: [] as any[], status: 'pending' };

  // Each step wrapped in try/catch — failure continues to next step

  // STEP 1: Run existing pipelines
  // STEP 2: Collect trend data
  // STEP 3: Analyze trends
  // STEP 4: Detect collisions
  // STEP 5: Investigate top signals (Fix 10: parallel with Promise.allSettled)
  try {
    // Returns { dbId: string; signal: ScoredSignal }[] — dbId is the content_signals UUID
    const topSignals = await getTopUninvestigatedSignals(db, 5);
    const briefResults = await Promise.allSettled(
      topSignals.map(({ dbId, signal }) => dispatchSwarm(signal, dbId, defaultSwarmConfig, db, llm))
    );
    const briefs = briefResults.filter(r => r.status === 'fulfilled').map(r => r.value);
    results.steps.push({ name: 'investigation', briefsGenerated: briefs.length });

    // STEP 6: Generate angles + drafts (Fix 4: actually persist drafts)
    let draftsGenerated = 0;
    for (const brief of briefs) {
      const platforms = selectBestPlatforms(brief.signal, 2);
      for (const platform of platforms) {
        const creation = await createContent(brief, platform, { autoSelect: true }, db, llm);
        if (creation.phase === 'complete') {
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
    results.steps.push({ name: 'creation', draftsGenerated });
  } catch (err) {
    results.steps.push({ name: 'investigation+creation', error: String(err) });
  }

  // STEP 7: Check for prediction callbacks
  let callbacks = [];
  try { callbacks = await detectCallbacks(db, llm); } catch {}

  // STEP 8: Assemble daily menu (Fix 5: pass callbacks as param)
  try {
    const menu = await assembleDailyMenu(db, callbacks);
    results.steps.push({ name: 'menu', items: menu.items.length });
  } catch (err) {
    results.steps.push({ name: 'menu', error: String(err) });
  }

  results.status = 'completed';
  return NextResponse.json(results);
}
```

- [ ] **Step 2: Add helper functions**

`getTopUninvestigatedSignals(db, limit)` — returns `{ dbId: string; signal: ScoredSignal }[]`. Queries `content_signals` from last 48h with `scored_relevance >= 3` that don't have a `research_briefs` entry. `dbId` is the `content_signals.id` UUID (needed as the second arg to `dispatchSwarm`). `signal` is mapped via `signalFromRow()` from `packages/pipelines/src/engine/utils.ts`.

`selectBestPlatforms(signal, count)` — returns top N platforms based on pillar→platform mapping from pillar registry. Default: `['linkedin', 'twitter']`.

- [ ] **Step 3: Update vercel.json**

Add overnight batch cron to `apps/web/vercel.json`:
```json
{
  "path": "/api/cron/overnight-batch",
  "schedule": "0 5 * * *"
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/cron/overnight-batch/ apps/web/src/app/api/daily-menu/ apps/web/vercel.json
git commit -m "feat(api): overnight batch orchestration with cron schedule"
```

---

### Task 4: Daily Menu UI components

**Files:**
- Create: `apps/web/src/components/dashboard/daily-menu/menu-container.tsx`
- Create: `apps/web/src/components/dashboard/daily-menu/menu-header.tsx`
- Create: `apps/web/src/components/dashboard/daily-menu/menu-item-card.tsx`
- Create: `apps/web/src/components/dashboard/daily-menu/angle-picker.tsx`

- [ ] **Step 1: Implement MenuContainer (server component)**

```typescript
// apps/web/src/components/dashboard/daily-menu/menu-container.tsx
import { createClient } from '@/lib/supabase/server';
import { MenuHeader } from './menu-header';
import { MenuItemCard } from './menu-item-card';

export default async function DailyMenuContainer() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: menu } = await supabase
    .from('daily_menus').select('*').eq('menu_date', today).single();

  if (!menu) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-zinc-400">No menu generated yet. Check back after the overnight batch runs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MenuHeader stats={menu.stats} date={menu.menu_date} generatedAt={menu.generated_at} />
      <div className="space-y-3">
        {menu.items.map((item: any) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement MenuHeader**

Display stats bar: signals processed, briefs generated, drafts ready, callbacks found, trend alerts, collisions. Use zinc-900 bg, zinc-400 text for labels, white for numbers. Show generation time.

- [ ] **Step 3: Implement MenuItemCard (client component)**

Follow spec `04-daily-menu.md` Menu Item Card section — renders differently based on `readiness`:
- `ready_to_post` → green left border, "Review Draft" button → links to `/review/[draftId]`
- `pick_an_angle` → violet left border, "View Angles" button → expands AnglePicker
- `callback` → amber left border, "Write Follow-Up" button
- `trend_alert` → blue left border, "Write Post" / "Track Silently" buttons
- `story_seed` → orange left border, "Develop Story" / "See Research" buttons

Use shadcn/ui `Card`, `Button`, `Badge` components. Dark mode: zinc-950 bg, zinc-900 cards, color-coded left borders.

- [ ] **Step 4: Implement AnglePicker (client component)**

Follow spec `04-daily-menu.md` Angle Picker section. Expandable panel showing angle cards. Each card shows: angle type badge (violet), hook text, thesis, engagement level, domain source. "Select" button calls `POST /api/creation/draft` then navigates to `/review/[contentItemId]`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/daily-menu/
git commit -m "feat(ui): daily menu components (container, header, item card, angle picker)"
```

---

### Task 5: Investigation UI components

**Files:**
- Create: `apps/web/src/components/dashboard/investigation/investigation-progress.tsx`
- Create: `apps/web/src/components/dashboard/investigation/research-brief-view.tsx`

- [ ] **Step 1: Implement InvestigationProgress**

Follow spec `04-daily-menu.md` Investigation Progress section. Client component that polls `GET /api/investigate/run/[runId]/status` every 2 seconds. Displays agent-by-agent status with icons:
- `success` → green check (CheckCircle)
- `running` → violet spinning loader
- `pending` → gray circle
- `failed` → red X

Show agent name + duration when complete. Stop polling when overall status is not 'running'.

- [ ] **Step 2: Implement ResearchBriefView**

Displays the synthesized research brief: top findings (with importance badges), cross-domain connections (highlighted), suggested angles, unusual fact (callout box). Uses zinc-800 bg cards with zinc-100 text.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/investigation/
git commit -m "feat(ui): investigation progress + research brief display components"
```

---

### Task 6: New pages (Signals, Investigate, Trends)

**Files:**
- Create: `apps/web/src/app/(dashboard)/signals/page.tsx`
- Create: `apps/web/src/app/(dashboard)/investigate/[signalId]/page.tsx`
- Create: `apps/web/src/app/(dashboard)/trends/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx` — add DailyMenuContainer

- [ ] **Step 1: Modify home page**

Add `DailyMenuContainer` as the primary view on the home page, with existing stats/charts below:

```typescript
import DailyMenuContainer from '@/components/dashboard/daily-menu/menu-container';

export default async function DashboardPage() {
  return (
    <div className="space-y-8">
      <DailyMenuContainer />
      {/* Existing stats and charts remain below */}
    </div>
  );
}
```

- [ ] **Step 2: Create Signal Inbox page**

`/signals` — server component. Fetches recent `content_signals` ordered by `scored_relevance` DESC. Each signal card shows title, summary, source type badge, score, and an "Investigate" button that navigates to `/investigate/[signalId]`. Also show signals that already have research briefs with a "View Brief" link.

- [ ] **Step 3: Create Investigation page**

`/investigate/[signalId]` — client component. On mount:
1. Call `POST /api/investigate/signal/[signalId]`
2. If `status: 'already_investigated'`, fetch and display existing brief
3. If investigation started, show `InvestigationProgress` component
4. When investigation completes, show `ResearchBriefView` + `AnglePicker`
5. When angle selected, show draft generation progress, then redirect to `/review/[contentItemId]`

- [ ] **Step 4: Create Trends page**

`/trends` — server component. Fetches `trend_entities` joined with `trend_analyses`. Grid of trend cards showing: entity name, phase badge (color-coded), velocity sparkline (from `chart_data`), content signal (strong_buy/buy/hold/sell). Click through to trend detail.

- [ ] **Step 5: Update sidebar navigation**

Read the existing sidebar component. Add new navigation items:
- "Today's Menu" → `/` (already home)
- "Signals" → `/signals`
- "Trends" → `/trends`

Keep existing items (Content, Pipelines, Review, etc.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/page.tsx apps/web/src/app/\(dashboard\)/signals/ apps/web/src/app/\(dashboard\)/investigate/ apps/web/src/app/\(dashboard\)/trends/
git commit -m "feat(ui): signals inbox, investigation page, trends dashboard"
```

---

### Task 7: Daily menu API route

**Files:**
- Create: `apps/web/src/app/api/daily-menu/route.ts`

- [ ] **Step 1: Implement GET /api/daily-menu**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_menus').select('*').eq('menu_date', today).single();

    if (error || !data) {
      return NextResponse.json({ menu: null, message: 'No menu for today' });
    }

    return NextResponse.json({ menu: data });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/daily-menu/
git commit -m "feat(api): daily menu fetch endpoint"
```

---

### Task 8: End-to-end tests

**Files:**
- Create: `apps/web/src/__tests__/daily-menu.test.ts`
- Create: `apps/web/src/__tests__/batch.test.ts`

- [ ] **Step 1: Write daily menu unit tests**

```typescript
import { describe, it, expect } from 'vitest';
import { calculatePriority } from '@/lib/queries/daily-menu';

describe('Daily Menu', () => {
  it('ready_to_post items score 80+ priority', () => {
    const score = calculatePriority({ readiness: 'ready_to_post', type: 'researched_signal' } as any);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('collision items get +15 bonus', () => {
    const base = calculatePriority({ readiness: 'story_seed', type: 'researched_signal' } as any);
    const withCollision = calculatePriority({ readiness: 'story_seed', type: 'collision' } as any);
    expect(withCollision - base).toBe(15);
  });

  it('prediction_check items get +20 bonus', () => {
    const base = calculatePriority({ readiness: 'callback', type: 'researched_signal' } as any);
    const withPrediction = calculatePriority({ readiness: 'callback', type: 'prediction_check' } as any);
    expect(withPrediction - base).toBe(20);
  });

  it('sorted by priority descending', () => {
    // Test that assembleDailyMenu returns items sorted
  });
});
```

- [ ] **Step 2: Write callback detection tests**

```typescript
describe('Callback Detection', () => {
  it('empty when no open predictions', async () => {
    const callbacks = await detectCallbacks(mockDbNoPredictions, mockLlm);
    expect(callbacks).toEqual([]);
  });

  it('matches prediction against recent signals', async () => {
    const callbacks = await detectCallbacks(mockDbWithPredictions, mockLlm);
    expect(callbacks.length).toBeGreaterThan(0);
    expect(callbacks[0].resolution).toBeDefined();
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `pnpm vitest run`
Expected: All PASS across all packages

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/__tests__/
git commit -m "test(menu): daily menu priority scoring + callback detection tests"
```

---

### Task 9: Visual testing + polish

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Test Daily Menu page**

Navigate to `http://localhost:3000`. Verify:
- DailyMenuContainer renders (even with empty menu — shows fallback message)
- Sidebar has new navigation items (Signals, Trends)
- Dark mode styling is consistent (zinc-950 bg, zinc-900 cards, violet accents)

- [ ] **Step 3: Test Signals page**

Navigate to `/signals`. Verify:
- Signal cards render with source type badges and scores
- "Investigate" button is visible and navigates correctly

- [ ] **Step 4: Test Trends page**

Navigate to `/trends`. Verify:
- Trend cards render with entity name and phase badges
- Layout is responsive and consistent with design system

- [ ] **Step 5: Test Investigation flow**

Navigate to `/investigate/[signalId]` with a real signal ID. Verify:
- Progress indicator appears with agent names
- Brief view renders after completion (or shows error state)
- Angle picker expands and shows angle cards

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(phase4): daily menu UI, signals inbox, investigation flow, trends dashboard"
```

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | DB migration | SQL validation |
| 2 | Menu assembly + callbacks | — |
| 3 | Overnight batch orchestration | — |
| 4 | Daily Menu UI components | — |
| 5 | Investigation UI components | — |
| 6 | New pages (Signals, Investigate, Trends) | — |
| 7 | Daily menu API route | — |
| 8 | E2E tests | 5 menu/callback tests |
| 9 | Visual testing + polish | Manual browser verification |

**Total: ~5 tests, ~9 commits**

---

## Cross-Phase E2E Test (after all 4 phases complete)

After all phases are implemented, run this validation:

1. **Signal → Swarm → Brief:** Trigger a pipeline run. Verify signals appear in `content_signals`, investigation runs in `investigation_runs`, briefs in `research_briefs`.
2. **Brief → Angles → Draft → Review:** Verify angle cards in `angle_cards`, drafts in `content_items` with `status: pending_review`.
3. **Content → Memory:** Approve a content item. Verify it appears in `content_memory` with embedding.
4. **Trends → Menu:** Add a trend entity, run collector + analyzer. Verify trend alert appears in daily menu.
5. **Collision → Menu:** With multiple signals, run collision detector. Verify collision items in daily menu.
6. **Interactive flow:** Click "Investigate" on a signal. Verify agent progress, brief display, angle selection, draft generation.
7. **Degradation:** Disable all agents. Verify fallback brief is created and content generation still works.
