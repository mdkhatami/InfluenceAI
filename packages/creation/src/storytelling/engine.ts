import type { LLMClient } from '@influenceai/integrations';
import { PLATFORM_FORMATS } from '@influenceai/integrations';
import type { ResearchBrief, AngleCard, StoryArc, StoryPlan, Draft, VoiceProfile, Platform } from '../types';
import { buildVoiceInjection } from '../voice/injector';

export async function generateDraft(
  brief: ResearchBrief,
  angle: AngleCard,
  arc: StoryArc,
  platform: Platform,
  voiceProfile: VoiceProfile | null,
  llm: LLMClient,
): Promise<Draft> {
  // STEP 1: Generate story plan (fast, structured)
  const plan = await llm.generateJSON<StoryPlan>({
    systemPrompt: 'You are a content strategist. Create a beat-by-beat story plan.',
    userPrompt: `
Angle: ${angle.angleType}
Hook: ${angle.hook}
Thesis: ${angle.thesis}
Story arc: ${arc.name}
Platform: ${platform}

Beats to fill:
${arc.structure.map(b => `- ${b.name}: ${b.instruction} (max: ${b.maxLength})`).join('\n')}

Available findings:
${angle.supportingFindings.map(f => `[${f.importance}] ${f.headline}: ${f.detail}`).join('\n')}

For each beat, specify: which finding(s) to use, the key point to make, and any specific data/quotes to include.
`,
    maxTokens: 400,
    temperature: 0.4,
  });

  // STEP 2: Generate full draft from plan
  let systemPrompt = buildDraftSystemPrompt(platform, arc);

  // Inject Voice DNA if available and confident enough
  if (voiceProfile && voiceProfile.confidence >= 0.3) {
    systemPrompt += buildVoiceInjection(voiceProfile);
  }

  const result = await llm.generateWithQuality({
    systemPrompt,
    userPrompt: `
Write the full post following this exact plan:

ANGLE: ${angle.hook}
THESIS: ${angle.thesis}

STORY PLAN:
${plan.beats.map(b => `[${b.beatName}]: ${b.content} — Use: ${b.findings}`).join('\n')}

RESEARCH DATA (cite specific facts):
${brief.topFindings.map(f => `- ${f.headline}: ${f.detail}`).join('\n')}

Write the complete post now. Follow the beat structure exactly. Cite specific numbers and facts from the research data. Do NOT use generic filler.
`,
    maxTokens: 1500,
    temperature: 0.7,
  });

  return {
    title: extractTitle(result.content),
    body: result.content,
    qualityScore: result.qualityScore,
    storyPlan: JSON.stringify(plan),
  };
}

function buildDraftSystemPrompt(platform: Platform, arc: StoryArc): string {
  const platformFormat = PLATFORM_FORMATS[platform] ?? '';
  return `You are writing a ${platform} post using the "${arc.name}" narrative structure.

${platformFormat}

NARRATIVE RULES:
- Follow the beat structure: ${arc.structure.map(b => b.name).join(' → ')}
- Every beat must earn the reader's attention for the next beat
- The hook must work as a standalone statement
- NEVER start with "I'm excited to share" or "In today's rapidly evolving landscape"
- Cite specific numbers, names, and facts
- End with something the reader will want to respond to
`;
}

function extractTitle(content: string): string {
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (!firstLine) return 'Untitled';
  // Truncate to 100 chars if needed
  return firstLine.trim().substring(0, 100);
}
