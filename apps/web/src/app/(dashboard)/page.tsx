import { PILLARS, PIPELINES } from '@influenceai/core';
import { StatsCard } from '@/components/dashboard/stats-card';
import { ActivityFeed } from '@/components/dashboard/activity-feed';
import { PipelineStatusCard } from '@/components/dashboard/pipeline-status-card';
import { EngagementChart } from '@/components/dashboard/engagement-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Workflow, CheckCircle, Eye } from 'lucide-react';
import { getContentStats, getContentPerDay, getContentByPillar, getRecentActivity } from '@/lib/queries/content';
import { getPipelineRunsToday, getLastRunPerPipeline } from '@/lib/queries/pipelines';

export default async function CommandCenterPage() {
  let stats = { contentThisWeek: 0, pendingReview: 0, totalPublished: 0 };
  let pipelineRunsToday = 0;
  let engagementData: { date: string; count: number }[] = [];
  let pillarCounts: Record<string, number> = {};
  let recentActivity: { id: string; title: string; pillar_slug: string; status: string; created_at: string }[] = [];
  let lastRuns: Record<string, { status: string; created_at: string }> = {};

  try {
    [stats, pipelineRunsToday, engagementData, pillarCounts, recentActivity, lastRuns] = await Promise.all([
      getContentStats(),
      getPipelineRunsToday(),
      getContentPerDay(14),
      getContentByPillar(),
      getRecentActivity(10),
      getLastRunPerPipeline(),
    ]);
  } catch (e) {
    // Fallback to defaults on error
  }

  const pillarContentCounts = PILLARS.map((p) => ({
    slug: p.slug,
    count: pillarCounts[p.slug] ?? 0,
  }));
  const maxPillarCount = Math.max(...pillarContentCounts.map((p) => p.count), 1);

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Command Center</h1>
        <p className="mt-1 text-zinc-400">Your AI content operation at a glance</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Content This Week" value={String(stats.contentThisWeek)} change="Created in the last 7 days" changeType="neutral" icon={FileText} />
        <StatsCard title="Pipeline Runs Today" value={String(pipelineRunsToday)} change="Runs since midnight" changeType="neutral" icon={Workflow} />
        <StatsCard title="Pending Review" value={String(stats.pendingReview)} change="Awaiting approval" changeType="neutral" icon={CheckCircle} />
        <StatsCard title="Total Published" value={String(stats.totalPublished)} change="All time" changeType="neutral" icon={Eye} />
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Engagement Chart */}
        <EngagementChart data={engagementData} />

        {/* Content by Pillar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Content by Pillar</CardTitle>
            <p className="text-sm text-zinc-400">Total pieces created</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {PILLARS.map((pillar) => {
                const count = pillarCounts[pillar.slug] ?? 0;
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
                        style={{ width: `${(count / maxPillarCount) * 100}%` }}
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
            const run = lastRuns[pipeline.slug];
            const status = run?.status === 'completed' || run?.status === 'partial_success'
              ? 'success'
              : run?.status === 'running'
              ? 'running'
              : run?.status === 'failed'
              ? 'failed'
              : 'idle';
            return (
              <PipelineStatusCard
                key={pipeline.slug}
                pipeline={pipeline}
                status={status as 'idle' | 'running' | 'success' | 'failed'}
                lastRunAt={run?.created_at}
              />
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <ActivityFeed items={recentActivity} />
    </div>
  );
}
