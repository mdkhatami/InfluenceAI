import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient, LLMGenerateParams } from '@influenceai/integrations';
import type { InvestigationAgent } from './base';
import type {
  AgentBrief,
  DevEcoExtraction,
  Finding,
  SourceCitation,
  InvestigationContext,
} from '../types';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const DEVECO_AGENT_SYSTEM_PROMPT = `You are a developer ecosystem analyst specializing in open-source software adoption, developer tooling, and community growth signals.

Your task is to analyze a signal and extract key developer ecosystem findings.

Analyze the developer adoption significance of the provided signal. Your goal is to:
1. Identify specific, verifiable adoption metrics (GitHub stars, npm/PyPI downloads, HN discussion)
2. Find meaningful growth trends and community signals
3. Note any implications for the developer tooling landscape
4. Rate the importance of each finding (high/medium/low)
5. Suggest 2-3 compelling narrative hooks about developer adoption

Return your analysis as JSON matching this exact structure:
{
  "findings": [
    {
      "type": "fact" | "comparison" | "prediction" | "contradiction" | "trend",
      "headline": "short headline summarizing the finding",
      "detail": "1-2 sentence explanation with specifics",
      "importance": "high" | "medium" | "low"
    }
  ],
  "hooks": ["narrative hook 1", "narrative hook 2"],
  "sources": [
    {
      "title": "source title",
      "url": "source url",
      "source": "github | npm | pypi | hackernews | etc",
      "accessedAt": "ISO date string"
    }
  ]
}

Focus on:
- Concrete growth metrics (stars/week, download counts, PR velocity)
- Community engagement signals (issues, discussions, HN mentions)
- Ecosystem integration (dependencies, plugins, forks)
- Adoption by notable projects or companies`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubMetrics {
  stars: number;
  forks: number;
  issues: number;
}

interface HNStory {
  objectID: string;
  title: string;
  points: number;
  num_comments: number;
  created_at: string;
}

interface HNMentions {
  count: number;
  topStories: HNStory[];
}

// ---------------------------------------------------------------------------
// DevEco Agent
// ---------------------------------------------------------------------------

