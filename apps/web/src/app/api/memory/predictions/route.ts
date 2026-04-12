import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findOpenPredictions } from '@influenceai/memory';

export const maxDuration = 300;

export async function GET() {
  try {
    const supabase = await createClient();
    const predictions = await findOpenPredictions(supabase);

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error('[memory/predictions] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 },
    );
  }
}
