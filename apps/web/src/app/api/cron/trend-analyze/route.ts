import { NextResponse } from 'next/server';
import { getServiceClient } from '@influenceai/database';
import { LLMClient } from '@influenceai/integrations';
import { analyzeTrends, discoverNewEntities } from '@influenceai/memory';
import { verifyCronAuth } from '../_lib/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const llm = LLMClient.fromEnv();

    const analyses = await analyzeTrends(supabase);
    const newEntities = await discoverNewEntities(supabase, llm);

    return NextResponse.json({
      pipeline: 'trend-analyze',
      analysesCount: analyses.length,
      newEntities: newEntities.length,
    });
  } catch (error) {
    console.error('[cron] trend-analyze failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
