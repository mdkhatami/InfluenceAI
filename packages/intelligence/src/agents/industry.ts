import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient, LLMGenerateParams } from '@influenceai/integrations';
import type { InvestigationAgent } from './base';
import type {
  AgentBrief,
  IndustryExtraction,
  Finding,
  SourceCitation,
  InvestigationContext,
} from '../types';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const INDUSTRY_AGENT_SYSTEM_PROMPT = `You are an industry analyst specializing in technology disruption, market dynamics, and the competitive landscape of AI-driven transformation.

Your task is to analyze a signal and extract key industry impact findings.

Analyze the industry disruption potential of the provided signal. Your goal is to:
1. Identify sectors and industries most affected by this development
2. Assess startup vs enterprise competitive dynamics
3. Predict market shifts and emerging opportunities
4. Note hiring trends and talent movement signals
5. Rate the importance of each finding (high/medium/low)
6. Suggest 2-3 compelling narrative hooks about startup/enterprise dynamics

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
      "source": "hackernews | producthunt | crunchbase | web | etc",
      "accessedAt": "ISO date string"
    }
  ]
}

Focus on:
- Concrete market displacement and disruption signals
- Startup fundraising and enterprise adoption patterns
- Talent movement and hiring signals
- Industry revenue at risk vs. opportunity
- Geographic and sector-specific competitive dynamics`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HNHit {
  objectID: string;
  title: string;
  points: number;
  num_comments: number;
  created_at: string;
  url?: string;
}

interface HNHiringResult {
  hits: HNHit[];
  nbHits: number;
}

interface ProductHuntPost {
  name: string;
  tagline: string;
  url: string;
  votesCount: number;
}

// ---------------------------------------------------------------------------
// Industry Agent
// ---------------------------------------------------------------------------

export class IndustryAgent implements InvestigationAgent {
  readonly id = 'industry';
  readonly name = 'Industry Impact';
  readonly description =
    'Analyzes industry disruption potential: affected sectors, market impacts, startup/enterprise dynamics, and hiring trends';
  readonly enabled = true;
  readonly timeout = 25000;

  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Search HackerNews Algolia for "who is hiring" posts matching the keywords.
   * Returns results or null on failure.
   */
  async fetchHNHiring(keywords: string): Promise<HNHiringResult | null> {
    try {
      const encoded = encodeURIComponent(`who is hiring ${keywords}`);
      const url = `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&hitsPerPage=5`;

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        hits: HNHit[];
        nbHits: number;
      };

      return {
        hits: data.hits || [],
        nbHits: data.nbHits ?? 0,
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetch ProductHunt trending posts if PRODUCTHUNT_TOKEN env var is set.
   * Fix 24: Skip entirely and return null if token is not configured.
   */
  async fetchProductHunt(): Promise<ProductHuntPost[] | null> {
    const token = process.env.PRODUCTHUNT_TOKEN;
    if (!token) {
      return null;
    }

    try {
      const query = `
        query {
          posts(first: 5, order: VOTES) {
            edges {
              node {
                name
                tagline
                url
                votesCount
              }
            }
          }
        }
      `;

      const res = await fetch('https://api.producthunt.com/v2/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        data?: {
          posts?: {
            edges?: Array<{
              node: ProductHuntPost;
            }>;
          };
        };
      };

      return (
        data?.data?.posts?.edges?.map((e) => e.node).filter(Boolean) ?? null
      );
    } catch {
      return null;
    }
  }

  /**
   * Extract industry-relevant keywords from signal for HN hiring search.
   */
  private extractIndustryKeywords(signal: ScoredSignal): string {
    const title = signal.title.toLowerCase();
    const summary = signal.summary.toLowerCase();
    const text = `${title} ${summary}`;

    // Extract meaningful words (filter out common stop words)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might',
      'that', 'this', 'these', 'those', 'it', 'its', 'as', 'up', 'out', 'new',
    ]);

    const words = text
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    // Return first 3 relevant keywords
    return words.slice(0, 3).join(' ');
  }

  async investigate(
    signal: ScoredSignal,
    _context?: InvestigationContext,
  ): Promise<AgentBrief> {
    try {
      // 1. Extract keywords for industry search
      const keywords = this.extractIndustryKeywords(signal);

      // 2. Fetch HN hiring data and optional ProductHunt data in parallel
      const [hnHiring, productHuntPosts] = await Promise.all([
        this.fetchHNHiring(keywords),
        this.fetchProductHunt(),
      ]);

      // 3. Build user prompt
      const userPrompt = this.buildUserPrompt(
        signal,
        keywords,
        hnHiring,
        productHuntPosts,
      );

      // 4. Call LLM for industry analysis
      const params: LLMGenerateParams = {
        systemPrompt: INDUSTRY_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 1200,
        temperature: 0.3,
      };

      const extraction =
        await this.llm.generateJSON<IndustryExtraction>(params);

      const findings = this.mapFindings(extraction.findings || []);
      const sources = this.mapSources(extraction.sources || [], signal);
      const hooks = extraction.hooks || [];

      const anyDataFetched = hnHiring !== null || productHuntPosts !== null;

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
    keywords: string,
    hnHiring: HNHiringResult | null,
    productHuntPosts: ProductHuntPost[] | null,
  ): string {
    const parts = [
      `Signal Title: ${signal.title}`,
      `Signal Summary: ${signal.summary}`,
      `Source Type: ${signal.sourceType}`,
      `URL: ${signal.url}`,
      `Score: ${signal.score}`,
      `Industry Keywords: ${keywords}`,
    ];

    if (hnHiring) {
      parts.push('');
      parts.push('--- HackerNews Hiring Signals ---');
      parts.push(`Total "Who is Hiring" mentions: ${hnHiring.nbHits}`);
      if (hnHiring.hits.length > 0) {
        parts.push('Recent posts:');
        for (const hit of hnHiring.hits.slice(0, 3)) {
          parts.push(
            `  - "${hit.title}" (${hit.points} pts, ${hit.num_comments} comments)`,
          );
        }
      }
    }

    if (productHuntPosts && productHuntPosts.length > 0) {
      parts.push('');
      parts.push('--- ProductHunt Trending ---');
      for (const post of productHuntPosts.slice(0, 3)) {
        parts.push(`  - ${post.name}: ${post.tagline} (${post.votesCount} votes)`);
      }
    }

    if (!hnHiring && !productHuntPosts) {
      parts.push('');
      parts.push(
        'Note: Could not fetch real-time industry data. Analyze market impact based on signal context only.',
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
