'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/dashboard/stats-card';
import { cn, formatNumber } from '@/lib/utils';
import { Eye, TrendingUp, CheckCircle, Zap } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
      <p className="mb-1 text-xs font-medium text-zinc-400">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span className="font-medium text-zinc-50">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

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

const pillarHexMap: Record<string, string> = {
  blue: '#3b82f6',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  emerald: '#10b981',
  red: '#ef4444',
  indigo: '#6366f1',
  orange: '#f97316',
};

export interface AnalyticsData {
  stats: {
    totalItems: number;
    approvedCount: number;
    approvalRate: number;
    totalTokens: number;
    avgQuality: number;
    byPlatform: Record<string, number>;
    byPillar: Record<string, number>;
  };
  trends: Array<{
    date: string;
    total: number;
    approved: number;
    avgQuality: number;
  }>;
  pillarBreakdown: Array<{
    name: string;
    count: number;
    color: string;
  }>;
  platformData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  pipelineSuccessRate: number;
}

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const { stats, trends, pillarBreakdown, platformData, pipelineSuccessRate } = data;

  // Format trends for chart — use short date label
  const chartTrends = trends.map((t) => ({
    ...t,
    dateLabel: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Find best pillar
  const bestPillar = pillarBreakdown.length > 0
    ? pillarBreakdown.reduce((a, b) => (a.count > b.count ? a : b))
    : null;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Content"
          value={formatNumber(stats.totalItems)}
          change={`${stats.approvalRate}% approval rate`}
          changeType={stats.approvalRate > 50 ? 'positive' : 'neutral'}
          icon={Eye}
        />
        <StatsCard
          title="Avg Quality Score"
          value={stats.avgQuality > 0 ? `${stats.avgQuality}/10` : 'N/A'}
          change={stats.avgQuality >= 7 ? 'Above target' : stats.avgQuality > 0 ? 'Below target' : 'No data'}
          changeType={stats.avgQuality >= 7 ? 'positive' : 'neutral'}
          icon={TrendingUp}
        />
        <StatsCard
          title="Pipeline Success"
          value={`${pipelineSuccessRate}%`}
          change={pipelineSuccessRate >= 80 ? 'Healthy' : 'Needs attention'}
          changeType={pipelineSuccessRate >= 80 ? 'positive' : 'negative'}
          icon={CheckCircle}
        />
        <StatsCard
          title="Best Pillar"
          value={bestPillar?.name ?? 'N/A'}
          change={bestPillar ? `${bestPillar.count} items` : 'No data'}
          changeType="neutral"
          icon={Zap}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Content Trends Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Content Production</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {chartTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartTrends}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#71717a' }} stroke="#27272a" interval={4} />
                    <YAxis tick={{ fontSize: 11, fill: '#71717a' }} stroke="#27272a" />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" fill="url(#gradTotal)" strokeWidth={2} name="Total" />
                    <Area type="monotone" dataKey="approved" stroke="#10b981" fill="transparent" strokeWidth={2} name="Approved" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-zinc-500">No trend data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length > 0 ? (
              <>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {platformData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {platformData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-zinc-300">{item.name}</span>
                      </div>
                      <span className="text-sm font-medium text-zinc-50">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-[200px] items-center justify-center">
                <p className="text-sm text-zinc-500">No platform data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pillar Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Content by Pillar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {pillarBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pillarBreakdown} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} stroke="#27272a" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#a1a1aa' }} stroke="#27272a" width={90} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Items">
                    {pillarBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={pillarHexMap[entry.color] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-zinc-500">No pillar data available</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
