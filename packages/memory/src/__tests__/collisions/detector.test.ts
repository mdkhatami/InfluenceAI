import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findTextOverlap,
  classifyCollisionType,
  findEntityOverlapCollisions,
  detectCollisions,
} from '../../collisions/detector';

// ---------------------------------------------------------------------------
// Tests: findTextOverlap
// ---------------------------------------------------------------------------

describe('findTextOverlap', () => {
  it('returns overlapping significant words when 2+ match', () => {
    const result = findTextOverlap(
      'OpenAI releases GPT-5 model today',
      'The new GPT-5 model from OpenAI is impressive',
    );
    expect(result).toContain('openai');
    expect(result).toContain('model');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty when fewer than 2 overlapping words', () => {
    const result = findTextOverlap(
      'OpenAI releases new model',
      'Apple announces quarterly earnings',
    );
    expect(result).toEqual([]);
  });

  it('ignores stop words and short words', () => {
    // Sentences that share only stop words ("the", "and", "for", "with") and short words ("is", "in")
    const result = findTextOverlap(
      'the cat and dog with hat',
      'the fish and bird with fin',
    );
    // "cat", "dog", "hat" vs "fish", "bird", "fin" — no significant overlap
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: classifyCollisionType
// ---------------------------------------------------------------------------

describe('classifyCollisionType', () => {
  it('maps known source pairs to types', () => {
    expect(classifyCollisionType('github', 'finance')).toBe('tech_market');
    expect(classifyCollisionType('finance', 'github')).toBe('tech_market');
    expect(classifyCollisionType('github', 'news')).toBe('tech_media');
    expect(classifyCollisionType('news', 'policy')).toBe('regulatory');
    expect(classifyCollisionType('finance', 'news')).toBe('market_media');
    expect(classifyCollisionType('github', 'hackernews')).toBe('community_tech');
  });

  it('returns "cross_domain" for unknown pairs', () => {
    expect(classifyCollisionType('twitter', 'reddit')).toBe('cross_domain');
    expect(classifyCollisionType('podcast', 'youtube')).toBe('cross_domain');
  });
});

// ---------------------------------------------------------------------------
// Tests: findEntityOverlapCollisions
// ---------------------------------------------------------------------------

describe('findEntityOverlapCollisions', () => {
  it('finds collisions across different source types', () => {
    const signals = [
      { id: 's1', title: 'OpenAI GPT-5 launch', summary: 'OpenAI released GPT-5 model', source_type: 'news' },
      { id: 's2', title: 'OpenAI stock impact', summary: 'GPT-5 model affects market', source_type: 'finance' },
    ];

    const collisions = findEntityOverlapCollisions(signals);

    expect(collisions).toHaveLength(1);
    expect(collisions[0].signalA.id).toBe('s1');
    expect(collisions[0].signalB.id).toBe('s2');
    expect(collisions[0].type).toBe('market_media');
    expect(collisions[0].connectionNarrative).toContain('Both mention:');
    expect(collisions[0].storyPotential).toBe('medium');
    expect(collisions[0].suggestedAngle).toBe('hidden_connection');
    expect(collisions[0].id).toBeTruthy();
    expect(collisions[0].createdAt).toBeInstanceOf(Date);
  });

  it('ignores signals from same source type', () => {
    const signals = [
      { id: 's1', title: 'OpenAI GPT-5 launch', summary: 'OpenAI released GPT-5 model', source_type: 'news' },
      { id: 's2', title: 'OpenAI GPT-5 impact', summary: 'GPT-5 model changes everything', source_type: 'news' },
    ];

    const collisions = findEntityOverlapCollisions(signals);

    expect(collisions).toHaveLength(0);
  });

  it('returns empty when no overlap', () => {
    const signals = [
      { id: 's1', title: 'Apple quarterly earnings', summary: 'Revenue up 10%', source_type: 'finance' },
      { id: 's2', title: 'New Linux kernel release', summary: 'Version 6.5 ships today', source_type: 'github' },
    ];

    const collisions = findEntityOverlapCollisions(signals);

    expect(collisions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mock DB builder for detectCollisions
// ---------------------------------------------------------------------------

function createMockDb(opts: {
  signals?: any[];
  fetchError?: { message: string } | null;
  insertError?: { message: string } | null;
}) {
  const { signals = [], fetchError = null, insertError = null } = opts;

  const insertFn = vi.fn().mockResolvedValue({ error: insertError });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'content_signals') {
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: fetchError ? null : signals,
                  error: fetchError,
                }),
              }),
            }),
          }),
        };
      }

      if (table === 'collisions') {
        return { insert: insertFn };
      }

      return {};
    }),
    _insertFn: insertFn,
  };
}

// ---------------------------------------------------------------------------
// Tests: detectCollisions
// ---------------------------------------------------------------------------

