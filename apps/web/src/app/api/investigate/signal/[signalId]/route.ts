import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { dispatchSwarm, defaultSwarmConfig } from '@influenceai/intelligence';

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ signalId: string }> }
) {
  const { signalId } = await params;
  const supabase = await createClient();

  // Fetch signal from DB
  const { data: signal, error } = await supabase
    .from('content_signals').select('*').eq('id', signalId).single();
  if (error || !signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }

  // Check if already investigated
  const { data: existing } = await supabase
    .from('research_briefs').select('id').eq('signal_id', signalId).single();
  if (existing) {
    return NextResponse.json({ researchBriefId: existing.id, status: 'already_investigated' });
  }

  // Dispatch swarm — use signal.id (UUID from DB) not signal.external_id (Fix 2)
  const llm = LLMClient.fromEnv();
  const scoredSignal = {
    sourceType: signal.source as any,
    sourceId: signal.external_id,
    title: signal.title,
    summary: signal.summary || '',
    url: signal.url || '',
    metadata: signal.metadata || {},
    fetchedAt: new Date(signal.ingested_at),
    score: signal.score ?? 0,
  };
  const brief = await dispatchSwarm(
    scoredSignal, signal.id,
    { ...defaultSwarmConfig, triggerType: 'manual' },
    supabase, llm,
  );

  return NextResponse.json({
    researchBriefId: brief.id,
    status: brief.coverage.failed > 0 ? 'partial' : 'completed',
    coverage: brief.coverage,
  });
}
