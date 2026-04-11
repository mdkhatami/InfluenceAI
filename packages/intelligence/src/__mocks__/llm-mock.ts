import type { LLMGenerateParams, LLMGenerateResult } from '@influenceai/integrations';
import techFixture from '../__fixtures__/tech-agent-response.json';

/**
 * Creates a mock LLMClient that routes generateJSON calls to fixture files
 * based on system prompt content. Matches the LLMClient class shape from
 * @influenceai/integrations (methods: generate, generateJSON,
 * generateWithQuality, createEmbedding).
 */
export function createMockLLMClient() {
  return {
    generate: async (params: LLMGenerateParams): Promise<LLMGenerateResult> => ({
      content: 'Mock generated content',
      model: 'mock-model',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }),

    generateJSON: async <T>(params: LLMGenerateParams): Promise<T> => {
      const prompt = params.systemPrompt.toLowerCase();

      // Route to appropriate fixture based on prompt content.
      // As more agents are implemented, add routing branches here:
      //   if (prompt.includes('history')) return historyFixture as T;
      //   if (prompt.includes('finance')) return financeFixture as T;
      //   if (prompt.includes('synthesis')) return synthesisFixture as T;
      if (prompt.includes('tech') || prompt.includes('technical')) {
        return techFixture as T;
      }

      // Default fallback returns tech fixture
      return techFixture as T;
    },

    generateWithQuality: async (params: LLMGenerateParams) => ({
      content: 'Mock content',
      qualityScore: 7,
      model: 'mock-model',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    }),

    createEmbedding: async (input: string): Promise<number[]> => {
      return new Array(1536).fill(0);
    },
  };
}
