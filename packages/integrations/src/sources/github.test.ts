import { describe, it, expect, vi } from 'vitest';
import { GitHubSignalAdapter } from './github';

vi.mock('../github/client', () => ({
  fetchTrendingRepos: vi.fn().mockResolvedValue([
    {
      name: 'ai-tool',
      fullName: 'org/ai-tool',
      description: 'An AI tool for developers',
      url: 'https://github.com/org/ai-tool',
      language: 'Python',
      stars: 2000,
      starsToday: 150,
      forks: 100,
    },
    {
      name: 'web-framework',
      fullName: 'org/web-framework',
      description: 'A web framework',
      url: 'https://github.com/org/web-framework',
      language: 'JavaScript',
      stars: 500,
      starsToday: 20,
      forks: 50,
    },
  ]),
  scoreRepos: vi.fn().mockImplementation((repos) => repos),
}));

describe('GitHubSignalAdapter', () => {
  const adapter = new GitHubSignalAdapter();

  it('has source type "github"', () => {
    expect(adapter.source).toBe('github');
  });

  it('returns Signal[] from fetch', async () => {
    const signals = await adapter.fetch();

    expect(signals.length).toBe(2);
    expect(signals[0].sourceType).toBe('github');
    expect(signals[0].sourceId).toBe('org/ai-tool');
    expect(signals[0].title).toBe('org/ai-tool: An AI tool for developers');
    expect(signals[0].url).toBe('https://github.com/org/ai-tool');
    expect(signals[0].metadata).toHaveProperty('stars', 2000);
  });

  it('sets fetchedAt to a recent date', async () => {
    const signals = await adapter.fetch();
    const now = Date.now();
    const fetchedAt = signals[0].fetchedAt.getTime();
    expect(now - fetchedAt).toBeLessThan(5000);
  });
});
