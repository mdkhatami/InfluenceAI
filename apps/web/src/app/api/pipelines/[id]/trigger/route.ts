import { NextResponse } from 'next/server';
import {
  runPipeline,
  githubTrendsPipeline,
  signalAmplifierPipeline,
  releaseRadarPipeline,
} from '@influenceai/pipelines';
import type { PipelineDefinition } from '@influenceai/core';

const pipelineMap: Record<string, PipelineDefinition> = {
  'github-trends': githubTrendsPipeline,
  'signal-amplifier': signalAmplifierPipeline,
  'release-radar': releaseRadarPipeline,
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const pipeline = pipelineMap[id];
  if (!pipeline) {
    return NextResponse.json(
      { error: `Unknown pipeline: ${id}` },
      { status: 404 },
    );
  }

  try {
    const result = await runPipeline(pipeline);
    return NextResponse.json({
      success: true,
      runId: result.runId,
      pipelineId: id,
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    });
  } catch (error) {
    console.error(`[pipeline] trigger ${id} failed:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger pipeline' },
      { status: 500 },
    );
  }
}
