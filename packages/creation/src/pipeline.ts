import type { LLMClient } from '@influenceai/integrations';
import type { Platform } from '@influenceai/core';
import type { ResearchBrief, AngleCard, CreationResult } from './types';
import { generateAngles, autoSelectAngle } from './angles/generator';
import { selectArc } from './storytelling/arcs';
import { generateDraft } from './storytelling/engine';
import { getCurrentVoiceProfile } from './voice/analyzer';

export async function createContent(
  brief: ResearchBrief,
  platform: Platform,
  options: { selectedAngleId?: string; autoSelect?: boolean },
  db: any, // SupabaseClient
  llm: LLMClient,
): Promise<CreationResult> {
  // 1. Generate angle cards
  const angleCards = await generateAngles(brief, platform, llm);
  await storeAngleCards(db, angleCards);

  // 2. Select angle (user-chosen or auto)
  let selectedAngle: AngleCard;
  if (options.selectedAngleId) {
    const found = angleCards.find(a => a.id === options.selectedAngleId);
    if (!found) {
      // Fallback to auto-select if provided ID not found
      selectedAngle = autoSelectAngle(angleCards, platform);
    } else {
      selectedAngle = found;
    }
  } else if (options.autoSelect) {
    selectedAngle = autoSelectAngle(angleCards, platform);
  } else {
    // Return angle cards only — wait for user selection (interactive mode)
    return { phase: 'angles_only', angleCards };
  }

  await updateAngleStatus(db, selectedAngle.id, 'selected');

  // 3. Select story arc
  const storyArc = selectArc(selectedAngle, platform);

  // 4. Get voice profile (null if none exists yet)
  const voiceProfile = await getCurrentVoiceProfile(db);

  // 5. Generate draft
  const draft = await generateDraft(brief, selectedAngle, storyArc, platform, voiceProfile, llm);

  return { phase: 'complete', angleCards, selectedAngle, storyArc, draft };
}

async function storeAngleCards(db: any, angleCards: AngleCard[]): Promise<void> {
  await db.from('angle_cards').insert(
    angleCards.map(a => ({
      id: a.id,
      research_brief_id: a.researchBriefId,
      angle_type: a.angleType,
      hook: a.hook,
      thesis: a.thesis,
      supporting_findings: a.supportingFindings,
      domain_source: a.domainSource,
      estimated_engagement: a.estimatedEngagement,
      reasoning: a.reasoning,
      status: a.status,
    })),
  );
}

async function updateAngleStatus(db: any, angleId: string, status: string): Promise<void> {
  await db.from('angle_cards').update({ status }).eq('id', angleId);
}
