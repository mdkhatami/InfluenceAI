import { describe, it, expect, vi } from 'vitest';
import { LLMClient } from './client';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    content: 'Generated post about AI trends',
                    qualityScore: 8,
                  }),
                },
              },
            ],
            model: 'gpt-4o',
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
          }),
        },
      };
    },
  };
});

describe('LLMClient', () => {
  const client = new LLMClient({ baseUrl: 'http://test', apiKey: 'test', model: 'gpt-4o' });

  it('generates content with quality score via generateWithQuality', async () => {
    const result = await client.generateWithQuality({
      systemPrompt: 'Write a post.',
      userPrompt: 'Topic: AI trends',
    });

    expect(result.content).toBe('Generated post about AI trends');
    expect(result.qualityScore).toBe(8);
    expect(result.model).toBe('gpt-4o');
    expect(result.usage).toBeDefined();
    expect(result.usage!.totalTokens).toBe(150);
  });

  it('creates client with model override via withModel', () => {
    const overridden = LLMClient.withModel('claude-sonnet-4-6');
    expect(overridden).toBeInstanceOf(LLMClient);
  });
});
