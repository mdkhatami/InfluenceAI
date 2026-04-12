import { NextResponse } from 'next/server';
import { getServiceClient } from '@influenceai/database';
import { LLMClient } from '@influenceai/integrations';
import { collectTrendData, analyzeTrends, discoverNewEntities, detectCollisions } from '@influenceai/memory';
import { runPipeline, githubTrendsPipeline, signalAmplifierPipeline, releaseRadarPipeline } from '@influenceai/pipelines';
import { assembleDailyMenu, detectCallbacks } from '@/lib/queries/daily-menu';
import type { BatchResult } from '@/lib/types/daily-menu';
import { verifyCronAuth } from '../_lib/auth';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();
  const llm = LLMClient.fromEnv();
  const results: BatchResult = {
    startedAt: new Date(),
    steps: [],
  };

  try {
    // STEP 1: Run existing pipelines (best-effort each)
    for (const pipeline of [githubTrendsPipeline, signalAmplifierPipeline, releaseRadarPipeline]) {
      try {
        const result = await runPipeline(pipeline);
        results.steps.push({ name: `pipeline:${pipeline.id}`, status: result.status, items: result.itemsGenerated });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        results.steps.push({ name: `pipeline:${pipeline.id}`, status: 'failed', error: message });
      }
    }

    // STEP 2: Collect trend data
    try {
      const trendResult = await collectTrendData(db);
      results.steps.push({ name: 'trend-collect', entitiesUpdated: trendResult.entitiesUpdated, errors: trendResult.errors });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.steps.push({ name: 'trend-collect', status: 'failed', error: message });
    }

    // STEP 3: Analyze trends + discover entities
    try {
      const analyses = await analyzeTrends(db);
      const newEntities = await discoverNewEntities(db, llm);
      results.steps.push({ name: 'trend-analyze', analysesCount: analyses.length, newEntities: newEntities.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.steps.push({ name: 'trend-analyze', status: 'failed', error: message });
    }

    // STEP 4: Detect collisions
    try {
      const collisions = await detectCollisions(db, llm);
      results.steps.push({ name: 'collisions', count: collisions.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.steps.push({ name: 'collisions', status: 'failed', error: message });
    }

    // STEP 5: Detect callbacks (prediction resolutions)
    try {
      const callbacks = await detectCallbacks(db, llm);
      results.steps.push({ name: 'callbacks', count: callbacks.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.steps.push({ name: 'callbacks', status: 'failed', error: message });
    }

    // STEP 6: Assemble daily menu
    try {
      const menu = await assembleDailyMenu(db);
      results.steps.push({ name: 'menu', items: menu.items.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.steps.push({ name: 'menu', status: 'failed', error: message });
    }

    results.completedAt = new Date();
    results.status = 'completed';
  } catch (error: unknown) {
    results.status = 'failed';
    results.error = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(results);
}
