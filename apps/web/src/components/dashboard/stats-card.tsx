import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
}

export function StatsCard({ title, value, change, changeType, icon: Icon }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-zinc-400">{title}</p>
            <p className="text-2xl font-bold text-zinc-50">{value}</p>
          </div>
          <div className="rounded-lg bg-zinc-800 p-3">
            <Icon className="h-5 w-5 text-zinc-400" />
          </div>
        </div>
        <div className="mt-3">
          <span
            className={cn(
              'text-xs font-medium',
              changeType === 'positive' && 'text-emerald-400',
              changeType === 'negative' && 'text-red-400',
              changeType === 'neutral' && 'text-zinc-400'
            )}
          >
            {change}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
