import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient, LLMGenerateParams } from '@influenceai/integrations';
import type { InvestigationAgent } from './base';
import { isAllowedUrl } from './base';
import type {
  AgentBrief,
  TechExtraction,
  Finding,
  SourceCitation,
  InvestigationContext,
} from '../types';

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const TECH_AGENT_SYSTEM_PROMPT = `You are a technical research analyst specializing in AI, machine learning, and software engineering. Your task is to analyze a signal (news item, GitHub repo, paper, etc.) and extract key technical findings.

Analyze the technical significance of the provided signal. Your goal is to:
1. Identify specific, verifiable technical facts (benchmarks, performance numbers, architecture details)
2. Find meaningful comparisons with existing solutions or competitors
3. Note any predictions or implications for the broader tech landscape
4. Rate the importance of each finding (high/medium/low)
5. Suggest 2-3 compelling narrative hooks that could be used in content creation

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
      "source": "github | arxiv | web | etc",
      "accessedAt": "ISO date string"
    }
  ]
}

Focus on:
- Concrete numbers and metrics over vague claims
- Comparisons that help readers understand significance
- Novel aspects that differentiate this from prior work
- Potential implications for practitioners and the industry`;

// ---------------------------------------------------------------------------
// GitHub source content fetcher
// ---------------------------------------------------------------------------

interface GitHubRepoInfo {
  full_name: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string;
  license?: { spdx_id: string };
  created_at: string;
  updated_at: string;
}

async function fetchGitHubContent(
  owner: string,
  repo: string,
): Promise<{ repoInfo: GitHubRepoInfo; readme: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const [repoRes, readmeRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers }),
  ]);

  if (!repoRes.ok) {
    throw new Error(
      `GitHub repo fetch failed: ${repoRes.status} ${repoRes.statusText}`,
    );
  }

  const repoInfo = (await repoRes.json()) as GitHubRepoInfo;

  let readme = '';
  if (readmeRes.ok) {
    const readmeData = (await readmeRes.json()) as {
      content: string;
      encoding: string;
    };
    if (readmeData.encoding === 'base64') {
      readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
    }
  }

  // Truncate README to avoid blowing up context window
  const MAX_README_LENGTH = 4000;
  if (readme.length > MAX_README_LENGTH) {
    readme = readme.slice(0, MAX_README_LENGTH) + '\n\n[README truncated]';
  }

  return { repoInfo, readme };
}

// ---------------------------------------------------------------------------
// Source content builder
// ---------------------------------------------------------------------------

function parseGitHubOwnerRepo(
  signal: ScoredSignal,
): { owner: string; repo: string } | null {
  // Try sourceId first (should be "owner/repo")
  if (signal.sourceId.includes('/')) {
    const [owner, repo] = signal.sourceId.split('/');
    if (owner && repo) return { owner, repo };
  }
  // Try parsing the URL
  try {
    const parsed = new URL(signal.url);
    if (parsed.hostname === 'github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return { owner: parts[0], repo: parts[1] };
      }
    }
  } catch {
    // URL parse failed
  }
  return null;
}

