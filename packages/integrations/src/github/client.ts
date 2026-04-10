import { z } from 'zod';

export const TrendingRepoSchema = z.object({
  name: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  language: z.string().nullable(),
  stars: z.number(),
  starsToday: z.number(),
  forks: z.number(),
});

export type TrendingRepo = z.infer<typeof TrendingRepoSchema>;

export interface GitHubTrendsOptions {
  language?: string;
  since?: 'daily' | 'weekly' | 'monthly';
}

export async function fetchTrendingRepos(
  options?: GitHubTrendsOptions,
): Promise<TrendingRepo[]> {
  const since = options?.since ?? 'daily';
  const lang = options?.language ?? '';

  // Try the unofficial trending API first
  const url = `https://api.gitterapp.com/repositories?language=${lang}&since=${since}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return await scrapeGitHubTrending(since, lang);
    }
    const data = await response.json();
    return (data as Record<string, unknown>[]).map(
      (repo: Record<string, unknown>) => ({
        name: (repo.name as string) ?? (repo.repositoryName as string) ?? '',
        fullName:
          (repo.fullName as string) ??
          `${repo.username}/${repo.repositoryName}`,
        description: (repo.description as string) ?? null,
        url:
          (repo.url as string) ??
          `https://github.com/${repo.username}/${repo.repositoryName}`,
        language: (repo.language as string) ?? null,
        stars: (repo.stars as number) ?? (repo.totalStars as number) ?? 0,
        starsToday:
          (repo.currentPeriodStars as number) ??
          (repo.starsSince as number) ??
          0,
        forks: (repo.forks as number) ?? 0,
      }),
    );
  } catch {
    return await scrapeGitHubTrending(since, lang);
  }
}

async function scrapeGitHubTrending(
  since: string,
  language: string,
): Promise<TrendingRepo[]> {
  const url = `https://github.com/trending${language ? `/${language}` : ''}?since=${since}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'InfluenceAI-Bot/1.0' },
  });

  if (!response.ok) {
    throw new Error(`GitHub trending returned ${response.status}`);
  }

  const html = await response.text();

  if (html.includes('login?') && !html.includes('Box-row')) {
    throw new Error('GitHub returned login page (rate limited or blocked)');
  }

  const repos: TrendingRepo[] = [];
  const articleRegex = /class="Box-row"[\s\S]*?<\/article>/g;
  const articles = html.match(articleRegex) ?? [];

  for (const article of articles.slice(0, 10)) {
    const nameMatch = article.match(/href="\/([^"]+)"/);
    const descMatch = article.match(
      /<p class="col-9[^"]*">\s*([\s\S]*?)\s*<\/p>/,
    );
    const langMatch = article.match(
      /itemprop="programmingLanguage">([\s\S]*?)<\/span>/,
    );
    const starsMatch = article.match(/\/stargazers">\s*([\d,]+)\s*<\/a>/);
    const todayMatch = article.match(
      /([\d,]+)\s*stars?\s*(today|this week|this month)/i,
    );

    if (nameMatch) {
      const fullName = nameMatch[1].trim();
      // Skip login redirects and non-repo paths
      if (fullName.startsWith('login') || !fullName.includes('/')) continue;
      const parts = fullName.split('/');
      repos.push({
        name: parts[1] ?? fullName,
        fullName,
        description: descMatch ? descMatch[1].trim() : null,
        url: `https://github.com/${fullName}`,
        language: langMatch ? langMatch[1].trim() : null,
        stars: parseInt((starsMatch?.[1] ?? '0').replace(/,/g, ''), 10),
        starsToday: parseInt(
          (todayMatch?.[1] ?? '0').replace(/,/g, ''), 10),
        forks: 0,
      });
    }
  }
  return repos;
}

/** Score repos by AI relevance for ranking */
export function scoreRepos(repos: TrendingRepo[]): TrendingRepo[] {
  return repos
    .map((repo) => {
      let score = repo.stars;

      // Boost for AI-friendly languages
      const lang = (repo.language ?? '').toLowerCase();
      if (['python', 'jupyter notebook'].includes(lang)) score *= 1.3;
      if (['typescript', 'rust'].includes(lang)) score *= 1.1;

      // Boost for AI-related keywords in description
      const desc = (repo.description ?? '').toLowerCase();
      const aiKeywords = ['ai', 'llm', 'gpt', 'machine learning', 'deep learning', 'transformer', 'neural', 'diffusion', 'agent', 'rag', 'embedding'];
      const keywordMatches = aiKeywords.filter((kw) => desc.includes(kw)).length;
      score *= 1 + keywordMatches * 0.15;

      // Boost for high star velocity
      if (repo.starsToday > 100) score *= 1.2;

      return { ...repo, stars: Math.round(score) };
    })
    .sort((a, b) => b.stars - a.stars);
}

/** Convert repos to content signals for the pipeline */
export function toSignals(repos: TrendingRepo[]) {
  return repos.map((repo) => ({
    source: 'github' as const,
    externalId: repo.fullName,
    title: `${repo.fullName}: ${repo.description ?? 'No description'}`,
    url: repo.url,
    summary: repo.description,
    author: repo.fullName.split('/')[0],
    score: repo.stars,
    metadata: {
      stars: repo.stars,
      starsToday: repo.starsToday,
      language: repo.language,
      forks: repo.forks,
    },
  }));
}
