import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectPrimaryMetric,
  computeVelocity,
  computeAcceleration,
  detectPhase,
  computeContentSignal,
  analyzeTrends,
  discoverNewEntities,
} from '../../trends/analyzer';

// ---------------------------------------------------------------------------
// Test data generators
// ---------------------------------------------------------------------------

/** Create `count` data points with linearly growing values starting at `start`. */
function makeGrowingPoints(
  entityId: string,
  count: number,
  start = 100,
  increment = 5,
  metricKey = 'githubStars',
): any[] {
  const baseDate = new Date('2026-03-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    entity_id: entityId,
    measured_at: new Date(baseDate.getTime() + i * 86_400_000).toISOString(),
    metrics: { [metricKey]: start + i * increment, yourPostCount: 1 },
  }));
}

/** Create `count` data points with linearly declining values. */
function makeDecliningPoints(
  entityId: string,
  count: number,
  start = 500,
  decrement = 5,
  metricKey = 'githubStars',
): any[] {
  const baseDate = new Date('2026-03-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    entity_id: entityId,
    measured_at: new Date(baseDate.getTime() + i * 86_400_000).toISOString(),
    metrics: { [metricKey]: Math.max(0, start - i * decrement), yourPostCount: 1 },
  }));
}

/** Create `count` data points with constant values (plateau). */
function makeFlatPoints(
  entityId: string,
  count: number,
  value = 200,
  metricKey = 'githubStars',
): any[] {
  const baseDate = new Date('2026-03-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    entity_id: entityId,
    measured_at: new Date(baseDate.getTime() + i * 86_400_000).toISOString(),
    metrics: { [metricKey]: value, yourPostCount: 1 },
  }));
}

/** Create data points with low values (emerging). */
function makeEmergingPoints(
  entityId: string,
  count: number,
  metricKey = 'githubStars',
): any[] {
  const baseDate = new Date('2026-03-01T00:00:00Z');
  return Array.from({ length: count }, (_, i) => ({
    entity_id: entityId,
    measured_at: new Date(baseDate.getTime() + i * 86_400_000).toISOString(),
    metrics: { [metricKey]: 2 + i * 0.3, yourPostCount: 0 },
  }));
}

// ---------------------------------------------------------------------------
// Helper to extract { date, value } from points
// ---------------------------------------------------------------------------

function toValues(points: any[], metricKey = 'githubStars') {
  return points.map((p) => ({
    date: p.measured_at as string,
    value: (p.metrics[metricKey] as number) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

function createMockDb(opts: {
  entities?: any[];
  points?: any[];
  memory?: any[];
  existingNames?: string[];
  upsertError?: { message: string } | null;
  insertError?: { message: string } | null;
  fetchError?: { message: string } | null;
}) {
  const {
    entities = [],
    points = [],
    memory = [],
    existingNames = [],
    upsertError = null,
    insertError = null,
    fetchError = null,
  } = opts;

  const upsertFn = vi.fn().mockResolvedValue({ error: upsertError });
  const insertFn = vi.fn().mockResolvedValue({ error: insertError });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'trend_entities') {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            if (cols === 'name') {
              // Used by discoverNewEntities to get existing names
              return {
                data: existingNames.map((n) => ({ name: n })),
                error: null,
                then: (fn: any) =>
                  fn({ data: existingNames.map((n) => ({ name: n })), error: null }),
              };
            }
            // select('*') for analyzeTrends
            return {
              eq: vi.fn().mockReturnValue({
                data: fetchError ? null : entities,
                error: fetchError,
                then: (fn: any) =>
                  fn({ data: fetchError ? null : entities, error: fetchError }),
              }),
            };
          }),
          insert: insertFn,
        };
      }

      if (table === 'trend_data_points') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: points,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'trend_analyses') {
        return {
          upsert: upsertFn,
        };
      }

      if (table === 'content_memory') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: memory,
                error: null,
              }),
            }),
          }),
        };
      }

      return {};
    }),
    _upsertFn: upsertFn,
    _insertFn: insertFn,
  };
}

// ---------------------------------------------------------------------------
// Tests: selectPrimaryMetric
// ---------------------------------------------------------------------------

describe('selectPrimaryMetric', () => {
  it('prefers githubStars when github_repo is set', () => {
    const entity = { github_repo: 'owner/repo', npm_package: null, pypi_package: null };
    const points = Array.from({ length: 10 }, () => ({
      metrics: { githubStars: 100, npmDownloads: 50, hnMentions: 3 },
    }));

    expect(selectPrimaryMetric(entity, points)).toBe('githubStars');
  });

  it('falls back to npmDownloads when github_repo not set but npm_package is', () => {
    const entity = { github_repo: null, npm_package: 'my-pkg', pypi_package: null };
    const points = Array.from({ length: 10 }, () => ({
      metrics: { githubStars: null, npmDownloads: 1000, hnMentions: 2 },
    }));

    expect(selectPrimaryMetric(entity, points)).toBe('npmDownloads');
  });

  it('falls back to hnMentions when no specific package fields', () => {
    const entity = { github_repo: null, npm_package: null, pypi_package: null };
    const points = Array.from({ length: 10 }, () => ({
      metrics: { githubStars: null, npmDownloads: null, pypiDownloads: null, hnMentions: 5 },
    }));

    expect(selectPrimaryMetric(entity, points)).toBe('hnMentions');
  });
});

