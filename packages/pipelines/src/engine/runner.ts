import type {
  PipelineDefinition,
  PipelineRunResult,
  PipelineRunStatus,
  ScoredSignal,
  Platform,
} from '@influenceai/core';
import {
  getServiceClient,
  createPipelineRun,
  completePipelineRun,
  logPipelineStep,
  findExistingHashes,
  upsertSignalWithScore,
  insertContentItem,
  getActiveTemplate,
  computeDedupeHash,
} from '@influenceai/database';
import { LLMClient, buildPrompt } from '@influenceai/integrations';
import { dispatchSwarm, defaultSwarmConfig } from '@influenceai/intelligence';
import type { ResearchBrief } from '@influenceai/intelligence';
import { deduplicateSignals } from './dedup';
import { scoreRelevance } from './relevance';
import { getPillar } from '@influenceai/core';
import { buildPromptFromBrief } from './brief-prompt';

export async function runPipeline(definition: PipelineDefinition): Promise<PipelineRunResult> {
  const startTime = Date.now();
  const db = getServiceClient();
  let runId: string;
  const errors: string[] = [];

  // Create pipeline run record
  try {
    runId = await createPipelineRun(db, {
      pipelineId: definition.id,
      pipelineSlug: definition.id,
    });
  } catch (err) {
    return {
      runId: '',
      pipelineId: definition.id,
      status: 'failed',
      signalsIngested: 0,
      signalsFiltered: 0,
      itemsGenerated: 0,
      errors: [`Failed to create run record: ${err}`],
      durationMs: Date.now() - startTime,
    };
  }

  let signalsIngested = 0;
  let signalsFiltered = 0;
  let itemsGenerated = 0;

  try {
    // STEP 1: INGEST
    await logPipelineStep(db, runId, 'ingest', 'info', 'Starting signal ingestion');
    const rawSignals = await definition.ingest({});
    signalsIngested = rawSignals.length;
    await logPipelineStep(db, runId, 'ingest', 'info', `Ingested ${rawSignals.length} signals`);

    // STEP 2: DEDUP
    const hashes = rawSignals.map((s) => computeDedupeHash(s));
    const existingHashes = await findExistingHashes(db, hashes);
    const newSignals = deduplicateSignals(rawSignals, existingHashes);
    await logPipelineStep(
      db,
      runId,
      'dedup',
      'info',
      `${newSignals.length} new signals after dedup (${rawSignals.length - newSignals.length} duplicates)`,
    );

    if (newSignals.length === 0) {
      await logPipelineStep(db, runId, 'dedup', 'info', 'No new signals — skipping generation');
      await completePipelineRun(db, runId, {
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
      });
      return {
        runId,
        pipelineId: definition.id,
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    // STEP 2.5: RELEVANCE SCORING
    const threshold = definition.relevanceThreshold ?? 3;
    const relevantSignals = scoreRelevance(newSignals, threshold);
    const droppedCount = newSignals.length - relevantSignals.length;
    if (droppedCount > 0) {
      await logPipelineStep(
        db,
        runId,
        'relevance',
        'warn',
        `Dropped ${droppedCount} signals below relevance threshold (${threshold})`,
      );
    }
    await logPipelineStep(
      db,
      runId,
      'relevance',
      'info',
      `${relevantSignals.length} signals passed relevance check (threshold: ${threshold})`,
    );

    if (relevantSignals.length === 0) {
      await logPipelineStep(db, runId, 'relevance', 'info', 'No relevant signals — skipping generation');
      await completePipelineRun(db, runId, {
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
      });
      return {
        runId,
        pipelineId: definition.id,
        status: 'completed',
        signalsIngested,
        signalsFiltered: 0,
        itemsGenerated: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    // STEP 3: FILTER
    await logPipelineStep(db, runId, 'filter', 'info', 'Starting signal filtering');
    const scoredSignals = await definition.filter(relevantSignals, {});
    const topSignals = scoredSignals.slice(0, definition.generate.topK);
    signalsFiltered = topSignals.length;
    await logPipelineStep(db, runId, 'filter', 'info', `Filtered to top ${topSignals.length} signals`);

    // STEP 4: GENERATE (per signal, per platform — sequential)
    await logPipelineStep(
      db,
      runId,
      'generate',
      'info',
      `Generating content for ${topSignals.length} signals x ${definition.platforms.length} platforms`,
    );

    const llm = definition.generate.model
      ? LLMClient.withModel(definition.generate.model)
      : LLMClient.fromEnv();

    const pillar = getPillar(definition.pillar);

    for (const signal of topSignals) {
      // Save signal to DB
      let signalId: string;
      try {
        signalId = await upsertSignalWithScore(db, signal, (signal as ScoredSignal).score ?? 0);
      } catch (err) {
        errors.push(`Failed to save signal ${signal.sourceId}: ${err}`);
        continue;
      }

      // Optional: dispatch investigation swarm for richer content
      let researchBrief: ResearchBrief | undefined;
      try {
        researchBrief = await dispatchSwarm(signal as ScoredSignal, signalId, defaultSwarmConfig, db, llm);
        await logPipelineStep(db, runId, 'investigate', 'info', `Investigation complete for ${signal.sourceId}: ${researchBrief.coverage.succeeded}/${researchBrief.coverage.dispatched} agents`);
      } catch (err) {
        // Investigation is best-effort — log but do not fail the run
        await logPipelineStep(db, runId, 'investigate', 'warn', `Swarm failed for ${signal.sourceId}: ${err}`);
        // Fall through — researchBrief stays undefined, use old path
      }

      for (const platform of definition.platforms) {
        try {
          // Get prompt template (DB first, fallback to pillar default)
          const dbTemplate = await getActiveTemplate(db, definition.pillar, platform);
          const template = dbTemplate ?? {
            systemPrompt: pillar?.promptTemplates?.default ?? 'You are an AI content writer.',
            userPromptTemplate: `{{platform_format}}\n\nSignal: {{signal_title}}\nSummary: {{signal_summary}}\nURL: {{signal_url}}\nMetadata: {{signal_metadata}}`,
          };

          // Use brief-aware prompt if investigation succeeded, otherwise fall back
          const { systemPrompt, userPrompt } = researchBrief
            ? buildPromptFromBrief(
                { systemPrompt: template.systemPrompt, userPromptTemplate: template.userPromptTemplate },
                researchBrief,
                platform as Platform,
              )
            : buildPrompt(
                { systemPrompt: template.systemPrompt, userPromptTemplate: template.userPromptTemplate },
                signal,
                platform,
              );

          const result = await llm.generateWithQuality({
            systemPrompt,
            userPrompt,
            maxTokens: definition.generate.maxTokens,
            temperature: definition.generate.temperature,
          });

          await insertContentItem(db, {
            title: signal.title.slice(0, 200),
            body: result.content,
            pillarSlug: definition.pillar,
            pipelineSlug: definition.id,
            platform,
            format: platform === 'twitter' ? 'thread' : platform === 'instagram' ? 'carousel' : 'text_post',
            status: 'pending_review',
            signalId,
            pipelineRunId: runId,
            promptTemplateId: dbTemplate?.id,
            generationModel: result.model,
            qualityScore: result.qualityScore,
            tokenUsage: result.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          });

          itemsGenerated++;
        } catch (err) {
          errors.push(`Failed to generate for ${signal.sourceId}/${platform}: ${err}`);
          await logPipelineStep(db, runId, 'generate', 'error', `Failed: ${signal.sourceId}/${platform}: ${err}`);
        }
      }
    }

    await logPipelineStep(db, runId, 'generate', 'info', `Generated ${itemsGenerated} content items`);

    // STEP 5: FINALIZE
    const status: PipelineRunStatus =
      errors.length === 0 ? 'completed' : itemsGenerated > 0 ? 'partial_success' : 'failed';

    await completePipelineRun(db, runId, {
      status,
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });

    return {
      runId,
      pipelineId: definition.id,
      status,
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      errors,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    errors.push(errorMsg);

    await logPipelineStep(db, runId!, 'runner', 'error', `Pipeline failed: ${errorMsg}`);
    await completePipelineRun(db, runId!, {
      status: 'failed',
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      error: errorMsg,
    });

    return {
      runId: runId!,
      pipelineId: definition.id,
      status: 'failed',
      signalsIngested,
      signalsFiltered,
      itemsGenerated,
      errors,
      durationMs: Date.now() - startTime,
    };
  }
}
