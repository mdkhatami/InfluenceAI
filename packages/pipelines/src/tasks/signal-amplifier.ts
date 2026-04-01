import type { PipelineDefinition, Signal, ScoredSignal } from '@influenceai/core';
import { RSSSignalAdapter, HackerNewsSignalAdapter } from '@influenceai/integrations';

const rssAdapter = new RSSSignalAdapter();
const hnAdapter = new HackerNewsSignalAdapter();

// Default RSS feeds for AI news aggregation.
// These can be overridden via integration_configs in the database.
const DEFAULT_AI_FEEDS = [
  'https://blog.openai.com/rss/',
  'https://www.anthropic.com/feed.xml',
  'https://ai.googleblog.com/feeds/posts/default?alt=rss',
  'https://huggingface.co/blog/feed.xml',
  'https://lilianweng.github.io/index.xml',
  'https://simonwillison.net/atom/everything/',
];

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'machine learning', 'deep learning',
  'transformer', 'neural', 'diffusion', 'agent', 'rag', 'embedding', 'fine-tuning',
  'langchain', 'openai', 'anthropic', 'hugging face', 'mistral', 'llama',
  'foundation model', 'large language model', 'multimodal', 'reasoning',
];

async function ingest(config: Record<string, unknown>): Promise<Signal[]> {
  const feedUrls = (config.feedUrls as string[]) ?? DEFAULT_AI_FEEDS;

  // Fetch from both sources in parallel
  const [rssSignals, hnSignals] = await Promise.all([
    rssAdapter.fetch({
      feedUrls,
      keywords: AI_KEYWORDS,
      maxAge: 24, // last 24 hours
    }),
    hnAdapter.fetch({
      storyType: 'top',
      limit: 30,
      keywords: AI_KEYWORDS,
      minScore: 50,
      maxAge: 24,
    }),
  ]);

  return [...rssSignals, ...hnSignals];
}

async function filter(signals: Signal[], _config: Record<string, unknown>): Promise<ScoredSignal[]> {
  return signals
    .map((signal) => {
      let score = 0;

      // Source-specific base scoring
      if (signal.sourceType === 'hackernews') {
        const meta = signal.metadata as { score?: number; commentCount?: number };
        // HN score is a strong engagement signal
        score += (meta.score ?? 0) * 0.5;
        // Comment count indicates discussion quality
        score += (meta.commentCount ?? 0) * 0.3;
      } else if (signal.sourceType === 'rss') {
        // RSS items get a base score; primary feeds get a boost
        score += 50;
        const feedUrl = (signal.metadata as { feedUrl?: string }).feedUrl ?? '';
        // Boost signals from primary AI company blogs
        if (feedUrl.includes('openai.com') || feedUrl.includes('anthropic.com') || feedUrl.includes('googleblog.com')) {
          score += 40;
        }
      }

      // Keyword density scoring
      const text = `${signal.title} ${signal.summary}`.toLowerCase();
      const keywordMatches = AI_KEYWORDS.filter((kw) => text.includes(kw));
      score += keywordMatches.length * 10;

      // Boost for high-signal keywords
      const highSignalKeywords = ['launch', 'release', 'announce', 'breakthrough', 'open source', 'benchmark', 'state-of-the-art', 'sota'];
      const highMatches = highSignalKeywords.filter((kw) => text.includes(kw));
      score += highMatches.length * 20;

      // Title length penalty (very short or very long titles are usually lower quality)
      if (signal.title.length < 20) score -= 10;
      if (signal.title.length > 200) score -= 10;

      const scoreReason = [
        `source=${signal.sourceType}`,
        `ai_keywords=${keywordMatches.length}`,
        `high_signal=${highMatches.length}`,
      ].join(', ');

      return { ...signal, score, scoreReason };
    })
    .sort((a, b) => b.score - a.score);
}

export const signalAmplifierPipeline: PipelineDefinition = {
  id: 'signal-amplifier',
  name: 'Signal Amplifier',
  description:
    'Aggregates AI news from RSS feeds and HackerNews, scores by relevance, generates content for LinkedIn and Twitter',
  schedule: '0 */3 * * *', // every 3 hours
  enabled: true,
  pillar: 'breaking-ai-news',
  platforms: ['linkedin', 'twitter'],
  ingest,
  filter,
  generate: {
    model: process.env.LLM_MODEL || 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.7,
    topK: 3,
  },
};
