import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient } from '@influenceai/integrations';
import type { AgentBrief, ResearchBrief, SynthesisOutput, Finding } from './types';

const SYNTHESIS_SYSTEM_PROMPT = `You are a research synthesis agent. You receive findings from multiple specialized investigation agents and must:

1. Rank all findings by importance and narrative potential
2. Identify connections between findings from DIFFERENT agents (cross-domain connections are most valuable)
3. Suggest 3-5 content angles based on the findings
4. Identify the single most unusual or surprising fact

Respond with JSON matching this structure:
{
  "rankedFindings": [{ "type": "fact|comparison|prediction|contradiction|trend", "headline": "...", "detail": "...", "importance": "high|medium|low" }],
  "connections": [{ "findingA": {...}, "findingB": {...}, "relationship": "...", "narrativeHook": "..." }],
  "angles": ["angle description 1", "angle description 2"],
  "unusualFact": "The single most surprising finding"
}`;

export async function synthesizeBriefs(
  signal: ScoredSignal,
  signalId: string,
  briefs: AgentBrief[],
  llm: LLMClient,
): Promise<ResearchBrief> {
  const userPrompt = buildSynthesisPrompt(signal, briefs);

  let synthesis: SynthesisOutput;
  try {
    synthesis = await llm.generateJSON<SynthesisOutput>({
      systemPrompt: SYNTHESIS_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 2000,
      temperature: 0.4,
    });
  } catch {
    // Fallback: merge findings without LLM
    synthesis = manualMerge(briefs);
  }

  return {
    id: crypto.randomUUID(),
    signalId,
    signal,
    topFindings: synthesis.rankedFindings.slice(0, 10),
    connections: synthesis.connections || [],
    suggestedAngles: synthesis.angles || [],
    unusualFact: synthesis.unusualFact || signal.title,
    agentBriefs: briefs,
    coverage: {
      dispatched: briefs.length,
      succeeded: briefs.filter((b) => b.status === 'success').length,
      failed: briefs.filter((b) => b.status === 'failed').length,
      agents: briefs.map((b) => b.agentId),
    },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  };
}

export function createFallbackBrief(signal: ScoredSignal, signalId: string): ResearchBrief {
  return {
    id: crypto.randomUUID(),
    signalId,
    signal,
    topFindings: [{ type: 'fact', headline: signal.title, detail: signal.summary, importance: 'medium' }],
    connections: [],
    suggestedAngles: ['breaking news: report the facts'],
    unusualFact: signal.title,
    agentBriefs: [],
    coverage: { dispatched: 0, succeeded: 0, failed: 0, agents: [] },
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  };
}

function buildSynthesisPrompt(signal: ScoredSignal, briefs: AgentBrief[]): string {
  let prompt = `## Signal\nTitle: ${signal.title}\nSummary: ${signal.summary}\nSource: ${signal.sourceType} (${signal.sourceId})\nScore: ${signal.score}/10\n\n`;

  for (const brief of briefs) {
    prompt += `## ${brief.agentId} Agent (confidence: ${brief.confidence})\n`;
    for (const finding of brief.findings) {
      prompt += `- [${finding.importance}] ${finding.headline}: ${finding.detail}\n`;
    }
    if (brief.narrativeHooks.length > 0) {
      prompt += `Hooks: ${brief.narrativeHooks.join('; ')}\n`;
    }
    prompt += '\n';
  }

  return prompt;
}

function manualMerge(briefs: AgentBrief[]): SynthesisOutput {
  const allFindings: Finding[] = briefs.flatMap((b) => b.findings);
  const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const ranked = allFindings
    .sort((a, b) => (importanceOrder[a.importance] ?? 1) - (importanceOrder[b.importance] ?? 1))
    .slice(0, 10);

  return {
    rankedFindings: ranked,
    connections: [],
    angles: briefs.flatMap((b) => b.narrativeHooks).slice(0, 5),
    unusualFact: ranked[0]?.headline || 'No findings',
  };
}
