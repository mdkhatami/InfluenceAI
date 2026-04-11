import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const supabase = await createClient();

  // Get investigation run
  const { data: run, error } = await supabase
    .from('investigation_runs').select('*').eq('id', runId).single();
  if (error || !run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  // Get agent briefs for this run
  const { data: briefs } = await supabase
    .from('agent_briefs').select('agent_id, status, confidence, created_at')
    .eq('investigation_run_id', runId);

  return NextResponse.json({
    runId: run.id,
    status: run.status,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    agents: (briefs || []).map(b => ({
      agentId: b.agent_id,
      status: b.status,
      confidence: b.confidence,
    })),
  });
}
