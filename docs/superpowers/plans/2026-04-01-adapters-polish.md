# Signal Source Adapters + Application Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RSS and HackerNews signal adapters to the pipeline engine, wire them into the Signal Amplifier and Release Radar pipeline definitions, and polish the dashboard with error boundaries, loading/empty states, and environment validation.

**Architecture:** Each adapter implements the existing `SignalAdapter` interface from `packages/integrations/src/sources/types.ts`. Pipeline definitions in `packages/pipelines/src/tasks/` compose one or more adapters via their `ingest` function. The shared engine runner (`packages/pipelines/src/engine/runner.ts`) handles execution. Dashboard polish is layered into the existing Next.js App Router layout and pages.

**Tech Stack:** TypeScript, Vitest, pnpm monorepo. RSS parsing via `fast-xml-parser` (lightweight, zero-dep XML parser). HackerNews via public Firebase HTTP API (no auth required). React error boundaries and Suspense for UI polish.

**Scope:** Plan 4 -- Phases 3 + 6 of the v2 spec. Covers RSS adapter, HackerNews adapter, Signal Amplifier pipeline, Release Radar pipeline, error boundaries, loading/empty states, and environment validation. ArXiv, Reddit, and HuggingFace adapters are deferred to a future plan.

**Predecessor:** `docs/superpowers/plans/2026-03-28-foundation-pipeline-engine.md` (Plan 1, Phases 1-2 -- must be complete)

---

## File Map

### New files

```
packages/integrations/src/sources/rss.ts                    -> RSS SignalAdapter
packages/integrations/src/sources/rss.test.ts               -> RSS adapter tests
packages/integrations/src/sources/hackernews.ts              -> HackerNews SignalAdapter
packages/integrations/src/sources/hackernews.test.ts         -> HackerNews adapter tests
packages/pipelines/src/tasks/signal-amplifier.ts             -> Signal Amplifier pipeline definition
packages/pipelines/src/tasks/release-radar.ts                -> Release Radar pipeline definition
apps/web/src/components/error-boundary.tsx                   -> React error boundary component
apps/web/src/components/dashboard/empty-state.tsx            -> Reusable empty state component
apps/web/src/components/dashboard/page-skeleton.tsx          -> Reusable skeleton loader component
apps/web/src/lib/env.ts                                      -> Environment variable validation
```

### Modified files

```
packages/integrations/package.json                           -> Add fast-xml-parser dependency
packages/integrations/src/index.ts                           -> Export new adapters
packages/pipelines/src/index.ts                              -> Export new pipeline definitions
apps/web/src/app/(dashboard)/layout.tsx                      -> Wrap children in error boundary
apps/web/src/app/(dashboard)/page.tsx                        -> Add Suspense + empty states
apps/web/src/app/(dashboard)/content/page.tsx                -> Add Suspense + empty states
apps/web/src/app/(dashboard)/pipelines/page.tsx              -> Add Suspense + empty states
apps/web/src/app/(dashboard)/review/page.tsx                 -> Add Suspense + empty states
apps/web/src/app/(dashboard)/analytics/page.tsx              -> Add Suspense + empty states
apps/web/src/app/(dashboard)/schedule/page.tsx               -> Add Suspense + empty states
apps/web/src/app/(dashboard)/settings/page.tsx               -> Add Suspense + empty states
apps/web/src/app/(dashboard)/pipelines/github-trends/page.tsx -> Add Suspense + empty states
apps/web/src/middleware.ts                                   -> Import env validation
```

---

## Task 1: RSS Signal Adapter

**Files:**
- Create: `packages/integrations/src/sources/rss.ts`
- Create: `packages/integrations/src/sources/rss.test.ts`
- Modify: `packages/integrations/package.json`
- Modify: `packages/integrations/src/index.ts`

### Context

The RSS adapter fetches items from configurable feed URLs, parses XML with `fast-xml-parser`, and converts them to `Signal[]`. It is used by the Signal Amplifier and Release Radar pipelines. The adapter config accepts a `feedUrls` array and an optional `keywords` array for filtering.

### Steps

- [ ] **Step 1: Install fast-xml-parser**

```bash
pnpm -F @influenceai/integrations add fast-xml-parser
```

This adds the dependency to `packages/integrations/package.json`. `fast-xml-parser` is a lightweight (~40KB), zero-dependency XML parser that handles RSS 2.0 and Atom feeds.

- [ ] **Step 2: Write failing tests for RSS adapter**

