import { describe, it, expect, vi, beforeEach } from 'vitest';
import { indexContentItem, batchIndexContent, EXTRACTION_SYSTEM_PROMPT } from '../../content-memory/indexer';
import extractionFixture from '../../__fixtures__/content-extraction-response.json';

// --- Helpers ---

function createMockItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    title: 'OpenAI announces GPT-5',
    body: 'OpenAI has announced GPT-5 with impressive benchmark results.',
    platform: 'linkedin',
    pillar_slug: 'breaking-ai-news',
    status: 'approved',
    published_at: '2026-04-10T12:00:00Z',
    updated_at: '2026-04-09T08:00:00Z',
    ...overrides,
  };
}

function createMockDb(
  itemOverrides: Record<string, unknown> = {},
  options: { upsertError?: { message: string }; existingMemoryIds?: string[] } = {},
) {
  const mockItem = createMockItem(itemOverrides);
  const existingMemoryIds = options.existingMemoryIds || [];

  const upsertFn = vi.fn().mockResolvedValue({ error: options.upsertError || null });
  const fromFn = vi.fn();

  // Track calls so we can build the right chain per table
  fromFn.mockImplementation((table: string) => {
    if (table === 'content_items') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
          }),
          in: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: mockItem.id }],
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === 'content_memory') {
      return {
        upsert: upsertFn,
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: existingMemoryIds.map((id) => ({ content_item_id: id })),
            error: null,
          }),
        }),
      };
    }
    return {};
  });

  return { from: fromFn, _upsertFn: upsertFn, _mockItem: mockItem };
}

function createMockLlm() {
  const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
  return {
    createEmbedding: vi.fn().mockResolvedValue(embedding),
    generateJSON: vi.fn().mockResolvedValue(extractionFixture),
    _embedding: embedding,
  } as any;
}

// --- Tests ---

describe('indexContentItem', () => {
  let db: ReturnType<typeof createMockDb>;
  let llm: ReturnType<typeof createMockLlm>;

  beforeEach(() => {
    db = createMockDb();
    llm = createMockLlm();
  });

  it('calls createEmbedding with title + body', async () => {
    await indexContentItem(db, llm, 'item-1');

    expect(llm.createEmbedding).toHaveBeenCalledWith(
      'OpenAI announces GPT-5\n\nOpenAI has announced GPT-5 with impressive benchmark results.',
    );
  });

  it('calls generateJSON with the extraction system prompt', async () => {
    await indexContentItem(db, llm, 'item-1');

    expect(llm.generateJSON).toHaveBeenCalledWith({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userPrompt: 'Title: OpenAI announces GPT-5\n\nContent: OpenAI has announced GPT-5 with impressive benchmark results.',
    });
  });

  it('adds status "open" to all predictions', async () => {
    const result = await indexContentItem(db, llm, 'item-1');

    expect(result.predictions).toEqual([
      {
        statement: 'GPT-5 will surpass human-level reasoning on most benchmarks',
        timeframe: '2025',
        confidence: 'medium',
        status: 'open',
      },
    ]);
  });

  it('uses published_at when available (Fix 13)', async () => {
    const result = await indexContentItem(db, llm, 'item-1');

    expect(result.published_at).toBe('2026-04-10T12:00:00Z');
  });

  it('falls back to updated_at when published_at is null (Fix 13)', async () => {
    db = createMockDb({ published_at: null });
    const result = await indexContentItem(db, llm, 'item-1');

    expect(result.published_at).toBe('2026-04-09T08:00:00Z');
  });

  it('upserts with onConflict: content_item_id', async () => {
    await indexContentItem(db, llm, 'item-1');

    expect(db._upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ content_item_id: 'item-1' }),
      { onConflict: 'content_item_id' },
    );
  });

  it('includes embedding, entities, topics, stances in the result', async () => {
    const result = await indexContentItem(db, llm, 'item-1');

    expect(result.embedding).toEqual(llm._embedding);
    expect(result.entities).toEqual(extractionFixture.entities);
    expect(result.topics).toEqual(extractionFixture.topics);
    expect(result.stances).toEqual(extractionFixture.stances);
    expect(result.platform).toBe('linkedin');
    expect(result.pillar_slug).toBe('breaking-ai-news');
  });

  it('throws when content item is not found', async () => {
    const notFoundDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    };

    await expect(indexContentItem(notFoundDb, llm, 'missing')).rejects.toThrow(
      'Content item not found: missing',
    );
  });

  it('throws when upsert fails', async () => {
    db = createMockDb({}, { upsertError: { message: 'duplicate key' } });

    await expect(indexContentItem(db, llm, 'item-1')).rejects.toThrow(
      'Failed to upsert content memory: duplicate key',
    );
  });
});

describe('batchIndexContent', () => {
  it('indexes multiple items and returns count', async () => {
    const items = [
      createMockItem({ id: 'item-1' }),
      createMockItem({ id: 'item-2' }),
    ];

    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content_items') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: items.map((i) => ({ id: i.id })),
                  error: null,
                }),
              }),
              eq: vi.fn().mockImplementation((_col: string, id: string) => ({
                single: vi.fn().mockResolvedValue({
                  data: items.find((i) => i.id === id),
                  error: null,
                }),
              })),
            }),
          };
        }
        if (table === 'content_memory') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: upsertFn,
          };
        }
        return {};
      }),
    };

    const llm = createMockLlm();
    const result = await batchIndexContent(db, llm);

    expect(result.indexed).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it('skips items already in content_memory', async () => {
    const items = [
      createMockItem({ id: 'item-1' }),
      createMockItem({ id: 'item-2' }),
    ];

    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content_items') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: items.map((i) => ({ id: i.id })),
                  error: null,
                }),
              }),
              eq: vi.fn().mockImplementation((_col: string, id: string) => ({
                single: vi.fn().mockResolvedValue({
                  data: items.find((i) => i.id === id),
                  error: null,
                }),
              })),
            }),
          };
        }
        if (table === 'content_memory') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ content_item_id: 'item-1' }], // item-1 already indexed
                error: null,
              }),
            }),
            upsert: upsertFn,
          };
        }
        return {};
      }),
    };

    const llm = createMockLlm();
    const result = await batchIndexContent(db, llm);

    expect(result.indexed).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('handles per-item errors gracefully without failing the batch', async () => {
    const items = [
      createMockItem({ id: 'item-1' }),
      createMockItem({ id: 'item-2' }),
    ];

    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content_items') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: items.map((i) => ({ id: i.id })),
                  error: null,
                }),
              }),
              eq: vi.fn().mockImplementation((_col: string, id: string) => {
                if (id === 'item-1') {
                  return {
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: 'not found' },
                    }),
                  };
                }
                return {
                  single: vi.fn().mockResolvedValue({
                    data: items.find((i) => i.id === id),
                    error: null,
                  }),
                };
              }),
            }),
          };
        }
        if (table === 'content_memory') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };

    const llm = createMockLlm();
    const result = await batchIndexContent(db, llm);

    expect(result.indexed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('item-1');
  });

  it('returns empty results when no items to index', async () => {
    const db = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'content_items') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    };

    const llm = createMockLlm();
    const result = await batchIndexContent(db, llm);

    expect(result.indexed).toBe(0);
    expect(result.errors).toEqual([]);
  });
});
