import { describe, it, expect, vi } from 'vitest';
import { generateDraft } from '../../storytelling/engine';
import type { AngleCard, ResearchBrief, Finding, StoryArc, VoiceProfile } from '../../types';
import { STORY_ARCS } from '../../storytelling/arcs';
import storyPlanFixture from '../../__fixtures__/story-plan-response.json';
import draftFixture from '../../__fixtures__/draft-with-quality.json';

function mockFinding(overrides: Partial<Finding> = {}): Finding {
  return { type: 'fact', headline: 'Test finding', detail: 'Detail', importance: 'medium', ...overrides };
}

function mockAngle(overrides: Partial<AngleCard> = {}): AngleCard {
  return {
    id: '1', researchBriefId: 'b1', angleType: 'contrarian', hook: 'Test hook',
    thesis: 'Test thesis', supportingFindings: [mockFinding()], domainSource: 'tech',
    estimatedEngagement: 'high', reasoning: 'test', status: 'selected', createdAt: new Date(),
    ...overrides,
  };
}

function mockBrief(overrides: Partial<ResearchBrief> = {}): ResearchBrief {
  return {
    id: 'brief-1', signalId: 'sig-1',
    signal: { sourceType: 'github', sourceId: 'test/repo', title: 'Test', summary: 'Summary', url: 'https://example.com', metadata: {}, fetchedAt: new Date(), score: 8 },
    topFindings: [mockFinding({ headline: 'Finding A', importance: 'high' }), mockFinding({ headline: 'Finding B' })],
    connections: [], suggestedAngles: [], unusualFact: 'Unusual', agentBriefs: [],
    coverage: { dispatched: 1, succeeded: 1, failed: 0, agents: ['tech'] },
    createdAt: new Date(), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    ...overrides,
  } as ResearchBrief;
}

function createMockLLM() {
  return {
    generateJSON: vi.fn().mockResolvedValue(storyPlanFixture),
    generate: vi.fn(),
    generateWithQuality: vi.fn().mockResolvedValue({
      content: draftFixture.content,
      qualityScore: draftFixture.qualityScore,
      model: 'test-model',
    }),
    createEmbedding: vi.fn(),
  };
}

describe('Storytelling Engine', () => {
  it('story plan produces beats matching arc structure', async () => {
    const llm = createMockLLM();
    const arc = STORY_ARCS[0]; // Detective
    const draft = await generateDraft(mockBrief(), mockAngle(), arc, 'linkedin', null, llm as any);
    // generateJSON was called for the plan step
    expect(llm.generateJSON).toHaveBeenCalledTimes(1);
    // generateWithQuality was called for the draft step
    expect(llm.generateWithQuality).toHaveBeenCalledTimes(1);
  });

  it('full draft produces non-empty body', async () => {
    const llm = createMockLLM();
    const arc = STORY_ARCS[0];
    const draft = await generateDraft(mockBrief(), mockAngle(), arc, 'linkedin', null, llm as any);
    expect(draft.body.length).toBeGreaterThan(100);
    expect(draft.title).toBeTruthy();
  });

  it('qualityScore between 1-10', async () => {
    const llm = createMockLLM();
    const arc = STORY_ARCS[0];
    const draft = await generateDraft(mockBrief(), mockAngle(), arc, 'linkedin', null, llm as any);
    expect(draft.qualityScore).toBeGreaterThanOrEqual(1);
    expect(draft.qualityScore).toBeLessThanOrEqual(10);
  });

  it('includes voice injection when profile confidence >= 0.3', async () => {
    const llm = createMockLLM();
    const arc = STORY_ARCS[0];
    const voiceProfile: VoiceProfile = {
      id: 'vp-1', version: 1, confidence: 0.5, editsAnalyzed: 25,
      styleRules: [{ rule: 'Use short sentences', evidence: 'Edits consistently shortened sentences', strength: 0.8 }],
      vocabularyPreferences: { preferred: ['leverage'], avoided: ['synergy'] },
      openingPatterns: ['Bold claim opener'], ctaPatterns: ['Question CTA'],
      toneDescriptor: 'Direct and analytical', stances: [],
      exemplarPosts: [], isActive: true, updatedAt: new Date(),
    };
    await generateDraft(mockBrief(), mockAngle(), arc, 'linkedin', voiceProfile, llm as any);
    // The system prompt sent to generateWithQuality should include voice profile
    const callArgs = llm.generateWithQuality.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain('AUTHOR VOICE PROFILE');
  });

  it('does NOT include voice injection when profile confidence < 0.3', async () => {
    const llm = createMockLLM();
    const arc = STORY_ARCS[0];
    const weakProfile: VoiceProfile = {
      id: 'vp-1', version: 1, confidence: 0.1, editsAnalyzed: 5,
      styleRules: [], vocabularyPreferences: { preferred: [], avoided: [] },
      openingPatterns: [], ctaPatterns: [], toneDescriptor: 'Unknown',
      stances: [], exemplarPosts: [], isActive: true, updatedAt: new Date(),
    };
    await generateDraft(mockBrief(), mockAngle(), arc, 'linkedin', weakProfile, llm as any);
    const callArgs = llm.generateWithQuality.mock.calls[0][0];
    expect(callArgs.systemPrompt).not.toContain('AUTHOR VOICE PROFILE');
  });
});
