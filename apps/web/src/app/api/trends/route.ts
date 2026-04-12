import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function GET() {
  try {
    const supabase = await createClient();

    // Fetch active trend entities
    const { data: entities, error: entitiesError } = await supabase
      .from('trend_entities')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (entitiesError) {
      return NextResponse.json({ error: entitiesError.message }, { status: 500 });
    }

    if (!entities || entities.length === 0) {
      return NextResponse.json({ entities: [] });
    }

    // Fetch latest analysis for each entity
    const entityIds = entities.map((e: any) => e.id);
    const { data: analyses, error: analysesError } = await supabase
      .from('trend_analyses')
      .select('entity_id, phase, velocity, acceleration, signal, chart_data, analyzed_at')
      .in('entity_id', entityIds);

    if (analysesError) {
      return NextResponse.json({ error: analysesError.message }, { status: 500 });
    }

    // Merge analyses into entities
    const analysisMap = new Map(
      (analyses ?? []).map((a: any) => [a.entity_id, a]),
    );

    const merged = entities.map((entity: any) => {
      const analysis = analysisMap.get(entity.id);
      return {
        ...entity,
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
      };
    });

    return NextResponse.json({ entities: merged });
  } catch (error) {
    console.error('[trends] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trends' },
      { status: 500 },
    );
  }
}
