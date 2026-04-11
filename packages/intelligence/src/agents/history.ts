import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient, LLMGenerateParams } from '@influenceai/integrations';
import type { InvestigationAgent } from './base';
import type {
  AgentBrief,
  HistoryExtraction,
  Finding,
  InvestigationContext,
} from '../types';
import techHistoryData from './data/tech-history.json';

// ---------------------------------------------------------------------------
// Tech history entry type
// ---------------------------------------------------------------------------

interface TechHistoryEntry {
  id: string;
  name: string;
  year: number;
  category: string;
  pattern: string;
  keywords: string[];
  trajectory: string;
  lessons: string[];
}

const TECH_HISTORY: TechHistoryEntry[] = techHistoryData as TechHistoryEntry[];

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const HISTORY_AGENT_SYSTEM_PROMPT = `You are a technology historian specializing in identifying historical parallels between current tech developments and past innovations.

You will be given a current technology signal and a set of candidate historical tech events that may be related.

Your task is to:
1. Compare the current signal to the historical tech events provided
2. Determine if there is a meaningful parallel (not just surface-level keyword similarity)
3. Assess whether the historical trajectory and lessons are relevant to the current situation
4. Rate your confidence in the parallel
5. Provide a compelling narrative hook connecting past and present

Return your analysis as JSON matching this exact structure:
{
  "hasParallel": true | false,
  "findings": [
    {
      "type": "comparison" | "prediction" | "trend" | "fact" | "contradiction",
      "headline": "brief description of the historical parallel",
      "detail": "1-2 sentence explanation of why this parallel is meaningful and what it predicts",
      "importance": "high" | "medium" | "low"
    }
  ],
  "hooks": ["narrative hook connecting this signal to history"],
  "confidence": 0.0 to 1.0
}

Only set hasParallel to true if there is a genuinely meaningful parallel, not just keyword overlap.
Focus on trajectory patterns (how the technology evolved and was adopted) rather than technical similarity.
Historical lessons should be actionable and specific to the current situation.`;

// ---------------------------------------------------------------------------
// History Agent
// ---------------------------------------------------------------------------

export class HistoryAgent implements InvestigationAgent {
  readonly id = 'history';
  readonly name = 'Historical Pattern';
  readonly description =
    'Finds historical tech parallels by matching signals to past innovation patterns and trajectories';
  readonly enabled = true;
  readonly timeout = 20000;

  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  /**
   * Find historical candidates by keyword overlap.
   * Returns top 5 entries sorted by keyword match count (minimum 1 match).
   */
  findHistoricalCandidates(signal: ScoredSignal): TechHistoryEntry[] {
    const signalText = `${signal.title} ${signal.summary}`.toLowerCase();

    const scored = TECH_HISTORY.map((entry) => {
      const overlap = entry.keywords.filter((kw) =>
        signalText.includes(kw.toLowerCase()),
      ).length;
      return { entry, overlap };
    });

    return scored
      .filter(({ overlap }) => overlap >= 1)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 5)
      .map(({ entry }) => entry);
  }

  async investigate(
    signal: ScoredSignal,
    _context?: InvestigationContext,
  ): Promise<AgentBrief> {
    try {
      const candidates = this.findHistoricalCandidates(signal);

      // If no candidates found, return partial without calling LLM
      if (candidates.length === 0) {
        return {
          agentId: this.id,
          status: 'partial',
          findings: [],
          narrativeHooks: [],
          confidence: 0.1,
          sources: [],
          rawData: { reason: 'No historical keyword matches found' },
        };
      }

      // Build user prompt with signal + candidates
      const userPrompt = this.buildUserPrompt(signal, candidates);

      const params: LLMGenerateParams = {
        systemPrompt: HISTORY_AGENT_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 1000,
        temperature: 0.4,
      };

      const extraction = await this.llm.generateJSON<HistoryExtraction>(params);

      const findings: Finding[] = (extraction.findings || []).map((f) => ({
        type: f.type || 'comparison',
        headline: f.headline || '',
        detail: f.detail || '',
        importance: f.importance || 'medium',
      }));

      const hooks = extraction.hooks || [];
      const hasParallel = extraction.hasParallel === true;

      return {
        agentId: this.id,
        status: hasParallel ? 'success' : 'partial',
        findings,
        narrativeHooks: hooks,
        confidence: hasParallel
          ? Math.max(extraction.confidence ?? 0.7, 0.5)
          : 0.2,
        sources: [],
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
    candidates: TechHistoryEntry[],
  ): string {
    const parts = [
      `Signal Title: ${signal.title}`,
      `Signal Summary: ${signal.summary}`,
      `Source Type: ${signal.sourceType}`,
      `URL: ${signal.url}`,
      '',
      '--- Historical Candidates ---',
    ];

    for (const entry of candidates) {
      parts.push(
        `\n[${entry.name} (${entry.year}) — ${entry.category}]`,
        `Pattern: ${entry.pattern}`,
        `Keywords: ${entry.keywords.join(', ')}`,
        `Trajectory: ${entry.trajectory}`,
        `Lessons: ${entry.lessons.join(' | ')}`,
      );
    }

    parts.push(
      '',
      'Evaluate which (if any) of these historical parallels are meaningful for the current signal.',
    );

    return parts.join('\n');
  }
}
