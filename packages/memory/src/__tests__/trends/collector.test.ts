import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchGitHubMetrics,
  fetchNpmDownloads,
  fetchPyPIDownloads,
  fetchHNMentions,
  collectTrendData,
} from '../../trends/collector';

// Helper to create a mock Response
function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Not Found',
    json: async () => body,
  } as Response;
}

describe('fetchGitHubMetrics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns stars, forks, and openIssues from GitHub API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          stargazers_count: 1500,
          forks_count: 200,
          open_issues_count: 42,
        }),
      ),
    );

    const result = await fetchGitHubMetrics('owner/repo');

    expect(result).toEqual({
      stars: 1500,
      forks: 200,
      openIssues: 42,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/owner/repo',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({}, false, 404)),
    );

    await expect(fetchGitHubMetrics('owner/repo')).rejects.toThrow(
      'GitHub API error 404',
    );
  });
});

describe('fetchNpmDownloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns weekly downloads from npm API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          downloads: 95000,
          package: 'some-package',
          start: '2026-04-05',
          end: '2026-04-11',
        }),
      ),
    );

    const result = await fetchNpmDownloads('some-package');

    expect(result).toEqual({ weeklyDownloads: 95000 });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.npmjs.org/downloads/point/last-week/some-package',
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({}, false, 404)),
    );

    await expect(fetchNpmDownloads('bad-package')).rejects.toThrow(
      'npm API error 404',
    );
  });
});

describe('fetchPyPIDownloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns weekly downloads from PyPI stats API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          data: {
            last_day: 5000,
            last_week: 35000,
            last_month: 150000,
          },
          package: 'some-lib',
          type: 'recent_downloads',
        }),
      ),
    );

    const result = await fetchPyPIDownloads('some-lib');

    expect(result).toEqual({ weeklyDownloads: 35000 });
    expect(fetch).toHaveBeenCalledWith(
      'https://pypistats.org/api/packages/some-lib/recent',
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse({}, false, 500)),
    );

    await expect(fetchPyPIDownloads('bad-lib')).rejects.toThrow(
      'PyPI API error 500',
    );
  });
});

describe('fetchHNMentions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns count and avgScore from HN Algolia API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          nbHits: 12,
          hits: [
            { points: 100 },
            { points: 200 },
            { points: 300 },
          ],
        }),
      ),
    );

    const result = await fetchHNMentions('LangChain');

    expect(result).toEqual({ count: 12, avgScore: 200 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('hn.algolia.com/api/v1/search'),
    );
  });

  it('returns avgScore 0 on empty results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockResponse({
          nbHits: 0,
          hits: [],
        }),
      ),
    );

    const result = await fetchHNMentions('ObscureTech');

    expect(result).toEqual({ count: 0, avgScore: 0 });
  });
});

// --- collectTrendData tests ---

function createMockDb(options: {
  entities?: any[];
  entityError?: any;
  contentCount?: number;
  upsertError?: any;
}) {
  const {
    entities = [],
    entityError = null,
    contentCount = 5,
    upsertError = null,
  } = options;

  // Build chainable mock for each table
  const mockChain = (table: string) => {
    if (table === 'trend_entities') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: entityError ? null : entities,
            error: entityError,
          }),
        }),
      };
    }
    if (table === 'content_memory') {
      return {
        select: vi.fn().mockReturnValue({
          contains: vi
            .fn()
            .mockResolvedValue({ count: contentCount, data: [], error: null }),
        }),
      };
    }
    if (table === 'trend_data_points') {
      return {
        upsert: vi.fn().mockResolvedValue({ error: upsertError }),
      };
    }
    return {};
  };

  return {
    from: vi.fn((table: string) => mockChain(table)),
  };
}

