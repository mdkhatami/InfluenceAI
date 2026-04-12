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
  await storeAngleCards(db, angleCards, brief.signalId);

  // 2. Select angle (user-chosen or auto)
  let selectedAngle: AngleCard;
  if (options.selectedAngleId) {
    const found = angleCards.find(a => a.id === options.selectedAngleId);
    if (!found) {
      selectedAngle = autoSelectAngle(angleCards, platform);
    } else {
      selectedAngle = found;
    }
  } else if (options.autoSelect) {
    selectedAngle = autoSelectAngle(angleCards, platform);
  } else {
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

/**
 * Generate a draft from a previously stored angle card (no angle regeneration).
 * Used by the draft API endpoint when the user has already selected an angle.
 */
export async function createDraftFromAngle(
  brief: ResearchBrief,
  angle: AngleCard,
  platform: Platform,
  db: any, // SupabaseClient
  llm: LLMClient,
): Promise<{ draft: import('./types').Draft; storyArc: import('./types').StoryArc }> {
  await updateAngleStatus(db, angle.id, 'selected');
  const storyArc = selectArc(angle, platform);
  const voiceProfile = await getCurrentVoiceProfile(db);
  const draft = await generateDraft(brief, angle, storyArc, platform, voiceProfile, llm);
  return { draft, storyArc };
}

async function storeAngleCards(db: any, angleCards: AngleCard[], signalId?: string): Promise<void> {
  const { error } = await db.from('angle_cards').insert(
    angleCards.map(a => ({
      id: a.id,
      research_brief_id: a.researchBriefId,
      signal_id: signalId || null,
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
  if (error) throw new Error(`Failed to store angle cards: ${error.message}`);
}

async function updateAngleStatus(db: any, angleId: string, status: string): Promise<void> {
  const { error } = await db.from('angle_cards').update({ status }).eq('id', angleId);
  if (error) throw new Error(`Failed to update angle status: ${error.message}`);
}
