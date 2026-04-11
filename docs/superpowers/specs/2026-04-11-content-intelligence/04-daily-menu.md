# Phase 4: Daily Menu & Interactive Mode

**Parent:** `00-master-spec.md`
**Layer:** 4 (Operations)
**Depends on:** Phases 1-3 outputs (research_briefs, angle_cards, content_items, content_memory, trend_analyses, collisions)
**Delivers:** Morning dashboard with curated menu, interactive "Investigate Now" flow, overnight batch orchestration

---

## Overview

This phase ties everything together into two user-facing workflows:

1. **Morning Menu (batch)** — Overnight cron runs the full pipeline. By morning, you see a prioritized menu of 5-7 ready-to-act items.
2. **Investigate Now (interactive)** — You see a signal and click "Investigate." The swarm runs in real-time, you pick an angle, review the draft.

Both use the same underlying components (Swarm, Creation Engine, Memory). The difference is timing and who makes decisions (auto vs. you).

---

## Package Structure

This phase primarily adds UI pages and API orchestration routes. No new package — it lives in `apps/web`.

```
apps/web/src/
  app/
    (dashboard)/
      page.tsx                    ← MODIFIED: Daily Menu becomes the home page
      investigate/
        [signalId]/
          page.tsx                ← NEW: Interactive investigation flow
    api/
      daily-menu/
        route.ts                  ← NEW: Generate/fetch daily menu
      investigate/
        [signalId]/
          route.ts                ← NEW: Trigger interactive investigation
          status/
            route.ts              ← NEW: Poll investigation progress
      cron/
        overnight-batch/
          route.ts                ← NEW: Full overnight orchestration
  components/
    dashboard/
      daily-menu/
        menu-container.tsx        ← NEW: Daily menu layout
        menu-item-card.tsx        ← NEW: Individual menu item (ready/angle/callback/alert)
        angle-picker.tsx          ← NEW: Angle card selection UI
        trend-alert-card.tsx      ← NEW: Trend phase change card with sparkline
        callback-card.tsx         ← NEW: Prediction resolved / follow-up card
        collision-card.tsx        ← NEW: Cross-domain story seed card
      investigation/
        investigation-progress.tsx ← NEW: Agent progress indicator
        research-brief-view.tsx    ← NEW: Research brief summary display
  lib/
    queries/
      daily-menu.ts              ← NEW: Menu assembly queries
      investigation.ts           ← NEW: Investigation status queries
```

---

## Overnight Batch Orchestration

### Cron Route: `/api/cron/overnight-batch`

Runs at ~5 AM daily. Orchestrates the full pipeline in sequence:

```typescript
export async function GET(request: Request) {
  // Verify cron secret (Vercel cron auth)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServerClient();
  const llm = LLMClient.fromEnv();
  const results: BatchResult = {
    startedAt: new Date(),
    steps: [],
  };

  try {
    // STEP 1: Run existing pipelines (ingest + dedup + filter)
    // Run enabled pipelines that are due based on their schedule
    const pipelineResults = await runDuePipelines(db, llm);
    results.steps.push({ name: 'pipelines', ...pipelineResults });

    // STEP 2: Collect trend data (Phase 3)
    const trendCollect = await collectTrendData(db);
    results.steps.push({ name: 'trend-collect', ...trendCollect });

    // STEP 3: Analyze trends (Phase 3)
    const trendAnalyze = await analyzeTrends(db);
    results.steps.push({ name: 'trend-analyze', count: trendAnalyze.length });

    // STEP 4: Detect collisions (Phase 3)
    const collisions = await detectCollisions(db, llm);
    results.steps.push({ name: 'collisions', count: collisions.length });

    // STEP 5: Run investigation swarm on top signals (Phase 1)
    const topSignals = await getTopUninvestigatedSignals(db, 5); // Top 5 new signals
    const briefs: ResearchBrief[] = [];
    for (const signal of topSignals) {
      const brief = await dispatchSwarm(signal, defaultSwarmConfig, db, llm);
      briefs.push(brief);
    }
    results.steps.push({ name: 'investigation', briefsGenerated: briefs.length });

    // STEP 6: Generate angles + drafts for each brief (Phase 2)
    let draftsGenerated = 0;
    for (const brief of briefs) {
      // Pick the best 2 platforms for this signal's pillar
      const platforms = selectBestPlatforms(brief.signal, 2);
      for (const platform of platforms) {
        const creation = await createContent(
          brief, platform, { autoSelect: true }, db, llm
        );
        if (creation.draft) draftsGenerated++;
      }
    }
    results.steps.push({ name: 'creation', draftsGenerated });

    // STEP 7: Check for prediction callbacks (Phase 3)
    const callbacks = await detectCallbacks(db, llm);
    results.steps.push({ name: 'callbacks', count: callbacks.length });

    // STEP 8: Assemble daily menu
    const menu = await assembleDailyMenu(db);
    results.steps.push({ name: 'menu', items: menu.items.length });

    results.completedAt = new Date();
    results.status = 'completed';

  } catch (error) {
    results.status = 'failed';
    results.error = error.message;
  }

  return Response.json(results);
}
```

