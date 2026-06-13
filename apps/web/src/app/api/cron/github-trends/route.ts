import { NextResponse } from 'next/server';
import { runPipeline, githubTrendsPipeline } from '@influenceai/pipelines';
import { verifyCronAuth } from '../_lib/auth';
import { reportError } from '@/lib/logger';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runPipeline(githubTrendsPipeline);
    return NextResponse.json({
      pipeline: 'github-trends',
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (error) {
    await reportError('cron/github-trends', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pipeline failed' },
      { status: 500 },
    );
  }
}
