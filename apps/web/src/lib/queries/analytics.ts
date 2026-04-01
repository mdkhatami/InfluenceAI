import { createClient } from '@/lib/supabase/server';

export async function getAnalyticsStats(days: number = 30) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('content_items')
    .select('platform, pillar_slug, quality_score, token_usage, status, created_at')
    .gte('created_at', since.toISOString());

  if (error) throw error;
  const items = data ?? [];

  const byPlatform: Record<string, number> = {};
  const byPillar: Record<string, number> = {};
  let totalTokens = 0;
  let approvedCount = 0;
  let qualitySum = 0;
  let qualityCount = 0;

  for (const item of items) {
    byPlatform[item.platform] = (byPlatform[item.platform] ?? 0) + 1;
    byPillar[item.pillar_slug] = (byPillar[item.pillar_slug] ?? 0) + 1;
    if (item.token_usage) {
      const usage = item.token_usage as { totalTokens?: number };
      totalTokens += usage.totalTokens ?? 0;
    }
    if (['approved', 'published', 'scheduled'].includes(item.status)) approvedCount++;
    if (item.quality_score !== null) {
      qualitySum += item.quality_score;
      qualityCount++;
    }
  }

  return {
    totalItems: items.length,
    approvedCount,
    approvalRate: items.length > 0 ? Math.round((approvedCount / items.length) * 100) : 0,
    totalTokens,
    avgQuality: qualityCount > 0 ? Math.round((qualitySum / qualityCount) * 100) / 100 : 0,
    byPlatform,
    byPillar,
  };
}

export async function getContentTrends(days: number = 30) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('content_items')
    .select('created_at, status, quality_score')
    .gte('created_at', since.toISOString())
    .order('created_at');

  if (error) throw error;

  const dailyStats: Record<string, { total: number; approved: number; avgQuality: number; qualityCount: number }> = {};
  for (const item of data ?? []) {
    const day = new Date(item.created_at).toISOString().split('T')[0];
    if (!dailyStats[day]) dailyStats[day] = { total: 0, approved: 0, avgQuality: 0, qualityCount: 0 };
    dailyStats[day].total++;
    if (['approved', 'published', 'scheduled'].includes(item.status)) dailyStats[day].approved++;
    if (item.quality_score !== null) {
      dailyStats[day].avgQuality += item.quality_score;
      dailyStats[day].qualityCount++;
    }
  }

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    const stats = dailyStats[key] ?? { total: 0, approved: 0, avgQuality: 0, qualityCount: 0 };
    result.push({
      date: key,
      total: stats.total,
      approved: stats.approved,
      avgQuality: stats.qualityCount > 0 ? Math.round((stats.avgQuality / stats.qualityCount) * 100) / 100 : 0,
    });
  }
  return result;
}
