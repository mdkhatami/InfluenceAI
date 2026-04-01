import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PREFERENCES_SERVICE = '_user_preferences';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('integration_configs')
      .select('config')
      .eq('service', PREFERENCES_SERVICE)
      .eq('config_type', 'user_preferences')
      .single();
    if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 });
    const defaults = { timezone: 'UTC', default_model: 'anthropic/claude-sonnet', notifications_enabled: false };
    return NextResponse.json({ preferences: data?.config ? { ...defaults, ...(data.config as Record<string, unknown>) } : defaults });
  } catch { return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { preferences } = await request.json();
    if (!preferences || typeof preferences !== 'object') return NextResponse.json({ error: 'preferences object is required' }, { status: 400 });
    const { data, error } = await supabase
      .from('integration_configs')
      .upsert({ service: PREFERENCES_SERVICE, config_type: 'user_preferences', config: preferences, is_active: true }, { onConflict: 'service' })
      .select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ preferences: data.config });
  } catch { return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 }); }
}