Create `packages/integrations/src/sources/rss.test.ts`:

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test -- packages/integrations/src/sources/rss.test.ts
```

Expected: FAIL -- module `./rss` not found.

- [ ] **Step 4: Implement RSS adapter**

Create `packages/integrations/src/sources/rss.ts`:

```typescript
import { XMLParser } from 'fast-xml-parser';
import type { Signal } from '@influenceai/core';
import type { SignalAdapter, AdapterConfig } from './types';

interface RSSItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { '#text': string };
  'dc:date'?: string;
}

interface AtomEntry {
  title?: string;
  link?: string | { '@_href': string } | Array<{ '@_href': string }>;
  summary?: string;
  content?: string;
  published?: string;
  updated?: string;
  id?: string;
}

interface ParsedRSS {
  rss?: {
    channel?: {
      item?: RSSItem | RSSItem[];
    };
  };
  feed?: {
    entry?: AtomEntry | AtomEntry[];
  };
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function extractGuid(item: RSSItem): string {
  if (typeof item.guid === 'string') return item.guid;
  if (item.guid && typeof item.guid === 'object' && '#text' in item.guid) {
    return item.guid['#text'];
  }
  return item.link ?? item.title ?? '';
}

function extractAtomLink(entry: AtomEntry): string {
  if (typeof entry.link === 'string') return entry.link;
  if (Array.isArray(entry.link)) return entry.link[0]?.['@_href'] ?? '';
  if (entry.link && typeof entry.link === 'object') return entry.link['@_href'] ?? '';
  return '';
}

function normalizeRSSItems(parsed: ParsedRSS, feedUrl: string): Array<{ title: string; url: string; summary: string; id: string; pubDate: string | undefined; feedUrl: string }> {
  const results: Array<{ title: string; url: string; summary: string; id: string; pubDate: string | undefined; feedUrl: string }> = [];

  // RSS 2.0 format
  if (parsed.rss?.channel?.item) {
    const items = Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item];

    for (const item of items) {
      results.push({
        title: item.title ?? '(untitled)',
        url: item.link ?? '',
        summary: item.description ?? '',
        id: extractGuid(item),
        pubDate: item.pubDate ?? item['dc:date'],
        feedUrl,
      });
    }
  }

  // Atom format
  if (parsed.feed?.entry) {
    const entries = Array.isArray(parsed.feed.entry)
      ? parsed.feed.entry
      : [parsed.feed.entry];

    for (const entry of entries) {
      results.push({
        title: entry.title ?? '(untitled)',
        url: extractAtomLink(entry),
        summary: entry.summary ?? entry.content ?? '',
        id: entry.id ?? extractAtomLink(entry),
        pubDate: entry.published ?? entry.updated,
        feedUrl,
      });
    }
  }

