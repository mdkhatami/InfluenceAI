import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { Signal, SignalSource } from '@influenceai/core';

export function computeDedupeHash(signal: { sourceType: SignalSource; sourceId: string; title: string }): string {
  return createHash('sha256')
    .update(`${signal.sourceType}:${signal.sourceId}:${signal.title}`)
    .digest('hex');
}

export async function findExistingHashes(
  client: SupabaseClient,
  hashes: string[],
): Promise<Set<string>> {
  const { data } = await client
    .from('content_signals')
    .select('dedup_hash')
    .in('dedup_hash', hashes);

  return new Set((data ?? []).map((row: { dedup_hash: string }) => row.dedup_hash));
}

export async function upsertSignalWithScore(
  client: SupabaseClient,
  signal: Signal,
  score: number,
): Promise<string> {
  const dedupHash = computeDedupeHash(signal);

  const { data, error } = await client
    .from('content_signals')
    .upsert(
      {
        source: signal.sourceType,
        source_type: signal.sourceType,
        external_id: signal.sourceId,
        title: signal.title,
        url: signal.url,
        summary: signal.summary,
        metadata: signal.metadata,
        raw_data: signal.metadata,
        dedup_hash: dedupHash,
        scored_relevance: score,
        ingested_at: signal.fetchedAt.toISOString(),
      },
      { onConflict: 'source,external_id' },
    )
    .select('id')
    .single();

  if (error) throw new Error(`Failed to upsert signal: ${error.message}`);
  return data!.id;
}
