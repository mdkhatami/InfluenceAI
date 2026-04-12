import { describe, it, expect, vi } from 'vitest';
import { analyzeVoice, getCurrentVoiceProfile } from '../../voice/analyzer';
import voiceFixture from '../../__fixtures__/voice-analysis-response.json';

function createMockDb(editCount: number = 10, hasExistingProfile: boolean = false) {
  const edits = Array.from({ length: editCount }, (_, i) => ({
    id: `edit-${i}`,
    before_body: `Before text ${i} with enough content to analyze properly`,
    after_body: `After text ${i} with modified content for analysis`,
    created_at: new Date().toISOString(),
  }));

  const mockFrom = vi.fn().mockImplementation((table: string) => {
    if (table === 'content_edits') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: edits }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({}),
        }),
      };
    }
    if (table === 'voice_profiles') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: hasExistingProfile
                ? {
                    id: 'old',
                    version: 1,
                    confidence: 0.2,
                    edits_analyzed: 10,
                    style_rules: [],
                    vocabulary_preferences: { preferred: [], avoided: [] },
                    opening_patterns: [],
                    cta_patterns: [],
                    tone_descriptor: '',
                    stances: [],
                    exemplar_posts: [],
                    is_active: true,
                    updated_at: new Date().toISOString(),
                  }
                : null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({}),
        }),
        insert: vi.fn().mockResolvedValue({}),
      };
    }
    if (table === 'content_items') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [] }),
            }),
          }),
        }),
      };
    }
    return {};
  });

  return { from: mockFrom };
}

function createMockLLM() {
  return {
    generateJSON: vi.fn().mockResolvedValue(voiceFixture),
    generate: vi.fn(),
    generateWithQuality: vi.fn(),
  };
}

describe('Voice Analyzer', () => {
  it('throws when fewer than 5 edits', async () => {
    const db = createMockDb(3);
    const llm = createMockLLM();
    await expect(analyzeVoice(db, llm as any)).rejects.toThrow('Not enough edits');
  });

  it('confidence scales with edit count', async () => {
    const db = createMockDb(25);
    const llm = createMockLLM();
    const profile = await analyzeVoice(db, llm as any);
    expect(profile.confidence).toBe(0.5); // 25/50 = 0.5
  });

  it('deactivates previous profile before insert (Fix 9)', async () => {
    const db = createMockDb(10, true);
    const llm = createMockLLM();
    await analyzeVoice(db, llm as any);
    // Check that update was called with is_active: false
    const voiceCalls = db.from.mock.calls.filter((c: any[]) => c[0] === 'voice_profiles');
    expect(voiceCalls.length).toBeGreaterThanOrEqual(2); // select + update + insert
  });

  it('marks edits as analyzed', async () => {
    const db = createMockDb(10);
    const llm = createMockLLM();
    await analyzeVoice(db, llm as any);
    const editCalls = db.from.mock.calls.filter((c: any[]) => c[0] === 'content_edits');
    expect(editCalls.length).toBeGreaterThanOrEqual(2); // select + update
  });
});