  return results;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export class RSSSignalAdapter implements SignalAdapter {
  source = 'rss' as const;

  async fetch(config?: AdapterConfig): Promise<Signal[]> {
    const feedUrls = (config?.feedUrls as string[]) ?? [];
    const keywords = (config?.keywords as string[]) ?? [];
    const maxAgeHours = config?.maxAge;

    if (feedUrls.length === 0) return [];

    const allSignals: Signal[] = [];
    const cutoff = maxAgeHours
      ? new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)
      : null;

    for (const feedUrl of feedUrls) {
      try {
        const response = await fetch(feedUrl, {
          headers: { 'User-Agent': 'InfluenceAI-Bot/1.0' },
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          console.warn(`RSS fetch failed for ${feedUrl}: ${response.status}`);
          continue;
        }

        const xml = await response.text();
        const parsed = parser.parse(xml) as ParsedRSS;
        const items = normalizeRSSItems(parsed, feedUrl);

        for (const item of items) {
          // Filter by maxAge if configured
          if (cutoff && item.pubDate) {
            const itemDate = new Date(item.pubDate);
            if (!isNaN(itemDate.getTime()) && itemDate < cutoff) {
              continue;
            }
          }

          // Filter by keywords if configured
          if (keywords.length > 0) {
            const searchText = `${item.title} ${item.summary}`;
            if (!matchesKeywords(searchText, keywords)) {
              continue;
            }
          }

          // Strip HTML tags from summary
          const cleanSummary = item.summary.replace(/<[^>]*>/g, '').trim();

          allSignals.push({
            sourceType: 'rss',
            sourceId: item.id || item.url,
            title: item.title,
            summary: cleanSummary.slice(0, 500),
            url: item.url,
            metadata: {
              feedUrl: item.feedUrl,
              pubDate: item.pubDate,
            },
            fetchedAt: new Date(),
          });
        }
      } catch (err) {
        console.warn(`RSS adapter error for ${feedUrl}:`, err);
        continue;
      }
    }

    return allSignals;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- packages/integrations/src/sources/rss.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 6: Export from integrations**

Add to `packages/integrations/src/index.ts` after the existing `GitHubSignalAdapter` export:

```typescript
export { RSSSignalAdapter } from './sources/rss';
```

- [ ] **Step 7: Commit**

```bash
git add packages/integrations/
git commit -m "feat(integrations): add RSS signal adapter with RSS 2.0 and Atom support"
```

---

## Task 2: HackerNews Signal Adapter

**Files:**
- Create: `packages/integrations/src/sources/hackernews.ts`
- Create: `packages/integrations/src/sources/hackernews.test.ts`
- Modify: `packages/integrations/src/index.ts`

### Context

The HackerNews adapter uses the public Firebase API (`https://hacker-news.firebaseio.com/v0/`) to fetch top and new stories. It fetches story IDs, then loads individual story details. It filters by AI-relevant keywords and minimum score. No API key is needed.

### Steps

- [ ] **Step 1: Write failing tests for HackerNews adapter**

Create `packages/integrations/src/sources/hackernews.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test -- packages/integrations/src/sources/hackernews.test.ts
```

Expected: FAIL -- module `./hackernews` not found.

- [ ] **Step 3: Implement HackerNews adapter**

Create `packages/integrations/src/sources/hackernews.ts`:

```typescript
import type { Signal } from '@influenceai/core';
import type { SignalAdapter, AdapterConfig } from './types';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

interface HNStory {
  id: number;
  title: string;
  url?: string;
  text?: string;
  score: number;
  by: string;
  time: number; // unix timestamp
  descendants?: number; // comment count
  type: string;
}

type StoryType = 'top' | 'new' | 'best';

async function fetchStoryIds(storyType: StoryType): Promise<number[]> {
  const response = await fetch(`${HN_API_BASE}/${storyType}stories.json`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`HN API returned ${response.status}`);
  return response.json() as Promise<number[]>;
}

async function fetchStory(id: number): Promise<HNStory | null> {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${id}.json`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return response.json() as Promise<HNStory | null>;
  } catch {
    return null;
  }
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export class HackerNewsSignalAdapter implements SignalAdapter {
  source = 'hackernews' as const;

  async fetch(config?: AdapterConfig): Promise<Signal[]> {
    const storyType = (config?.storyType as StoryType) ?? 'top';
    const limit = (config?.limit as number) ?? 30;
    const keywords = (config?.keywords as string[]) ?? [];
    const minScore = (config?.minScore as number) ?? 0;
    const maxAgeHours = config?.maxAge;

    try {
      const storyIds = await fetchStoryIds(storyType);
      const idsToFetch = storyIds.slice(0, limit);

      // Fetch stories in parallel with concurrency limit
      const BATCH_SIZE = 10;
      const stories: HNStory[] = [];

      for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
        const batch = idsToFetch.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(fetchStory));
        for (const story of results) {
          if (story && story.type === 'story') {
            stories.push(story);
          }
        }
      }

      const cutoff = maxAgeHours
        ? Date.now() - maxAgeHours * 60 * 60 * 1000
        : 0;

      const signals: Signal[] = [];

      for (const story of stories) {
        // Filter by minimum score
        if (story.score < minScore) continue;

        // Filter by max age
        if (cutoff > 0 && story.time * 1000 < cutoff) continue;

        // Filter by keywords if provided
        if (keywords.length > 0) {
          const searchText = `${story.title} ${story.text ?? ''}`;
          if (!matchesKeywords(searchText, keywords)) continue;
        }

        const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;

        signals.push({
          sourceType: 'hackernews',
          sourceId: `hn:${story.id}`,
          title: story.title,
          summary: story.text
            ? story.text.replace(/<[^>]*>/g, '').slice(0, 500)
            : '',
          url,
          metadata: {
            score: story.score,
            author: story.by,
            commentCount: story.descendants ?? 0,
            hnUrl: `https://news.ycombinator.com/item?id=${story.id}`,
            storyType,
          },
          fetchedAt: new Date(),
        });
      }

      return signals;
    } catch (err) {
      console.warn('HackerNews adapter error:', err);
      return [];
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- packages/integrations/src/sources/hackernews.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Export from integrations**

Add to `packages/integrations/src/index.ts` after the `RSSSignalAdapter` export:

```typescript
export { HackerNewsSignalAdapter } from './sources/hackernews';
```

The full `packages/integrations/src/index.ts` should now be:

```typescript
export * from './types';
export { LLMClient } from './llm/client';
export type { LLMGenerateParams, LLMGenerateResult } from './llm/client';
export { buildPrompt, type PromptTemplateInput } from './llm/prompts';
export {
  fetchTrendingRepos,
  scoreRepos,
  toSignals,
} from './github/client';
export type { TrendingRepo, GitHubTrendsOptions } from './github/client';
export {
  GITHUB_TRENDS_SYSTEM_PROMPT,
  GITHUB_TRENDS_USER_PROMPT,
  buildGitHubTrendsPrompt,
} from './github/prompts';
export { type SignalAdapter, type AdapterConfig } from './sources/types';
export { GitHubSignalAdapter } from './sources/github';
export { RSSSignalAdapter } from './sources/rss';
export { HackerNewsSignalAdapter } from './sources/hackernews';
```

- [ ] **Step 6: Commit**

```bash
git add packages/integrations/
git commit -m "feat(integrations): add HackerNews signal adapter using Firebase API"
```

---

## Task 3: Signal Amplifier Pipeline Definition

**Files:**
- Create: `packages/pipelines/src/tasks/signal-amplifier.ts`
- Modify: `packages/pipelines/src/index.ts`

### Context

The Signal Amplifier pipeline combines RSS and HackerNews adapters to aggregate AI news signals. It feeds the `breaking-ai-news` pillar and targets LinkedIn and Twitter. The registry entry in `packages/core/src/pipelines/registry.ts` (slug: `signal-amplifier`) already defines this pipeline's UI metadata -- this task creates the executable `PipelineDefinition` with real ingest/filter functions.

### Steps

- [ ] **Step 1: Create the Signal Amplifier pipeline definition**

Create `packages/pipelines/src/tasks/signal-amplifier.ts`:

```typescript
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
```

- [ ] **Step 2: Export from pipelines index**

Add to `packages/pipelines/src/index.ts`:

```typescript
export { signalAmplifierPipeline } from './tasks/signal-amplifier';
```

The full `packages/pipelines/src/index.ts` should now be:

```typescript
export { runPipeline } from './engine/runner';
export { deduplicateSignals } from './engine/dedup';
export { githubTrendsPipeline } from './tasks/github-trends';
export { signalAmplifierPipeline } from './tasks/signal-amplifier';
```

- [ ] **Step 3: Type-check**

```bash
pnpm -F @influenceai/pipelines type-check 2>&1 || true
```

If the package has no type-check script, run:

```bash
cd packages/pipelines && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/pipelines/src/
git commit -m "feat(pipelines): add Signal Amplifier pipeline combining RSS + HackerNews adapters"
```

---

## Task 4: Release Radar Pipeline Definition

**Files:**
- Create: `packages/pipelines/src/tasks/release-radar.ts`
- Modify: `packages/pipelines/src/index.ts`

### Context

The Release Radar pipeline also combines RSS and HackerNews, but is tuned specifically for AI product releases and announcements. It feeds the `breaking-ai-news` pillar and targets LinkedIn, Twitter, and YouTube. It uses a higher score threshold and release-specific keywords to focus on announcements rather than general discussion. The registry entry in `packages/core/src/pipelines/registry.ts` (slug: `release-radar`) already defines the UI metadata.

### Steps

- [ ] **Step 1: Create the Release Radar pipeline definition**

Create `packages/pipelines/src/tasks/release-radar.ts`:

```typescript
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
```

- [ ] **Step 2: Export from pipelines index**

Add to `packages/pipelines/src/index.ts`:

```typescript
export { releaseRadarPipeline } from './tasks/release-radar';
```

The full `packages/pipelines/src/index.ts` should now be:

```typescript
export { runPipeline } from './engine/runner';
export { deduplicateSignals } from './engine/dedup';
export { githubTrendsPipeline } from './tasks/github-trends';
export { signalAmplifierPipeline } from './tasks/signal-amplifier';
export { releaseRadarPipeline } from './tasks/release-radar';
```

- [ ] **Step 3: Type-check**

```bash
cd packages/pipelines && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add packages/pipelines/src/
git commit -m "feat(pipelines): add Release Radar pipeline for AI product release tracking"
```

---

## Task 5: Error Boundaries

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

### Context

The dashboard currently has no error handling at the component level. If any dashboard page throws during render, the entire app crashes. This task adds a reusable React error boundary component and wraps the dashboard layout's children with it.

The error boundary uses `'use client'` because React error boundaries require class components (or the experimental `use` hook pattern). We use a class component since it is the stable approach in React 18/19 and Next.js 15.

### Steps

- [ ] **Step 1: Create error boundary component**

Create `apps/web/src/components/error-boundary.tsx`:

```typescript
'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <Card className="max-w-md border-red-500/20 bg-zinc-900">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="rounded-full bg-red-500/10 p-3">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-50">Something went wrong</h3>
                <p className="mt-1 text-sm text-zinc-400">
                  An unexpected error occurred while rendering this section.
                </p>
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="max-h-32 w-full overflow-auto rounded-lg bg-zinc-950 p-3 text-left text-xs text-red-300">
                  {this.state.error.message}
                </pre>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight page-level error boundary wrapper.
 * Wrap individual page content to isolate failures.
 */
export function PageErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
```

- [ ] **Step 2: Wrap dashboard layout children with error boundary**

In `apps/web/src/app/(dashboard)/layout.tsx`, add the import at the top:

```typescript
import { ErrorBoundary } from '@/components/error-boundary';
```

Then wrap the `{children}` inside the `<main>` tag:

Replace:
```tsx
<main className="p-6">{children}</main>
```

With:
```tsx
<main className="p-6">
  <ErrorBoundary>{children}</ErrorBoundary>
</main>
```

- [ ] **Step 3: Verify the app still renders**

```bash
pnpm -F @influenceai/web build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "feat(web): add React error boundary to dashboard layout"
```

---

## Task 6: Loading and Empty States

**Files:**
- Create: `apps/web/src/components/dashboard/page-skeleton.tsx`
- Create: `apps/web/src/components/dashboard/empty-state.tsx`
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/content/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/pipelines/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/review/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/analytics/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/schedule/page.tsx`

### Context

Dashboard pages currently render mock data synchronously. When real data fetching is wired in (a future plan), pages will need Suspense boundaries with skeleton loaders while data loads, and empty state illustrations when no data exists. This task adds the reusable components and integrates them into each page. The pages remain client components with mock data for now -- the Suspense boundaries are added proactively so they are ready when data fetching is added.

### Steps

- [ ] **Step 1: Create skeleton loader component**

Create `apps/web/src/components/dashboard/page-skeleton.tsx`:

```typescript
'use client';

import { cn } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-zinc-800/50',
        className,
      )}
    />
  );
}

