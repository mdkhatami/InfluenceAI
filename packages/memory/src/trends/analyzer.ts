import type { LLMClient } from '@influenceai/integrations';
import type { TrendAnalysis, TrendPhase, ContentSignal, TrendEntity, Entity, EntityMeta } from '../types';

// ---------------------------------------------------------------------------
// Metric selection
// ---------------------------------------------------------------------------

/**
 * Selects the best primary metric for an entity based on availability.
 * Priority: githubStars > npmDownloads > pypiDownloads > hnMentions.
 * Entity-specific packages/repos shift the preference.
 */
export function selectPrimaryMetric(
  entity: Pick<TrendEntity, 'github_repo' | 'npm_package' | 'pypi_package'>,
  points: Array<{ metrics: Record<string, number | null> }>,
): string {
  const metricPriority: Array<{ key: string; entityField: keyof Pick<TrendEntity, 'github_repo' | 'npm_package' | 'pypi_package'> | null }> = [
    { key: 'githubStars', entityField: 'github_repo' },
    { key: 'npmDownloads', entityField: 'npm_package' },
    { key: 'pypiDownloads', entityField: 'pypi_package' },
    { key: 'hnMentions', entityField: null },
  ];

  // Prefer metrics where the entity has the corresponding field set
  for (const { key, entityField } of metricPriority) {
    if (entityField && entity[entityField]) {
      const hasValues = points.filter(
        (p) => p.metrics[key] !== undefined && p.metrics[key] !== null,
      ).length;
      if (hasValues > points.length / 2) return key;
    }
  }

  // Fallback: pick the first metric with data in most points
  for (const { key } of metricPriority) {
    const hasValues = points.filter(
      (p) => p.metrics[key] !== undefined && p.metrics[key] !== null,
    ).length;
    if (hasValues > points.length / 2) return key;
  }

  return 'hnMentions';
}

// ---------------------------------------------------------------------------
// Velocity & acceleration
// ---------------------------------------------------------------------------

/**
 * Average weekly percentage change over the last 2 weeks.
 * Compares the average of the last 7 values with the previous 7 values.
 */
export function computeVelocity(
  values: Array<{ date: string; value: number }>,
): number {
  if (values.length < 14) return 0;

  const recent = values.slice(-7);
  const previous = values.slice(-14, -7);

  const recentAvg = recent.reduce((s, v) => s + v.value, 0) / recent.length;
  const previousAvg = previous.reduce((s, v) => s + v.value, 0) / previous.length;

  return ((recentAvg - previousAvg) / (previousAvg || 1)) * 100;
}

/**
 * Change in velocity: velocity of last 2 weeks minus velocity of weeks 3-4.
 * Needs at least 28 data points; returns 0 otherwise.
 */
export function computeAcceleration(
  values: Array<{ date: string; value: number }>,
): number {
  if (values.length < 28) return 0;

  // Velocity for last 2 weeks (index -14..-1)
  const recentLast7 = values.slice(-7);
  const recentPrev7 = values.slice(-14, -7);
  const recentAvgLast = recentLast7.reduce((s, v) => s + v.value, 0) / recentLast7.length;
  const recentAvgPrev = recentPrev7.reduce((s, v) => s + v.value, 0) / recentPrev7.length;
  const velocityRecent = ((recentAvgLast - recentAvgPrev) / (recentAvgPrev || 1)) * 100;

  // Velocity for weeks 3-4 (index -28..-15)
  const olderLast7 = values.slice(-21, -14);
  const olderPrev7 = values.slice(-28, -21);
  const olderAvgLast = olderLast7.reduce((s, v) => s + v.value, 0) / olderLast7.length;
  const olderAvgPrev = olderPrev7.reduce((s, v) => s + v.value, 0) / olderPrev7.length;
  const velocityOlder = ((olderAvgLast - olderAvgPrev) / (olderAvgPrev || 1)) * 100;

  return velocityRecent - velocityOlder;
}

// ---------------------------------------------------------------------------
// Phase detection
// ---------------------------------------------------------------------------

export function detectPhase(
  velocity: number,
  acceleration: number,
  values: Array<{ date: string; value: number }>,
): TrendPhase {
  const recent = values.slice(-7);
  const avgRecent = recent.reduce((sum, v) => sum + v.value, 0) / recent.length;

  if (avgRecent < 10) return 'emerging';
  if (velocity > 0 && acceleration > 0) return 'accelerating';
  if (velocity > 0 && acceleration <= 0) return 'peak';
  if (velocity < 0 && acceleration < 0) return 'decelerating';
  if (Math.abs(velocity) < 2) return 'plateau'; // < 2% weekly change
  if (velocity < 0) return 'declining';
  return 'emerging';
}

// ---------------------------------------------------------------------------
// Content signal
// ---------------------------------------------------------------------------

