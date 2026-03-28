import type { SupabaseClient } from '@supabase/supabase-js';
import type { Platform, ContentStatus } from '@influenceai/core';

export interface InsertContentItemParams {
  title: string;
  body: string;
  pillarSlug: string;
  pipelineSlug: string;
  platform: Platform;
  format: string;
  status: ContentStatus;
  signalId: string;
  pipelineRunId: string;
  promptTemplateId?: string;
  generationModel: string;
  qualityScore: number;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function insertContentItem(
  client: SupabaseClient,
  params: InsertContentItemParams,
): Promise<string> {
  const { data, error } = await client
    .from('content_items')
    .insert({
      title: params.title,
      body: params.body,
      pillar_slug: params.pillarSlug,
      pipeline_slug: params.pipelineSlug,
      platform: params.platform,
      format: params.format,
      status: params.status,
      signal_id: params.signalId,
      pipeline_run_id: params.pipelineRunId,
      prompt_template_id: params.promptTemplateId,
      generation_model: params.generationModel,
      quality_score: params.qualityScore,
      token_usage: params.tokenUsage,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to insert content item: ${error.message}`);
  return data!.id;
}

export async function updateContentStatus(
  client: SupabaseClient,
  itemId: string,
  status: ContentStatus,
  extra?: { rejectionReason?: string; replacedById?: string; scheduledAt?: string },
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (extra?.rejectionReason) update.rejection_reason = extra.rejectionReason;
  if (extra?.replacedById) update.replaced_by_id = extra.replacedById;
  if (extra?.scheduledAt) update.scheduled_at = extra.scheduledAt;

  const { error } = await client.from('content_items').update(update).eq('id', itemId);
  if (error) throw new Error(`Failed to update content item: ${error.message}`);
}
