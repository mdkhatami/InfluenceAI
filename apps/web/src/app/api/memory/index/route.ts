import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { indexContentItem, batchIndexContent } from '@influenceai/memory';

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contentItemId, batch, limit } = body as {
      contentItemId?: string;
      batch?: boolean;
      limit?: number;
    };

    const supabase = await createClient();
    const llm = LLMClient.fromEnv();

    if (contentItemId) {
      const entry = await indexContentItem(supabase, llm, contentItemId);
      return NextResponse.json({
        indexed: 1,
        contentItemId: entry.content_item_id,
      });
    }

    if (batch) {
      const result = await batchIndexContent(supabase, llm, limit ?? 50);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Provide contentItemId or batch: true' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[memory/index] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Indexing failed' },
      { status: 500 },
    );
  }
}
