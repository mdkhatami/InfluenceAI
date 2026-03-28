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
    title: 'org/ai-tool: Amazing AI tool',
    summary: 'An amazing AI tool',
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
});