**Max duration:** 300 seconds (Vercel Functions default). Each step has internal timeouts to stay within budget.

**Step failure handling:** Each step is wrapped in try/catch. A failed step logs the error and continues to the next step. The menu assembler works with whatever data is available.

### Helper: Get Top Uninvestigated Signals

```typescript
async function getTopUninvestigatedSignals(
  db: SupabaseClient,
  limit: number
): Promise<ScoredSignal[]> {
  // Signals that passed relevance filter but don't have a research brief yet
  const { data } = await db.from('content_signals')
    .select('*')
    .gte('ingested_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .gte('scored_relevance', 3)
    .not('id', 'in',
      db.from('research_briefs').select('signal_id')
    )
    .order('scored_relevance', { ascending: false })
    .limit(limit);

  return data.map(signalFromRow);
}
```

### Helper: Detect Callbacks

```typescript
async function detectCallbacks(
  db: SupabaseClient,
  llm: LLMClient
): Promise<CallbackItem[]> {
  // 1. Get all open predictions
  const predictions = await findOpenPredictions(db);
  if (predictions.length === 0) return [];

  // 2. Get recent signals (last 48h)
  const recentSignals = await db.from('content_signals')
    .select('title, summary')
    .gte('ingested_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .limit(30);

  // 3. Use LLM to check if any predictions were resolved
  const result = await llm.generateJSON<{ resolved: ResolvedPrediction[] }>({
    systemPrompt: 'Check if any of these predictions have been resolved by recent events.',
    userPrompt: `
Open predictions:
${predictions.map((p, i) => `[${i}] "${p.prediction.statement}" (made ${p.prediction.timeframe || 'no timeframe'})`).join('\n')}

Recent signals:
${recentSignals.data.map(s => `- ${s.title}: ${s.summary}`).join('\n')}

For each prediction that has been clearly confirmed or denied by a recent signal, output: { predictionIndex, status: "correct"|"wrong"|"partially_correct", evidence: "which signal resolved it" }
`,
    maxTokens: 400,
    temperature: 0.2,
  });

  // 4. Update prediction statuses and return callback items
  return result.resolved.map(r => ({
    type: 'callback' as const,
    prediction: predictions[r.predictionIndex],
    resolution: r.status,
    evidence: r.evidence,
  }));
}
```

---

## Daily Menu Assembly

