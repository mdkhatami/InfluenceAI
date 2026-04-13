export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { TrendEntityCard } from '@/components/dashboard/trends/trend-entity-card';
import { TrendingUp } from 'lucide-react';

export default async function TrendsPage() {
  const supabase = await createClient();

  // Fetch trend entities with their latest analyses
  const { data: entities } = await supabase
    .from('trend_entities')
    .select(`
      id,
      name,
      type,
      tracking_since,
      trend_analyses (
        phase,
        velocity,
        signal,
        analyzed_at
      )
    `)
    .eq('is_active', true)
    .order('name');

  const trends = entities?.map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    phase: entity.trend_analyses?.[0]?.phase,
    velocity: entity.trend_analyses?.[0]?.velocity,
    signal: entity.trend_analyses?.[0]?.signal,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Trends</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Tracked entities with phase detection and content signals
        </p>
      </div>

      {/* Summary Stats */}
      {trends.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-zinc-400">Total: </span>
              <span className="font-medium text-zinc-50">{trends.length}</span>
            </div>
            <div>
              <span className="text-zinc-400">Accelerating: </span>
              <span className="font-medium text-green-400">
                {trends.filter((t) => t.phase === 'accelerating').length}
              </span>
            </div>
            <div>
              <span className="text-zinc-400">Peak: </span>
              <span className="font-medium text-amber-400">
                {trends.filter((t) => t.phase === 'peak').length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trend List */}
      {trends.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 py-16">
          <TrendingUp className="h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-400">No trends tracked yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Add entities to track via API or Settings
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trends.map((trend) => (
            <TrendEntityCard key={trend.id} trend={trend} />
          ))}
        </div>
      )}
    </div>
  );
}
