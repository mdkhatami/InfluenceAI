import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('returns results in input order', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('handles an empty input', async () => {
    const out = await mapWithConcurrency([], 4, async (n) => n);
    expect(out).toEqual([]);
  });

  it('processes every item exactly once', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([10, 20, 30], 5, async (n) => {
      seen.push(n);
      return n;
    });
    expect(seen.sort((a, b) => a - b)).toEqual([10, 20, 30]);
  });
});