```typescript
interface MenuAssemblyInput {
  readyDrafts: ContentItem[];           // Content items generated overnight, status: pending_review
  angleCards: AngleCard[];               // Generated but not yet selected
  callbacks: CallbackItem[];             // Resolved predictions
  trendAlerts: TrendAnalysis[];          // Phase changes detected today
  collisions: Collision[];               // Unprocessed collisions
  coverageGaps: string[];               // Topics trending but uncovered
}

async function assembleDailyMenu(db: SupabaseClient): Promise<DailyMenu> {
  const today = new Date().toISOString().split('T')[0];

  // Fetch all inputs
  const [readyDrafts, angleCards, callbacks, trendAlerts, collisions] = await Promise.all([
    // Ready drafts: items generated in last 24h, pending review
    db.from('content_items')
      .select('*, content_signals!inner(title, url)')
      .eq('status', 'pending_review')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('quality_score', { ascending: false })
      .limit(10),

    // Angle cards without selected status (user hasn't picked yet)
    db.from('angle_cards')
      .select('*')
      .eq('status', 'generated')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

    // Recent callbacks (from overnight detection)
    db.from('daily_menu_items')
      .select('*')
      .eq('type', 'callback')
      .eq('menu_date', today),

    // Trend alerts: entities where phase changed in last analysis
    db.from('trend_analyses')
      .select('*, trend_entities!inner(name, type)')
      .in('signal', ['strong_buy', 'buy'])
      .gte('analyzed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

    // Unprocessed collisions
    db.from('collisions')
      .select('*')
      .eq('status', 'detected')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('story_potential', { ascending: false }),
  ]);

  // Build menu items
  const items: DailyMenuItem[] = [];

  // Ready-to-post drafts
  readyDrafts.data?.forEach(draft => {
    items.push({
      id: generateId(),
      priority: 0,  // Calculated below
      readiness: 'ready_to_post',
      type: 'researched_signal',
      title: draft.title,
      reason: `Quality score: ${draft.quality_score}/10. ${draft.platform} post ready.`,
      draftId: draft.id,
      signalId: draft.signal_id,
      estimatedEffort: '30 sec',
      platforms: [draft.platform],
      pillar: draft.pillar_slug,
    });
  });

  // Angle-only items (research done, needs angle selection)
  // Group angle cards by research_brief_id
  const briefGroups = new Map<string, typeof angleCards.data>();
  angleCards.data?.forEach(card => {
    const group = briefGroups.get(card.research_brief_id) || [];
    group.push(card);
    briefGroups.set(card.research_brief_id, group);
  });

  for (const [briefId, cards] of briefGroups) {
    items.push({
      id: generateId(),
      priority: 0,
      readiness: 'pick_an_angle',
      type: 'researched_signal',
      title: cards[0].hook, // Use first angle's hook as preview
      reason: `${cards.length} angles available. Pick one to generate draft.`,
      researchBriefId: briefId,
      angleCards: cards,
      estimatedEffort: '1 min',
      platforms: ['linkedin', 'twitter'], // Default platforms
      pillar: '',
    });
  }

  // Callbacks
  callbacks.data?.forEach(cb => {
    items.push({
      id: generateId(),
      priority: 0,
      readiness: 'callback',
      type: 'prediction_check',
      title: cb.title,
      reason: cb.reason,
      predictionId: cb.metadata?.predictionId,
      estimatedEffort: '2 min',
      platforms: ['linkedin'],
      pillar: '',
    });
  });

  // Trend alerts
  trendAlerts.data?.forEach(ta => {
    items.push({
      id: generateId(),
      priority: 0,
      readiness: 'trend_alert',
      type: 'trend_change',
      title: `${ta.trend_entities.name}: phase is now "${ta.phase}"`,
      reason: `Velocity: ${ta.velocity > 0 ? '+' : ''}${ta.velocity.toFixed(1)}. Signal: ${ta.signal}.`,
      trendAnalysisId: ta.id,
      estimatedEffort: '2 min',
      platforms: ['linkedin', 'twitter'],
      pillar: '',
    });
  });

  // Collisions
  collisions.data?.forEach(c => {
    items.push({
      id: generateId(),
      priority: 0,
      readiness: 'story_seed',
      type: 'collision',
      title: c.connection_narrative,
      reason: `Cross-domain: ${c.type}. Story potential: ${c.story_potential}.`,
      collisionId: c.id,
      estimatedEffort: '5 min',
      platforms: ['linkedin'],
      pillar: '',
    });
  });

  // Calculate priorities
  items.forEach(item => {
    item.priority = calculatePriority(item);
  });

  // Sort by priority (highest first)
  items.sort((a, b) => b.priority - a.priority);

  // Store menu
  const menu: DailyMenu = {
    id: generateId(),
    date: today,
    generatedAt: new Date(),
    items: items.slice(0, 10), // Top 10 items
    stats: {
      signalsProcessed: readyDrafts.data?.length ?? 0,
      briefsGenerated: briefGroups.size,
      draftsReady: items.filter(i => i.readiness === 'ready_to_post').length,
      callbacksFound: items.filter(i => i.type === 'prediction_check').length,
      trendAlerts: items.filter(i => i.type === 'trend_change').length,
      collisionsDetected: items.filter(i => i.type === 'collision').length,
    },
  };

  await db.from('daily_menus').upsert({
    id: menu.id,
    menu_date: today,
    generated_at: menu.generatedAt,
    items: menu.items,
    stats: menu.stats,
  }, { onConflict: 'menu_date' });

  return menu;
}
```

