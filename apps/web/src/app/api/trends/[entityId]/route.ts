import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const supabase = await createClient();

    // Fetch entity
    const { data: entity, error: entityError } = await supabase
      .from('trend_entities')
      .select('*')
      .eq('id', entityId)
      .single();

    if (entityError || !entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Fetch analysis
    const { data: analysis } = await supabase
      .from('trend_analyses')
      .select('*')
      .eq('entity_id', entityId)
      .single();

    // Fetch data points (last 12 weeks)
    const { data: dataPoints } = await supabase
      .from('trend_data_points')
      .select('*')
      .eq('entity_id', entityId)
      .order('measured_at', { ascending: true })
      .limit(84);

    return NextResponse.json({
      entity,
      analysis: analysis
        ? {
            phase: analysis.phase,
            velocity: analysis.velocity,
            acceleration: analysis.acceleration,
            signal: analysis.signal,
            chartData: analysis.chart_data,
            analyzedAt: analysis.analyzed_at,
          }
        : null,
      dataPoints: dataPoints ?? [],
    });
  } catch (error) {
    console.error('[trends/entity] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch entity trends' },
      { status: 500 },
    );
  }
}
