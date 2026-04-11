import { describe, it, expect } from 'vitest';
import { synthesizeBriefs, createFallbackBrief } from '../synthesis';
import { createMockLLMClient } from '../__mocks__/llm-mock';
import type { ScoredSignal } from '@influenceai/core';
import type { AgentBrief } from '../types';

const signal: ScoredSignal = {
  sourceType: 'github', sourceId: 'test/repo', title: 'New AI framework',
  summary: 'Revolutionary open-source AI framework', url: 'https://github.com/test/repo',
  metadata: {}, fetchedAt: new Date(), score: 8,
};

const techBrief: AgentBrief = {
  agentId: 'tech', status: 'success',
  findings: [
    { type: 'fact', headline: '95% MMLU accuracy', detail: 'Beats GPT-4', importance: 'high' },
    { type: 'comparison', headline: '3x cheaper inference', detail: '$0.50 vs $2.50/1M tokens', importance: 'high' },
  ],
  narrativeHooks: ['The benchmark king got dethroned'],
  confidence: 0.9, sources: [],
};

const historyBrief: AgentBrief = {
  agentId: 'history', status: 'success',
  findings: [
    { type: 'comparison', headline: 'Docker adoption pattern', detail: 'Same growth trajectory as Docker 2014', importance: 'high' },
  ],
  narrativeHooks: ['History rhymes with Docker 2014'],
  confidence: 0.7, sources: [],
};

describe('synthesizeBriefs', () => {
  it('ranks findings by importance', async () => {
    const brief = await synthesizeBriefs(signal, 'signal-uuid', [techBrief, historyBrief], createMockLLMClient() as any);
    expect(brief.topFindings.length).toBeGreaterThan(0);
    expect(brief.topFindings[0].importance).toBe('high');
  });

  it('identifies cross-domain connections', async () => {
    const brief = await synthesizeBriefs(signal, 'signal-uuid', [techBrief, historyBrief], createMockLLMClient() as any);
    expect(brief.connections.length).toBeGreaterThan(0);
    expect(brief.connections[0]).toHaveProperty('narrativeHook');
  });

  it('handles 2-6 agent briefs', async () => {
    const brief = await synthesizeBriefs(signal, 'signal-uuid', [techBrief], createMockLLMClient() as any);
    expect(brief.topFindings.length).toBeGreaterThan(0);
    expect(brief.agentBriefs.length).toBe(1);
  });
});

describe('createFallbackBrief', () => {
  it('returns valid brief from signal alone', () => {
    const brief = createFallbackBrief(signal, 'signal-uuid');
    expect(brief.signalId).toBe('signal-uuid');
    expect(brief.topFindings[0].headline).toBe(signal.title);
    expect(brief.coverage.dispatched).toBe(0);
    expect(brief.suggestedAngles.length).toBeGreaterThan(0);
  });
});
