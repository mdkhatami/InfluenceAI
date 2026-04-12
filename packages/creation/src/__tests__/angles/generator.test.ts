import { describe, it, expect, vi } from 'vitest';
import { generateAngles, autoSelectAngle } from '../../angles/generator';
import type { AngleCard, ResearchBrief, Finding } from '../../types';
import angleFixture from '../../__fixtures__/angle-response.json';

function mockFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    type: 'fact',
    headline: 'Test finding',
    detail: 'Some detail about the finding',
    importance: 'medium',
    ...overrides,
  };
}

function mockResearchBrief(overrides: Partial<ResearchBrief> = {}): ResearchBrief {
  return {
    id: 'brief-1',
    signalId: 'sig-1',
    signal: {
      sourceType: 'github',
      sourceId: 'test/repo',
      title: 'Test Signal',
      summary: 'A test signal for angle generation',
      url: 'https://github.com/test/repo',
      metadata: {},
      fetchedAt: new Date(),
      score: 8,
    },
    topFindings: [
      mockFinding({ headline: 'Finding A', importance: 'high' }),
      mockFinding({ headline: 'Finding B', importance: 'medium' }),
      mockFinding({ headline: 'Finding C', importance: 'low' }),
    ],
    connections: [{ findingA: mockFinding(), findingB: mockFinding(), relationship: 'causal', narrativeHook: 'Connection hook' }],
    suggestedAngles: ['angle 1'],
    unusualFact: 'Surprising fact',
    agentBriefs: [],
    coverage: { dispatched: 2, succeeded: 2, failed: 0, agents: ['tech', 'history'] },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    ...overrides,
  } as ResearchBrief;
}

function mockAngle(overrides: Partial<AngleCard> = {}): AngleCard {
  return {
    id: '1', researchBriefId: 'b1', angleType: 'contrarian', hook: 'Hook',
    thesis: 'Thesis', supportingFindings: [], domainSource: 'tech',
    estimatedEngagement: 'high', reasoning: 'test', status: 'generated', createdAt: new Date(),
    ...overrides,
  };
}

// Create a mock LLM client that returns the fixture
function createMockLLM() {
  return {
    generateJSON: vi.fn().mockResolvedValue(angleFixture),
    generate: vi.fn(),
    generateWithQuality: vi.fn(),
    createEmbedding: vi.fn(),
  };
}

describe('Angle Generator', () => {
  it('generates exactly 5 angle cards', async () => {
    const brief = mockResearchBrief();
    const llm = createMockLLM();
    const angles = await generateAngles(brief, 'linkedin', llm as any);
    expect(angles).toHaveLength(5);
  });

  it('all 5 have different angleType values', async () => {
    const llm = createMockLLM();
    const angles = await generateAngles(mockResearchBrief(), 'linkedin', llm as any);
    const types = new Set(angles.map(a => a.angleType));
    expect(types.size).toBe(5);
  });

  it('maps fields correctly from raw LLM output', async () => {
    const llm = createMockLLM();
    const angles = await generateAngles(mockResearchBrief(), 'linkedin', llm as any);
    expect(angles[0].hook).toBe("Everyone's celebrating this launch. Here's why they shouldn't be.");
    expect(angles[0].angleType).toBe('contrarian');
    expect(angles[0].status).toBe('generated');
    expect(angles[0].researchBriefId).toBe('brief-1');
  });

  it('handles out-of-range findingRefs with bounds checking (Fix 15)', async () => {
    // Brief only has 2 findings (indices 0, 1), but fixture has findingRefs [0, 2]
    const brief = mockResearchBrief({ topFindings: [mockFinding(), mockFinding()] });
    const llm = createMockLLM();
    const angles = await generateAngles(brief, 'linkedin', llm as any);
    // Should not crash — out-of-range refs filtered out
    angles.forEach(a => {
      a.supportingFindings.forEach(f => expect(f).toBeDefined());
    });
  });

  it('autoSelectAngle picks highest engagement', () => {
    const angles = [
      mockAngle({ estimatedEngagement: 'low', angleType: 'practical' }),
      mockAngle({ estimatedEngagement: 'high', angleType: 'contrarian' }),
      mockAngle({ estimatedEngagement: 'medium', angleType: 'prediction' }),
    ];
    const selected = autoSelectAngle(angles, 'linkedin');
    expect(selected.estimatedEngagement).toBe('high');
  });

  it('autoSelectAngle uses platform preference tiebreaker', () => {
    const angles = [
      mockAngle({ estimatedEngagement: 'high', angleType: 'practical' }),
      mockAngle({ estimatedEngagement: 'high', angleType: 'contrarian' }),
    ];
    // LinkedIn prefers contrarian over practical
    const selected = autoSelectAngle(angles, 'linkedin');
    expect(selected.angleType).toBe('contrarian');
  });
});
