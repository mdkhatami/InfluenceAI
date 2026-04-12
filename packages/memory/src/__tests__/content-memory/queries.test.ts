import { describe, it, expect, vi } from 'vitest';
import {
  findSimilarContent,
  findByEntity,
  findOpenPredictions,
  findStances,
  findCoverageGaps,
} from '../../content-memory/queries';

// --- Mock DB Factory ---

interface ChainableMock {
  select: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
}

function createChainableMock(resolvedValue: { data: any; error: any }): ChainableMock {
  const mock: ChainableMock = {
    select: vi.fn(),
    contains: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    not: vi.fn(),
    gte: vi.fn(),
  };

  // Every method returns the mock itself for chaining, except terminal calls resolve
  for (const key of Object.keys(mock) as Array<keyof ChainableMock>) {
    mock[key].mockReturnValue(mock);
  }

  // Make the mock thenable so await resolves to the value
  (mock as any).then = (resolve: any) => resolve(resolvedValue);

  return mock;
}

function createMockDb(overrides: Record<string, any> = {}) {
  const tableChains: Record<string, ChainableMock> = {};

  return {
    rpc: vi.fn().mockResolvedValue({
      data: overrides.rpcData ?? [],
      error: overrides.rpcError ?? null,
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (!tableChains[table]) {
        const resolvedValue = {
          data: overrides[table] ?? [],
          error: overrides[`${table}Error`] ?? null,
        };
        tableChains[table] = createChainableMock(resolvedValue);
      }
      return tableChains[table];
    }),
  };
}

// --- Test Data ---

const mockMemoryRow = {
  id: 'mem-1',
  content_item_id: 'ci-1',
  platform: 'linkedin',
  pillar_slug: 'breaking-ai-news',
  embedding: [0.1, 0.2, 0.3],
  entities: [{ name: 'OpenAI', type: 'company', sentiment: 'positive' }],
  topics: ['ai', 'llm'],
  predictions: [
    { statement: 'GPT-5 by 2025', timeframe: '2025', confidence: 'high', status: 'open' },
    { statement: 'AGI by 2030', timeframe: '2030', confidence: 'low', status: 'correct' },
  ],
  stances: [
    { topic: 'AI regulation', position: 'supportive' },
    { topic: 'open source models', position: 'strongly in favor' },
  ],
  platform_metrics: { likes: 42 },
  published_at: '2026-04-01T00:00:00Z',
  created_at: '2026-04-01T00:00:00Z',
  similarity: 0.92,
};

const mockMemoryRow2 = {
  id: 'mem-2',
  content_item_id: 'ci-2',
  platform: 'twitter',
  pillar_slug: 'hype-detector',
  embedding: [0.4, 0.5, 0.6],
  entities: [{ name: 'Google', type: 'company', sentiment: 'neutral' }],
  topics: ['gemini', 'multimodal'],
  predictions: [
    { statement: 'Gemini 3 will beat GPT-5', timeframe: '2026', confidence: 'medium', status: 'open' },
  ],
  stances: [
    { topic: 'AI regulation', position: 'cautious' },
  ],
  platform_metrics: {},
  published_at: '2026-04-05T00:00:00Z',
  created_at: '2026-04-05T00:00:00Z',
};

// --- Tests ---

describe('findSimilarContent', () => {
  it('calls rpc with correct params and returns mapped results', async () => {
    const db = createMockDb({ rpcData: [mockMemoryRow] });
    const embedding = [0.1, 0.2, 0.3];

    const results = await findSimilarContent(db, embedding, 0.7, 3);

    expect(db.rpc).toHaveBeenCalledWith('match_content_memory', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 3,
    });
    expect(results).toHaveLength(1);
    expect(results[0].content_item_id).toBe('ci-1');
    expect(results[0].similarity).toBe(0.92);
    expect(results[0].platform).toBe('linkedin');
    expect(results[0].topics).toEqual(['ai', 'llm']);
  });

  it('returns empty array when rpc returns no data', async () => {
    const db = createMockDb({ rpcData: null, rpcError: { message: 'not found' } });

    const results = await findSimilarContent(db, [0.1, 0.2]);

    expect(results).toEqual([]);
  });

  it('uses default threshold and limit', async () => {
    const db = createMockDb({ rpcData: [] });

    await findSimilarContent(db, [0.1]);

    expect(db.rpc).toHaveBeenCalledWith('match_content_memory', {
      query_embedding: [0.1],
      match_threshold: 0.8,
      match_count: 5,
    });
  });
});

