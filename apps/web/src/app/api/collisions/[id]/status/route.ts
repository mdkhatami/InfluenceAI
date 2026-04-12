import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: 'used' | 'dismissed' };

    if (!status || !['used', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "used" or "dismissed"' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('collisions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Collision not found' }, { status: 404 });
    }

    return NextResponse.json({ id: data.id, status: data.status });
  } catch (error) {
    console.error('[collisions/status] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update collision' },
      { status: 500 },
    );
  }
}
