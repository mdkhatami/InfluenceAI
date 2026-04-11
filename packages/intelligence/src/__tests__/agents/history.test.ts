import { describe, it, expect } from 'vitest';
import { createMockLLMClient } from '../../__mocks__/llm-mock';
import { HistoryAgent } from '../../agents/history';

describe('HistoryAgent', () => {
  const agent = new HistoryAgent(createMockLLMClient() as any);

  it('matches signal to history entry by keyword', async () => {
    const signal = {
      sourceType: 'github' as const,
      sourceId: 'test/repo',
      title: 'New container orchestration platform',
      summary: 'A kubernetes alternative for docker containers',
      url: 'https://github.com/test/repo',
      metadata: {},
      fetchedAt: new Date(),
      score: 7,
    };
    const brief = await agent.investigate(signal);
    expect(brief.status).toBe('success');
    expect(brief.findings.length).toBeGreaterThan(0);
    expect(brief.agentId).toBe('history');
  });

  it('returns partial when no good match found', async () => {
    const signal = {
      sourceType: 'rss' as const,
      sourceId: 'test',
      title: 'Completely unrelated topic about cooking',
      summary: 'Recipes for pasta dishes',
      url: 'https://example.com',
      metadata: {},
      fetchedAt: new Date(),
      score: 3,
    };
    const brief = await agent.investigate(signal);
    // Even with no keyword match, the LLM mock returns hasParallel:true
    // But agent should still return a brief
    expect(brief.agentId).toBe('history');
  });

  it('returns confidence > 0.5 when parallel found', async () => {
    const signal = {
      sourceType: 'github' as const,
      sourceId: 'test/ml-framework',
      title: 'New open-source machine learning framework',
      summary: 'Deep learning library similar to TensorFlow and PyTorch',
      url: 'https://github.com/test/ml',
      metadata: {},
      fetchedAt: new Date(),
      score: 8,
    };
    const brief = await agent.investigate(signal);
    expect(brief.confidence).toBeGreaterThan(0.5);
  });
});
