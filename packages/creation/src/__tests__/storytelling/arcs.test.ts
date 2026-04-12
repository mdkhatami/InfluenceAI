import { describe, it, expect } from 'vitest';
import { STORY_ARCS, selectArc } from '../../storytelling/arcs';
import type { AngleCard } from '../../types';

function mockAngle(overrides: Partial<AngleCard> = {}): AngleCard {
  return {
    id: '1', researchBriefId: 'b1', angleType: 'contrarian', hook: 'Hook',
    thesis: 'Thesis', supportingFindings: [], domainSource: 'tech',
    estimatedEngagement: 'high', reasoning: 'test', status: 'generated', createdAt: new Date(),
    ...overrides,
  };
}

describe('Story Arcs', () => {
  it('has exactly 6 arcs defined', () => {
    expect(STORY_ARCS).toHaveLength(6);
  });

  it('contrarian → Detective on LinkedIn', () => {
    const arc = selectArc(mockAngle({ angleType: 'contrarian' }), 'linkedin');
    expect(arc.id).toBe('detective');
  });

  it('prediction → Prophet on LinkedIn', () => {
    const arc = selectArc(mockAngle({ angleType: 'prediction' }), 'linkedin');
    expect(arc.id).toBe('prophet');
  });

  it('historical_parallel → Historian on YouTube', () => {
    const arc = selectArc(mockAngle({ angleType: 'historical_parallel' }), 'youtube');
    expect(arc.id).toBe('historian');
  });

  it('fallback to Detective when no match', () => {
    const arc = selectArc(mockAngle({ angleType: 'career_impact' }), 'linkedin');
    expect(arc).toBeDefined();
    // career_impact isn't in any arc's bestFor, so falls back to first arc (detective)
    expect(arc.id).toBe('detective');
  });
});
