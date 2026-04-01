import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const pillarId = searchParams.get('pillar_id');
    const platform = searchParams.get('platform');

    let query = supabase.from('prompt_templates').select('*')
      .order('pillar_id', { ascending: true })
      .order('platform', { ascending: true })
      .order('version', { ascending: false });

    if (pillarId) query = query.eq('pillar_id', pillarId);
    if (platform) query = query.eq('platform', platform);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ templates: data ?? [] });
  } catch { return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { pillar_id, platform, template_type, system_prompt, user_prompt_template, model_override } = await request.json();

    if (!pillar_id || !platform || !system_prompt || !user_prompt_template) {
      return NextResponse.json({ error: 'pillar_id, platform, system_prompt, and user_prompt_template are required' }, { status: 400 });
    }

    const type = template_type ?? 'generation';

    // Find current highest version
    const { data: existing } = await supabase
      .from('prompt_templates').select('version')
      .eq('pillar_id', pillar_id).eq('platform', platform).eq('template_type', type)
      .order('version', { ascending: false }).limit(1).single();

    const nextVersion = (existing?.version ?? 0) + 1;

    // Deactivate old versions
    await supabase.from('prompt_templates').update({ is_active: false })
      .eq('pillar_id', pillar_id).eq('platform', platform).eq('template_type', type);

    // Insert new version
    const { data, error } = await supabase.from('prompt_templates').insert({
      pillar_id, platform, template_type: type, system_prompt, user_prompt_template,
      model_override: model_override ?? null, version: nextVersion, is_active: true,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed to create template' }, { status: 500 }); }
}
