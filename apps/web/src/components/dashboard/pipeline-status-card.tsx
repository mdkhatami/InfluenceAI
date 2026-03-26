import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, getAutomationColor, getRelativeTime } from '@/lib/utils';
import type { PipelineConfig } from '@influenceai/core';
import {
  GitBranch,
  Radio,
  Radar,
  Video,
  Target,
  Mic,
  LayoutGrid,
  UserCircle,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  GitBranch,
  Radio,
  Radar,
  Video,
  Target,
  Mic,
  LayoutGrid,
  UserCircle,
};

interface PipelineStatusCardProps {
  pipeline: PipelineConfig;
  status?: 'idle' | 'running' | 'success' | 'failed';
  lastRunAt?: string;
}

const statusDot: Record<string, string> = {
  idle: 'bg-zinc-500',
  running: 'bg-blue-400 animate-pulse',
  success: 'bg-emerald-400',
  failed: 'bg-red-400',
};

const statusLabel: Record<string, string> = {
  idle: 'Idle',
  running: 'Running',
  success: 'Success',
  failed: 'Failed',
};

export function PipelineStatusCard({
  pipeline,
  status = 'idle',
  lastRunAt,
}: PipelineStatusCardProps) {
  const Icon = iconMap[pipeline.icon] || GitBranch;

  return (
    <Card className={cn(status === 'running' && 'border-blue-500/30')}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-zinc-800 p-2">
              <Icon className="h-4 w-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-50">{pipeline.name}</p>
              <p className="text-xs text-zinc-500">{pipeline.outputVolume}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', statusDot[status])} />
            <span className="text-xs text-zinc-400">{statusLabel[status]}</span>
          </div>
        </div>
        {lastRunAt && (
          <p className="mt-2 text-xs text-zinc-500">
            Last run: {getRelativeTime(lastRunAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