describe('findByEntity', () => {
  it('queries with entity name only', async () => {
    const db = createMockDb({ content_memory: [mockMemoryRow] });

    const results = await findByEntity(db, 'OpenAI');

    expect(db.from).toHaveBeenCalledWith('content_memory');
    const chain = db.from('content_memory');
    expect(chain.contains).toHaveBeenCalledWith('entities', [{ name: 'OpenAI' }]);
    expect(chain.order).toHaveBeenCalledWith('published_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(results).toHaveLength(1);
    expect(results[0].content_item_id).toBe('ci-1');
  });

  it('queries with entity name + type', async () => {
    const db = createMockDb({ content_memory: [mockMemoryRow] });

    const results = await findByEntity(db, 'OpenAI', 'company');

    const chain = db.from('content_memory');
    expect(chain.contains).toHaveBeenCalledWith('entities', [{ name: 'OpenAI', type: 'company' }]);
    expect(results).toHaveLength(1);
  });

  it('returns empty array on error', async () => {
    const db = createMockDb({ content_memory: null, content_memoryError: { message: 'fail' } });

    const results = await findByEntity(db, 'Unknown');

    expect(results).toEqual([]);
  });
});

describe('findOpenPredictions', () => {
  it('flatMaps only open predictions from multiple rows', async () => {
    const db = createMockDb({ content_memory: [mockMemoryRow, mockMemoryRow2] });

    const results = await findOpenPredictions(db);

    // mockMemoryRow has 1 open prediction, mockMemoryRow2 has 1 open prediction
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      contentItemId: 'ci-1',
      prediction: mockMemoryRow.predictions[0],
    });
    expect(results[1]).toEqual({
      contentItemId: 'ci-2',
      prediction: mockMemoryRow2.predictions[0],
    });
  });

  it('returns empty array when no predictions exist', async () => {
    const db = createMockDb({ content_memory: [] });

    const results = await findOpenPredictions(db);

    expect(results).toEqual([]);
  });

  it('returns empty array on error', async () => {
    const db = createMockDb({ content_memory: null, content_memoryError: { message: 'fail' } });

    const results = await findOpenPredictions(db);

    expect(results).toEqual([]);
  });

  it('skips rows with null predictions', async () => {
    const db = createMockDb({
      content_memory: [{ content_item_id: 'ci-3', predictions: null }],
    });

    const results = await findOpenPredictions(db);

    expect(results).toEqual([]);
  });
});

describe('findStances', () => {
  it('filters stances by topic (case-insensitive)', async () => {
    const db = createMockDb({ content_memory: [mockMemoryRow, mockMemoryRow2] });

    const results = await findStances(db, 'ai regulation');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ topic: 'AI regulation', position: 'supportive' });
    expect(results[1]).toEqual({ topic: 'AI regulation', position: 'cautious' });
  });

  it('uses partial matching on topic', async () => {
    const db = createMockDb({ content_memory: [mockMemoryRow] });

    const results = await findStances(db, 'regulation');

    expect(results).toHaveLength(1);
    expect(results[0].topic).toBe('AI regulation');
  });

  it('returns empty array when no stances match', async () => {
    const db = createMockDb({ content_memory: [mockMemoryRow] });

    const results = await findStances(db, 'quantum computing');

    expect(results).toEqual([]);
  });

  it('returns empty array on error', async () => {
    const db = createMockDb({ content_memory: null, content_memoryError: { message: 'fail' } });

    const results = await findStances(db, 'anything');

    expect(results).toEqual([]);
  });
});

describe('findCoverageGaps', () => {
  it('returns topics from signals not in content', async () => {
    const db = createMockDb({
      content_signals: [
        { metadata: { topics: ['transformers', 'RLHF', 'scaling laws'] } },
        { metadata: { topics: ['llm', 'fine-tuning'] } },
      ],
      content_memory: [
        { topics: ['transformers', 'llm'] },
      ],
    });

    const results = await findCoverageGaps(db, 14);

    // 'rlhf', 'scaling laws', 'fine-tuning' are not covered
    expect(results).toContain('rlhf');
    expect(results).toContain('scaling laws');
    expect(results).toContain('fine-tuning');
    expect(results).not.toContain('transformers');
    expect(results).not.toContain('llm');
  });

  it('extracts topics from signal title when no topics array', async () => {
    const db = createMockDb({
      content_signals: [
        { metadata: { title: 'New breakthrough in neural architecture' } },
      ],
      content_memory: [
        { topics: ['neural'] },
      ],
    });

    const results = await findCoverageGaps(db, 14);

    // 'breakthrough' and 'architecture' should be gaps (> 3 chars), 'neural' is covered
    expect(results).toContain('breakthrough');
    expect(results).toContain('architecture');
    expect(results).not.toContain('neural');
    // 'new' is only 3 chars, should be filtered out
    expect(results).not.toContain('new');
  });

  it('returns empty array when no signals exist', async () => {
    const db = createMockDb({
      content_signals: [],
      content_memory: [],
    });

    const results = await findCoverageGaps(db);

    expect(results).toEqual([]);
  });

  it('handles null data gracefully', async () => {
    const db = createMockDb({
      content_signals: null,
      content_signalsError: { message: 'fail' },
      content_memory: null,
      content_memoryError: { message: 'fail' },
    });

    const results = await findCoverageGaps(db);

    expect(results).toEqual([]);
  });
});
