import { Badge } from '@/components/ui/badge';
import type { DailyMenuStats } from '@/lib/types/daily-menu';

export function MenuHeader({ stats, date }: { stats: DailyMenuStats; date: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100">Today&apos;s Menu</h2>
          <p className="text-sm text-zinc-400 mt-1">
            {new Date(date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {stats.draftsReady > 0 && (
            <Badge variant="secondary">{stats.draftsReady} ready</Badge>
          )}
          {stats.trendAlerts > 0 && (
            <Badge variant="secondary">{stats.trendAlerts} trends</Badge>
          )}
          {stats.collisionsDetected > 0 && (
            <Badge variant="secondary">{stats.collisionsDetected} collisions</Badge>
          )}
          {stats.callbacksFound > 0 && (
            <Badge variant="secondary">{stats.callbacksFound} callbacks</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
