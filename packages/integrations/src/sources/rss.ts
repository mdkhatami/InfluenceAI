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
