import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../../__mocks__/api-handlers';
import { createMockLLMClient } from '../../__mocks__/llm-mock';
import { FinanceAgent } from '../../agents/finance';

const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterAll(() => server.close());

describe('FinanceAgent', () => {
  const agent = new FinanceAgent(createMockLLMClient() as any);

  it('maps company name to ticker via JSON lookup', async () => {
    const signal = { sourceType: 'rss' as const, sourceId: 'test', title: 'NVIDIA announces new AI chip',
      summary: 'nvidia releases next-gen GPU for AI training', url: 'https://example.com',
      metadata: {}, fetchedAt: new Date(), score: 7 };
    const brief = await agent.investigate(signal);
    expect(brief.status).toBe('success');
    expect(brief.findings.length).toBeGreaterThan(0);
  });

  it('skips stock data for private companies', async () => {
    const signal = { sourceType: 'rss' as const, sourceId: 'test', title: 'OpenAI raises funding',
      summary: 'OpenAI secures new investment', url: 'https://example.com',
      metadata: {}, fetchedAt: new Date(), score: 7 };
    const brief = await agent.investigate(signal);
    // OpenAI has null ticker — agent should still work but skip stock data
    expect(brief.agentId).toBe('finance');
    expect(brief.status).toBe('success');
  });

  it('handles Yahoo Finance API failure gracefully', async () => {
    // Even if stock data fails, agent should return partial, never throw
    const signal = { sourceType: 'rss' as const, sourceId: 'test', title: 'Random company without ticker info',
      summary: 'Some financial news about unknown company', url: 'https://example.com',
      metadata: {}, fetchedAt: new Date(), score: 5 };
    const brief = await agent.investigate(signal);
    expect(brief.agentId).toBe('finance');
    expect(['success', 'partial']).toContain(brief.status);
  });
});
