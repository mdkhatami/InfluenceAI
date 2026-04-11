import { describe, it, expect, vi } from 'vitest';
import { dispatchSwarm } from '../dispatcher';
import { createMockLLMClient } from '../__mocks__/llm-mock';
import type { ScoredSignal } from '@influenceai/core';
import { setupServer } from 'msw/node';
import { handlers } from '../__mocks__/api-handlers';
import { beforeAll, afterAll } from 'vitest';

// MSW server to handle GitHub API calls from agents
const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

// Mock DB client — mimics Supabase client shape
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
          return {
            data: record,
            error: null,
            select: () => ({
              single: () => Promise.resolve({ data: record, error: null }),
            }),
          };
        }),
        update: vi.fn((updates: any) => ({
          eq: vi.fn(() => Promise.resolve({ data: { ...updates }, error: null })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: store[table]?.[0] || null, error: null }),
            ),
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
  sourceType: 'github',
  sourceId: 'test/repo',
  title: 'AI framework',
  summary: 'New open-source AI framework with funding implications',
  url: 'https://github.com/test/repo',
  metadata: {},
  fetchedAt: new Date(),
  score: 7,
};

describe('dispatchSwarm', () => {
  it('dispatches selected agents and produces a research brief', async () => {
    const mockDb = createMockDb();
    const brief = await dispatchSwarm(
      signal,
      'signal-uuid-1',
      { enabledAgents: ['tech', 'history'], globalTimeout: 30000, maxConcurrent: 6 },
      mockDb as any,
      createMockLLMClient() as any,
    );
    expect(brief.coverage.dispatched).toBeGreaterThanOrEqual(2);
    expect(brief.topFindings.length).toBeGreaterThan(0);
    expect(brief.signalId).toBe('signal-uuid-1');
  });

  it('returns fallback brief when no agents selected', async () => {
    const mockDb = createMockDb();
    const brief = await dispatchSwarm(
      signal,
      'signal-uuid-1',
      { enabledAgents: [], globalTimeout: 5000, maxConcurrent: 6 },
      mockDb as any,
      createMockLLMClient() as any,
    );
    // Fallback brief uses signal title as the main finding
    expect(brief.topFindings[0].headline).toBe(signal.title);
  });

  it('stores investigation run and research brief in DB', async () => {
    const mockDb = createMockDb();
    await dispatchSwarm(
      signal,
      'signal-uuid-2',
      { enabledAgents: ['tech'], globalTimeout: 30000, maxConcurrent: 6 },
      mockDb as any,
      createMockLLMClient() as any,
    );
    // Verify DB calls were made
    expect(mockDb.from).toHaveBeenCalledWith('investigation_runs');
    expect(mockDb.from).toHaveBeenCalledWith('research_briefs');
  });

  it('records correct coverage stats', async () => {
    const mockDb = createMockDb();
    const brief = await dispatchSwarm(
      signal,
      'signal-uuid-3',
      { enabledAgents: ['tech', 'history'], globalTimeout: 30000, maxConcurrent: 6 },
      mockDb as any,
      createMockLLMClient() as any,
    );
    expect(brief.coverage.dispatched).toBe(2);
    expect(brief.coverage.succeeded).toBeGreaterThanOrEqual(0);
    expect(brief.coverage.agents).toContain('tech');
    expect(brief.coverage.agents).toContain('history');
  });

  it('includes signal reference in the brief', async () => {
    const mockDb = createMockDb();
    const brief = await dispatchSwarm(
      signal,
      'signal-uuid-4',
      { enabledAgents: ['tech'], globalTimeout: 30000, maxConcurrent: 6 },
      mockDb as any,
      createMockLLMClient() as any,
    );
    expect(brief.signal).toBe(signal);
    expect(brief.id).toBeTruthy();
    expect(brief.createdAt).toBeInstanceOf(Date);
    expect(brief.expiresAt).toBeInstanceOf(Date);
  });
});
