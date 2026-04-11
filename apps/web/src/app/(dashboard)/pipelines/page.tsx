export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, getRelativeTime } from '@/lib/utils';
import { PIPELINE_MAP } from '@influenceai/core';
import { getLastRunPerPipeline, getPipelineStats } from '@/lib/queries/pipelines';
import { PipelineTriggerButton } from '@/components/dashboard/pipeline-trigger-button';
import {
  GitBranch,
  Radio,
  Radar,
  ArrowRight,
  Clock,
  Zap,
  FileText,
  CheckCircle,
  XCircle,
  Timer,
} from 'lucide-react';

const IMPLEMENTED_SLUGS = ['github-trends', 'signal-amplifier', 'release-radar'] as const;

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitBranch,
  Radio,
  Radar,
};

const pipelineColors: Record<string, string> = {
  'github-trends': 'from-blue-500/20 to-blue-600/5',
  'signal-amplifier': 'from-violet-500/20 to-violet-600/5',
  'release-radar': 'from-amber-500/20 to-amber-600/5',
};

const pipelineIconColors: Record<string, string> = {
  'github-trends': 'text-blue-400 bg-blue-500/10',
  'signal-amplifier': 'text-violet-400 bg-violet-500/10',
  'release-radar': 'text-amber-400 bg-amber-500/10',
};

function parseCronToHuman(cron?: string): string {
  if (!cron) return 'On-demand';
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (hour.startsWith('*/')) {
      return `Every ${hour.slice(2)} hours`;
    }
    return `Daily at ${hour}:${minute.padStart(2, '0')} UTC`;
  }
  if (dayOfWeek !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[parseInt(dayOfWeek)] ?? dayOfWeek;
    return `${day} at ${hour}:${minute.padStart(2, '0')} UTC`;
  }
  return cron;
}

function mapRunStatus(dbStatus?: string): 'idle' | 'running' | 'success' | 'failed' {
  if (!dbStatus) return 'idle';
  if (dbStatus === 'completed' || dbStatus === 'partial_success') return 'success';
  if (dbStatus === 'running') return 'running';
  if (dbStatus === 'failed') return 'failed';
  return 'idle';
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  idle: { icon: Timer, color: 'text-zinc-500', label: 'Never run' },
  running: { icon: Zap, color: 'text-blue-400', label: 'Running' },
  success: { icon: CheckCircle, color: 'text-emerald-400', label: 'Succeeded' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Failed' },
};

export default async function PipelinesPage() {
  let lastRuns: Record<string, { status: string; created_at: string; items_generated?: number }> = {};
  let pipelineStats = { totalRuns: 0, successRate: 0, totalGenerated: 0 };

  try {
    [lastRuns, pipelineStats] = await Promise.all([
      getLastRunPerPipeline(),
      getPipelineStats(),
    ]);
  } catch {
    // Fallback to defaults on error
  }

  const pipelines = IMPLEMENTED_SLUGS.map((slug) => PIPELINE_MAP.get(slug)!).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Pipelines</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {pipelineStats.totalRuns} total runs &middot; {pipelineStats.successRate}% success rate &middot; {pipelineStats.totalGenerated} items generated
        </p>
      </div>

      {/* Pipeline Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {pipelines.map((pipeline) => {
          const Icon = iconMap[pipeline.icon] || GitBranch;
          const run = lastRuns[pipeline.slug];
          const status = mapRunStatus(run?.status);
          const StatusIcon = statusConfig[status].icon;
          const schedule = parseCronToHuman(pipeline.schedule);
          const iconColor = pipelineIconColors[pipeline.slug] ?? 'text-zinc-400 bg-zinc-800';
          const gradient = pipelineColors[pipeline.slug] ?? '';

          return (
            <Card
              key={pipeline.slug}
              className="flex flex-col overflow-hidden"
            >
              {/* Gradient accent bar */}
              <div className={cn('h-1 bg-gradient-to-r', gradient)} />

              <CardContent className="flex-1 p-6">
                {/* Icon + Name */}
                <div className="flex items-start gap-3">
                  <div className={cn('rounded-lg p-2.5', iconColor)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-50">{pipeline.name}</h3>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{schedule}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-zinc-400 line-clamp-2">
                  {pipeline.description}
                </p>

                {/* Last run status */}
                <div className="mt-4 flex items-center gap-2">
                  <StatusIcon className={cn('h-3.5 w-3.5', statusConfig[status].color)} />
                  <span className={cn('text-xs', statusConfig[status].color)}>
                    {statusConfig[status].label}
                  </span>
                  {run?.created_at && (
                    <>
                      <span className="text-xs text-zinc-600">&middot;</span>
                      <span className="text-xs text-zinc-500">{getRelativeTime(run.created_at)}</span>
                    </>
                  )}
                </div>

                {/* Items generated */}
                {run?.items_generated !== undefined && run.items_generated > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <FileText className="h-3 w-3 text-zinc-500" />
                    <span className="text-xs text-zinc-500">
                      {run.items_generated} item{run.items_generated !== 1 ? 's' : ''} last run
                    </span>
                  </div>
                )}
              </CardContent>

              <CardFooter className="gap-2 border-t border-zinc-800 px-6 py-4">
                <PipelineTriggerButton
                  pipelineSlug={pipeline.slug}
                  pipelineName={pipeline.name}
                  size="sm"
                  className="flex-1"
                />
                <Link href={`/pipelines/${pipeline.slug}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                    <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
