'use client';

import Link from 'next/link';
import { PIPELINES } from '@influenceai/core';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/stats-card';
import { cn, getAutomationColor, getRelativeTime } from '@/lib/utils';
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
  Play,
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

const pipelineRuntimeData: Record<string, { status: 'idle' | 'running' | 'success' | 'failed'; lastRunAt: string }> = {
  'github-trends': { status: 'success', lastRunAt: new Date(Date.now() - 2 * 3600000).toISOString() },
  'signal-amplifier': { status: 'running', lastRunAt: new Date(Date.now() - 10 * 60000).toISOString() },
  'release-radar': { status: 'failed', lastRunAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  'youtube-series': { status: 'idle', lastRunAt: new Date(Date.now() - 72 * 3600000).toISOString() },
  'weekly-strategy': { status: 'success', lastRunAt: new Date(Date.now() - 24 * 3600000).toISOString() },
  'auto-podcast': { status: 'success', lastRunAt: new Date(Date.now() - 48 * 3600000).toISOString() },
  'infographic-factory': { status: 'success', lastRunAt: new Date(Date.now() - 6 * 3600000).toISOString() },
  'digital-twin': { status: 'success', lastRunAt: new Date(Date.now() - 8 * 3600000).toISOString() },
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

export default function PipelinesPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Automation Pipelines</h1>
        <p className="mt-1 text-zinc-400">Manage your content generation workflows</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Pipelines" value="8" change="All configured" changeType="neutral" icon={Layers} />
        <StatsCard title="Active Today" value="5" change="+2 from yesterday" changeType="positive" icon={Activity} />
        <StatsCard title="Success Rate" value="94.2%" change="+1.3% this week" changeType="positive" icon={CheckCircle} />
        <StatsCard title="Content Generated" value="156" change="+23 this week" changeType="positive" icon={FileText} />
      </div>

      {/* Pipeline Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {PIPELINES.map((pipeline) => {
          const Icon = iconMap[pipeline.icon] || GitBranch;
          const runtime = pipelineRuntimeData[pipeline.slug];
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
                {runtime && (
                  <div className="mt-4 flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', statusDot[runtime.status])} />
                    <span className="text-xs text-zinc-400">{statusLabel[runtime.status]}</span>
                    <span className="text-xs text-zinc-600">&middot;</span>
                    <span className="text-xs text-zinc-500">{getRelativeTime(runtime.lastRunAt)}</span>
                  </div>
                )}

                {/* Steps Preview */}
                <div className="mt-4 flex items-center gap-1">
                  <span className="mr-2 text-xs text-zinc-500">{pipeline.steps.length} steps</span>
                  {pipeline.steps.map((step, i) => (
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
                <Button variant="secondary" size="sm" className="flex-1">
                  <Play className="mr-2 h-3 w-3" />
                  Run Now
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
