import type { LLMClient } from '@influenceai/integrations';
import type { Collision, RawCollision } from '../types';

// ---------------------------------------------------------------------------
// System prompt for LLM collision detection
// ---------------------------------------------------------------------------

const COLLISION_DETECTOR_SYSTEM_PROMPT = `You detect hidden connections between news signals from different domains.

A "collision" is when two apparently unrelated events are actually part of the same story. Examples:
- A tech company raises $5B (tech signal) + EU announces AI regulation deadline (policy signal) -> The raise was timed to beat regulation
- Open-source model matches GPT-4 (tech signal) + NVDA stock drops 3% (finance signal) -> Market pricing in commoditization risk
- New AI tool automates legal review (tech signal) + Legal tech startup lays off 30% (industry signal) -> Same disruption wave

Output JSON: { collisions: [{ indexA, indexB, type, narrative, potential: "high"|"medium"|"low", angle }] }
Only include genuine connections. Empty array is fine if nothing connects.`;

// ---------------------------------------------------------------------------
// Text overlap detection
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was',
  'has', 'have', 'will', 'been', 'not', 'but', 'can', 'its', 'also',
  'more', 'than',
]);

/**
 * Finds significant overlapping words between two text strings.
 * Returns the shared words only if there are 2+ matches (ignoring stop words
 * and words shorter than 3 characters).
 */
export function findTextOverlap(textA: string, textB: string): string[] {
  const extractWords = (text: string) => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
    );
  };

  const wordsA = extractWords(textA);
  const wordsB = extractWords(textB);

  const overlap: string[] = [];
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap.push(word);
  }

  // Only consider it a collision if there are 2+ overlapping significant words
  return overlap.length >= 2 ? overlap : [];
}

// ---------------------------------------------------------------------------
// Collision type classification
// ---------------------------------------------------------------------------

/**
 * Maps a pair of source types to a human-readable collision category.
 * Falls back to 'cross_domain' for unknown combinations.
 */
export function classifyCollisionType(sourceA: string, sourceB: string): string {
  const pair = [sourceA, sourceB].sort().join('+');
  const typeMap: Record<string, string> = {
    'finance+github': 'tech_market',
    'github+news': 'tech_media',
    'news+policy': 'regulatory',
    'finance+news': 'market_media',
    'github+hackernews': 'community_tech',
  };
  return typeMap[pair] || 'cross_domain';
}

// ---------------------------------------------------------------------------
// Entity overlap collision finder
// ---------------------------------------------------------------------------

/**
 * Compares signals across DIFFERENT source types and detects collisions based
 * on significant word overlap in their title + summary text.
 */
export function findEntityOverlapCollisions(signals: any[]): Collision[] {
  const collisions: Collision[] = [];

  // Group signals by source_type
  const bySource = new Map<string, any[]>();
  for (const s of signals) {
    const group = bySource.get(s.source_type) || [];
    group.push(s);
    bySource.set(s.source_type, group);
  }

  const sourceTypes = Array.from(bySource.keys());

  // Compare signals across DIFFERENT source types
  for (let i = 0; i < sourceTypes.length; i++) {
    for (let j = i + 1; j < sourceTypes.length; j++) {
      const groupA = bySource.get(sourceTypes[i])!;
      const groupB = bySource.get(sourceTypes[j])!;

      for (const a of groupA) {
        for (const b of groupB) {
          const overlap = findTextOverlap(
            `${a.title} ${a.summary}`,
            `${b.title} ${b.summary}`,
          );
          if (overlap.length > 0) {
            collisions.push({
              id: crypto.randomUUID(),
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

// ---------------------------------------------------------------------------
// LLM prompt builder
// ---------------------------------------------------------------------------

function buildCollisionUserPrompt(signals: any[]): string {
  return `Recent signals (last 48 hours):
${signals.map((s: any, i: number) => `[${i}] (${s.source_type}) ${s.title}: ${s.summary}`).join('\n')}

Find pairs of signals that are secretly part of the same story. Look for:
- Tech event + financial market reaction
- Technology + regulatory/political implication
- Two events in different domains caused by the same underlying shift
- Historical pattern repeating in a new domain

Only report HIGH-CONFIDENCE connections. Don't force connections that don't exist.`;
}

// ---------------------------------------------------------------------------
// Main collision detection pipeline
// ---------------------------------------------------------------------------

/**
 * Detects cross-domain story connections from recent signals using entity
 * overlap and LLM-assisted analysis.
 *
 * 1. Fetches recent signals (last 48 hours, top 30 by relevance)
 * 2. Finds entity-overlap collisions across different source types
 * 3. Uses LLM to detect hidden narrative connections
 * 4. Stores all collisions in the database
 */
export async function detectCollisions(
  db: any,
  llm: LLMClient,
): Promise<Collision[]> {
  // 1. Get recent signals (last 48 hours), top 30 by relevance
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const { data: signals, error } = await db
    .from('content_signals')
    .select('*')
    .gte('ingested_at', cutoff.toISOString())
    .order('scored_relevance', { ascending: false })
    .limit(30);

  if (error) throw new Error(`Failed to fetch signals: ${error.message}`);
  if (!signals || signals.length < 2) return [];

  // 2. Method 1: Entity overlap across different source types
  const entityCollisions = findEntityOverlapCollisions(signals);

  // 3. Method 2: LLM-assisted connection detection
  const llmCollisions = await llm.generateJSON<{ collisions: RawCollision[] }>({
    systemPrompt: COLLISION_DETECTOR_SYSTEM_PROMPT,
    userPrompt: buildCollisionUserPrompt(signals),
    maxTokens: 600,
    temperature: 0.4,
  });

  // 4. Map raw LLM collisions to full Collision objects
  const mappedLlmCollisions = (llmCollisions.collisions || [])
    .filter(
      (raw) =>
        raw.indexA >= 0 &&
        raw.indexA < signals.length &&
        raw.indexB >= 0 &&
        raw.indexB < signals.length,
    )
    .map((raw) => ({
      id: crypto.randomUUID(),
      type: raw.type,
      signalA: {
        id: signals[raw.indexA].id,
        title: signals[raw.indexA].title,
        domain: signals[raw.indexA].source_type,
      },
      signalB: {
        id: signals[raw.indexB].id,
        title: signals[raw.indexB].title,
        domain: signals[raw.indexB].source_type,
      },
      connectionNarrative: raw.narrative,
      storyPotential: raw.potential,
      suggestedAngle: raw.angle,
      createdAt: new Date(),
    }));

  const allCollisions = [...entityCollisions, ...mappedLlmCollisions];

  // 5. Store collisions
  for (const collision of allCollisions) {
    const { error: insertError } = await db.from('collisions').insert({
      id: collision.id,
      type: collision.type,
      signal_a: collision.signalA,
      signal_b: collision.signalB,
      connection_narrative: collision.connectionNarrative,
      story_potential: collision.storyPotential,
      suggested_angle: collision.suggestedAngle,
      status: 'detected',
    });
    // Non-critical — log but don't fail
    if (insertError) {
      console.error(`Failed to store collision: ${insertError.message}`);
    }
  }

  return allCollisions;
}
