import type { ScoredSignal } from '@influenceai/core';

/** Maps a DB snake_case content_signals row to a ScoredSignal camelCase object */
export function signalFromRow(row: Record<string, unknown>): ScoredSignal {
  return {
    sourceType: (row.source_type ?? row.source) as ScoredSignal['sourceType'],
    sourceId: (row.external_id) as string,
    title: row.title as string,
    summary: (row.summary ?? '') as string,
    url: (row.url ?? '') as string,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    fetchedAt: new Date(row.ingested_at as string),
    score: (row.scored_relevance as number) ?? (row.score as number) ?? 0,
  };
}

/** Returns top N platforms based on pillar config. Default: linkedin + twitter. */
export function selectBestPlatforms(
  _signal: ScoredSignal,
  count: number,
): string[] {
  const defaults = ['linkedin', 'twitter', 'instagram', 'youtube'];
  return defaults.slice(0, count);
}
