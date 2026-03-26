'use client';

import { PILLARS, PIPELINES } from '@influenceai/core';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { PipelineStatusCard } from '@/components/dashboard/pipeline-status-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Workflow, CheckCircle, Eye } from 'lucide-react';
import { getPillarColor } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// --- Mock Data ---

const engagementData = Array.from({ length: 14 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (13 - i));
  const base = 800 + i * 60 + Math.floor(Math.random() * 200);
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    views: base + Math.floor(Math.random() * 400),
    likes: Math.floor(base * 0.12) + Math.floor(Math.random() * 30),
    comments: Math.floor(base * 0.03) + Math.floor(Math.random() * 10),
  };
});

const pillarContentCounts = [
  { slug: 'breaking-ai-news', count: 34 },
  { slug: 'reshared-posts', count: 28 },
  { slug: 'strategy-career', count: 12 },
  { slug: 'live-demos', count: 8 },
  { slug: 'hype-detector', count: 15 },
  { slug: 'inside-the-machine', count: 10 },
  { slug: 'failure-lab', count: 6 },
];

const pipelineStatuses: { slug: string; status: 'idle' | 'running' | 'success' | 'failed'; lastRunAt: string }[] = [
  { slug: 'github-trends', status: 'success', lastRunAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  { slug: 'signal-amplifier', status: 'running', lastRunAt: new Date(Date.now() - 15 * 60000).toISOString() },
  { slug: 'release-radar', status: 'failed', lastRunAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { slug: 'youtube-series', status: 'idle', lastRunAt: new Date(Date.now() - 48 * 3600000).toISOString() },
  { slug: 'weekly-strategy', status: 'success', lastRunAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  { slug: 'auto-podcast', status: 'idle', lastRunAt: new Date(Date.now() - 72 * 3600000).toISOString() },
  { slug: 'infographic-factory', status: 'success', lastRunAt: new Date(Date.now() - 6 * 3600000).toISOString() },
  { slug: 'digital-twin', status: 'success', lastRunAt: new Date(Date.now() - 8 * 3600000).toISOString() },
];

// --- Custom Tooltip ---

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
      <p className="mb-2 text-xs font-medium text-zinc-400">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-300">{entry.name}:</span>
          <span className="font-medium text-zinc-50">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// --- Page ---

export default function CommandCenterPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Command Center</h1>
        <p className="mt-1 text-zinc-400">Your AI content operation at a glance</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Content This Week" value="23" change="+18% from last week" changeType="positive" icon={FileText} />
        <StatsCard title="Pipeline Runs Today" value="7" change="+3 from yesterday" changeType="neutral" icon={Workflow} />
        <StatsCard title="Pending Review" value="5" change="-2 from yesterday" changeType="positive" icon={CheckCircle} />
        <StatsCard title="Total Reach (30d)" value="124.5K" change="+32% from last month" changeType="positive" icon={Eye} />
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Engagement Chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Engagement Overview</CardTitle>
            <p className="text-sm text-zinc-400">Last 14 days across all platforms</p>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={engagementData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLikes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradComments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#71717a' }} stroke="#27272a" />
                  <YAxis tick={{ fontSize: 12, fill: '#71717a' }} stroke="#27272a" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="views" stroke="#3b82f6" fill="url(#gradViews)" strokeWidth={2} name="Views" />
                  <Area type="monotone" dataKey="likes" stroke="#8b5cf6" fill="url(#gradLikes)" strokeWidth={2} name="Likes" />
                  <Area type="monotone" dataKey="comments" stroke="#10b981" fill="url(#gradComments)" strokeWidth={2} name="Comments" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Content by Pillar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Content by Pillar</CardTitle>
            <p className="text-sm text-zinc-400">Total pieces created</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PILLARS.map((pillar) => {
                const count = pillarContentCounts.find((p) => p.slug === pillar.slug)?.count ?? 0;
                const max = Math.max(...pillarContentCounts.map((p) => p.count));
                return (
                  <div key={pillar.slug} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-300 truncate max-w-[180px]">{pillar.name.split(' \u2192')[0]}</span>
                      <span className="text-sm font-medium text-zinc-50">{count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pillar.color === 'blue' ? 'bg-blue-500' :
                          pillar.color === 'violet' ? 'bg-violet-500' :
                          pillar.color === 'amber' ? 'bg-amber-500' :
                          pillar.color === 'emerald' ? 'bg-emerald-500' :
                          pillar.color === 'red' ? 'bg-red-500' :
                          pillar.color === 'indigo' ? 'bg-indigo-500' :
                          pillar.color === 'orange' ? 'bg-orange-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Pipelines */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-zinc-50">Active Pipelines</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PIPELINES.map((pipeline) => {
            const pStatus = pipelineStatuses.find((s) => s.slug === pipeline.slug);
            return (
              <PipelineStatusCard
                key={pipeline.slug}
                pipeline={pipeline}
                status={pStatus?.status ?? 'idle'}
                lastRunAt={pStatus?.lastRunAt}
              />
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <ActivityFeed />
    </div>
  );
}