export class DevEcoAgent implements InvestigationAgent {
  readonly id = 'deveco';
  readonly name = 'Developer Ecosystem';
  readonly description =
    'Analyzes developer adoption signals: GitHub metrics, npm/PyPI downloads, HackerNews discussions';
  readonly enabled = true;
  readonly timeout = 25000;

  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Fetch GitHub repository metrics.
   * Uses GITHUB_TOKEN env var if available. Returns null on failure.
   */
  async fetchGitHubMetrics(
    repoFullName: string,
  ): Promise<GitHubMetrics | null> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      const token = process.env.GITHUB_TOKEN;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [owner, repo] = repoFullName.split('/');
      if (!owner || !repo) return null;

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers, signal: AbortSignal.timeout(10000) },
      );

      if (!res.ok) return null;

      const data = (await res.json()) as {
        stargazers_count: number;
        forks_count: number;
        open_issues_count: number;
      };

      return {
        stars: data.stargazers_count,
        forks: data.forks_count,
        issues: data.open_issues_count,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch npm weekly download count for a package.
   * Returns download count or null on failure.
   */
  async fetchNpmDownloads(packageName: string): Promise<number | null> {
    try {
      const res = await fetch(
        `https://api.npmjs.org/downloads/point/last-week/${packageName}`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!res.ok) return null;

      const data = (await res.json()) as { downloads: number };
      return data.downloads ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch PyPI last-week download count for a package.
   * Returns last_week count or null on failure.
   */
  async fetchPyPIDownloads(packageName: string): Promise<number | null> {
    try {
      const res = await fetch(
        `https://pypistats.org/api/packages/${packageName}/recent`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!res.ok) return null;

      const data = (await res.json()) as { data?: { last_week?: number } };
      return data?.data?.last_week ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch HackerNews mentions for a search term.
   * Returns hit count + top stories, or null on failure.
   */
  async fetchHNMentions(searchTerm: string): Promise<HNMentions | null> {
    try {
      const encoded = encodeURIComponent(searchTerm);
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&hitsPerPage=5`,
        { signal: AbortSignal.timeout(10000) },
      );

      if (!res.ok) return null;

      const data = (await res.json()) as {
        hits: HNStory[];
        nbHits: number;
      };

      return {
        count: data.nbHits,
        topStories: data.hits || [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract repo full name from a GitHub signal.
   */
  private parseGitHubRepo(signal: ScoredSignal): string | null {
    if (signal.sourceType !== 'github') return null;

    // Try sourceId first (should be "owner/repo")
    if (signal.sourceId.includes('/')) {
      const [owner, repo] = signal.sourceId.split('/');
      if (owner && repo) return `${owner}/${repo}`;
    }

    // Try parsing the URL
    try {
      const parsed = new URL(signal.url);
      if (parsed.hostname === 'github.com') {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) {
          return `${parts[0]}/${parts[1]}`;
        }
      }
    } catch {
      // URL parse failed
    }

    return null;
  }

  /**
   * Extract a probable package name from the signal for npm/PyPI lookup.
   * Uses the repo name if available, otherwise tries the last URL segment.
   */
  private extractPackageName(signal: ScoredSignal): string | null {
    const repoName = this.parseGitHubRepo(signal);
    if (repoName) {
      return repoName.split('/')[1] ?? null;
    }

    // Fallback: use a keyword from the title
    const titleWords = signal.title
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    return titleWords[0] ?? null;
  }

  async investigate(
    signal: ScoredSignal,
    _context?: InvestigationContext,
  ): Promise<AgentBrief> {
    try {
      // 1. Fetch metrics in parallel
      const repoName = this.parseGitHubRepo(signal);
      const packageName = this.extractPackageName(signal);
      const searchTerm = signal.title.split(' ').slice(0, 3).join(' ');

      const [githubMetrics, npmDownloads, pypiDownloads, hnMentions] =
        await Promise.all([
          repoName ? this.fetchGitHubMetrics(repoName) : Promise.resolve(null),
          packageName
            ? this.fetchNpmDownloads(packageName)
            : Promise.resolve(null),
          packageName
            ? this.fetchPyPIDownloads(packageName)
            : Promise.resolve(null),
          this.fetchHNMentions(searchTerm),
        ]);

      // 2. Build user prompt
      const userPrompt = this.buildUserPrompt(
        signal,
        githubMetrics,
        npmDownloads,
        pypiDownloads,
        hnMentions,
      );

      // 3. Call LLM
      const params: LLMGenerateParams = {
        systemPrompt: DEVECO_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 1200,
        temperature: 0.3,
      };

      const extraction = await this.llm.generateJSON<DevEcoExtraction>(params);

      // 4. Map results
      const findings = this.mapFindings(extraction.findings || []);
      const sources = this.mapSources(extraction.sources || [], signal);
      const hooks = extraction.hooks || [];

      // Determine fetch success for status
      const anyDataFetched =
        githubMetrics !== null ||
        npmDownloads !== null ||
        pypiDownloads !== null ||
        hnMentions !== null;

      return {
        agentId: this.id,
        status: anyDataFetched ? 'success' : 'partial',
        findings,
        narrativeHooks: hooks,
        confidence: this.computeConfidence(findings, anyDataFetched),
        sources,
      };
    } catch (error) {
      // Never throw — always return a brief
      return {
        agentId: this.id,
        status: 'failed',
        findings: [],
        narrativeHooks: [],
        confidence: 0,
        sources: [],
        rawData: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  private buildUserPrompt(
    signal: ScoredSignal,
    githubMetrics: GitHubMetrics | null,
    npmDownloads: number | null,
    pypiDownloads: number | null,
    hnMentions: HNMentions | null,
  ): string {
    const parts = [
      `Signal Title: ${signal.title}`,
      `Signal Summary: ${signal.summary}`,
      `Source Type: ${signal.sourceType}`,
      `URL: ${signal.url}`,
      `Score: ${signal.score}`,
    ];

    if (githubMetrics) {
      parts.push('');
      parts.push('--- GitHub Metrics ---');
      parts.push(`Stars: ${githubMetrics.stars.toLocaleString()}`);
      parts.push(`Forks: ${githubMetrics.forks.toLocaleString()}`);
      parts.push(`Open Issues: ${githubMetrics.issues.toLocaleString()}`);
    }

    if (npmDownloads !== null) {
      parts.push('');
      parts.push(`--- npm Downloads (last week) ---`);
      parts.push(`Downloads: ${npmDownloads.toLocaleString()}`);
    }

    if (pypiDownloads !== null) {
      parts.push('');
      parts.push(`--- PyPI Downloads (last week) ---`);
      parts.push(`Downloads: ${pypiDownloads.toLocaleString()}`);
    }

    if (hnMentions) {
      parts.push('');
      parts.push(`--- HackerNews Mentions ---`);
      parts.push(`Total Stories: ${hnMentions.count}`);
      if (hnMentions.topStories.length > 0) {
        parts.push('Top Stories:');
        for (const story of hnMentions.topStories.slice(0, 3)) {
          parts.push(
            `  - "${story.title}" (${story.points} pts, ${story.num_comments} comments)`,
          );
        }
      }
    }

    if (!githubMetrics && npmDownloads === null && pypiDownloads === null && !hnMentions) {
      parts.push('');
      parts.push(
        'Note: Could not fetch ecosystem data. Analyze developer adoption based on the signal context only.',
      );
    }

    return parts.join('\n');
  }

  private mapFindings(raw: Partial<Finding>[]): Finding[] {
    return raw.map((f) => ({
      type: f.type || 'fact',
      headline: f.headline || '',
      detail: f.detail || '',
      importance: f.importance || 'medium',
      ...(f.data ? { data: f.data } : {}),
    }));
  }

  private mapSources(
    raw: Partial<SourceCitation>[],
    signal: ScoredSignal,
  ): SourceCitation[] {
    return raw.map((s) => ({
      title: s.title || '',
      url: s.url || signal.url,
      source: s.source || signal.sourceType,
      accessedAt:
        s.accessedAt instanceof Date
          ? s.accessedAt
          : s.accessedAt
            ? new Date(s.accessedAt as unknown as string)
            : new Date(),
    }));
  }

  private computeConfidence(
    findings: Finding[],
    hasData: boolean,
  ): number {
    if (findings.length === 0) return 0.1;

    let score = 0.4;
    score += Math.min(findings.length * 0.1, 0.3);

    const highCount = findings.filter((f) => f.importance === 'high').length;
    score += Math.min(highCount * 0.1, 0.2);

    if (hasData) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }
}