### Priority Scoring

```typescript
function calculatePriority(item: DailyMenuItem): number {
  let score = 0;

  // Base score by readiness
  const baseScores: Record<MenuItemReadiness, number> = {
    ready_to_post: 80,
    callback: 70,
    story_seed: 60,
    trend_alert: 50,
    pick_an_angle: 40,
  };
  score += baseScores[item.readiness] ?? 30;

  // Recency bonus (only for items with a signal)
  // Estimated from creation time
  const ageHours = (Date.now() - new Date(item.createdAt ?? Date.now()).getTime()) / (1000 * 60 * 60);
  if (ageHours < 6) score += 20;
  else if (ageHours < 24) score += 10;
  else if (ageHours < 48) score += 5;

  // Type-specific bonuses
  if (item.type === 'collision') score += 15;       // Cross-domain = highly original
  if (item.type === 'prediction_check') score += 20; // Resolved predictions = authority builder

  // Engagement estimate (for angle cards)
  if (item.angleCards?.some(a => a.estimatedEngagement === 'high')) score += 10;

  return score;
}
```

---

## Interactive Investigation Flow

### API Route: `POST /api/investigate/{signalId}`

```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ signalId: string }> }
) {
  const { signalId } = await params;
  const db = createServerClient();
  const llm = LLMClient.fromEnv();

  // 1. Fetch the signal
  const { data: signal } = await db.from('content_signals')
    .select('*')
    .eq('id', signalId)
    .single();

  if (!signal) {
    return Response.json({ error: 'Signal not found' }, { status: 404 });
  }

  // 2. Check if already investigated
  const { data: existing } = await db.from('research_briefs')
    .select('id')
    .eq('signal_id', signalId)
    .single();

  if (existing) {
    return Response.json({
      researchBriefId: existing.id,
      status: 'already_investigated',
    });
  }

  // 3. Dispatch swarm
  const brief = await dispatchSwarm(
    signalFromRow(signal),
    { ...defaultSwarmConfig, triggerType: 'manual' },
    db,
    llm
  );

  // 4. Generate angle cards immediately
  const platforms: Platform[] = ['linkedin', 'twitter']; // Default platforms
  const angleCards: AngleCard[] = [];
  for (const platform of platforms) {
    const cards = await generateAngles(brief, platform, llm);
    await storeAngleCards(db, cards);
    angleCards.push(...cards);
  }

  return Response.json({
    researchBriefId: brief.id,
    status: brief.coverage.failed > 0 ? 'partial' : 'completed',
    coverage: brief.coverage,
    angleCards,
    durationMs: Date.now() - new Date(brief.createdAt).getTime(),
  });
}
```

### API Route: `GET /api/investigate/{runId}/status`

