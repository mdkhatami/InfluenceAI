'use client';

import { useState } from 'react';
import { PILLARS } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsCard } from '@/components/dashboard/stats-card';
import { cn, getPillarColor, formatNumber } from '@/lib/utils';
import { Eye, TrendingUp, UserPlus, Zap } from 'lucide-react';
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

// --- Mock Data ---

const ranges = ['7d', '30d', '90d'] as const;

const dailyImpressions = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    impressions: 20000 + i * 800 + Math.floor(Math.random() * 5000),
  };
});

const platformData = [
  { name: 'LinkedIn', value: 45, color: '#3b82f6' },
  { name: 'Instagram', value: 30, color: '#e879f9' },
  { name: 'YouTube', value: 20, color: '#ef4444' },
  { name: 'Twitter', value: 5, color: '#71717a' },
];

const topContent = [
  { title: '3 AI repos blowing up on GitHub right now', platform: 'LinkedIn', views: 45200, likes: 1240, rate: '4.8%' },
  { title: 'I tested 5 "GPT killers" — only 1 delivered', platform: 'LinkedIn', views: 38900, likes: 980, rate: '5.2%' },
  { title: 'OpenAI\'s new org chart tells us everything', platform: 'LinkedIn', views: 31400, likes: 870, rate: '4.1%' },
  { title: 'The AI framework nobody expected', platform: 'Instagram', views: 28700, likes: 2100, rate: '7.3%' },
  { title: 'I spent 3 days building an AI agent — it failed', platform: 'YouTube', views: 22100, likes: 1650, rate: '6.1%' },
];

const pillarPerformance = PILLARS.map((p) => ({
  name: p.name.split(' →')[0].split(':')[0],
  engagement: Math.floor(Math.random() * 50000) + 10000,
  color: p.color,
})).sort((a, b) => b.engagement - a.engagement);

const pillarColorMap: Record<string, string> = {
  blue: '#3b82f6',
  violet: '#8b5cf6',
  amber: '#f59e0b',
  emerald: '#10b981',
  red: '#ef4444',
  indigo: '#6366f1',
  orange: '#f97316',
};

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

export default function AnalyticsPage() {
  const [range, setRange] = useState<typeof ranges[number]>('30d');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Analytics</h1>
          <p className="mt-1 text-zinc-400">Track your content performance across platforms</p>
        </div>
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                range === r
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Impressions" value="847K" change="+24% from last period" changeType="positive" icon={Eye} />
        <StatsCard title="Engagement Rate" value="4.2%" change="+0.3% improvement" changeType="positive" icon={TrendingUp} />
        <StatsCard title="Followers Gained" value="+1,247" change="+18% growth" changeType="positive" icon={UserPlus} />
        <StatsCard title="Best Pillar" value="Breaking News" change="Highest engagement" changeType="neutral" icon={Zap} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Impressions Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Impressions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyImpressions}>
                  <defs>
                    <linearGradient id="gradImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#71717a' }} stroke="#27272a" interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: '#71717a' }} stroke="#27272a" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="impressions" stroke="#3b82f6" fill="url(#gradImpressions)" strokeWidth={2} name="Impressions" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {/* Top Content */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Content</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Views</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Likes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Engagement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {topContent.map((item) => (
                  <tr key={item.title} className="transition hover:bg-zinc-800/50">
                    <td className="max-w-xs truncate px-6 py-4 text-sm font-medium text-zinc-200">{item.title}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Badge variant="secondary" className="text-xs">{item.platform}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{formatNumber(item.views)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{formatNumber(item.likes)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-emerald-400">{item.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pillar Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement by Pillar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pillarPerformance} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} stroke="#27272a" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#a1a1aa' }} stroke="#27272a" width={90} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="engagement" radius={[0, 4, 4, 0]} name="Engagement">
                  {pillarPerformance.map((entry) => (
                    <Cell key={entry.name} fill={pillarColorMap[entry.color] || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
