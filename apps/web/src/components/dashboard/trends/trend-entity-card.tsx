'use client';

import { Button } from '@/components/ui/button';
import { PhaseBadge } from './phase-badge';
import { SignalBadge } from './signal-badge';

interface TrendEntityCardProps {
  trend: {
    id: string;
    name: string;
    type: string;
    phase?: string;
    signal?: string;
    velocity?: number;
  };
}

export function TrendEntityCard({ trend }: TrendEntityCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-50">{trend.name}</h3>
            <p className="text-xs text-zinc-500">{trend.type}</p>
          </div>

          <div className="flex items-center gap-2">
            {trend.phase && <PhaseBadge phase={trend.phase} />}
            {trend.signal && <SignalBadge signal={trend.signal} />}
            {trend.velocity !== undefined && (
              <span className="text-xs text-zinc-400">
                Velocity: {trend.velocity > 0 ? '+' : ''}{trend.velocity.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            View Detail
          </Button>
        </div>
      </div>
    </div>
  );
}
