export const dynamic = 'force-dynamic';

import { getAnalyticsStats, getContentTrends } from '@/lib/queries/analytics';
import { getPipelineSuccessRate } from '@/lib/queries/pipelines';
import { PILLARS } from '@influenceai/core';
import { AnalyticsCharts, type AnalyticsData } from './analytics-charts';

const platformColorMap: Record<string, string> = {
  linkedin: '#3b82f6',
  instagram: '#e879f9',
  youtube: '#ef4444',
  twitter: '#71717a',
};

const platformLabel: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter',
};

export default async function AnalyticsPage() {
  let stats: Awaited<ReturnType<typeof getAnalyticsStats>> = {
    totalItems: 0,
    approvedCount: 0,
    approvalRate: 0,
    totalTokens: 0,
    avgQuality: 0,
    byPlatform: {},
    byPillar: {},
  };
  let trends: Awaited<ReturnType<typeof getContentTrends>> = [];
  let pipelineSuccessRate = 0;

  try {
    [stats, trends, pipelineSuccessRate] = await Promise.all([
      getAnalyticsStats(30),
      getContentTrends(30),
      getPipelineSuccessRate(),
    ]);
  } catch (error) {
    console.error('Failed to fetch analytics data:', error);
  }

  // Transform byPlatform into pie chart data (percentages)
  const totalPlatformItems = Object.values(stats.byPlatform).reduce((a, b) => a + b, 0);
  const platformData = Object.entries(stats.byPlatform)
    .map(([key, count]) => ({
      name: platformLabel[key] ?? key,
      value: totalPlatformItems > 0 ? Math.round((count / totalPlatformItems) * 100) : 0,
      color: platformColorMap[key] ?? '#71717a',
    }))
    .sort((a, b) => b.value - a.value);

  // Transform byPillar into bar chart data, mapped through PILLARS for names/colors
  const pillarBreakdown = PILLARS
    .map((p) => ({
      name: p.name.split(' \u2192')[0].split(':')[0],
      count: stats.byPillar[p.slug] ?? 0,
      color: p.color,
    }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);

  const data: AnalyticsData = {
    stats,
    trends,
    pillarBreakdown,
    platformData,
    pipelineSuccessRate,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Analytics</h1>
        <p className="mt-1 text-zinc-400">Track your content performance across platforms</p>
      </div>

      <AnalyticsCharts data={data} />
    </div>
  );
}
