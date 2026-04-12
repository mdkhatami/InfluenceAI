import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trackEdit } from '@influenceai/creation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('content_items')
      .select('*, content_signals(*)')
      .eq('id', id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Track edit if content changed
    if (body.title !== undefined || body.body !== undefined) {
      const { data: current } = await supabase
        .from('content_items')
        .select('title, body')
        .eq('id', id)
        .single();

      if (current) {
        const newTitle = body.title ?? current.title;
        const newBody = body.body ?? current.body;
        if (current.title !== newTitle || current.body !== newBody) {
          await trackEdit(supabase, id, current.title || '', current.body || '', newTitle || '', newBody || '');
        }
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) update.status = body.status;
    if (body.body !== undefined) update.body = body.body;
    if (body.title !== undefined) update.title = body.title;
    if (body.scheduledAt !== undefined) update.scheduled_at = body.scheduledAt;
    if (body.rejectionReason !== undefined) update.rejection_reason = body.rejectionReason;
    if (body.publishedAt !== undefined) update.published_at = body.publishedAt;

    const { data, error } = await supabase
      .from('content_items')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
