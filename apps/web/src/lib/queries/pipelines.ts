import { createClient } from '@/lib/supabase/server';

export async function getPipelineRunsToday() {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('pipeline_runs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function getLastRunPerPipeline() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const lastRuns: Record<string, (typeof data)[number]> = {};
  for (const run of data ?? []) {
    const slug = run.pipeline_slug ?? run.pipeline_id;
    if (!lastRuns[slug]) lastRuns[slug] = run;
  }
  return lastRuns;
}

export async function getRecentPipelineRuns(limit: number = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPipelineSuccessRate() {
  const supabase = await createClient();
  const [total, success] = await Promise.all([
    supabase.from('pipeline_runs').select('id', { count: 'exact', head: true }),
    supabase.from('pipeline_runs').select('id', { count: 'exact', head: true }).in('status', ['completed', 'partial_success']),
  ]);
  const t = total.count ?? 0;
  const s = success.count ?? 0;
  return t > 0 ? Math.round((s / t) * 100) : 0;
}

export async function getPipelineStats() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('pipeline_runs').select('items_generated, status');
  if (error) throw error;

  let totalGenerated = 0;
  let successCount = 0;
  const totalRuns = data?.length ?? 0;

  for (const run of data ?? []) {
    totalGenerated += run.items_generated ?? 0;
    if (run.status === 'completed' || run.status === 'partial_success') successCount++;
  }

  return {
    totalGenerated,
    totalRuns,
    successRate: totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0,
  };
}

export async function getPipelineLogs(runId: string, limit: number = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_logs')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