/**
 * Stats row skeleton -- 4 stat cards
 */
export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * Card grid skeleton -- configurable number of cards
 */
export function CardGridSkeleton({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  const colClass =
    columns === 2
      ? 'md:grid-cols-2'
      : columns === 3
        ? 'md:grid-cols-2 xl:grid-cols-3'
        : 'md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={cn('grid grid-cols-1 gap-6', colClass)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-20" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-3/4" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-md" />
            <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Table skeleton -- header + rows
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex gap-4 border-b border-zinc-800 px-6 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-zinc-800/50 px-6 py-4 last:border-0">
          {Array.from({ length: 5 }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Chart skeleton
 */
export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-1 h-3 w-56" />
      <Skeleton className="mt-4 h-[320px] w-full rounded-lg" />
    </div>
  );
}

/**
 * Full page skeleton for Command Center
 */
export function CommandCenterSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <StatsRowSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartSkeleton />
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <CardGridSkeleton count={8} columns={2} />
    </div>
  );
}

/**
 * Full page skeleton for Pipelines
 */
export function PipelinesSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <StatsRowSkeleton />
      <CardGridSkeleton count={8} columns={3} />
    </div>
  );
}

/**
 * Full page skeleton for Content / Review
 */
export function ContentSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}

/**
 * Full page skeleton for Analytics
 */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <StatsRowSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}

