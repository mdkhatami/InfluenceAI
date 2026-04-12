import { randomUUID } from 'crypto';
import type { LLMClient } from '@influenceai/integrations';
import type { AngleCard, RawAngle, ResearchBrief, Platform } from '../types';

const ANGLE_GENERATOR_SYSTEM_PROMPT = `You are a content strategist who creates diverse, compelling angles for social media posts.

Given research findings from multiple domains (tech, finance, geopolitics, industry, developer ecosystem, history), generate 5 distinct content angles. Each angle must:

1. Use a different angle type from: contrarian, practical, prediction, historical_parallel, hidden_connection, career_impact, unraveling, david_vs_goliath, financial_signal, geopolitical_chess
2. Reference specific findings by index (0-based)
3. Have a bold, scroll-stopping hook (first line of the post)
4. Have a clear thesis (the argument in 1-2 sentences)
5. Identify which domain primarily drives this angle

DIVERSITY RULE: No two angles may share the same angle type OR the same primary domain source. Maximize how different the angles feel from each other.

Output JSON: { "angles": [{ "type", "hook", "thesis", "findingRefs": number[], "primaryDomain", "engagement": "high"|"medium"|"low", "reasoning" }] }`;

const platformPreferences: Record<string, string[]> = {
  linkedin: ['contrarian', 'hidden_connection', 'career_impact', 'prediction'],
  twitter: ['practical', 'contrarian', 'david_vs_goliath', 'unraveling'],
  instagram: ['practical', 'hidden_connection', 'david_vs_goliath'],
  youtube: ['unraveling', 'historical_parallel', 'prediction', 'practical'],
};

const engagementScore: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function buildUserPrompt(brief: ResearchBrief, platform: Platform): string {
  const findings = brief.topFindings
    .map((f, i) => `[${i}] (${f.importance}) ${f.headline}: ${f.detail}`)
    .join('\n');

  const connections = brief.connections
    .map(c => `- ${c.findingA.headline} <-> ${c.findingB.headline}: ${c.relationship} — "${c.narrativeHook}"`)
    .join('\n');

  const agents = brief.coverage.agents.join(', ');

  return `## Research Brief for Signal: "${brief.signal.title}"

### Findings (reference by index):
${findings}

### Cross-domain Connections:
${connections || 'None identified'}

### Unusual Fact:
${brief.unusualFact || 'None'}

### Coverage:
Agents used: ${agents} (${brief.coverage.succeeded}/${brief.coverage.dispatched} succeeded)

### Target Platform: ${platform}

Generate 5 diverse angles optimized for ${platform}.`;
}

export async function generateAngles(
  brief: ResearchBrief,
  platform: Platform,
  llm: LLMClient,
): Promise<AngleCard[]> {
  const result = await llm.generateJSON<{ angles: RawAngle[] }>({
    systemPrompt: ANGLE_GENERATOR_SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(brief, platform),
  });

  return result.angles.map((raw) => ({
    id: randomUUID(),
    researchBriefId: brief.id,
    angleType: raw.type,
    hook: raw.hook,
    thesis: raw.thesis,
    // Fix 15 (CRITICAL): Filter findingRefs with bounds check before mapping
    supportingFindings: raw.findingRefs
      .filter(ref => ref >= 0 && ref < brief.topFindings.length)
      .map(ref => brief.topFindings[ref]),
    domainSource: raw.primaryDomain,
    estimatedEngagement: raw.engagement,
    reasoning: raw.reasoning,
    status: 'generated' as const,
    createdAt: new Date(),
  }));
}

export function autoSelectAngle(angles: AngleCard[], platform: Platform): AngleCard {
  const prefs = platformPreferences[platform] ?? [];

  const sorted = [...angles].sort((a, b) => {
    // Primary sort: engagement score (descending)
    const engDiff = (engagementScore[b.estimatedEngagement] ?? 0)
      - (engagementScore[a.estimatedEngagement] ?? 0);
    if (engDiff !== 0) return engDiff;

    // Tiebreaker: platform preference index (lower index = more preferred)
    const aIdx = prefs.indexOf(a.angleType);
    const bIdx = prefs.indexOf(b.angleType);
    // Types not in prefs list get a high index (least preferred)
    const aRank = aIdx === -1 ? prefs.length : aIdx;
    const bRank = bIdx === -1 ? prefs.length : bIdx;
    return aRank - bRank;
  });

  return sorted[0];
}
