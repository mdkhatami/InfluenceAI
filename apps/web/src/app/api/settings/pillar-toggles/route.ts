import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('integration_configs')
      .select('service, is_active')
      .eq('config_type', 'pillar_toggle');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const toggles: Record<string, boolean> = {};
    for (const row of data ?? []) toggles[row.service] = row.is_active;
    return NextResponse.json({ toggles });
  } catch { return NextResponse.json({ error: 'Failed to fetch pillar toggles' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { slug, enabled } = await request.json();
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    const { data, error } = await supabase
      .from('integration_configs')
      .upsert({ service: slug, is_active: enabled, config_type: 'pillar_toggle', config: {} }, { onConflict: 'service' })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ toggle: { slug: data.service, enabled: data.is_active } });
  } catch { return NextResponse.json({ error: 'Failed to update pillar toggle' }, { status: 500 }); }
}
