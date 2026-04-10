import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPipeline } from './runner';
import type { PipelineDefinition, Signal, ScoredSignal } from '@influenceai/core';

// Mock database module
vi.mock('@influenceai/database', () => ({
  getServiceClient: vi.fn().mockReturnValue({}),
  createPipelineRun: vi.fn().mockResolvedValue('run-123'),
  completePipelineRun: vi.fn().mockResolvedValue(undefined),
  logPipelineStep: vi.fn().mockResolvedValue(undefined),
  findExistingHashes: vi.fn().mockResolvedValue(new Set()),
  upsertSignalWithScore: vi.fn().mockResolvedValue('signal-123'),
  insertContentItem: vi.fn().mockResolvedValue('item-123'),
  getActiveTemplate: vi.fn().mockResolvedValue(null),
  computeDedupeHash: vi.fn().mockReturnValue('hash-123'),
}));

// Mock LLM client
vi.mock('@influenceai/integrations', () => ({
  LLMClient: {
    fromEnv: vi.fn().mockReturnValue({
      generateWithQuality: vi.fn().mockResolvedValue({
        content: 'Generated content for LinkedIn',
        qualityScore: 8,
        model: 'gpt-4o',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
    }),
    withModel: vi.fn().mockReturnValue({
      generateWithQuality: vi.fn().mockResolvedValue({
        content: 'Generated content',
        qualityScore: 7,
        model: 'gpt-4o-mini',
        usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
      }),
    }),
  },
  buildPrompt: vi.fn().mockReturnValue({
    systemPrompt: 'You are a writer.',
    userPrompt: 'Write about this topic.',
  }),
}));

const mockSignals: Signal[] = [
  {
    sourceType: 'github',
    sourceId: 'org/ai-tool',
    title: 'org/ai-tool: Advanced GPT-based LLM framework for deep learning',
    summary: 'A transformer-based generative AI tool for machine learning research',
    url: 'https://github.com/org/ai-tool',
    metadata: { stars: 2000 },
    fetchedAt: new Date(),
  },
];

const mockScoredSignals: ScoredSignal[] = [
  { ...mockSignals[0], score: 95, scoreReason: 'High relevance' },
];

const mockDefinition: PipelineDefinition = {
  id: 'github-trends',
  name: 'GitHub Trends Daily',
  description: 'Test pipeline',
  schedule: '0 8 * * *',
  enabled: true,
  pillar: 'breaking-ai-news',
  platforms: ['linkedin', 'twitter'],
  ingest: vi.fn().mockResolvedValue(mockSignals),
  filter: vi.fn().mockResolvedValue(mockScoredSignals),
  generate: {
    model: 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.7,
    topK: 3,
  },
};

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a PipelineRunResult with correct structure', async () => {
    const result = await runPipeline(mockDefinition);

    expect(result).toHaveProperty('runId', 'run-123');
    expect(result).toHaveProperty('pipelineId', 'github-trends');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('signalsIngested');
    expect(result).toHaveProperty('signalsFiltered');
    expect(result).toHaveProperty('itemsGenerated');
    expect(result).toHaveProperty('durationMs');
  });

  it('calls ingest and filter functions from the definition', async () => {
    await runPipeline(mockDefinition);

    expect(mockDefinition.ingest).toHaveBeenCalled();
    expect(mockDefinition.filter).toHaveBeenCalled();
  });

  it('generates content for each platform', async () => {
    const result = await runPipeline(mockDefinition);

    // 1 signal × 2 platforms = 2 content items
    expect(result.itemsGenerated).toBe(2);
  });

  it('marks run as completed on success', async () => {
    const result = await runPipeline(mockDefinition);
    expect(result.status).toBe('completed');
  });

  it('marks run as failed when ingest throws', async () => {
    const failDef = {
      ...mockDefinition,
      ingest: vi.fn().mockRejectedValue(new Error('API down')),
    };

    const result = await runPipeline(failDef);
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('filters out non-AI-relevant signals before passing to filter step', async () => {
    const aiSignal: Signal = {
      sourceType: 'github',
      sourceId: 'org/llm-framework',
      title: 'org/llm-framework: GPT-based LLM framework for deep learning',
      summary: 'A transformer-based generative AI tool for machine learning',
      url: 'https://github.com/org/llm-framework',
      metadata: {},
      fetchedAt: new Date(),
    };
    const gardeningSignal: Signal = {
      sourceType: 'rss',
      sourceId: 'blog/gardening-tips',
      title: 'How to grow tomatoes in your garden',
      summary: 'Tips for growing vegetables in your backyard garden',
      url: 'https://example.com/gardening',
      metadata: {},
      fetchedAt: new Date(),
    };

    const mixedDef = {
      ...mockDefinition,
      ingest: vi.fn().mockResolvedValue([aiSignal, gardeningSignal]),
      filter: vi.fn().mockResolvedValue([{ ...aiSignal, score: 90, scoreReason: 'AI relevant' }]),
    };

    await runPipeline(mixedDef);

    expect(mixedDef.filter).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ sourceId: 'org/llm-framework' })]),
      {},
    );
    // The gardening signal should NOT be passed to filter
    const filterCallArg = (mixedDef.filter as ReturnType<typeof vi.fn>).mock.calls[0][0] as Signal[];
    expect(filterCallArg.some((s: Signal) => s.sourceId === 'blog/gardening-tips')).toBe(false);
  });

  it('uses default threshold of 3 when relevanceThreshold is not set', async () => {
    const aiSignal: Signal = {
      sourceType: 'github',
      sourceId: 'org/pytorch-model',
      title: 'org/pytorch-model: PyTorch neural network for deep learning',
      summary: 'A machine learning framework using transformers and embeddings',
      url: 'https://github.com/org/pytorch-model',
      metadata: {},
      fetchedAt: new Date(),
    };
    const lowRelevanceSignal: Signal = {
      sourceType: 'rss',
      sourceId: 'blog/cooking',
      title: 'Best pasta recipes for dinner',
      summary: 'Delicious Italian pasta cooking guide',
      url: 'https://example.com/cooking',
      metadata: {},
      fetchedAt: new Date(),
    };

    const defWithoutThreshold = {
      ...mockDefinition,
      relevanceThreshold: undefined,
      ingest: vi.fn().mockResolvedValue([aiSignal, lowRelevanceSignal]),
      filter: vi.fn().mockResolvedValue([{ ...aiSignal, score: 90, scoreReason: 'AI relevant' }]),
    };

    await runPipeline(defWithoutThreshold);

    // Only the AI signal should reach the filter step
    const filterCallArg = (defWithoutThreshold.filter as ReturnType<typeof vi.fn>).mock.calls[0][0] as Signal[];
    expect(filterCallArg.some((s: Signal) => s.sourceId === 'org/pytorch-model')).toBe(true);
    expect(filterCallArg.some((s: Signal) => s.sourceId === 'blog/cooking')).toBe(false);
  });

  it('skips generation when all signals are dropped by relevance', async () => {
    const nonAiSignal: Signal = {
      sourceType: 'rss',
      sourceId: 'blog/sports',
      title: 'Football match results from last weekend',
      summary: 'Weekend sports scores and highlights from the league',
      url: 'https://example.com/sports',
      metadata: {},
      fetchedAt: new Date(),
    };

    const allDroppedDef = {
      ...mockDefinition,
      ingest: vi.fn().mockResolvedValue([nonAiSignal]),
      filter: vi.fn().mockResolvedValue([]),
    };

    const result = await runPipeline(allDroppedDef);

    expect(allDroppedDef.filter).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
    expect(result.itemsGenerated).toBe(0);
  });
});
