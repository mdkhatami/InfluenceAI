import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findByEntity } from '@influenceai/memory';

export const maxDuration = 300;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? undefined;

    const supabase = await createClient();
    const results = await findByEntity(supabase, decodeURIComponent(name), type);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[memory/entity] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 },
    );
  }
}
