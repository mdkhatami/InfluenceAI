import { task, schedules } from '@trigger.dev/sdk/v3';
import { runPipeline } from '../engine/runner';
import { githubTrendsPipeline } from '../tasks/github-trends';

export const githubTrendsTask = task({
  id: 'github-trends-pipeline',
  retry: { maxAttempts: 2 },
  run: async () => {
    const result = await runPipeline(githubTrendsPipeline);

    return {
      status: result.status,
      signalsIngested: result.signalsIngested,
      signalsFiltered: result.signalsFiltered,
      itemsGenerated: result.itemsGenerated,
      errors: result.errors,
      durationMs: result.durationMs,
    };
  },
});

export const githubTrendsSchedule = schedules.task({
  id: 'github-trends-daily',
  task: githubTrendsTask.id,
  cron: '0 8 * * *',
});
