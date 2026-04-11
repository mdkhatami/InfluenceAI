import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../../__mocks__/api-handlers';
import { createMockLLMClient } from '../../__mocks__/llm-mock';
import { TechAgent } from '../../agents/tech';
import type { ScoredSignal } from '@influenceai/core';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

function mockSignal(overrides: Partial<ScoredSignal> = {}): ScoredSignal {
  return {
    sourceType: 'github',
    sourceId: 'test/repo',
    title: 'New LLM framework',
    summary: 'An open-source LLM that achieves state-of-the-art results',
    url: 'https://github.com/test/repo',
    metadata: {},
    fetchedAt: new Date(),
    score: 7,
    ...overrides,
  };
}

describe('TechAgent', () => {
  const agent = new TechAgent(createMockLLMClient() as any);

  it('has correct metadata', () => {
    expect(agent.id).toBe('tech');
    expect(agent.name).toBe('Tech Deep-Dive');
    expect(agent.enabled).toBe(true);
    expect(agent.timeout).toBe(30000);
  });

  it('produces at least 1 finding on valid GitHub signal', async () => {
    const signal = mockSignal();
    const brief = await agent.investigate(signal);
    expect(brief.status).toBe('success');
    expect(brief.findings.length).toBeGreaterThan(0);
    expect(brief.agentId).toBe('tech');
    expect(brief.narrativeHooks.length).toBeGreaterThan(0);
    expect(brief.sources.length).toBeGreaterThan(0);
    expect(brief.confidence).toBeGreaterThan(0);
  });

  it('returns partial status when source fetch fails', async () => {
    const signal = mockSignal({
      sourceType: 'github',
      sourceId: 'fail/repo',
      title: 'Broken repo',
      summary: 'test',
      url: 'https://github.com/fail/repo',
    });
    const brief = await agent.investigate(signal);
    expect(brief.status).toBe('partial');
    expect(brief.agentId).toBe('tech');
    // Should still have findings from LLM fallback using title+summary
    expect(brief.findings.length).toBeGreaterThan(0);
  });

  it('handles non-GitHub source types gracefully', async () => {
    const signal = mockSignal({
      sourceType: 'rss',
      sourceId: 'rss-item-1',
      title: 'New AI research paper',
      summary: 'A breakthrough in neural architecture search',
      url: 'https://example.com/article',
    });
    const brief = await agent.investigate(signal);
    expect(brief.agentId).toBe('tech');
    expect(['success', 'partial']).toContain(brief.status);
  });

  it('never throws - always returns AgentBrief', async () => {
    // Even with minimal/empty signal data, should not throw
    const signal = mockSignal({
      sourceType: 'rss',
      sourceId: 'x',
      title: '',
      summary: '',
      url: '',
    });
    const brief = await agent.investigate(signal);
    expect(brief).toHaveProperty('agentId', 'tech');
    expect(brief).toHaveProperty('status');
    expect(brief).toHaveProperty('findings');
    expect(brief).toHaveProperty('narrativeHooks');
    expect(brief).toHaveProperty('confidence');
    expect(brief).toHaveProperty('sources');
  });

  it('includes source citations with accessedAt dates', async () => {
    const signal = mockSignal();
    const brief = await agent.investigate(signal);
    if (brief.sources.length > 0) {
      for (const source of brief.sources) {
        expect(source).toHaveProperty('title');
        expect(source).toHaveProperty('url');
        expect(source).toHaveProperty('source');
        expect(source).toHaveProperty('accessedAt');
      }
    }
  });
});
