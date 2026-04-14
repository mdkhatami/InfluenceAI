import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ briefId: string }> }
) {
  const { briefId } = await params;
  const supabase = await createClient();

  const { data: brief, error } = await supabase
    .from('research_briefs')
    .select('top_findings, connections, unusual_fact, suggested_angles, coverage')
    .eq('id', briefId)
    .single();

  if (error || !brief) {
    return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
  }

  return NextResponse.json(brief);
}
