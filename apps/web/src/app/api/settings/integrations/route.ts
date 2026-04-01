import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('config_type', 'api_key')
      .order('service', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ integrations: data ?? [] });
  } catch { return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { service, config, is_active } = await request.json();
    if (!service) return NextResponse.json({ error: 'service is required' }, { status: 400 });
    const { data, error } = await supabase
      .from('integration_configs')
      .upsert({ service, config, is_active, config_type: 'api_key' }, { onConflict: 'service' })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ integration: data });
  } catch { return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 }); }
}