export function computeContentSignal(
  phase: TrendPhase,
  _velocity: number,
  yourPostCount: number,
): ContentSignal {
  if (phase === 'accelerating' && yourPostCount < 2) return 'strong_buy';
  if (phase === 'accelerating') return 'buy';
  if (phase === 'peak' && yourPostCount < 3) return 'buy';
  if (phase === 'peak') return 'hold';
  if (phase === 'decelerating') return 'sell';
  if (phase === 'declining') return 'strong_sell';
  return 'hold';
}

// ---------------------------------------------------------------------------
// Main analysis pipeline
// ---------------------------------------------------------------------------

export async function analyzeTrends(db: any): Promise<TrendAnalysis[]> {
  const { data: entities, error } = await db
    .from('trend_entities')
    .select('*')
    .eq('is_active', true);

  if (error) throw new Error(`Failed to fetch entities: ${error.message}`);
  if (!entities || entities.length === 0) return [];

  const analyses: TrendAnalysis[] = [];

  for (const entity of entities) {
    // Fetch last 12 weeks of data points
    const { data: points } = await db
      .from('trend_data_points')
      .select('*')
      .eq('entity_id', entity.id)
      .order('measured_at', { ascending: true })
      .limit(84); // 12 weeks x 7 days

    if (!points || points.length < 14) continue; // Need at least 2 weeks

    // Pick the best available primary metric
    const metricKey = selectPrimaryMetric(entity, points);
    const values = points.map((p: any) => ({
      date: p.measured_at as string,
      value: (p.metrics[metricKey] as number) ?? 0,
    }));

    const velocity = computeVelocity(values);
    const acceleration = computeAcceleration(values);
    const phase = detectPhase(velocity, acceleration, values);

    // Content signal based on phase + your coverage
    const yourPosts = points[points.length - 1]?.metrics?.yourPostCount ?? 0;
    const signal = computeContentSignal(phase, velocity, yourPosts as number);

    const analysis: TrendAnalysis = {
      entityId: entity.id as string,
      entityName: entity.name as string,
      phase,
      velocity,
      acceleration,
      patternMatch: null, // Future: historical pattern matching
      signal,
      chartData: values.slice(-28), // Last 4 weeks
      analyzedAt: new Date(),
    };

    // Upsert (one analysis per entity)
    await db.from('trend_analyses').upsert(
      {
        entity_id: entity.id,
        phase: analysis.phase,
        velocity: analysis.velocity,
        acceleration: analysis.acceleration,
        pattern_match: analysis.patternMatch,
        signal: analysis.signal,
        chart_data: analysis.chartData,
        analyzed_at: analysis.analyzedAt.toISOString(),
      },
      { onConflict: 'entity_id' },
    );

    analyses.push(analysis);
  }

  return analyses;
}

// ---------------------------------------------------------------------------
// Entity discovery
// ---------------------------------------------------------------------------

export async function discoverNewEntities(
  db: any,
  llm: LLMClient,
): Promise<TrendEntity[]> {
  // 1. Get entities from recent content_memory entries (last 14 days)
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentMemory } = await db
    .from('content_memory')
    .select('entities')
    .gte('published_at', cutoff)
    .limit(50);

  if (!recentMemory || recentMemory.length === 0) return [];

  // 2. Count entity mentions
  const entityCounts = new Map<string, number>();
  for (const row of recentMemory) {
    for (const e of (row.entities || []) as Entity[]) {
      const key = `${e.name}::${e.type}`;
      entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
    }
  }

  // 3. Filter: mentioned 3+ times AND not already tracked
  const { data: existingEntities } = await db.from('trend_entities').select('name');
  const existingNames = new Set(
    (existingEntities || []).map((e: any) => e.name as string),
  );

  const newEntities: TrendEntity[] = [];
  for (const [key, count] of entityCounts) {
    if (count < 3) continue;
    const [name, type] = key.split('::');
    if (existingNames.has(name)) continue;

    // Use LLM to get tracking metadata
    const meta = await llm.generateJSON<EntityMeta>({
      systemPrompt:
        'Given a technology/company name, identify its GitHub repo (if any) and npm/PyPI package name (if any). Return JSON: { githubRepo?: string, npmPackage?: string, pypiPackage?: string }',
      userPrompt: `Entity: ${name} (type: ${type}). What is the main GitHub repo and npm/PyPI package?`,
      maxTokens: 100,
      temperature: 0,
    });

    const entity: TrendEntity = {
      name,
      type,
      github_repo: meta.githubRepo || null,
      npm_package: meta.npmPackage || null,
      pypi_package: meta.pypiPackage || null,
      is_active: true,
    };

    const { error: insertError } = await db.from('trend_entities').insert(entity);
    if (!insertError) {
      newEntities.push(entity);
    }
  }

  return newEntities;
}
