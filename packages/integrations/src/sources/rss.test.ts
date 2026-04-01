import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RSSSignalAdapter } from './rss';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const RSS_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI News Feed</title>
    <link>https://example.com</link>
    <item>
      <title>New GPT-5 Release Announced</title>
      <link>https://example.com/gpt5</link>
      <description>OpenAI announces GPT-5 with major improvements in reasoning.</description>
      <pubDate>Tue, 01 Apr 2026 08:00:00 GMT</pubDate>
      <guid>https://example.com/gpt5</guid>
    </item>
    <item>
      <title>Cooking Recipe: Best Pasta</title>
      <link>https://example.com/pasta</link>
      <description>A delicious pasta recipe for weeknight dinners.</description>
      <pubDate>Mon, 31 Mar 2026 12:00:00 GMT</pubDate>
      <guid>https://example.com/pasta</guid>
    </item>
    <item>
      <title>LLM Agents Now Handle Complex Tasks</title>
      <link>https://example.com/agents</link>
      <description>New research shows LLM-based agents can handle multi-step reasoning.</description>
      <pubDate>Tue, 01 Apr 2026 06:00:00 GMT</pubDate>
      <guid>https://example.com/agents</guid>
    </item>
  </channel>
</rss>`;

const ATOM_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>AI Research Blog</title>
  <entry>
    <title>Transformer Architecture Improvements</title>
    <link href="https://research.example.com/transformers"/>
    <summary>New attention mechanisms reduce compute by 40%.</summary>
    <published>2026-04-01T10:00:00Z</published>
    <id>urn:uuid:transformer-001</id>
  </entry>
</feed>`;

describe('RSSSignalAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has source type "rss"', () => {
    const adapter = new RSSSignalAdapter();
    expect(adapter.source).toBe('rss');
  });

  it('fetches and parses RSS 2.0 feed items into Signal[]', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(RSS_FEED_XML),
    });

    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({
      feedUrls: ['https://example.com/feed.xml'],
    });

    expect(signals.length).toBe(3);
    expect(signals[0].sourceType).toBe('rss');
    expect(signals[0].title).toBe('New GPT-5 Release Announced');
    expect(signals[0].url).toBe('https://example.com/gpt5');
    expect(signals[0].summary).toContain('OpenAI announces GPT-5');
    expect(signals[0].sourceId).toBe('https://example.com/gpt5');
    expect(signals[0].fetchedAt).toBeInstanceOf(Date);
  });

  it('filters items by AI keywords when keywords config is provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(RSS_FEED_XML),
    });

    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({
      feedUrls: ['https://example.com/feed.xml'],
      keywords: ['gpt', 'llm', 'agent', 'transformer', 'ai'],
    });

    // "Cooking Recipe: Best Pasta" should be filtered out
    expect(signals.length).toBe(2);
    expect(signals.every((s) => s.title !== 'Cooking Recipe: Best Pasta')).toBe(true);
  });

  it('parses Atom feeds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(ATOM_FEED_XML),
    });

    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({
      feedUrls: ['https://research.example.com/atom.xml'],
    });

    expect(signals.length).toBe(1);
    expect(signals[0].title).toBe('Transformer Architecture Improvements');
    expect(signals[0].url).toBe('https://research.example.com/transformers');
    expect(signals[0].summary).toContain('attention mechanisms');
  });

  it('aggregates signals from multiple feed URLs', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(RSS_FEED_XML),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(ATOM_FEED_XML),
      });

    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({
      feedUrls: [
        'https://example.com/feed.xml',
        'https://research.example.com/atom.xml',
      ],
    });

    expect(signals.length).toBe(4); // 3 RSS + 1 Atom
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips failed feeds and continues with others', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(ATOM_FEED_XML),
      });

    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({
      feedUrls: [
        'https://broken.example.com/feed.xml',
        'https://research.example.com/atom.xml',
      ],
    });

    expect(signals.length).toBe(1);
    expect(signals[0].title).toBe('Transformer Architecture Improvements');
  });

  it('returns empty array when no feedUrls provided', async () => {
    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({});

    expect(signals).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('respects maxAge to filter old items', async () => {
    // Create RSS with items that have pubDate far in the past
    const oldItemXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>Old Article</title>
      <link>https://example.com/old</link>
      <description>Very old article</description>
      <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      <guid>https://example.com/old</guid>
    </item>
    <item>
      <title>Recent Article</title>
      <link>https://example.com/recent</link>
      <description>Very recent article</description>
      <pubDate>${new Date().toUTCString()}</pubDate>
      <guid>https://example.com/recent</guid>
    </item>
  </channel>
</rss>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(oldItemXml),
    });

    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({
      feedUrls: ['https://example.com/feed.xml'],
      maxAge: 24, // only items from last 24 hours
    });

    expect(signals.length).toBe(1);
    expect(signals[0].title).toBe('Recent Article');
  });

  it('stores feed source URL in metadata', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(RSS_FEED_XML),
    });

    const adapter = new RSSSignalAdapter();
    const signals = await adapter.fetch({
      feedUrls: ['https://example.com/feed.xml'],
    });

    expect(signals[0].metadata).toHaveProperty('feedUrl', 'https://example.com/feed.xml');
  });
});
