import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const pillar = searchParams.get('pillar') ?? undefined;
    const platform = searchParams.get('platform') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const supabase = await createClient();
    let query = supabase
      .from('content_items')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (pillar) query = query.eq('pillar_slug', pillar);
    if (platform) query = query.eq('platform', platform);
    if (search) query = query.ilike('title', `%${search}%`);
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [], total: count ?? 0 });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();

    const newItem = {
      ...body,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('content_items')
      .insert(newItem)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ content: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
  }
}