describe('detectCollisions', () => {
  it('combines entity + LLM collisions and stores them', async () => {
    const signals = [
      { id: 's1', title: 'OpenAI GPT-5 launch', summary: 'OpenAI released GPT-5 model today', source_type: 'news' },
      { id: 's2', title: 'OpenAI market impact', summary: 'GPT-5 model shakes finance sector', source_type: 'finance' },
      { id: 's3', title: 'EU passes AI regulation', summary: 'New policy framework announced', source_type: 'policy' },
    ];

    const db = createMockDb({ signals });

    const llm = {
      generateJSON: vi.fn().mockResolvedValue({
        collisions: [
          {
            indexA: 0,
            indexB: 2,
            type: 'regulatory',
            narrative: 'GPT-5 launch may have been timed before EU regulation',
            potential: 'high' as const,
            angle: 'regulation_timing',
          },
        ],
      }),
    } as any;

    const result = await detectCollisions(db, llm);

    // Should have entity overlap collision (s1 + s2) + LLM collision (s1 + s3)
    expect(result.length).toBeGreaterThanOrEqual(2);

    // Verify LLM was called
    expect(llm.generateJSON).toHaveBeenCalledTimes(1);

    // Verify collisions were stored
    expect(db._insertFn).toHaveBeenCalledTimes(result.length);

    // Every collision should have required fields
    for (const c of result) {
      expect(c.id).toBeTruthy();
      expect(c.type).toBeTruthy();
      expect(c.signalA).toBeDefined();
      expect(c.signalB).toBeDefined();
      expect(c.connectionNarrative).toBeTruthy();
      expect(c.storyPotential).toBeTruthy();
      expect(c.createdAt).toBeInstanceOf(Date);
    }
  });

  it('returns empty when fewer than 2 signals', async () => {
    const db = createMockDb({
      signals: [{ id: 's1', title: 'Single signal', summary: 'Only one', source_type: 'news' }],
    });
    const llm = { generateJSON: vi.fn() } as any;

    const result = await detectCollisions(db, llm);

    expect(result).toEqual([]);
    expect(llm.generateJSON).not.toHaveBeenCalled();
  });

  it('returns empty when no signals at all', async () => {
    const db = createMockDb({ signals: [] });
    const llm = { generateJSON: vi.fn() } as any;

    const result = await detectCollisions(db, llm);

    expect(result).toEqual([]);
    expect(llm.generateJSON).not.toHaveBeenCalled();
  });

  it('filters invalid LLM indices (out of bounds)', async () => {
    const signals = [
      { id: 's1', title: 'Signal one about testing', summary: 'First signal description', source_type: 'news' },
      { id: 's2', title: 'Signal two about markets', summary: 'Second signal description', source_type: 'finance' },
    ];

    const db = createMockDb({ signals });

    const llm = {
      generateJSON: vi.fn().mockResolvedValue({
        collisions: [
          { indexA: 0, indexB: 1, type: 'valid', narrative: 'Valid connection', potential: 'high' as const, angle: 'test' },
          { indexA: 5, indexB: 1, type: 'invalid', narrative: 'Out of bounds A', potential: 'low' as const, angle: 'bad' },
          { indexA: 0, indexB: 99, type: 'invalid', narrative: 'Out of bounds B', potential: 'low' as const, angle: 'bad' },
          { indexA: -1, indexB: 0, type: 'invalid', narrative: 'Negative index', potential: 'low' as const, angle: 'bad' },
        ],
      }),
    } as any;

    const result = await detectCollisions(db, llm);

    // Only the valid LLM collision + any entity collisions should be present
    const llmCollisions = result.filter((c) => c.type === 'valid');
    expect(llmCollisions).toHaveLength(1);

    // None of the invalid ones should appear
    const invalidCollisions = result.filter((c) => c.type === 'invalid');
    expect(invalidCollisions).toHaveLength(0);
  });

  it('handles LLM returning empty collisions array', async () => {
    const signals = [
      { id: 's1', title: 'Apple quarterly earnings', summary: 'Revenue up by ten percent', source_type: 'news' },
      { id: 's2', title: 'Linux kernel release', summary: 'Version six ships today', source_type: 'finance' },
    ];

    const db = createMockDb({ signals });

    const llm = {
      generateJSON: vi.fn().mockResolvedValue({ collisions: [] }),
    } as any;

    const result = await detectCollisions(db, llm);

    // No entity overlap (no shared words), no LLM collisions
    expect(result).toEqual([]);
    expect(llm.generateJSON).toHaveBeenCalledTimes(1);
  });

  it('throws when signal fetch fails', async () => {
    const db = createMockDb({ fetchError: { message: 'connection refused' } });
    const llm = { generateJSON: vi.fn() } as any;

    await expect(detectCollisions(db, llm)).rejects.toThrow(
      'Failed to fetch signals: connection refused',
    );
  });

  it('continues when collision insert fails', async () => {
    const signals = [
      { id: 's1', title: 'OpenAI GPT-5 launch', summary: 'OpenAI released GPT-5 model today', source_type: 'news' },
      { id: 's2', title: 'OpenAI market impact', summary: 'GPT-5 model affects market prices', source_type: 'finance' },
    ];

    const db = createMockDb({ signals, insertError: { message: 'insert failed' } });

    const llm = {
      generateJSON: vi.fn().mockResolvedValue({ collisions: [] }),
    } as any;

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should NOT throw — insert errors are non-critical
    const result = await detectCollisions(db, llm);

    // Entity overlap should still find collision(s)
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
