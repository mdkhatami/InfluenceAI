import type { Signal } from '@influenceai/core';
import { computeDedupeHash } from '@influenceai/database';

/**
 * Filters out signals whose dedup hashes already exist in the database.
 * Returns only new (unseen) signals.
 */
export function deduplicateSignals(signals: Signal[], existingHashes: Set<string>): Signal[] {
  return signals.filter((signal) => {
    const hash = computeDedupeHash(signal);
    return !existingHashes.has(hash);
  });
}
