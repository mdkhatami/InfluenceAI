import Link from 'next/link';
import { PIPELINES } from '@influenceai/core';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/stats-card';
import { PipelineTrigger } from '@/components/dashboard/pipeline-trigger';
import { cn, getAutomationColor, getRelativeTime } from '@/lib/utils';
import { getLastRunPerPipeline, getPipelineStats } from '@/lib/queries/pipelines';
import {
  GitBranch,
  Radio,
  Radar,
  Video,
  Target,
  Mic,
  LayoutGrid,
  UserCircle,
  Layers,
  Activity,
  CheckCircle,
  FileText,
  Settings,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitBranch, Radio, Radar, Video, Target, Mic, LayoutGrid, UserCircle,
};

const automationLabels: Record<string, string> = {
  high: 'High Automation',
  medium: 'Medium Automation',
  low: 'Low Automation',
  manual: 'Manual',
};

const statusDot: Record<string, string> = {
  idle: 'bg-zinc-500',
  running: 'bg-blue-400 animate-pulse',
  success: 'bg-emerald-400',
  failed: 'bg-red-400',
};

const statusLabel: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  success: 'Last run succeeded',
  failed: 'Last run failed',
};

function mapRunStatus(dbStatus?: string): 'idle' | 'running' | 'success' | 'failed' {
  if (!dbStatus) return 'idle';
  if (dbStatus === 'completed' || dbStatus === 'partial_success') return 'success';
  if (dbStatus === 'running') return 'running';
  if (dbStatus === 'failed') return 'failed';
  return 'idle';
}

export default async function PipelinesPage() {
  let lastRuns: Record<string, { status: string; created_at: string; started_at?: string }> = {};
  let pipelineStats = { totalRuns: 0, successRate: 0, totalGenerated: 0 };

  try {
    [lastRuns, pipelineStats] = await Promise.all([
      getLastRunPerPipeline(),
      getPipelineStats(),
    ]);
  } catch (e) {
    // Fallback to defaults on error
  }

  const activeToday = Object.values(lastRuns).filter((run) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(run.created_at).getTime() >= today.getTime();
  }).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Automation Pipelines</h1>
        <p className="mt-1 text-zinc-400">Manage your content generation workflows</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Pipelines" value={String(PIPELINES.length)} change="All configured" changeType="neutral" icon={Layers} />
        <StatsCard title="Active Today" value={String(activeToday)} change="Runs since midnight" changeType="neutral" icon={Activity} />
        <StatsCard title="Success Rate" value={pipelineStats.totalRuns > 0 ? `${pipelineStats.successRate}%` : '--'} change={`${pipelineStats.totalRuns} total runs`} changeType="neutral" icon={CheckCircle} />
        <StatsCard title="Content Generated" value={String(pipelineStats.totalGenerated)} change="All time" changeType="neutral" icon={FileText} />
      </div>

      {/* Pipeline Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {PIPELINES.map((pipeline) => {
          const Icon = iconMap[pipeline.icon] || GitBranch;
          const run = lastRuns[pipeline.slug];
          const status = mapRunStatus(run?.status);
          const lastRunAt = run?.started_at ?? run?.created_at;
          const isGithubTrends = pipeline.slug === 'github-trends';

          return (
            <Card
              key={pipeline.slug}
              className={cn(
                'flex flex-col transition-all duration-200 hover:border-zinc-700',
                isGithubTrends && 'border-blue-500/30 shadow-lg shadow-blue-500/5'
              )}
            >
              <CardContent className="flex-1 p-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'rounded-lg p-2',
                      isGithubTrends ? 'bg-blue-500/10' : 'bg-zinc-800'
                    )}>
                      <Icon className={cn('h-5 w-5', isGithubTrends ? 'text-blue-400' : 'text-zinc-400')} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-50">{pipeline.name}</h3>
                      <p className="text-xs text-zinc-500">{pipeline.outputVolume}</p>
                    </div>
                  </div>
                  <Badge className={cn('text-xs', getAutomationColor(pipeline.automationLevel))}>
                    {automationLabels[pipeline.automationLevel]}
                  </Badge>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-zinc-400 line-clamp-2">
                  {pipeline.description}
                </p>

                {/* Status */}
                <div className="mt-4 flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', statusDot[status])} />
                  <span className="text-xs text-zinc-400">{statusLabel[status]}</span>
                  {lastRunAt && (
                    <>
                      <span className="text-xs text-zinc-600">&middot;</span>
                      <span className="text-xs text-zinc-500">{getRelativeTime(lastRunAt)}</span>
                    </>
                  )}
                </div>

                {/* Steps Preview */}
                <div className="mt-4 flex items-center gap-1">
                  <span className="mr-2 text-xs text-zinc-500">{pipeline.steps.length} steps</span>
                  {pipeline.steps.map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        step.type === 'ingest' ? 'bg-blue-400' :
                        step.type === 'filter' ? 'bg-amber-400' :
                        step.type === 'generate' ? 'bg-violet-400' :
                        step.type === 'review' ? 'bg-orange-400' :
                        step.type === 'publish' ? 'bg-emerald-400' :
                        step.type === 'visual' ? 'bg-pink-400' :
                        step.type === 'audio_video' ? 'bg-indigo-400' : 'bg-zinc-500'
                      )}
                    />
                  ))}
                </div>
              </CardContent>

              <CardFooter className="gap-2 border-t border-zinc-800 px-6 py-4">
                {isGithubTrends ? (
                  <Link href="/pipelines/github-trends" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Settings className="mr-2 h-3 w-3" />
                      Configure
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" className="flex-1">
                    <Settings className="mr-2 h-3 w-3" />
                    Configure
                  </Button>
                )}
                <div className="flex-1">
                  <PipelineTrigger pipelineSlug={pipeline.slug} />
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
