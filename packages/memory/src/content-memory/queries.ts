import type { ContentMemoryEntry, Prediction, ExtractedStance } from '../types';

/**
 * Find content similar to a given embedding using pgvector similarity search.
 */
export async function findSimilarContent(
  db: any,
  embedding: number[],
  threshold: number = 0.8,
  limit: number = 5
): Promise<ContentMemoryEntry[]> {
  const { data, error } = await db.rpc('match_content_memory', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error || !data) {
    return [];
  }

  return (data as any[]).map((row) => ({
    id: row.id,
    content_item_id: row.content_item_id,
    platform: row.platform,
    pillar_slug: row.pillar_slug,
    embedding: row.embedding ?? [],
    entities: row.entities ?? [],
    topics: row.topics ?? [],
    predictions: row.predictions ?? [],
    stances: row.stances ?? [],
    platform_metrics: row.platform_metrics,
    published_at: row.published_at,
    created_at: row.created_at,
    similarity: row.similarity,
  }));
}

/**
 * Find content memory entries that mention a specific entity.
 * Optionally filter by entity type.
 */
export async function findByEntity(
  db: any,
  entityName: string,
  entityType?: string
): Promise<ContentMemoryEntry[]> {
  const containsFilter = entityType
    ? [{ name: entityName, type: entityType }]
    : [{ name: entityName }];

  const { data, error } = await db
    .from('content_memory')
    .select('*')
    .contains('entities', containsFilter)
    .order('published_at', { ascending: false })
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data as ContentMemoryEntry[];
}

/**
 * Find all open predictions across content memory entries.
 */
export async function findOpenPredictions(
  db: any
): Promise<Array<{ contentItemId: string; prediction: Prediction }>> {
  const { data, error } = await db
    .from('content_memory')
    .select('content_item_id, predictions')
    .not('predictions', 'eq', '[]');

  if (error || !data) {
    return [];
  }

  return (data as any[]).flatMap((row) => {
    const predictions: Prediction[] = row.predictions ?? [];
    return predictions
      .filter((p) => p.status === 'open')
      .map((prediction) => ({
        contentItemId: row.content_item_id,
        prediction,
      }));
  });
}

/**
 * Find stances on a given topic across all content memory entries.
 * Uses case-insensitive partial matching on topic.
 */
export async function findStances(
  db: any,
  topic: string
): Promise<ExtractedStance[]> {
  const { data, error } = await db
    .from('content_memory')
    .select('stances')
    .not('stances', 'eq', '[]');

  if (error || !data) {
    return [];
  }

  const searchTopic = topic.toLowerCase();

  return (data as any[]).flatMap((row) => {
    const stances: ExtractedStance[] = row.stances ?? [];
    return stances.filter((s) => s.topic.toLowerCase().includes(searchTopic));
  });
}

/**
 * Find topics mentioned in recent signals that haven't been covered in recent content.
 * Returns an array of uncovered topic strings.
 */
export async function findCoverageGaps(
  db: any,
  daysSinceLastPost: number = 14
): Promise<string[]> {
  const cutoff = new Date(Date.now() - daysSinceLastPost * 24 * 60 * 60 * 1000);
  const cutoffISO = cutoff.toISOString();

  // Fetch recent signal metadata to extract topics
  const { data: signalData } = await db
    .from('content_signals')
    .select('metadata')
    .gte('ingested_at', cutoffISO)
    .limit(100);

  // Fetch topics from recent content memory
  const { data: contentData } = await db
    .from('content_memory')
    .select('topics')
    .gte('published_at', cutoffISO);

  // Extract signal topics from metadata
  const signalTopics = new Set<string>();
  for (const row of signalData ?? []) {
    const meta = row.metadata;
    if (!meta) continue;

    // Extract from metadata.topics array if present
    if (Array.isArray(meta.topics)) {
      for (const t of meta.topics) {
        if (typeof t === 'string') signalTopics.add(t.toLowerCase());
      }
    }

    // Extract from metadata.title as fallback — split into significant words
    if (typeof meta.title === 'string') {
      const words = meta.title
        .toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 3);
      for (const w of words) {
        signalTopics.add(w);
      }
    }
  }

  // Collect all content topics
  const coveredTopics = new Set<string>();
  for (const row of contentData ?? []) {
    const topics: string[] = row.topics ?? [];
    for (const t of topics) {
      coveredTopics.add(t.toLowerCase());
    }
  }

  // Find signal topics not covered in content
  const gaps: string[] = [];
  for (const topic of signalTopics) {
    if (!coveredTopics.has(topic)) {
      gaps.push(topic);
    }
  }

  return gaps;
}
