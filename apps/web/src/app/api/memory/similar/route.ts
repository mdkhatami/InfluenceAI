import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findSimilarContent } from '@influenceai/memory';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { embedding, threshold, limit } = body as {
      embedding: number[];
      threshold?: number;
      limit?: number;
    };

    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        { error: 'embedding array is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const results = await findSimilarContent(
      supabase,
      embedding,
      threshold ?? 0.8,
      limit ?? 5,
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[memory/similar] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 },
    );
  }
}