/**
 * Full page skeleton for Schedule
 */
export function ScheduleSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800">
        {/* Day headers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h-${i}`} className="bg-zinc-900 p-3">
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
        {/* Day cells */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`c-${i}`} className="min-h-[120px] bg-zinc-900/50 p-2">
            <Skeleton className="h-3 w-6" />
            {i % 3 === 0 && <Skeleton className="mt-2 h-6 w-full rounded" />}
            {i % 5 === 0 && <Skeleton className="mt-1 h-6 w-full rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create empty state component**

Create `apps/web/src/components/dashboard/empty-state.tsx`:

```typescript
'use client';

import { cn } from '@/lib/utils';
import {
  FileText,
  Workflow,
  BarChart3,
  CalendarDays,
  CheckCircle,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 p-8 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-zinc-800/50 p-4">
        <Icon className="h-8 w-8 text-zinc-500" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-configured empty states for each dashboard section

export function EmptyContent() {
  return (
    <EmptyState
      icon={FileText}
      title="No content yet"
      description="Content will appear here once your pipelines generate their first drafts. Run a pipeline to get started."
    />
  );
}

export function EmptyPipelines() {
  return (
    <EmptyState
      icon={Workflow}
      title="No pipeline runs"
      description="Your pipelines are configured but have not run yet. Trigger a pipeline manually or wait for the next scheduled run."
    />
  );
}

export function EmptyReviewQueue() {
  return (
    <EmptyState
      icon={CheckCircle}
      title="Review queue is empty"
      description="No content is waiting for review. All caught up!"
    />
  );
}

export function EmptyAnalytics() {
  return (
    <EmptyState
      icon={BarChart3}
      title="No analytics data"
      description="Analytics will appear here once content has been published and engagement data is collected."
    />
  );
}

export function EmptySchedule() {
  return (
    <EmptyState
      icon={CalendarDays}
      title="Nothing scheduled"
      description="No content is scheduled for publishing this week. Approve content from the review queue to schedule it."
    />
  );
}
```

- [ ] **Step 3: Add Suspense to Command Center page**

In `apps/web/src/app/(dashboard)/page.tsx`, add the Suspense import at the top of the file:

```typescript
import { Suspense } from 'react';
```

And import the skeleton:

```typescript
import { CommandCenterSkeleton } from '@/components/dashboard/page-skeleton';
```

Then wrap the return value of `CommandCenterPage` in Suspense. Replace the function signature and first line:

```typescript
export default function CommandCenterPage() {
  return (
    <Suspense fallback={<CommandCenterSkeleton />}>
      <CommandCenterContent />
    </Suspense>
  );
}

function CommandCenterContent() {
  return (
    <div className="space-y-6 p-6">
```

And close the extra function at the very end of the component. The existing closing `}` at the end of the component body closes `CommandCenterContent`, and the new wrapper `CommandCenterPage` provides the Suspense boundary.

- [ ] **Step 4: Add Suspense to Pipelines page**

In `apps/web/src/app/(dashboard)/pipelines/page.tsx`, apply the same pattern:

Add imports:

```typescript
import { Suspense } from 'react';
import { PipelinesSkeleton } from '@/components/dashboard/page-skeleton';
```

Wrap the content:

```typescript
export default function PipelinesPage() {
  return (
    <Suspense fallback={<PipelinesSkeleton />}>
      <PipelinesContent />
    </Suspense>
  );
}

function PipelinesContent() {
  // ... existing return JSX
```

- [ ] **Step 5: Add Suspense to Content page**

In `apps/web/src/app/(dashboard)/content/page.tsx`, add:

```typescript
import { Suspense } from 'react';
import { ContentSkeleton } from '@/components/dashboard/page-skeleton';
```

And wrap accordingly using `ContentSkeleton` as the fallback.

- [ ] **Step 6: Add Suspense to Review page**

In `apps/web/src/app/(dashboard)/review/page.tsx`, add:

```typescript
import { Suspense } from 'react';
import { ContentSkeleton } from '@/components/dashboard/page-skeleton';
```

And wrap accordingly using `ContentSkeleton` as the fallback.

- [ ] **Step 7: Add Suspense to Analytics page**

In `apps/web/src/app/(dashboard)/analytics/page.tsx`, add:

```typescript
import { Suspense } from 'react';
import { AnalyticsSkeleton } from '@/components/dashboard/page-skeleton';
```

And wrap accordingly using `AnalyticsSkeleton` as the fallback.

- [ ] **Step 8: Add Suspense to Schedule page**

In `apps/web/src/app/(dashboard)/schedule/page.tsx`, add:

```typescript
import { Suspense } from 'react';
import { ScheduleSkeleton } from '@/components/dashboard/page-skeleton';
```

And wrap accordingly using `ScheduleSkeleton` as the fallback.

- [ ] **Step 9: Verify the app builds**

```bash
pnpm -F @influenceai/web build
```

Expected: build succeeds with no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/dashboard/page-skeleton.tsx apps/web/src/components/dashboard/empty-state.tsx apps/web/src/app/\(dashboard\)/
git commit -m "feat(web): add skeleton loaders, empty states, and Suspense boundaries to dashboard pages"
```

---

## Task 7: Environment Validation

**Files:**
- Create: `apps/web/src/lib/env.ts`
- Modify: `apps/web/src/middleware.ts`

### Context

The app currently fails silently or with cryptic errors when required environment variables are missing. This task adds a validation module that checks for required env vars at startup and surfaces clear, actionable error messages. The validation runs in middleware (which executes on every request) and logs warnings on first load.

The validation is intentionally lenient -- it warns rather than crashing -- because the app is designed to work in a degraded mode without some services (e.g., no LLM means pipelines cannot run, but the dashboard still works).

### Steps

- [ ] **Step 1: Create environment validation module**

Create `apps/web/src/lib/env.ts`:

```typescript
type EnvRequirement = {
  key: string;
  required: boolean;
  description: string;
  category: 'supabase' | 'llm' | 'auth' | 'integrations' | 'trigger';
};

const ENV_REQUIREMENTS: EnvRequirement[] = [
  // Supabase -- required for core functionality
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL (e.g., https://xxx.supabase.co)',
    category: 'supabase',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    required: false, // falls back to ANON_KEY
    description: 'Supabase publishable key (or set NEXT_PUBLIC_SUPABASE_ANON_KEY)',
    category: 'supabase',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false, // only needed for server-side pipeline execution
    description: 'Supabase service role key (needed for pipeline execution)',
    category: 'supabase',
  },

  // LLM -- needed for content generation
  {
    key: 'LLM_BASE_URL',
    required: false,
    description: 'LLM API base URL (e.g., https://api.openai.com/v1)',
    category: 'llm',
  },
  {
    key: 'LLM_API_KEY',
    required: false,
    description: 'LLM API key',
    category: 'llm',
  },
  {
    key: 'LLM_MODEL',
    required: false,
    description: 'LLM model name (e.g., gpt-4o)',
    category: 'llm',
  },

  // Auth
  {
    key: 'ALLOWED_EMAILS',
    required: false,
    description: 'Comma-separated email whitelist for auth',
    category: 'auth',
  },

  // Integrations
  {
    key: 'GITHUB_TOKEN',
    required: false,
    description: 'GitHub token (increases rate limit from 60 to 5000/hr)',
    category: 'integrations',
  },

  // Trigger.dev
  {
    key: 'TRIGGER_SECRET_KEY',
    required: false,
    description: 'Trigger.dev secret key for scheduled pipeline execution',
    category: 'trigger',
  },
  {
    key: 'TRIGGER_PROJECT_ID',
    required: false,
    description: 'Trigger.dev project ID',
    category: 'trigger',
  },
];

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

let cachedResult: EnvValidationResult | null = null;

/**
 * Validates environment variables and returns a result with errors and warnings.
 * Results are cached after the first call.
 */
export function validateEnv(): EnvValidationResult {
  if (cachedResult) return cachedResult;

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const req of ENV_REQUIREMENTS) {
    const value = process.env[req.key];
    const isSet = value !== undefined && value !== '';

    if (req.required && !isSet) {
      errors.push(`Missing required env var: ${req.key} -- ${req.description}`);
    } else if (!req.required && !isSet) {
      warnings.push(`Optional env var not set: ${req.key} -- ${req.description}`);
    }
  }

  // Special case: check that at least one Supabase key is set
  const hasPublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== '';
  const hasAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== '';

  if (!hasPublishableKey && !hasAnonKey) {
    warnings.push(
      'Neither NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY nor NEXT_PUBLIC_SUPABASE_ANON_KEY is set. Auth will be disabled (dev mode).',
    );
  }

  // Special case: LLM vars should all be set together
  const llmVars = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'];
  const llmSet = llmVars.filter((k) => process.env[k] && process.env[k] !== '');
  if (llmSet.length > 0 && llmSet.length < 3) {
    warnings.push(
      `Partial LLM configuration: ${llmSet.join(', ')} set but ${llmVars.filter((k) => !llmSet.includes(k)).join(', ')} missing. Pipelines may fail.`,
    );
  }

  // Special case: Trigger.dev vars should be set together
  const triggerVars = ['TRIGGER_SECRET_KEY', 'TRIGGER_PROJECT_ID'];
  const triggerSet = triggerVars.filter((k) => process.env[k] && process.env[k] !== '');
  if (triggerSet.length === 1) {
    warnings.push(
      `Partial Trigger.dev configuration: ${triggerSet.join(', ')} set but ${triggerVars.filter((k) => !triggerSet.includes(k)).join(', ')} missing. Scheduled pipelines will not run.`,
    );
  }

  cachedResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  };

  return cachedResult;
}

