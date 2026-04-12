import { describe, it, expect, vi } from 'vitest';
import { createContent } from '../pipeline';
import type { ResearchBrief, Finding, AngleCard } from '../types';
import angleFixture from '../__fixtures__/angle-response.json';
import storyPlanFixture from '../__fixtures__/story-plan-response.json';
import draftFixture from '../__fixtures__/draft-with-quality.json';

function mockFinding(overrides: Partial<Finding> = {}): Finding {
  return { type: 'fact', headline: 'Test finding', detail: 'Detail', importance: 'medium', ...overrides };
}

function mockBrief(): ResearchBrief {
  return {
    id: 'brief-1', signalId: 'sig-1',
    signal: { sourceType: 'github', sourceId: 'test/repo', title: 'Test Signal', summary: 'Summary', url: 'https://example.com', metadata: {}, fetchedAt: new Date(), score: 8 },
    topFindings: [mockFinding({ headline: 'A', importance: 'high' }), mockFinding({ headline: 'B' }), mockFinding({ headline: 'C' })],
    connections: [], suggestedAngles: [], unusualFact: 'Surprising',
    agentBriefs: [],
    coverage: { dispatched: 2, succeeded: 2, failed: 0, agents: ['tech', 'history'] },
    createdAt: new Date(), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  } as ResearchBrief;
}

function createMockLLM() {
  return {
    generateJSON: vi.fn()
      .mockResolvedValueOnce(angleFixture)  // angles step
      .mockResolvedValueOnce(storyPlanFixture), // story plan step
    generate: vi.fn(),
    generateWithQuality: vi.fn().mockResolvedValue({
      content: draftFixture.content,
      qualityScore: draftFixture.qualityScore,
      model: 'test',
    }),
    createEmbedding: vi.fn(),
  };
}

function createMockDb() {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'voice_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      }
      return {
        insert: insertFn,
        update: updateFn,
        upsert: vi.fn().mockResolvedValue({}),
      };
    }),
  };
}

describe('createContent', () => {
  it('batch mode: returns complete result with selectedAngle + draft', async () => {
    const result = await createContent(mockBrief(), 'linkedin', { autoSelect: true }, createMockDb() as any, createMockLLM() as any);
    expect(result.phase).toBe('complete');
    if (result.phase === 'complete') {
      expect(result.draft.body).toBeTruthy();
      expect(result.selectedAngle).toBeDefined();
      expect(result.storyArc).toBeDefined();
      expect(result.angleCards).toHaveLength(5);
    }
  });

  it('interactive: returns angles_only when no selection provided', async () => {
    const llm = createMockLLM();
    const result = await createContent(mockBrief(), 'linkedin', {}, createMockDb() as any, llm as any);
    expect(result.phase).toBe('angles_only');
    if (result.phase === 'angles_only') {
      expect(result.angleCards.length).toBe(5);
    }
    // Should NOT have called generateWithQuality (no draft generation)
    expect(llm.generateWithQuality).not.toHaveBeenCalled();
  });
});
