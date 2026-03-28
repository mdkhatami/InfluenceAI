import { describe, it, expect } from 'vitest';
import { deduplicateSignals } from './dedup';
import type { Signal } from '@influenceai/core';
import { computeDedupeHash } from '@influenceai/database';

describe('deduplicateSignals', () => {
  const signals: Signal[] = [
    {
      sourceType: 'github',
      sourceId: 'org/repo-a',
      title: 'org/repo-a: Great tool',
      summary: 'A great tool',
      url: 'https://github.com/org/repo-a',
      metadata: {},
      fetchedAt: new Date(),
    },
    {
      sourceType: 'github',
      sourceId: 'org/repo-b',
      title: 'org/repo-b: Another tool',
      summary: 'Another tool',
      url: 'https://github.com/org/repo-b',
      metadata: {},
      fetchedAt: new Date(),
    },
  ];

  it('filters out signals whose hashes exist in the known set', () => {
    const hashA = computeDedupeHash(signals[0]);
    const existingHashes = new Set([hashA]);

    const result = deduplicateSignals(signals, existingHashes);

    expect(result.length).toBe(1);
    expect(result[0].sourceId).toBe('org/repo-b');
  });

  it('returns all signals when no existing hashes', () => {
    const result = deduplicateSignals(signals, new Set());
    expect(result.length).toBe(2);
  });

  it('returns empty when all are duplicates', () => {
    const hashes = new Set(signals.map((s) => computeDedupeHash(s)));
    const result = deduplicateSignals(signals, hashes);
    expect(result.length).toBe(0);
  });
});
