import type { LLMClient } from '@influenceai/integrations';
import type { ContentMemoryEntry, ContentExtraction } from '../types';

const EXTRACTION_SYSTEM_PROMPT = `Extract structured metadata from a social media post about AI/technology.

Output JSON with:
- entities: [{name, type: "company"|"person"|"technology"|"concept"|"regulation", sentiment: "positive"|"negative"|"neutral"}]
- topics: string[] (3-7 concise topic tags)
- predictions: [{statement, timeframe (if mentioned), confidence: "high"|"medium"|"low"}]
- stances: [{topic, position}]

Rules:
- Only extract entities actually mentioned, not implied
- Predictions must be forward-looking statements with verifiable outcomes
- Stances are opinions the author clearly expresses, not neutral mentions`;

export { EXTRACTION_SYSTEM_PROMPT };

/**
 * Indexes a single content item into the content_memory table by generating
 * embeddings and extracting structured metadata via LLM.
 */
export async function indexContentItem(
  db: any,
  llm: LLMClient,
  contentItemId: string,
): Promise<ContentMemoryEntry> {
  // 1. Fetch the content item
  const { data: item, error: fetchError } = await db
    .from('content_items')
    .select('*')
    .eq('id', contentItemId)
    .single();

  if (fetchError || !item) {
    throw new Error(`Content item not found: ${contentItemId}`);
  }

  // 2. Generate embedding from title + body
  const textForEmbedding = `${item.title}\n\n${item.body}`;
  const embedding = await llm.createEmbedding(textForEmbedding);

  // 3. Extract entities, topics, predictions, stances via LLM
  const extraction = await llm.generateJSON<ContentExtraction>({
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    userPrompt: `Title: ${item.title}\n\nContent: ${item.body}`,
  });

  // 4. Build the entry (Fix 14: stances are ExtractedStance, not Stance)
  const entry: ContentMemoryEntry = {
    content_item_id: contentItemId,
    platform: item.platform,
    pillar_slug: item.pillar_slug,
    embedding,
    entities: extraction.entities,
    topics: extraction.topics,
    predictions: extraction.predictions.map((p) => ({
      ...p,
      status: 'open' as const,
    })),
    stances: extraction.stances,
    // Fix 13: prefer published_at, fall back to updated_at
    published_at: item.published_at || item.updated_at,
  };

  // 5. Upsert into content_memory
  const { error: upsertError } = await db
    .from('content_memory')
    .upsert(entry, { onConflict: 'content_item_id' });

  if (upsertError) {
    throw new Error(`Failed to upsert content memory: ${upsertError.message}`);
  }

  return entry;
}

/**
 * Batch-indexes approved/published content items that don't yet have a
 * content_memory entry. Gracefully handles per-item errors.
 */
export async function batchIndexContent(
  db: any,
  llm: LLMClient,
  limit: number = 50,
): Promise<{ indexed: number; errors: string[] }> {
  // 1. Fetch approved/published content items
  const { data: contentItems, error: fetchError } = await db
    .from('content_items')
    .select('id')
    .in('status', ['approved', 'published'])
    .limit(limit);

  if (fetchError) {
    throw new Error(`Failed to fetch content items: ${fetchError.message}`);
  }

  if (!contentItems || contentItems.length === 0) {
    return { indexed: 0, errors: [] };
  }

  // 2. Check which already have content_memory entries
  const itemIds = contentItems.map((item: { id: string }) => item.id);
  const { data: existingEntries, error: existingError } = await db
    .from('content_memory')
    .select('content_item_id')
    .in('content_item_id', itemIds);

  if (existingError) {
    throw new Error(`Failed to check existing entries: ${existingError.message}`);
  }

  const existingIds = new Set(
    (existingEntries || []).map((e: { content_item_id: string }) => e.content_item_id),
  );

  const toIndex = contentItems.filter(
    (item: { id: string }) => !existingIds.has(item.id),
  );

  // 3. Index each item, collecting errors
  let indexed = 0;
  const errors: string[] = [];

  for (const item of toIndex) {
    try {
      await indexContentItem(db, llm, item.id);
      indexed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Item ${item.id}: ${message}`);
    }
  }

  return { indexed, errors };
}