/**
 * Log env validation results once at startup.
 * Call from middleware or instrumentation.
 */
let hasLogged = false;

export function logEnvValidation(): void {
  if (hasLogged) return;
  hasLogged = true;

  const result = validateEnv();

  if (result.errors.length > 0) {
    console.error('\n========== ENVIRONMENT ERRORS ==========');
    for (const err of result.errors) {
      console.error(`  [ERROR] ${err}`);
    }
    console.error('=========================================\n');
  }

  if (result.warnings.length > 0) {
    console.warn('\n========== ENVIRONMENT WARNINGS ==========');
    for (const warn of result.warnings) {
      console.warn(`  [WARN] ${warn}`);
    }
    console.warn('==========================================\n');
  }

  if (result.valid && result.warnings.length === 0) {
    console.log('[env] All environment variables configured correctly.');
  }
}
```

- [ ] **Step 2: Call env validation from middleware**

In `apps/web/src/middleware.ts`, add the import at the top of the file (after the existing imports):

```typescript
import { logEnvValidation } from '@/lib/env';
```

And add the validation call as the first line inside the `middleware` function body:

```typescript
export async function middleware(request: NextRequest) {
  logEnvValidation();
  // ... rest of existing middleware code
```

This runs once on the first request (the result is cached). It does not block the request or change any behavior -- it only logs warnings/errors to the server console.

- [ ] **Step 3: Verify the app builds and starts**

```bash
pnpm -F @influenceai/web build
```

Expected: build succeeds. On `pnpm dev`, the console shows environment validation output.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/env.ts apps/web/src/middleware.ts
git commit -m "feat(web): add environment variable validation with startup warnings"
```

---

## Future Work

The following adapters are lower priority and can be implemented in a future plan when their respective pipelines are ready for execution:

- **ArXiv Signal Adapter** -- Use the ArXiv API (`http://export.arxiv.org/api/query`) to search for recent AI/ML papers. Used by the `youtube-series` pipeline.
- **Reddit Signal Adapter** -- Use the Reddit JSON API (`https://www.reddit.com/r/{subreddit}/.json`) to monitor AI subreddits (r/MachineLearning, r/LocalLLaMA, r/artificial). Useful for community sentiment signals.
- **HuggingFace Signal Adapter** -- Use the HuggingFace Hub API (`https://huggingface.co/api/`) to track trending models and datasets. Useful for the `live-demos` and `inside-the-machine` pipelines.

Each would follow the same pattern established here: implement `SignalAdapter`, write tests first, export from `@influenceai/integrations`, create pipeline definition in `@influenceai/pipelines`.

---

## Summary

After completing all 7 tasks, you will have:

1. **RSS Signal Adapter** -- Fetches and parses RSS 2.0 and Atom feeds, filters by keywords and age, handles multiple feed URLs with graceful error recovery. 8 tests.
2. **HackerNews Signal Adapter** -- Fetches top/new stories via Firebase API, filters by AI keywords and minimum score, batched parallel fetching with concurrency control. 8 tests.
3. **Signal Amplifier Pipeline** -- Combines RSS + HN adapters with AI keyword filtering, engagement-based scoring, runs every 3 hours, targets LinkedIn + Twitter.
4. **Release Radar Pipeline** -- Combines RSS + HN tuned for product releases, version detection, higher thresholds, runs every 6 hours, targets LinkedIn + Twitter.
5. **Error Boundaries** -- React error boundary wrapping dashboard layout with styled fallback UI, dev-mode error details, retry button.
6. **Loading & Empty States** -- Skeleton loaders for every dashboard page type (stats, cards, tables, charts, calendar), reusable empty state components with pre-configured variants per section.
7. **Environment Validation** -- Startup validation of all env vars with categorized warnings, special-case checks for partial configurations, cached single-run execution from middleware.