async function fetchSourceContent(
  signal: ScoredSignal,
): Promise<{ content: string; fetchSuccess: boolean }> {
  try {
    if (signal.sourceType === 'github') {
      const parsed = parseGitHubOwnerRepo(signal);
      if (!parsed) {
        return { content: '', fetchSuccess: false };
      }
      const { repoInfo, readme } = await fetchGitHubContent(
        parsed.owner,
        parsed.repo,
      );
      const lines = [
        `Repository: ${repoInfo.full_name}`,
        `Description: ${repoInfo.description || 'N/A'}`,
        `Stars: ${repoInfo.stargazers_count}`,
        `Forks: ${repoInfo.forks_count}`,
        `Language: ${repoInfo.language || 'N/A'}`,
        `License: ${repoInfo.license?.spdx_id || 'N/A'}`,
        `Created: ${repoInfo.created_at}`,
        `Last Updated: ${repoInfo.updated_at}`,
        '',
        '--- README ---',
        readme || '(no README available)',
      ];
      return { content: lines.join('\n'), fetchSuccess: true };
    }

    // For arxiv, huggingface, and other sources: attempt URL fetch if allowed
    if (signal.url && isAllowedUrl(signal.url)) {
      try {
        const res = await fetch(signal.url, {
          headers: { Accept: 'text/plain, text/html' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const text = await res.text();
          // Truncate to avoid blowing up context
          const truncated =
            text.length > 4000 ? text.slice(0, 4000) + '\n[truncated]' : text;
          return { content: truncated, fetchSuccess: true };
        }
      } catch {
        // URL fetch failed, fall through
      }
    }

    // No source content available; agent will use title + summary only
    return { content: '', fetchSuccess: false };
  } catch (error) {
    return { content: '', fetchSuccess: false };
  }
}

// ---------------------------------------------------------------------------
// Tech Agent
// ---------------------------------------------------------------------------

export class TechAgent implements InvestigationAgent {
  readonly id = 'tech';
  readonly name = 'Tech Deep-Dive';
  readonly description =
    'Analyzes technical aspects of signals: benchmarks, architecture, comparisons, and implications';
  readonly enabled = true;
  readonly timeout = 30000;

  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async investigate(
    signal: ScoredSignal,
    _context?: InvestigationContext,
  ): Promise<AgentBrief> {
    try {
      // 1. Fetch source content
      const { content: sourceContent, fetchSuccess } =
        await fetchSourceContent(signal);

      // 2. Build the user prompt
      const userPrompt = this.buildUserPrompt(signal, sourceContent);

      // 3. Call LLM for structured extraction
      const params: LLMGenerateParams = {
        systemPrompt: TECH_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 1500,
        temperature: 0.3,
      };

      const extraction = await this.llm.generateJSON<TechExtraction>(params);

      // 4. Map to AgentBrief
      const findings: Finding[] = (extraction.findings || []).map((f) => ({
        type: f.type || 'fact',
        headline: f.headline || '',
        detail: f.detail || '',
        importance: f.importance || 'medium',
        ...(f.data ? { data: f.data } : {}),
      }));

      const sources: SourceCitation[] = (extraction.sources || []).map((s) => ({
        title: s.title || '',
        url: s.url || signal.url,
        source: s.source || signal.sourceType,
        accessedAt: s.accessedAt ? new Date(s.accessedAt as unknown as string) : new Date(),
      }));

      const hooks = extraction.hooks || [];

      return {
        agentId: this.id,
        status: fetchSuccess ? 'success' : 'partial',
        findings,
        narrativeHooks: hooks,
        confidence: this.computeConfidence(findings, fetchSuccess),
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
    sourceContent: string,
  ): string {
    const parts = [
      `Signal Title: ${signal.title}`,
      `Signal Summary: ${signal.summary}`,
      `Source Type: ${signal.sourceType}`,
      `URL: ${signal.url}`,
      `Score: ${signal.score}`,
    ];

    if (sourceContent) {
      parts.push('', '--- Source Content ---', sourceContent);
    } else {
      parts.push(
        '',
        'Note: Could not fetch full source content. Analyze based on the title and summary above.',
      );
    }

    return parts.join('\n');
  }

  private computeConfidence(
    findings: Finding[],
    fetchSuccess: boolean,
  ): number {
    if (findings.length === 0) return 0;

    let score = 0.4; // Base confidence

    // More findings = higher confidence (up to +0.3)
    score += Math.min(findings.length * 0.1, 0.3);

    // High-importance findings boost confidence
    const highCount = findings.filter((f) => f.importance === 'high').length;
    score += Math.min(highCount * 0.1, 0.2);

    // Successful source fetch adds confidence
    if (fetchSuccess) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }
}
