import type { PipelineDefinition, Signal, ScoredSignal } from '@influenceai/core';
import { GitHubSignalAdapter } from '@influenceai/integrations';

const adapter = new GitHubSignalAdapter();

const AI_KEYWORDS = ['ai', 'llm', 'gpt', 'machine-learning', 'deep-learning', 'transformer', 'neural', 'diffusion', 'agent', 'rag', 'embedding', 'langchain', 'openai', 'anthropic'];

async function ingest(): Promise<Signal[]> {
  return adapter.fetch({ since: 'daily' });
}

async function filter(signals: Signal[]): Promise<ScoredSignal[]> {
  return signals
    .map((signal) => {
      let score = 0;
      const meta = signal.metadata as { stars?: number; starsToday?: number; language?: string };

      // Star velocity is the primary signal
      score += (meta.starsToday ?? 0) * 2;
      score += Math.log10((meta.stars ?? 1) + 1) * 10;

      // AI-relevant language boost
      const lang = (meta.language ?? '').toLowerCase();
      if (['python', 'jupyter notebook'].includes(lang)) score += 20;
      if (['typescript', 'rust'].includes(lang)) score += 10;

      // AI keyword boost from title/summary
      const text = `${signal.title} ${signal.summary}`.toLowerCase();
      const matches = AI_KEYWORDS.filter((kw) => text.includes(kw));
      score += matches.length * 15;

      const scoreReason = [
        `stars_today=${meta.starsToday ?? 0}`,
        `lang=${meta.language ?? 'unknown'}`,
        `ai_keywords=${matches.length}`,
      ].join(', ');

      return { ...signal, score, scoreReason };
    })
    .sort((a, b) => b.score - a.score);
}

export const githubTrendsPipeline: PipelineDefinition = {
  id: 'github-trends',
  name: 'GitHub Trends Daily Digest',
  description: 'Fetches trending GitHub repos, scores by AI relevance, generates content for LinkedIn/Twitter/Instagram',
  schedule: '0 8 * * *',
  enabled: true,
  pillar: 'breaking-ai-news',
  platforms: ['linkedin', 'twitter', 'instagram'],
  ingest,
  filter,
  generate: {
    model: process.env.LLM_MODEL || 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.7,
    topK: 3,
  },
};
