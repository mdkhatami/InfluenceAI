import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient, LLMGenerateParams } from '@influenceai/integrations';
import type { InvestigationAgent } from './base';
import { isAllowedUrl } from './base';
import type {
  AgentBrief,
  GeopoliticsExtraction,
  Finding,
  SourceCitation,
  InvestigationContext,
} from '../types';
import euAiActData from './data/eu-ai-act.json';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const GEOPOLITICS_AGENT_SYSTEM_PROMPT = `You are a geopolitical and regulatory analyst specializing in AI governance, technology policy, and the intersection of AI with state power.

Your task is to analyze a signal and extract key geopolitical and regulatory findings.

Analyze the geopolitical and regulatory implications of the provided signal. Your goal is to:
1. Identify affected regulations, laws, or policy frameworks (EU AI Act, NIST AI RMF, executive orders, national AI strategies)
2. Assess government and regulatory responses likely to follow
3. Analyze the balance of power between corporations, governments, and citizens
4. Predict policy responses from major jurisdictions (EU, US, China, UK)
5. Rate the importance of each finding (high/medium/low)
6. Suggest 2-3 compelling narrative hooks about government/corporate power dynamics

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
      "source": "eu_commission | nist | whitehouse | policy_feed | web | etc",
      "accessedAt": "ISO date string"
    }
  ]
}

Focus on:
- Specific regulatory articles or provisions that apply
- Cross-border policy tensions and geopolitical competition
- Government surveillance, control, and national security angles
- Corporate lobbying and regulatory capture dynamics
- Civil liberties and fundamental rights implications`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EUAIActEntry {
  article: string;
  title: string;
  riskLevel: string;
  keywords: string[];
  summary: string;
}

export interface MatchedArticle {
  article: string;
  title: string;
  riskLevel: string;
  summary: string;
  matchCount: number;
}

interface PolicyFeedItem {
  title: string;
  url: string;
  source: string;
}

// ---------------------------------------------------------------------------
// Policy feed sources
// ---------------------------------------------------------------------------

const POLICY_FEED_URLS = [
  {
    url: 'https://www.nist.gov/system/files/documents/2023/01/26/AI_RMF_1.0.json',
    source: 'nist',
  },
  {
    url: 'https://digital-strategy.ec.europa.eu/en/policies/european-approach-artificial-intelligence',
    source: 'eu_commission',
  },
];

// ---------------------------------------------------------------------------
// Geopolitics Agent
// ---------------------------------------------------------------------------

export class GeopoliticsAgent implements InvestigationAgent {
  readonly id = 'geopolitics';
  readonly name = 'Geopolitics & Regulation';
  readonly description =
    'Analyzes geopolitical and regulatory implications of AI signals: EU AI Act, NIST, policy responses, and government/corporate power dynamics';
  readonly enabled = true;
  readonly timeout = 25000;

  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Match signal title + summary against EU AI Act entries by keyword overlap.
   * Returns matched articles sorted by keyword overlap count (descending).
   */
  matchEUAIAct(signal: ScoredSignal): MatchedArticle[] {
    const text = `${signal.title} ${signal.summary}`.toLowerCase();
    const results: MatchedArticle[] = [];

    for (const entry of euAiActData as EUAIActEntry[]) {
      const matchCount = entry.keywords.filter((kw) =>
        text.includes(kw.toLowerCase()),
      ).length;

      if (matchCount > 0) {
        results.push({
          article: entry.article,
          title: entry.title,
          riskLevel: entry.riskLevel,
          summary: entry.summary,
          matchCount,
        });
      }
    }

    return results.sort((a, b) => b.matchCount - a.matchCount);
  }

