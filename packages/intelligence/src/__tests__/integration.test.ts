import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../__mocks__/api-handlers';
import { createMockLLMClient } from '../__mocks__/llm-mock';
import { dispatchSwarm } from '../dispatcher';
import { defaultSwarmConfig } from '../config';
import type { ScoredSignal } from '@influenceai/core';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

// In-memory DB mock — must support: from(table).insert/update/select/upsert
const createMockDb = () => {
  const store: Record<string, any[]> = {};
  return {
    from: vi.fn((table: string) => {
      if (!store[table]) store[table] = [];
      return {
        insert: vi.fn((row: any) => {
          const id = row.id || crypto.randomUUID();
          const record = { ...row, id };
          store[table].push(record);
          return { data: record, error: null, select: () => ({ single: () => Promise.resolve({ data: record, error: null }) }) };
        }),
        update: vi.fn((updates: any) => ({
          eq: vi.fn(() => Promise.resolve({ data: { ...updates }, error: null })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: store[table]?.[0] || null, error: null })),
          })),
        })),
        upsert: vi.fn((row: any) => {
          store[table].push(row);
          return Promise.resolve({ data: row, error: null });
        }),
      };
    }),
  };
};

const signal: ScoredSignal = {
  sourceType: 'github', sourceId: 'langchain-ai/langchain',
  title: 'LangChain raises $25M Series A',
  summary: 'LLM framework LangChain secured funding. GitHub stars growing 500/week. EU considering framework regulation.',
  url: 'https://github.com/langchain-ai/langchain', metadata: {}, fetchedAt: new Date(), score: 8,
};

describe('Full investigation integration', () => {
  it('dispatches multiple agents and produces a research brief', async () => {
    const mockDb = createMockDb();
    const brief = await dispatchSwarm(signal, 'uuid-123', defaultSwarmConfig, mockDb as any, createMockLLMClient() as any);

    // Should have dispatched tech + history (always) + finance (funding keyword) + deveco (github keyword)
    expect(brief.coverage.dispatched).toBeGreaterThanOrEqual(4);
    expect(brief.coverage.succeeded).toBeGreaterThanOrEqual(1);
    expect(brief.topFindings.length).toBeGreaterThan(0);
    expect(brief.suggestedAngles.length).toBeGreaterThan(0);
    expect(brief.unusualFact).toBeTruthy();
  });

  it('handles mixed agent success/failure gracefully', async () => {
    const mockDb = createMockDb();
    // Use config with only tech + history
    const brief = await dispatchSwarm(
      signal, 'uuid-456',
      { enabledAgents: ['tech', 'history'], globalTimeout: 10000, maxConcurrent: 2 },
      mockDb as any,
      createMockLLMClient() as any,
    );
    expect(brief.coverage.succeeded).toBeGreaterThanOrEqual(1);
    expect(brief.topFindings.length).toBeGreaterThan(0);
  });
});
