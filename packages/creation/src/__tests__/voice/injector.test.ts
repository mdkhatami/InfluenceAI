import { describe, it, expect } from 'vitest';
import { buildVoiceInjection } from '../../voice/injector';
import type { VoiceProfile } from '../../types';

function mockProfile(overrides: Partial<VoiceProfile> = {}): VoiceProfile {
  return {
    id: 'vp-1', version: 1, confidence: 0.6, editsAnalyzed: 30,
    styleRules: [
      { rule: 'Use short sentences', evidence: 'test', strength: 0.8 },
      { rule: 'Weak rule', evidence: 'test', strength: 0.3 },
    ],
    vocabularyPreferences: { preferred: ['leverage'], avoided: ['synergy'] },
    openingPatterns: ['Bold opener'], ctaPatterns: ['Question CTA'],
    toneDescriptor: 'Direct and analytical',
    stances: [{ topic: 'AI hype', position: 'Skeptical', confidence: 0.7, lastExpressed: new Date() }],
    exemplarPosts: [
      { contentItemId: '1', platform: 'linkedin', title: 'Post 1', body: 'Example body 1', qualityScore: 9, editDistance: 5 },
      { contentItemId: '2', platform: 'twitter', title: 'Post 2', body: 'Example body 2', qualityScore: 8, editDistance: 3 },
      { contentItemId: '3', platform: 'linkedin', title: 'Post 3', body: 'Example body 3', qualityScore: 8, editDistance: 4 },
      { contentItemId: '4', platform: 'linkedin', title: 'Post 4', body: 'Example body 4', qualityScore: 7, editDistance: 6 },
    ],
    isActive: true, updatedAt: new Date(),
    ...overrides,
  };
}

describe('Voice Injector', () => {
  it('returns empty string when confidence < 0.3', () => {
    const result = buildVoiceInjection(mockProfile({ confidence: 0.1 }));
    expect(result).toBe('');
  });

  it('includes only strong rules (strength >= 0.5)', () => {
    const result = buildVoiceInjection(mockProfile());
    expect(result).toContain('Use short sentences');
    expect(result).not.toContain('Weak rule');
  });

  it('includes max 3 exemplar posts', () => {
    const result = buildVoiceInjection(mockProfile());
    expect(result).toContain('Example 1');
    expect(result).toContain('Example 2');
    expect(result).toContain('Example 3');
    expect(result).not.toContain('Example 4');
  });

  it('includes vocabulary preferences', () => {
    const result = buildVoiceInjection(mockProfile());
    expect(result).toContain('leverage');
    expect(result).toContain('synergy');
    expect(result).toContain('NEVER');
  });

  it('includes stances', () => {
    const result = buildVoiceInjection(mockProfile());
    expect(result).toContain('AI hype');
    expect(result).toContain('Skeptical');
  });
});
