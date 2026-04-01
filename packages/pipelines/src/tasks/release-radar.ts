import type { PipelineDefinition, Signal, ScoredSignal } from '@influenceai/core';
import { RSSSignalAdapter, HackerNewsSignalAdapter } from '@influenceai/integrations';

const rssAdapter = new RSSSignalAdapter();
const hnAdapter = new HackerNewsSignalAdapter();

// Focused on official release/changelog feeds
const RELEASE_FEEDS = [
  'https://blog.openai.com/rss/',
  'https://www.anthropic.com/feed.xml',
  'https://ai.googleblog.com/feeds/posts/default?alt=rss',
  'https://huggingface.co/blog/feed.xml',
  'https://github.blog/feed/',
  'https://stability.ai/feed',
  'https://www.midjourney.com/blog/rss.xml',
  'https://ollama.com/blog/rss.xml',
];

const RELEASE_KEYWORDS = [
  'release', 'launch', 'announce', 'introducing', 'now available', 'open source',
  'version', 'v2', 'v3', 'v4', 'v5', 'update', 'upgrade', 'changelog',
  'new model', 'new feature', 'api', 'sdk', 'beta', 'ga', 'general availability',
  'gpt', 'claude', 'gemini', 'llama', 'mistral', 'flux', 'stable diffusion',
];

async function ingest(config: Record<string, unknown>): Promise<Signal[]> {
  const feedUrls = (config.feedUrls as string[]) ?? RELEASE_FEEDS;

  const [rssSignals, hnSignals] = await Promise.all([
    rssAdapter.fetch({
      feedUrls,
      keywords: RELEASE_KEYWORDS,
      maxAge: 48, // 48 hours -- releases can take a day to surface
    }),
    hnAdapter.fetch({
      storyType: 'top',
      limit: 50,
      keywords: RELEASE_KEYWORDS,
      minScore: 100, // higher threshold -- release posts tend to get high engagement
      maxAge: 48,
    }),
  ]);

  return [...rssSignals, ...hnSignals];
}

async function filter(signals: Signal[], _config: Record<string, unknown>): Promise<ScoredSignal[]> {
  return signals
    .map((signal) => {
      let score = 0;
      const text = `${signal.title} ${signal.summary}`.toLowerCase();

      // Release-specific keyword boost (primary signal)
      const releaseTerms = ['release', 'launch', 'announce', 'introducing', 'now available', 'open source', 'changelog', 'general availability'];
      const releaseMatches = releaseTerms.filter((kw) => text.includes(kw));
      score += releaseMatches.length * 25;

      // Version number detection (strong release indicator)
      const versionPattern = /v?\d+\.\d+/;
      if (versionPattern.test(text)) score += 30;

      // Model/product name detection
      const productNames = ['gpt', 'claude', 'gemini', 'llama', 'mistral', 'flux', 'stable diffusion', 'dall-e', 'sora', 'copilot'];
      const productMatches = productNames.filter((p) => text.includes(p));
      score += productMatches.length * 20;

      // Source-specific scoring
      if (signal.sourceType === 'hackernews') {
        const meta = signal.metadata as { score?: number; commentCount?: number };
        score += (meta.score ?? 0) * 0.3;
        score += (meta.commentCount ?? 0) * 0.2;
        // HN stories with very high scores (>200) about releases are gold
        if ((meta.score ?? 0) > 200) score += 50;
      } else if (signal.sourceType === 'rss') {
        score += 30;
        // Official blog feeds get a strong boost
        const feedUrl = (signal.metadata as { feedUrl?: string }).feedUrl ?? '';
        if (feedUrl.includes('openai.com') || feedUrl.includes('anthropic.com') || feedUrl.includes('googleblog.com')) {
          score += 60;
        }
      }

      const scoreReason = [
        `release_terms=${releaseMatches.length}`,
        `products=${productMatches.length}`,
        `has_version=${versionPattern.test(text)}`,
        `source=${signal.sourceType}`,
      ].join(', ');

      return { ...signal, score, scoreReason };
    })
    .filter((s) => s.score > 0) // Must match at least something release-related
    .sort((a, b) => b.score - a.score);
}

export const releaseRadarPipeline: PipelineDefinition = {
  id: 'release-radar',
  name: 'AI Company Release Radar',
  description:
    'Tracks AI company releases via RSS feeds and HackerNews, turns changelogs into compelling story-driven content',
  schedule: '0 */6 * * *', // every 6 hours
  enabled: true,
  pillar: 'breaking-ai-news',
  platforms: ['linkedin', 'twitter'],
  ingest,
  filter,
  generate: {
    model: process.env.LLM_MODEL || 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.7,
    topK: 2, // fewer but higher quality for releases
  },
};
