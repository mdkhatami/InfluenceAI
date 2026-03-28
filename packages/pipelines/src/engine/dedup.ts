import type { Signal } from '@influenceai/core';
import { computeDedupeHash } from '@influenceai/database';

export function deduplicateSignals(signals: Signal[], existingHashes: Set<string>): Signal[] {
  return signals.filter((signal) => {
    const hash = computeDedupeHash(signal);
    return !existingHashes.has(hash);
  });
}
