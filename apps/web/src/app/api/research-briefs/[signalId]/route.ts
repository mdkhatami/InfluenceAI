import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ signalId: string }> }
) {
  const { signalId } = await params;
  const supabase = await createClient();

  const { data: brief, error } = await supabase
    .from('research_briefs').select('*').eq('signal_id', signalId).single();
  if (error || !brief) {
    return NextResponse.json({ error: 'Research brief not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: brief.id,
    signalId: brief.signal_id,
    signal: brief.signal_data,  // Fix 1: return stored signal
    topFindings: brief.top_findings,
    connections: brief.connections,
    suggestedAngles: brief.suggested_angles,
    unusualFact: brief.unusual_fact,
    coverage: brief.coverage,
    createdAt: brief.created_at,
    expiresAt: brief.expires_at,
  });
}
