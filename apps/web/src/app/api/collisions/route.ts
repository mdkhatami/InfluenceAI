import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? 'detected';
    const limit = parseInt(searchParams.get('limit') ?? '10', 10);

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('collisions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      collisions: (data ?? []).map((c: any) => ({
        id: c.id,
        type: c.type,
        signalA: c.signal_a,
        signalB: c.signal_b,
        connectionNarrative: c.connection_narrative,
        storyPotential: c.story_potential,
        suggestedAngle: c.suggested_angle,
        status: c.status,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('[collisions] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collisions' },
      { status: 500 },
    );
  }
}