For polling progress during interactive investigation:

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const db = createServerClient();

  const { data: run } = await db.from('investigation_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (!run) {
    return Response.json({ error: 'Run not found' }, { status: 404 });
  }

  // Get individual agent statuses
  const { data: agentBriefs } = await db.from('agent_briefs')
    .select('agent_id, status, duration_ms, created_at')
    .eq('investigation_run_id', runId)
    .order('created_at', { ascending: true });

  // Build agent status map
  const dispatched = run.agents_list || [];
  const agentStatuses = dispatched.map(agentId => {
    const brief = agentBriefs?.find(b => b.agent_id === agentId);
    return {
      id: agentId,
      status: brief ? brief.status : (run.status === 'running' ? 'running' : 'pending'),
      durationMs: brief?.duration_ms,
    };
  });

  return Response.json({
    runId,
    status: run.status,
    agents: agentStatuses,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  });
}
```

---

## UI Components

### Daily Menu Container (`menu-container.tsx`)

The main dashboard component. Replaces or augments the current Command Center.

```typescript
// Server component — fetches today's menu
export default async function DailyMenuContainer() {
  const db = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: menu } = await db.from('daily_menus')
    .select('*')
    .eq('menu_date', today)
    .single();

  // If no menu yet (before overnight batch), show recent signals instead
  if (!menu) {
    return <FallbackSignalList />;
  }

  return (
    <div>
      <MenuHeader stats={menu.stats} date={menu.menu_date} />
      <div className="space-y-4">
        {menu.items.map(item => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
```

### Menu Item Card (`menu-item-card.tsx`)

Renders differently based on `readiness`:

```typescript
'use client';

export function MenuItemCard({ item }: { item: DailyMenuItem }) {
  switch (item.readiness) {
    case 'ready_to_post':
      return (
        <Card className="border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="text-green-400">READY TO POST</span>
            <span>{item.estimatedEffort}</span>
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mt-1">{item.title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{item.reason}</p>
          <div className="flex gap-2 mt-3">
            <Link href={`/review/${item.draftId}`}>
              <Button size="sm">Review Draft</Button>
            </Link>
            <Button size="sm" variant="ghost">See Other Angles</Button>
            <Button size="sm" variant="ghost">Skip</Button>
          </div>
        </Card>
      );

    case 'pick_an_angle':
      return (
        <Card className="border-l-4 border-l-violet-500">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="text-violet-400">PICK AN ANGLE</span>
            <span>{item.estimatedEffort}</span>
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mt-1">{item.title}</h3>
          <p className="text-sm text-zinc-400 mt-1">
            {item.angleCards?.length} angles available
          </p>
          <div className="flex gap-2 mt-3">
            <AnglePicker angleCards={item.angleCards} briefId={item.researchBriefId} />
            <Button size="sm" variant="ghost">Skip</Button>
          </div>
        </Card>
      );

    case 'callback':
      return (
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="text-amber-400">CALLBACK OPPORTUNITY</span>
            <span>{item.estimatedEffort}</span>
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mt-1">{item.title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{item.reason}</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm">Write Follow-Up</Button>
            <Button size="sm" variant="ghost">Dismiss</Button>
          </div>
        </Card>
      );

    case 'trend_alert':
      return (
        <Card className="border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="text-blue-400">TREND ALERT</span>
            <span>{item.estimatedEffort}</span>
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mt-1">{item.title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{item.reason}</p>
          {/* Sparkline chart would go here */}
          <div className="flex gap-2 mt-3">
            <Button size="sm">Write Post</Button>
            <Button size="sm" variant="ghost">Track Silently</Button>
            <Button size="sm" variant="ghost">Skip</Button>
          </div>
        </Card>
      );

    case 'story_seed':
      return (
        <Card className="border-l-4 border-l-orange-500">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="text-orange-400">COLLISION DETECTED</span>
            <span>{item.estimatedEffort}</span>
          </div>
          <h3 className="text-lg font-medium text-zinc-100 mt-1">{item.title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{item.reason}</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm">Develop Story</Button>
            <Button size="sm" variant="ghost">See Research</Button>
            <Button size="sm" variant="ghost">Skip</Button>
          </div>
        </Card>
      );
  }
}
```

### Angle Picker (`angle-picker.tsx`)

Expandable panel showing angle cards:

```typescript
'use client';

export function AnglePicker({ angleCards, briefId }: {
  angleCards: AngleCard[];
  briefId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleSelect = async (angleId: string) => {
    setGenerating(true);
    const response = await fetch('/api/creation/draft', {
      method: 'POST',
      body: JSON.stringify({ researchBriefId: briefId, angleCardId: angleId, platform: 'linkedin' }),
    });
    const result = await response.json();
    // Navigate to review page with generated draft
    window.location.href = `/review/${result.contentItemId}`;
  };

  if (!expanded) {
    return <Button size="sm" onClick={() => setExpanded(true)}>View Angles</Button>;
  }

  return (
    <div className="grid gap-3 mt-3">
      {angleCards.map(card => (
        <div key={card.id} className="p-3 rounded-lg bg-zinc-800 border border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-violet-400 uppercase">
              {card.angleType.replace('_', ' ')}
            </span>
            <span className={`text-xs ${
              card.estimatedEngagement === 'high' ? 'text-green-400' :
              card.estimatedEngagement === 'medium' ? 'text-amber-400' : 'text-zinc-500'
            }`}>
              {card.estimatedEngagement} engagement
            </span>
          </div>
          <p className="text-zinc-100 mt-1 font-medium">"{card.hook}"</p>
          <p className="text-zinc-400 text-sm mt-1">{card.thesis}</p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-zinc-500">via {card.domainSource} agent</span>
            <Button
              size="sm"
              onClick={() => handleSelect(card.id)}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Select'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Investigation Progress (`investigation-progress.tsx`)

Shows real-time agent status during interactive investigation:

```typescript
'use client';

export function InvestigationProgress({ runId }: { runId: string }) {
  const [status, setStatus] = useState<InvestigationStatus | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/investigate/${runId}/status`);
      const data = await res.json();
      setStatus(data);
      if (data.status !== 'running') clearInterval(interval);
    }, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [runId]);

  if (!status) return <Skeleton />;

  const agentLabels: Record<string, string> = {
    tech: 'Tech Deep-Dive',
    finance: 'Finance',
    geopolitics: 'Geopolitics',
    industry: 'Industry Impact',
    deveco: 'Dev Ecosystem',
    history: 'Historical Pattern',
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-zinc-400">
        Investigating signal across {status.agents.length} domains...
      </p>
      {status.agents.map(agent => (
        <div key={agent.id} className="flex items-center gap-3 text-sm">
          {agent.status === 'success' && <CheckCircle className="h-4 w-4 text-green-400" />}
          {agent.status === 'running' && <Loader className="h-4 w-4 text-violet-400 animate-spin" />}
          {agent.status === 'pending' && <Circle className="h-4 w-4 text-zinc-600" />}
          {agent.status === 'failed' && <XCircle className="h-4 w-4 text-red-400" />}
          <span className="text-zinc-300">{agentLabels[agent.id] || agent.id}</span>
          {agent.durationMs && (
            <span className="text-zinc-500">{(agent.durationMs / 1000).toFixed(1)}s</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Database Schema

```sql
-- Migration: 00006_daily_menu.sql

-- Daily menus (one per day)
CREATE TABLE daily_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  items JSONB NOT NULL DEFAULT '[]',
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_menus_date ON daily_menus(menu_date DESC);

-- RLS
ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated all" ON daily_menus FOR ALL TO authenticated USING (true);
```

Note: Daily menu items are stored as JSONB within the `daily_menus` row rather than a separate table. This keeps the query simple (one fetch for the whole menu) and the data is transient (regenerated daily).

---

## Cron Configuration

Add to Vercel cron config:

```json
{
  "crons": [
    {
      "path": "/api/cron/overnight-batch",
      "schedule": "0 5 * * *"
    }
  ]
}
```

The overnight batch route internally calls all the sub-steps. Individual cron routes from Phase 3 (`/api/cron/trend-collect`, `/api/cron/collision-detect`) are still available for manual/independent triggering but are not separately scheduled — the overnight batch handles sequencing.

---

## Integration with Existing Pages

### Home Page Modification

The current `apps/web/src/app/(dashboard)/page.tsx` (Command Center) is modified to show the Daily Menu as the primary view, with existing stats/charts below:

```typescript
export default async function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* NEW: Daily Menu at the top */}
      <DailyMenuContainer />

      {/* EXISTING: Stats and charts below */}
      <StatsGrid />
      <ContentTrendsChart />
    </div>
  );
}
```

### Signal Cards Get "Investigate" Button

Wherever signals are displayed (content library, pipeline detail pages), add an "Investigate" button:

```typescript
// In signal/content card component
<Button
  size="sm"
  variant="outline"
  onClick={() => router.push(`/investigate/${signalId}`)}
>
  Investigate
</Button>
```

---

## Implementation Steps (for planning phase)

1. Create DB migration for daily_menus table
2. Implement overnight batch orchestration route
3. Implement daily menu assembly logic (priority scoring, grouping)
4. Implement callback detection (prediction resolution matching)
5. Implement interactive investigation API route
6. Implement investigation status polling API route
7. Build DailyMenuContainer server component
8. Build MenuItemCard client component (all 5 readiness variants)
9. Build AnglePicker client component
10. Build InvestigationProgress client component
11. Build investigation detail page (`/investigate/[signalId]`)
12. Modify home page to show Daily Menu
13. Add "Investigate" button to signal display components
14. Configure Vercel cron for overnight batch
15. End-to-end testing: batch flow + interactive flow
