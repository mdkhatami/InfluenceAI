import { describe, it, expect } from 'vitest';
import { selectAgents } from '../../agents/selector';
import type { ScoredSignal } from '@influenceai/core';

function mockSignal(overrides: Partial<ScoredSignal> = {}): ScoredSignal {
  return {
    sourceType: 'github', sourceId: 'test/repo', title: 'Test signal',
    summary: 'A test', url: 'https://example.com', metadata: {},
    fetchedAt: new Date(), score: 5, ...overrides,
  };
}

describe('selectAgents', () => {
  const allEnabled = ['tech', 'finance', 'geopolitics', 'industry', 'deveco', 'history'];

  it('always selects tech + history', () => {
    const agents = selectAgents(mockSignal({ title: 'Random news' }), allEnabled);
    const ids = agents.map(a => a.id);
    expect(ids).toContain('tech');
    expect(ids).toContain('history');
  });

  it('selects finance for funding keywords', () => {
    const agents = selectAgents(mockSignal({ title: 'OpenAI raises $10 billion in funding round' }), allEnabled);
    expect(agents.map(a => a.id)).toContain('finance');
  });

  it('selects geopolitics for regulation keywords', () => {
    const agents = selectAgents(mockSignal({ title: 'EU AI Act new compliance requirements' }), allEnabled);
    expect(agents.map(a => a.id)).toContain('geopolitics');
  });

  it('max 6 agents for fully triggering signal', () => {
    const agents = selectAgents(
      mockSignal({ title: 'OpenAI funding regulation github npm framework enterprise disruption' }),
      allEnabled,
    );
    expect(agents.length).toBeLessThanOrEqual(6);
  });

  it('respects enabledAgents filter', () => {
    const agents = selectAgents(mockSignal(), ['tech', 'history']);
    expect(agents.length).toBe(2);
  });
});
