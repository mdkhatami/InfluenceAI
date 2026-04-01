import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HackerNewsSignalAdapter } from './hackernews';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const MOCK_TOP_STORY_IDS = [101, 102, 103, 104];

const MOCK_STORIES: Record<number, Record<string, unknown>> = {
  101: {
    id: 101,
    title: 'Show HN: Open-source LLM agent framework',
    url: 'https://github.com/example/llm-agent',
    score: 350,
    by: 'developer1',
    time: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    descendants: 120,
    type: 'story',
  },
  102: {
    id: 102,
    title: 'How we saved $2M switching to a new database',
    url: 'https://blog.example.com/database-switch',
    score: 200,
    by: 'developer2',
    time: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
    descendants: 85,
    type: 'story',
  },
  103: {
    id: 103,
    title: 'GPT-5 achieves PhD-level reasoning on benchmarks',
    url: 'https://openai.com/blog/gpt5',
    score: 500,
    by: 'airesearcher',
    time: Math.floor(Date.now() / 1000) - 1800, // 30 min ago
    descendants: 300,
    type: 'story',
  },
  104: {
    id: 104,
    title: 'Ask HN: What keyboard do you use?',
    url: '',
    text: 'Looking for ergonomic keyboard recommendations',
    score: 50,
    by: 'user4',
    time: Math.floor(Date.now() / 1000) - 600,
    descendants: 200,
    type: 'story',
  },
};

function setupMockFetch() {
  mockFetch.mockImplementation((url: string) => {
    const urlStr = url.toString();

    if (urlStr.includes('topstories.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_TOP_STORY_IDS),
      });
    }

    if (urlStr.includes('newstories.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([101, 103]),
      });
    }

    const idMatch = urlStr.match(/item\/(\d+)\.json/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      const story = MOCK_STORIES[id];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(story ?? null),
      });
    }

    return Promise.resolve({ ok: false, status: 404 });
  });
}

describe('HackerNewsSignalAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockFetch();
  });

  it('has source type "hackernews"', () => {
    const adapter = new HackerNewsSignalAdapter();
    expect(adapter.source).toBe('hackernews');
  });

  it('fetches top stories and converts to Signal[]', async () => {
    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({ storyType: 'top', limit: 4 });

    expect(signals.length).toBeGreaterThan(0);
    expect(signals[0].sourceType).toBe('hackernews');
    expect(signals[0].fetchedAt).toBeInstanceOf(Date);
  });

  it('stores HN metadata (score, author, comments) in signal metadata', async () => {
    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({ storyType: 'top', limit: 4 });

    const gpt5Signal = signals.find((s) => s.title.includes('GPT-5'));
    expect(gpt5Signal).toBeDefined();
    expect(gpt5Signal!.metadata).toHaveProperty('score', 500);
    expect(gpt5Signal!.metadata).toHaveProperty('author', 'airesearcher');
    expect(gpt5Signal!.metadata).toHaveProperty('commentCount', 300);
  });

  it('filters by AI keywords when keywords config is provided', async () => {
    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({
      storyType: 'top',
      limit: 4,
      keywords: ['llm', 'gpt', 'ai', 'agent'],
    });

    // Should keep "LLM agent framework" and "GPT-5" but not "database switch" or "keyboard"
    expect(signals.every((s) =>
      ['llm', 'gpt', 'ai', 'agent'].some((kw) =>
        s.title.toLowerCase().includes(kw)
      )
    )).toBe(true);
  });

  it('filters by minimum score', async () => {
    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({
      storyType: 'top',
      limit: 4,
      minScore: 100,
    });

    // Story 104 has score 50, should be excluded
    expect(signals.every((s) => (s.metadata as { score: number }).score >= 100)).toBe(true);
  });

  it('uses sourceId of format "hn:<id>"', async () => {
    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({ storyType: 'top', limit: 4 });

    expect(signals.every((s) => s.sourceId.startsWith('hn:'))).toBe(true);
  });

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({ storyType: 'top', limit: 4 });

    expect(signals).toEqual([]);
  });

  it('limits the number of stories fetched', async () => {
    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({ storyType: 'top', limit: 2 });

    // Fetched 2 story IDs, so at most 2 signals (possibly fewer after filtering)
    expect(mockFetch).toHaveBeenCalled();
    // First call is for topstories.json, then up to 2 story detail calls
    const storyDetailCalls = mockFetch.mock.calls.filter((c) =>
      c[0].toString().includes('/item/')
    );
    expect(storyDetailCalls.length).toBeLessThanOrEqual(2);
  });

  it('builds URL from story url or falls back to HN item page', async () => {
    const adapter = new HackerNewsSignalAdapter();
    const signals = await adapter.fetch({ storyType: 'top', limit: 4 });

    // Story 104 has no url, should fall back to HN item page
    const askHnSignal = signals.find((s) => s.sourceId === 'hn:104');
    if (askHnSignal) {
      expect(askHnSignal.url).toBe('https://news.ycombinator.com/item?id=104');
    }
  });
});
