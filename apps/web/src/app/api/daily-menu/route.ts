import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assembleDailyMenu } from '@/lib/queries/daily-menu';

export const maxDuration = 300;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_menus')
      .select('*')
      .eq('menu_date', today)
      .single();

    if (error || !data) {
      return NextResponse.json({ menu: null, message: 'No menu for today yet' });
    }

    return NextResponse.json({
      menu: {
        id: data.id,
        date: data.menu_date,
        generatedAt: data.generated_at,
        items: data.items,
        stats: data.stats,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch daily menu' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const menu = await assembleDailyMenu(supabase);
    return NextResponse.json({ menu });
  } catch (error) {
    console.error('[daily-menu] regeneration failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate menu' },
      { status: 500 },
    );
  }
}
