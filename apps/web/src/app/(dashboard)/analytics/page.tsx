export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAnalyticsStats, getContentTrends } from '@/lib/queries/analytics';
import { getPipelineStats } from '@/lib/queries/pipelines';
import {
  ContentVolumeChart,
  BreakdownBarChart,
} from '@/components/dashboard/analytics/analytics-charts';
import { PILLARS } from '@influenceai/core';
import { formatNumber } from '@/lib/utils';
import { FileText, CheckCircle2, Star, Coins } from 'lucide-react';

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

function pillarLabel(slug: string): string {
  return PILLARS.find((p) => p.slug === slug)?.name ?? slug;
}

export default async function AnalyticsPage() {
  let stats = {
    totalItems: 0,
    approvedCount: 0,
    approvalRate: 0,
    totalTokens: 0,
    avgQuality: 0,
    byPlatform: {} as Record<string, number>,
    byPillar: {} as Record<string, number>,
  };
  let trends: { date: string; total: number; approved: number; avgQuality: number }[] = [];
  let pipelineStats = { totalRuns: 0, successRate: 0, totalGenerated: 0 };

  try {
    [stats, trends, pipelineStats] = await Promise.all([
      getAnalyticsStats(30),
      getContentTrends(30),
      getPipelineStats(),
    ]);
  } catch {
    // Fall back to empty state on error
  }

  const platformData = Object.entries(stats.byPlatform)
    .map(([k, v]) => ({ name: PLATFORM_LABELS[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);

  const pillarData = Object.entries(stats.byPillar)
    .map(([k, v]) => ({ name: pillarLabel(k).split(' ')[0], value: v }))
    .sort((a, b) => b.value - a.value);

  const summaryCards = [
    {
      label: 'Content generated',
      value: formatNumber(stats.totalItems),
      sub: 'last 30 days',
      icon: FileText,
      color: 'text-violet-400',
    },
    {
      label: 'Approval rate',
      value: `${stats.approvalRate}%`,
      sub: `${stats.approvedCount} approved`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
    },
    {
      label: 'Avg quality',
      value: stats.avgQuality ? `${stats.avgQuality}/10` : '—',
      sub: 'self-assessed',
      icon: Star,
      color: 'text-amber-400',
    },
    {
      label: 'Tokens used',
      value: formatNumber(stats.totalTokens),
      sub: 'across generations',
      icon: Coins,
      color: 'text-blue-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Content production over the last 30 days &middot; {pipelineStats.totalRuns} pipeline runs
          &middot; {pipelineStats.successRate}% success rate
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-400">{c.label}</span>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </div>
                <p className="mt-2 text-2xl font-bold text-zinc-50">{c.value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{c.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Volume over time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ContentVolumeChart data={trends} />
        </CardContent>
      </Card>

      {/* Breakdown charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By platform</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownBarChart data={platformData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By pillar</CardTitle>
          </CardHeader>
          <CardContent>
            <BreakdownBarChart data={pillarData} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
