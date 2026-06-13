/**
 * Runs `fn` over `items` with at most `limit` promises in flight at once.
 * Results are returned in input order. Used to parallelize per-signal
 * generation so large batches don't serialize into a function timeout.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };
  const size = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}
