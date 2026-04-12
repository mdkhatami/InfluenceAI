import type { CollectResult } from '../types';

// --- Data Source Fetchers ---

export async function fetchGitHubMetrics(
  repo: string,
): Promise<{ stars: number; forks: number; openIssues: number }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
  };
}

export async function fetchNpmDownloads(
  pkg: string,
): Promise<{ weeklyDownloads: number }> {
  const res = await fetch(
    `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`,
  );
  if (!res.ok) {
    throw new Error(`npm API error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  return { weeklyDownloads: data.downloads };
}

export async function fetchPyPIDownloads(
  pkg: string,
): Promise<{ weeklyDownloads: number }> {
  const res = await fetch(
    `https://pypistats.org/api/packages/${encodeURIComponent(pkg)}/recent`,
  );
  if (!res.ok) {
    throw new Error(`PyPI API error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  return { weeklyDownloads: data.data.last_week };
}

export async function fetchHNMentions(
  term: string,
): Promise<{ count: number; avgScore: number }> {
  const weekAgoTimestamp = Math.floor(
    (Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000,
  );
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?query="${encodeURIComponent(term)}"&tags=story&numericFilters=created_at_i>${weekAgoTimestamp}`,
  );
  if (!res.ok) {
    throw new Error(`HN Algolia API error ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const count: number = data.nbHits;

  if (!data.hits || data.hits.length === 0) {
    return { count, avgScore: 0 };
  }

  const totalScore = data.hits.reduce(
    (sum: number, hit: { points: number }) => sum + (hit.points || 0),
    0,
  );
  const avgScore = totalScore / data.hits.length;

  return { count, avgScore };
}

// --- Main Collector ---

export async function collectTrendData(db: any): Promise<CollectResult> {
  // 1. Get all active tracked entities
  const { data: entities, error } = await db
    .from('trend_entities')
    .select('*')
    .eq('is_active', true);

  if (error) throw new Error(`Failed to fetch entities: ${error.message}`);
  if (!entities || entities.length === 0)
    return { entitiesUpdated: 0, errors: [] };

  const errors: string[] = [];
  let updated = 0;

  // 2. For each entity, collect metrics from available sources
  for (const entity of entities) {
    try {
      const metrics: Record<string, number | null> = {};

      // GitHub (if entity has github_repo)
      if (entity.github_repo) {
        try {
          const gh = await fetchGitHubMetrics(entity.github_repo);
          metrics.githubStars = gh.stars;
          metrics.githubForks = gh.forks;
          metrics.githubOpenIssues = gh.openIssues;
        } catch (e: any) {
          errors.push(`${entity.name}/github: ${e.message}`);
        }
      }

      // npm (if entity has npm_package)
      if (entity.npm_package) {
        try {
          const npm = await fetchNpmDownloads(entity.npm_package);
          metrics.npmDownloads = npm.weeklyDownloads;
        } catch (e: any) {
          errors.push(`${entity.name}/npm: ${e.message}`);
        }
      }

      // PyPI (if entity has pypi_package)
      if (entity.pypi_package) {
        try {
          const pypi = await fetchPyPIDownloads(entity.pypi_package);
          metrics.pypiDownloads = pypi.weeklyDownloads;
        } catch (e: any) {
          errors.push(`${entity.name}/pypi: ${e.message}`);
        }
      }

      // HackerNews mentions
      try {
        const hn = await fetchHNMentions(entity.name);
        metrics.hnMentions = hn.count;
        metrics.hnAvgScore = hn.avgScore;
      } catch (e: any) {
        errors.push(`${entity.name}/hn: ${e.message}`);
      }

      // Your post count from content_memory
      const posts = await db
        .from('content_memory')
        .select('id', { count: 'exact' })
        .contains('entities', [{ name: entity.name }]);
      metrics.yourPostCount = posts.count ?? 0;

      // 3. Store data point (one per entity per day)
      const { error: upsertError } = await db
        .from('trend_data_points')
        .upsert(
          {
            entity_id: entity.id,
            measured_at: new Date().toISOString().split('T')[0], // Date only
            metrics,
          },
          { onConflict: 'entity_id,measured_at' },
        );

      if (upsertError) {
        errors.push(`${entity.name}/store: ${upsertError.message}`);
      } else {
        updated++;
      }
    } catch (err: any) {
      errors.push(`${entity.name}: ${err.message}`);
    }
  }

  return { entitiesUpdated: updated, errors };
}
