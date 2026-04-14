export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { SignalCard } from '@/components/dashboard/signals/signal-card';
import { SignalFilters } from '@/components/dashboard/signals/signal-filters';
import { SignalPagination } from '@/components/dashboard/signals/signal-pagination';
import { Inbox } from 'lucide-react';

interface SearchParams {
  source?: string;
  minScore?: string;
  timeRange?: string;
  page?: string;
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Pagination
  const page = parseInt(params.page || '1', 10);
  const pageSize = 20; // Per spec
  const offset = (page - 1) * pageSize;

  // Build query
  let query = supabase
    .from('content_signals')
    .select(
      `
      id,
      source_type,
      source_id,
      title,
      summary,
      url,
      scored_relevance,
      ingested_at
    `,
    )
    .order('ingested_at', { ascending: false });

  // Apply filters
  if (params.source) {
    query = query.eq('source_type', params.source);
  }

  if (params.minScore) {
    query = query.gte('scored_relevance', parseFloat(params.minScore));
  }

  // Time range filter
  if (params.timeRange && params.timeRange !== 'all') {
    const now = new Date();
    let cutoff: Date;
    switch (params.timeRange) {
      case '24h':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = new Date(0); // All time
    }
    query = query.gte('ingested_at', cutoff.toISOString());
  }

  // Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data: signals } = await query;

  // Get total count for pagination
  let countQuery = supabase
    .from('content_signals')
    .select('*', { count: 'exact', head: true });

  if (params.source) {
    countQuery = countQuery.eq('source_type', params.source);
  }

  if (params.minScore) {
    countQuery = countQuery.gte('scored_relevance', parseFloat(params.minScore));
  }

  if (params.timeRange && params.timeRange !== 'all') {
    const now = new Date();
    let cutoff: Date;
    switch (params.timeRange) {
      case '24h':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoff = new Date(0);
    }
    countQuery = countQuery.gte('ingested_at', cutoff.toISOString());
  }

  const { count } = await countQuery;
  const totalPages = Math.ceil((count || 0) / pageSize);

  // Check which signals have research briefs
  const signalsWithBriefs = signals
    ? await Promise.all(
        signals.map(async (signal) => {
          const { data: brief } = await supabase
            .from('research_briefs')
            .select('id')
            .eq('signal_id', signal.id)
            .maybeSingle();
          return { ...signal, has_research_brief: !!brief };
        }),
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Signal Inbox</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Recent signals from all sources
        </p>
      </div>

      {/* Filters */}
      <SignalFilters />

      {/* Signal List */}
      {!signals || signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 py-16">
          <Inbox className="h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-400">
            No signals found
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Run a pipeline to ingest new signals
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {signalsWithBriefs.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>

          {/* Pagination */}
          <SignalPagination currentPage={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