// ---------------------------------------------------------------------------
// Tests: computeVelocity
// ---------------------------------------------------------------------------

describe('computeVelocity', () => {
  it('returns positive % for growing values', () => {
    const points = makeGrowingPoints('e1', 14, 100, 10);
    const values = toValues(points);
    const velocity = computeVelocity(values);

    expect(velocity).toBeGreaterThan(0);
  });

  it('returns negative % for shrinking values', () => {
    const points = makeDecliningPoints('e1', 14, 500, 10);
    const values = toValues(points);
    const velocity = computeVelocity(values);

    expect(velocity).toBeLessThan(0);
  });

  it('returns 0 when fewer than 14 data points', () => {
    const points = makeGrowingPoints('e1', 10);
    const values = toValues(points);

    expect(computeVelocity(values)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: computeAcceleration
// ---------------------------------------------------------------------------

describe('computeAcceleration', () => {
  it('returns positive when velocity is increasing', () => {
    // Weeks 3-4: small increment, weeks 1-2: large increment
    // First 14 values grow slowly, next 14 grow faster
    const baseDate = new Date('2026-03-01T00:00:00Z');
    const values = Array.from({ length: 28 }, (_, i) => {
      const increment = i < 14 ? 2 : 10; // Accelerating growth
      return {
        date: new Date(baseDate.getTime() + i * 86_400_000).toISOString(),
        value: 100 + (i < 14 ? i * increment : 14 * 2 + (i - 14) * increment),
      };
    });

    const acceleration = computeAcceleration(values);
    expect(acceleration).toBeGreaterThan(0);
  });

  it('returns 0 when not enough data points', () => {
    const points = makeGrowingPoints('e1', 20);
    const values = toValues(points);

    expect(computeAcceleration(values)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: detectPhase
// ---------------------------------------------------------------------------

describe('detectPhase', () => {
  it('returns "emerging" for low avgRecent', () => {
    const values = makeEmergingPoints('e1', 14);
    const v = toValues(values);
    const phase = detectPhase(5, 2, v);

    expect(phase).toBe('emerging');
  });

  it('returns "accelerating" for positive velocity + acceleration', () => {
    const points = makeGrowingPoints('e1', 14, 100, 10);
    const values = toValues(points);

    expect(detectPhase(15, 5, values)).toBe('accelerating');
  });

  it('returns "peak" for positive velocity + non-positive acceleration', () => {
    const points = makeGrowingPoints('e1', 14, 100, 10);
    const values = toValues(points);

    expect(detectPhase(15, 0, values)).toBe('peak');
    expect(detectPhase(15, -5, values)).toBe('peak');
  });

  it('returns "plateau" for near-zero velocity', () => {
    const points = makeFlatPoints('e1', 14, 200);
    const values = toValues(points);

    // Plateau is reachable when velocity is slightly negative (so it doesn't
    // hit the positive-velocity "peak" branch) and acceleration is >= 0
    // (so it doesn't hit "decelerating"), with |velocity| < 2.
    expect(detectPhase(-1.5, 0, values)).toBe('plateau');
    expect(detectPhase(-0.5, 1, values)).toBe('plateau');
  });

  it('returns "decelerating" for negative velocity + acceleration', () => {
    const points = makeDecliningPoints('e1', 14, 200, 5);
    const values = toValues(points);

    expect(detectPhase(-10, -5, values)).toBe('decelerating');
  });

  it('returns "declining" for negative velocity only', () => {
    const points = makeDecliningPoints('e1', 14, 200, 5);
    const values = toValues(points);

    expect(detectPhase(-10, 0, values)).toBe('declining');
  });
});

// ---------------------------------------------------------------------------
// Tests: computeContentSignal
// ---------------------------------------------------------------------------

describe('computeContentSignal', () => {
  it('returns strong_buy for accelerating + low coverage', () => {
    expect(computeContentSignal('accelerating', 20, 0)).toBe('strong_buy');
    expect(computeContentSignal('accelerating', 20, 1)).toBe('strong_buy');
  });

  it('returns buy for accelerating + sufficient coverage', () => {
    expect(computeContentSignal('accelerating', 20, 5)).toBe('buy');
  });

  it('returns buy for peak + low coverage', () => {
    expect(computeContentSignal('peak', 10, 1)).toBe('buy');
  });

  it('returns hold for peak + sufficient coverage', () => {
    expect(computeContentSignal('peak', 10, 5)).toBe('hold');
  });

  it('returns sell for decelerating', () => {
    expect(computeContentSignal('decelerating', -10, 3)).toBe('sell');
  });

  it('returns strong_sell for declining', () => {
    expect(computeContentSignal('declining', -20, 3)).toBe('strong_sell');
  });

  it('returns hold for other phases', () => {
    expect(computeContentSignal('emerging', 5, 0)).toBe('hold');
    expect(computeContentSignal('plateau', 1, 2)).toBe('hold');
  });
});

// ---------------------------------------------------------------------------
// Tests: analyzeTrends
// ---------------------------------------------------------------------------

describe('analyzeTrends', () => {
  it('processes entities and upserts analyses', async () => {
    const entities = [
      { id: 'e1', name: 'TechA', github_repo: 'org/tech-a', npm_package: null, pypi_package: null, is_active: true },
    ];
    const points = makeGrowingPoints('e1', 28, 100, 10);
    const db = createMockDb({ entities, points });

    const results = await analyzeTrends(db);

    expect(results).toHaveLength(1);
    expect(results[0].entityId).toBe('e1');
    expect(results[0].entityName).toBe('TechA');
    expect(results[0].phase).toBeDefined();
    expect(results[0].velocity).toBeGreaterThan(0);
    expect(results[0].signal).toBeDefined();
    expect(results[0].chartData.length).toBeGreaterThan(0);
    expect(results[0].analyzedAt).toBeInstanceOf(Date);

    // Verify upsert was called
    expect(db._upsertFn).toHaveBeenCalledTimes(1);
    expect(db._upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_id: 'e1',
        phase: expect.any(String),
        velocity: expect.any(Number),
      }),
      { onConflict: 'entity_id' },
    );
  });

  it('skips entities with fewer than 14 data points', async () => {
    const entities = [
      { id: 'e1', name: 'TechA', github_repo: 'org/tech-a', npm_package: null, pypi_package: null, is_active: true },
    ];
    const points = makeGrowingPoints('e1', 10); // Only 10 points
    const db = createMockDb({ entities, points });

    const results = await analyzeTrends(db);

    expect(results).toHaveLength(0);
    expect(db._upsertFn).not.toHaveBeenCalled();
  });

  it('returns empty array when no active entities', async () => {
    const db = createMockDb({ entities: [] });
    const results = await analyzeTrends(db);

    expect(results).toEqual([]);
  });

  it('throws when entity fetch fails', async () => {
    const db = createMockDb({ fetchError: { message: 'connection refused' } });

    await expect(analyzeTrends(db)).rejects.toThrow('Failed to fetch entities: connection refused');
  });
});

// ---------------------------------------------------------------------------
// Tests: discoverNewEntities
// ---------------------------------------------------------------------------

describe('discoverNewEntities', () => {
  it('discovers entities mentioned 3+ times, skips existing', async () => {
    const memory = [
      { entities: [{ name: 'NewLib', type: 'technology' }, { name: 'ExistingCo', type: 'company' }] },
      { entities: [{ name: 'NewLib', type: 'technology' }] },
      { entities: [{ name: 'NewLib', type: 'technology' }, { name: 'RareTool', type: 'technology' }] },
    ];

    const db = createMockDb({
      memory,
      existingNames: ['ExistingCo'],
    });

    const llm = {
      generateJSON: vi.fn().mockResolvedValue({
        githubRepo: 'org/newlib',
        npmPackage: 'newlib',
        pypiPackage: null,
      }),
    } as any;

    const result = await discoverNewEntities(db, llm);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('NewLib');
    expect(result[0].type).toBe('technology');
    expect(result[0].github_repo).toBe('org/newlib');
    expect(result[0].npm_package).toBe('newlib');
    expect(result[0].is_active).toBe(true);

    // Should have called LLM for metadata
    expect(llm.generateJSON).toHaveBeenCalledTimes(1);

    // Should have inserted the entity
    expect(db._insertFn).toHaveBeenCalledTimes(1);
  });

  it('returns empty when no recent memory', async () => {
    const db = createMockDb({ memory: [] });
    const llm = { generateJSON: vi.fn() } as any;

    const result = await discoverNewEntities(db, llm);
    expect(result).toEqual([]);
    expect(llm.generateJSON).not.toHaveBeenCalled();
  });

  it('skips entities mentioned fewer than 3 times', async () => {
    const memory = [
      { entities: [{ name: 'OnceLib', type: 'technology' }] },
      { entities: [{ name: 'TwiceLib', type: 'technology' }, { name: 'TwiceLib', type: 'technology' }] },
    ];

    const db = createMockDb({ memory });
    const llm = { generateJSON: vi.fn() } as any;

    const result = await discoverNewEntities(db, llm);
    expect(result).toEqual([]);
    expect(llm.generateJSON).not.toHaveBeenCalled();
  });
});
