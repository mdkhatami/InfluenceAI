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