  /**
   * Attempt to fetch from well-known policy feed sources.
   * Gracefully returns empty array if any feed fails.
   * Uses isAllowedUrl() for SSRF protection.
   */
  async fetchPolicyFeeds(): Promise<PolicyFeedItem[]> {
    const results: PolicyFeedItem[] = [];

    for (const feed of POLICY_FEED_URLS) {
      if (!isAllowedUrl(feed.url)) {
        continue;
      }

      try {
        const res = await fetch(feed.url, {
          headers: { Accept: 'application/json, text/html' },
          signal: AbortSignal.timeout(8000),
        });

        if (res.ok) {
          results.push({
            title: `${feed.source.toUpperCase()} Policy Feed`,
            url: feed.url,
            source: feed.source,
          });
        }
      } catch {
        // Gracefully skip failed feeds
      }
    }

    return results;
  }

  async investigate(
    signal: ScoredSignal,
    _context?: InvestigationContext,
  ): Promise<AgentBrief> {
    try {
      // 1. Match EU AI Act articles
      const matchedArticles = this.matchEUAIAct(signal);

      // 2. Attempt policy feeds (graceful failure)
      const policyFeeds = await this.fetchPolicyFeeds();

      // 3. Build user prompt
      const userPrompt = this.buildUserPrompt(
        signal,
        matchedArticles,
        policyFeeds,
      );

      // 4. Call LLM for regulatory analysis
      const params: LLMGenerateParams = {
        systemPrompt: GEOPOLITICS_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 1200,
        temperature: 0.3,
      };

      const extraction =
        await this.llm.generateJSON<GeopoliticsExtraction>(params);

      const findings = this.mapFindings(extraction.findings || []);
      const sources = this.mapSources(extraction.sources || [], signal);
      const hooks = extraction.hooks || [];

      // Add matched EU AI Act articles as sources
      for (const article of matchedArticles.slice(0, 3)) {
        sources.push({
          title: `EU AI Act — ${article.article}: ${article.title}`,
          url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689',
          source: 'eu_ai_act',
          accessedAt: new Date(),
        });
      }

      // Determine confidence based on EU AI Act matches
      const hasSpecificPolicyConnection = matchedArticles.length > 0;
      const confidence = hasSpecificPolicyConnection
        ? this.computeConfidence(findings, matchedArticles.length)
        : 0.2;

      return {
        agentId: this.id,
        status: findings.length > 0 ? 'success' : 'partial',
        findings,
        narrativeHooks: hooks,
        confidence,
        sources,
        ...(matchedArticles.length > 0
          ? { rawData: { matchedEUAIActArticles: matchedArticles } }
          : {}),
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
    matchedArticles: MatchedArticle[],
    policyFeeds: PolicyFeedItem[],
  ): string {
    const parts = [
      `Signal Title: ${signal.title}`,
      `Signal Summary: ${signal.summary}`,
      `Source Type: ${signal.sourceType}`,
      `URL: ${signal.url}`,
      `Score: ${signal.score}`,
    ];

    if (matchedArticles.length > 0) {
      parts.push('');
      parts.push('--- EU AI Act Matches ---');
      for (const match of matchedArticles.slice(0, 5)) {
        parts.push(
          `${match.article} (${match.title}) — Risk Level: ${match.riskLevel} — Keyword matches: ${match.matchCount}`,
        );
        parts.push(`  ${match.summary}`);
      }
    } else {
      parts.push('');
      parts.push(
        'Note: No direct EU AI Act article matches found. Analyze based on general regulatory context.',
      );
    }

    if (policyFeeds.length > 0) {
      parts.push('');
      parts.push('--- Policy Feed Sources Available ---');
      for (const feed of policyFeeds) {
        parts.push(`  - ${feed.title} (${feed.source}): ${feed.url}`);
      }
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
    articleMatchCount: number,
  ): number {
    if (findings.length === 0) return 0.2;

    let score = 0.4;
    score += Math.min(findings.length * 0.1, 0.3);

    const highCount = findings.filter((f) => f.importance === 'high').length;
    score += Math.min(highCount * 0.1, 0.2);

    // More matched EU AI Act articles = more specific regulatory connection
    if (articleMatchCount >= 3) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }
}