describe('collectTrendData', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty result when no active entities', async () => {
    const db = createMockDb({ entities: [] });

    const result = await collectTrendData(db);

    expect(result).toEqual({ entitiesUpdated: 0, errors: [] });
  });

  it('processes entities and upserts data points', async () => {
    // Mock all fetch calls to succeed
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return Promise.resolve(
            mockResponse({
              stargazers_count: 500,
              forks_count: 50,
              open_issues_count: 10,
            }),
          );
        }
        if (url.includes('npmjs.org')) {
          return Promise.resolve(mockResponse({ downloads: 20000 }));
        }
        if (url.includes('pypistats.org')) {
          return Promise.resolve(
            mockResponse({ data: { last_week: 15000 } }),
          );
        }
        if (url.includes('hn.algolia.com')) {
          return Promise.resolve(
            mockResponse({ nbHits: 3, hits: [{ points: 50 }] }),
          );
        }
        return Promise.resolve(mockResponse({}, false, 404));
      }),
    );

    const entities = [
      {
        id: 'entity-1',
        name: 'TestFramework',
        github_repo: 'test/framework',
        npm_package: 'test-framework',
        pypi_package: 'test-framework',
        is_active: true,
      },
    ];
    const db = createMockDb({ entities });

    const result = await collectTrendData(db);

    expect(result.entitiesUpdated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify upsert was called
    expect(db.from).toHaveBeenCalledWith('trend_data_points');
  });

  it('handles per-source errors gracefully', async () => {
    // GitHub fails, npm succeeds, HN succeeds
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return Promise.resolve(mockResponse({}, false, 403));
        }
        if (url.includes('npmjs.org')) {
          return Promise.resolve(mockResponse({ downloads: 20000 }));
        }
        if (url.includes('hn.algolia.com')) {
          return Promise.resolve(
            mockResponse({ nbHits: 2, hits: [{ points: 30 }] }),
          );
        }
        return Promise.resolve(mockResponse({}, false, 404));
      }),
    );

    const entities = [
      {
        id: 'entity-1',
        name: 'PartialEntity',
        github_repo: 'test/repo',
        npm_package: 'test-pkg',
        pypi_package: null,
        is_active: true,
      },
    ];
    const db = createMockDb({ entities });

    const result = await collectTrendData(db);

    // Entity should still be updated despite GitHub failure
    expect(result.entitiesUpdated).toBe(1);
    // Should have one error from GitHub
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain('PartialEntity/github');
  });

  it('handles per-entity errors gracefully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('hn.algolia.com')) {
          return Promise.resolve(
            mockResponse({ nbHits: 0, hits: [] }),
          );
        }
        return Promise.resolve(mockResponse({}, false, 500));
      }),
    );

    const entities = [
      {
        id: 'entity-1',
        name: 'GoodEntity',
        github_repo: null,
        npm_package: null,
        pypi_package: null,
        is_active: true,
      },
      {
        id: 'entity-2',
        name: 'BadEntity',
        github_repo: null,
        npm_package: null,
        pypi_package: null,
        is_active: true,
      },
    ];

    // Create a db where the second entity's content_memory query throws
    let contentQueryCount = 0;
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'trend_entities') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: entities,
                error: null,
              }),
            }),
          };
        }
        if (table === 'content_memory') {
          contentQueryCount++;
          if (contentQueryCount === 2) {
            return {
              select: vi.fn().mockReturnValue({
                contains: vi.fn().mockRejectedValue(new Error('DB timeout')),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              contains: vi
                .fn()
                .mockResolvedValue({ count: 3, data: [], error: null }),
            }),
          };
        }
        if (table === 'trend_data_points') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      }),
    };

    const result = await collectTrendData(db);

    // First entity should succeed, second should fail
    expect(result.entitiesUpdated).toBe(1);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e: string) => e.includes('BadEntity'))).toBe(
      true,
    );
  });

  it('throws when entity fetch fails', async () => {
    const db = createMockDb({
      entityError: { message: 'connection refused' },
    });

    await expect(collectTrendData(db)).rejects.toThrow(
      'Failed to fetch entities: connection refused',
    );
  });
});
