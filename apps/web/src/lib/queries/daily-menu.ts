import type { LLMClient } from '@influenceai/integrations';
import { findOpenPredictions } from '@influenceai/memory';
import type {
  DailyMenu,
  DailyMenuItem,
  DailyMenuStats,
  CallbackItem,
  MenuItemReadiness,
} from '@/lib/types/daily-menu';

// ---------------------------------------------------------------------------
// Priority calculation
// ---------------------------------------------------------------------------

export function calculatePriority(item: DailyMenuItem): number {
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

  // Recency bonus
  if (item.createdAt) {
    const ageHours =
      (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours < 6) score += 20;
    else if (ageHours < 24) score += 10;
    else if (ageHours < 48) score += 5;
  }

  // Type-specific bonuses
  if (item.type === 'collision') score += 15;
  if (item.type === 'prediction_check') score += 20;

  // Engagement estimate (for angle cards)
  if (
    item.angleCards?.some(
      (a: any) => a.estimated_engagement === 'high',
    )
  ) {
    score += 10;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Assemble daily menu
// ---------------------------------------------------------------------------

export async function assembleDailyMenu(db: any, callbacks: CallbackItem[] = []): Promise<DailyMenu> {
  const today = new Date().toISOString().split('T')[0];

  // Fetch all inputs in parallel
  const [readyDrafts, angleCards, trendAlerts, collisions] = await Promise.all([
    // Ready drafts: pending_review items from last 24h, sorted by quality
    db
      .from('content_items')
      .select('*')
      .eq('status', 'pending_review')
      .gte(
        'created_at',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      )
      .order('quality_score', { ascending: false })
      .limit(10),

    // Angle cards without selection (status = 'generated', last 24h)
    db
      .from('angle_cards')
      .select('*')
      .eq('status', 'generated')
      .gte(
        'created_at',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      ),

    // Trend alerts: strong_buy or buy signals from last 24h
    db
      .from('trend_analyses')
      .select('*, trend_entities!inner(name, type)')
      .in('signal', ['strong_buy', 'buy'])
      .gte(
        'analyzed_at',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      ),

    // Unprocessed collisions from last 48h
    db
      .from('collisions')
      .select('*')
      .eq('status', 'detected')
      .gte(
        'created_at',
        new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      )
      .order('story_potential', { ascending: false }),
  ]);

  const items: DailyMenuItem[] = [];

  // Ready-to-post drafts
  (readyDrafts.data || []).forEach((draft: any) => {
    items.push({
      id: crypto.randomUUID(),
      priority: 0,
      readiness: 'ready_to_post',
      type: 'researched_signal',
      title: draft.title || 'Untitled Draft',
      reason: `Quality score: ${draft.quality_score ?? 'N/A'}/10. ${draft.platform} post ready.`,
      draftId: draft.id,
      signalId: draft.signal_id,
      estimatedEffort: '30 sec',
      platforms: [draft.platform],
      pillar: draft.pillar_slug || '',
      createdAt: draft.created_at,
    });
  });

  // Angle-only items: group by research_brief_id
  const briefGroups = new Map<string, any[]>();
  (angleCards.data || []).forEach((card: any) => {
    const group = briefGroups.get(card.research_brief_id) || [];
    group.push(card);
    briefGroups.set(card.research_brief_id, group);
  });

  for (const [briefId, cards] of briefGroups) {
    items.push({
      id: crypto.randomUUID(),
      priority: 0,
      readiness: 'pick_an_angle',
      type: 'researched_signal',
      title: cards[0].hook || 'Pick an angle',
      reason: `${cards.length} angles available. Pick one to generate draft.`,
      researchBriefId: briefId,
      angleCards: cards,
      estimatedEffort: '1 min',
      platforms: ['linkedin', 'twitter'],
      pillar: '',
      createdAt: cards[0].created_at,
    });
  }

  // Trend alerts
  (trendAlerts.data || []).forEach((ta: any) => {
    items.push({
      id: crypto.randomUUID(),
      priority: 0,
      readiness: 'trend_alert',
      type: 'trend_change',
      title: `${ta.trend_entities?.name}: phase is now "${ta.phase}"`,
      reason: `Velocity: ${ta.velocity > 0 ? '+' : ''}${Number(ta.velocity).toFixed(1)}%. Signal: ${ta.signal}.`,
      trendAnalysisId: ta.id,
      estimatedEffort: '2 min',
      platforms: ['linkedin', 'twitter'],
      pillar: '',
      createdAt: ta.analyzed_at,
    });
  });

  // Collisions
  (collisions.data || []).forEach((c: any) => {
    items.push({
      id: crypto.randomUUID(),
      priority: 0,
      readiness: 'story_seed',
      type: 'collision',
      title: c.connection_narrative,
      reason: `Cross-domain: ${c.type}. Story potential: ${c.story_potential}.`,
      collisionId: c.id,
      estimatedEffort: '5 min',
      platforms: ['linkedin'],
      pillar: '',
      createdAt: c.created_at,
    });
  });

  // Callbacks (prediction resolutions)
  callbacks.forEach((cb) => {
    items.push({
      id: crypto.randomUUID(),
      priority: 0,
      readiness: 'callback',
      type: 'prediction_check',
      title: `Prediction resolved: ${cb.prediction.statement}`,
      reason: `${cb.resolution}: ${cb.evidence}`,
      predictionId: cb.contentItemId,
      estimatedEffort: '2 min',
      platforms: ['linkedin'],
      pillar: '',
    });
  });

  // Calculate priorities and sort
  items.forEach((item) => {
    item.priority = calculatePriority(item);
  });
  items.sort((a, b) => b.priority - a.priority);

  const stats: DailyMenuStats = {
    signalsProcessed: (readyDrafts.data || []).length,
    briefsGenerated: briefGroups.size,
    draftsReady: items.filter((i) => i.readiness === 'ready_to_post').length,
    callbacksFound: items.filter((i) => i.type === 'prediction_check').length,
    trendAlerts: items.filter((i) => i.type === 'trend_change').length,
    collisionsDetected: items.filter((i) => i.type === 'collision').length,
  };

  const menu: DailyMenu = {
    id: crypto.randomUUID(),
    date: today,
    generatedAt: new Date(),
    items: items.slice(0, 10),
    stats,
  };

  // Upsert menu (one per day) — omit id, let Postgres generate it
  const { data: upserted } = await db.from('daily_menus').upsert(
    {
      menu_date: today,
      generated_at: menu.generatedAt.toISOString(),
      items: menu.items,
      stats: menu.stats,
    },
    { onConflict: 'menu_date' },
  ).select('id').single();

  if (upserted) {
    menu.id = upserted.id;
  }

  return menu;
}

// ---------------------------------------------------------------------------
// Callback detection
// ---------------------------------------------------------------------------

export async function detectCallbacks(
  db: any,
  llm: LLMClient,
): Promise<CallbackItem[]> {
  const predictions = await findOpenPredictions(db);
  if (predictions.length === 0) return [];

  // Get recent signals
  const { data: recentSignals } = await db
    .from('content_signals')
    .select('title, summary')
    .gte(
      'ingested_at',
      new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    )
    .limit(30);

  if (!recentSignals || recentSignals.length === 0) return [];

  const result = await llm.generateJSON<{
    resolved: Array<{
      predictionIndex: number;
      status: 'correct' | 'wrong' | 'partially_correct';
      evidence: string;
    }>;
  }>({
    systemPrompt:
      'Check if any of these predictions have been resolved by recent events. Output JSON: { resolved: [{ predictionIndex, status: "correct"|"wrong"|"partially_correct", evidence }] }. Only include predictions clearly resolved. Empty array is fine.',
    userPrompt: `Open predictions:\n${predictions.map((p, i) => `[${i}] "${p.prediction.statement}" (timeframe: ${p.prediction.timeframe || 'none'})`).join('\n')}\n\nRecent signals:\n${recentSignals.map((s: any) => `- ${s.title}: ${s.summary}`).join('\n')}`,
    maxTokens: 400,
    temperature: 0.2,
  });

  return (result.resolved || [])
    .filter(
      (r) => r.predictionIndex >= 0 && r.predictionIndex < predictions.length,
    )
    .map((r) => ({
      type: 'callback' as const,
      contentItemId: predictions[r.predictionIndex].contentItemId,
      prediction: predictions[r.predictionIndex].prediction,
      resolution: r.status,
      evidence: r.evidence,
    }));
}

// ---------------------------------------------------------------------------
// Top uninvestigated signals
// ---------------------------------------------------------------------------

export async function getTopUninvestigatedSignals(
  db: any,
  limit: number = 5,
) {
  // Get signal IDs that already have research briefs
  const { data: investigatedIds } = await db
    .from('research_briefs')
    .select('signal_id');

  const excludeIds = (investigatedIds || [])
    .map((r: any) => r.signal_id)
    .filter(Boolean);

  // Get top signals from last 48h that haven't been investigated
  let query = db
    .from('content_signals')
    .select('*')
    .gte(
      'ingested_at',
      new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    )
    .gte('scored_relevance', 3)
    .order('scored_relevance', { ascending: false })
    .limit(limit);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch signals: ${error.message}`);
  return data || [];
}
