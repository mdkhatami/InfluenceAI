import type { SupabaseClient } from '@supabase/supabase-js';
import type { PipelineRunStatus as CorePipelineRunStatus } from '@influenceai/core';

export type PipelineRunStatus = CorePipelineRunStatus;

export async function createPipelineRun(
  client: SupabaseClient,
  params: { pipelineId: string; pipelineSlug: string; triggerTaskId?: string },
): Promise<string> {
  const { data, error } = await client
    .from('pipeline_runs')
    .insert({
      pipeline_slug: params.pipelineSlug,
      pipeline_id: params.pipelineId,
      status: 'running',
      trigger_task_id: params.triggerTaskId,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create pipeline run: ${error.message}`);
  return data!.id;
}

export async function completePipelineRun(
  client: SupabaseClient,
  runId: string,
  result: {
    status: PipelineRunStatus;
    signalsIngested: number;
    signalsFiltered: number;
    itemsGenerated: number;
    error?: string;
  },
): Promise<void> {
  const { error } = await client
    .from('pipeline_runs')
    .update({
      status: result.status,
      signals_ingested: result.signalsIngested,
      signals_filtered: result.signalsFiltered,
      items_generated: result.itemsGenerated,
      error: result.error,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  if (error) throw new Error(`Failed to complete pipeline run: ${error.message}`);
}

export async function logPipelineStep(
  client: SupabaseClient,
  runId: string,
  step: string,
  level: 'info' | 'warn' | 'error',
  message: string,
): Promise<void> {
  const { error } = await client
    .from('pipeline_logs')
    .insert({ run_id: runId, step, level, message });

  if (error) {
    console.error(`Failed to log pipeline step: ${error.message}`);
  }
}
