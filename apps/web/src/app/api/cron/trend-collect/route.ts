import { NextResponse } from 'next/server';
import { getServiceClient } from '@influenceai/database';
import { collectTrendData } from '@influenceai/memory';
import { verifyCronAuth } from '../_lib/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();
    const result = await collectTrendData(supabase);

    return NextResponse.json({
      pipeline: 'trend-collect',
      entitiesUpdated: result.entitiesUpdated,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[cron] trend-collect failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
