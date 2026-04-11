import { buildPrompt } from '@influenceai/integrations';
import type { ResearchBrief } from '@influenceai/intelligence';
import type { Platform } from '@influenceai/core';

export function buildPromptFromBrief(
  template: { systemPrompt: string; userPromptTemplate: string },
  brief: ResearchBrief,
  platform: Platform,
): { systemPrompt: string; userPrompt: string } {
  // Start with existing template variable replacement
  const { systemPrompt, userPrompt: baseUserPrompt } = buildPrompt(template, brief.signal, platform);

  let userPrompt = baseUserPrompt;

  // Append research findings
  userPrompt += '\n\n--- RESEARCH FINDINGS ---\n';
  userPrompt += brief.topFindings
    .map(f => `[${f.importance.toUpperCase()}] ${f.headline}: ${f.detail}`)
    .join('\n');

  if (brief.connections.length > 0) {
    userPrompt += '\n\n--- CROSS-DOMAIN CONNECTIONS ---\n';
    userPrompt += brief.connections.map(c => c.narrativeHook).join('\n');
  }

  userPrompt += `\n\nMost surprising finding (use as hook): ${brief.unusualFact}`;
  userPrompt += '\n\nIMPORTANT: Your post MUST cite at least 2 specific facts from the research findings above. Do not write generic commentary.';

  return { systemPrompt, userPrompt };
}
