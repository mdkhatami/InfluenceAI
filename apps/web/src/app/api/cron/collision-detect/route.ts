import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LLMClient } from '@influenceai/integrations';
import { detectCollisions } from '@influenceai/memory';
import { verifyCronAuth } from '../_lib/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const llm = LLMClient.fromEnv();

    const collisions = await detectCollisions(supabase, llm);

    return NextResponse.json({
      pipeline: 'collision-detect',
      collisionsFound: collisions.length,
    });
  } catch (error) {
    console.error('[cron] collision-detect failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
