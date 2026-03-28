import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Map pipeline IDs to Trigger.dev task IDs
  const taskMap: Record<string, string> = {
    'github-trends': 'github-trends-pipeline',
  };

  const taskId = taskMap[id];
  if (!taskId) {
    return NextResponse.json(
      { error: `Unknown pipeline: ${id}` },
      { status: 404 },
    );
  }

  try {
    const handle = await tasks.trigger(taskId, {});

    return NextResponse.json({
      success: true,
      pipelineId: id,
      triggerRunId: handle.id,
      message: `Pipeline ${id} triggered successfully`,
    });
  } catch (error) {
    console.error(`Failed to trigger pipeline ${id}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger pipeline' },
      { status: 500 },
    );
  }
}
