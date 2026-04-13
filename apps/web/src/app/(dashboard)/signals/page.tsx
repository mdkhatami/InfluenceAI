export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { SignalCard } from '@/components/dashboard/signals/signal-card';
import { Inbox } from 'lucide-react';

interface SearchParams {
  source?: string;
  minScore?: string;
}

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

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
    .order('ingested_at', { ascending: false })
    .limit(50);

  if (params.source) {
    query = query.eq('source_type', params.source);
  }

  if (params.minScore) {
    query = query.gte('scored_relevance', parseFloat(params.minScore));
  }

  const { data: signals } = await query;

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
      <div className="flex gap-3">
        <select
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
          defaultValue={params.source || ''}
        >
          <option value="">All Sources</option>
          <option value="github">GitHub</option>
          <option value="rss">RSS</option>
          <option value="hackernews">HackerNews</option>
          <option value="arxiv">ArXiv</option>
        </select>

        <select
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
          defaultValue={params.minScore || '0'}
        >
          <option value="0">All Scores</option>
          <option value="3">3+</option>
          <option value="5">5+</option>
          <option value="7">7+</option>
        </select>
      </div>

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
        <div className="space-y-3">
          {signalsWithBriefs.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}
