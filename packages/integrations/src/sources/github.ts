import type { Signal } from '@influenceai/core';
import type { SignalAdapter, AdapterConfig } from './types';
import { fetchTrendingRepos, scoreRepos, type GitHubTrendsOptions } from '../github/client';

export class GitHubSignalAdapter implements SignalAdapter {
  source = 'github' as const;

  async fetch(config?: AdapterConfig): Promise<Signal[]> {
    const options: GitHubTrendsOptions = {
      language: (config?.language as string) ?? '',
      since: (config?.since as 'daily' | 'weekly' | 'monthly') ?? 'daily',
    };

    const repos = await fetchTrendingRepos(options);
    const scored = scoreRepos(repos);

    return scored.map((repo) => ({
      sourceType: 'github' as const,
      sourceId: repo.fullName,
      title: `${repo.fullName}: ${repo.description ?? 'No description'}`,
      summary: repo.description ?? '',
      url: repo.url,
      metadata: {
        stars: repo.stars,
        starsToday: repo.starsToday,
        language: repo.language,
        forks: repo.forks,
      },
      fetchedAt: new Date(),
    }));
  }
}
