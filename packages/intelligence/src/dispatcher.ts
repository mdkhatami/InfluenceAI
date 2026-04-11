import type { ScoredSignal } from '@influenceai/core';
import type { LLMClient } from '@influenceai/integrations';
import type {
  AgentBrief,
  ResearchBrief,
  InvestigationAgent,
} from './types';
import type { SwarmConfig } from './config';
import { selectAgents } from './agents/selector';
import { withTimeout } from './agents/base';
import { TechAgent } from './agents/tech';
import { HistoryAgent } from './agents/history';
import { FinanceAgent } from './agents/finance';
import { DevEcoAgent } from './agents/dev-ecosystem';
import { GeopoliticsAgent } from './agents/geopolitics';
import { IndustryAgent } from './agents/industry';
import { synthesizeBriefs, createFallbackBrief } from './synthesis';

// ---------------------------------------------------------------------------
// Agent factory — creates agent instances with injected LLM client
// ---------------------------------------------------------------------------

function createAgent(id: string, llm: LLMClient): InvestigationAgent | null {
  const agents: Record<string, () => InvestigationAgent> = {
    tech: () => new TechAgent(llm),
    history: () => new HistoryAgent(llm),
    finance: () => new FinanceAgent(llm),
    deveco: () => new DevEcoAgent(llm),
    geopolitics: () => new GeopoliticsAgent(llm),
    industry: () => new IndustryAgent(llm),
  };
  return agents[id]?.() ?? null;
}

// ---------------------------------------------------------------------------
// DB helper functions
// ---------------------------------------------------------------------------

async function createInvestigationRun(
  db: any,
  signalId: string,
  config: SwarmConfig,
): Promise<string> {
  const { data } = await db
    .from('investigation_runs')
    .insert({
      signal_id: signalId,
      status: 'running',
      config: config,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  return data?.id;
}

async function storeAgentBrief(
  db: any,
  runId: string,
  brief: AgentBrief,
): Promise<void> {
  await db.from('agent_briefs').insert({
    investigation_run_id: runId,
    agent_id: brief.agentId,
    status: brief.status,
    findings: brief.findings,
    narrative_hooks: brief.narrativeHooks,
    confidence: brief.confidence,
    sources: brief.sources,
    raw_data: brief.rawData,
  });
}

async function storeResearchBrief(
  db: any,
  brief: ResearchBrief,
): Promise<void> {
  await db.from('research_briefs').insert({
    id: brief.id,
    signal_id: brief.signalId,
    signal_data: brief.signal, // Fix 1: store full signal object as JSONB
    top_findings: brief.topFindings,
    connections: brief.connections,
    suggested_angles: brief.suggestedAngles,
    unusual_fact: brief.unusualFact,
    agent_briefs_summary: brief.agentBriefs.map((b) => ({
      agentId: b.agentId,
      status: b.status,
      findingCount: b.findings.length,
    })),
    coverage: brief.coverage,
  });
}

async function completeInvestigationRun(
  db: any,
  runId: string,
  status: string,
): Promise<void> {
  await db
    .from('investigation_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

async function logStep(
  db: any,
  runId: string,
  message: string,
): Promise<void> {
  await db.from('pipeline_logs').insert({
    run_id: runId,
    step_name: 'investigation',
    message,
    created_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function dispatchSwarm(
  signal: ScoredSignal,
  dbSignalId: string, // Fix 2: UUID from content_signals table, NOT signal.sourceId
  config: SwarmConfig,
  db: any,
  llm: LLMClient,
): Promise<ResearchBrief> {
  // 1. Create investigation run record
  const runId = await createInvestigationRun(db, dbSignalId, config);
  await logStep(db, runId, 'Investigation started');

  // 2. Select which agents to dispatch
  const selectedAgents = selectAgents(signal, config.enabledAgents);

  // 3. Handle empty agent selection
  if (selectedAgents.length === 0) {
    const fallback = createFallbackBrief(signal, dbSignalId);
    await storeResearchBrief(db, fallback);
    await completeInvestigationRun(db, runId, 'completed');
    await logStep(db, runId, 'No agents selected — fallback brief created');
    return fallback;
  }

  // 4. Create fresh agent instances with injected LLM client
  //    (selectAgents returns registry instances; we need our own with the provided LLM)
  const agents: InvestigationAgent[] = [];
  for (const selected of selectedAgents) {
    const agent = createAgent(selected.id, llm);
    if (agent) {
      agents.push(agent);
    }
  }

  await logStep(
    db,
    runId,
    `Dispatching ${agents.length} agents: ${agents.map((a) => a.id).join(', ')}`,
  );

  // 5. Dispatch all agents in parallel with per-agent timeouts
  const results = await Promise.allSettled(
    agents.map((agent) =>
      withTimeout(agent.investigate(signal), agent.timeout).then(
        async (brief) => {
          await storeAgentBrief(db, runId, brief); // Fix 8: must await
          await logStep(db, runId, `${agent.id} completed`); // Fix 8: must await
          return brief;
        },
      ),
    ),
  );

  // 6. Separate fulfilled/rejected results
  const succeeded: AgentBrief[] = [];
  const failed: string[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      succeeded.push(result.value);
    } else {
      failed.push(agents[i].id);
      await logStep(
        db,
        runId,
        `${agents[i].id} failed: ${result.reason?.message || 'unknown error'}`,
      );
    }
  }

  // 7. Synthesize results into research brief
  let brief: ResearchBrief;
  if (succeeded.length === 0) {
    brief = createFallbackBrief(signal, dbSignalId);
    await logStep(db, runId, 'All agents failed — fallback brief created');
  } else {
    brief = await synthesizeBriefs(signal, dbSignalId, succeeded, llm);
    // Update coverage to include the full dispatch count (not just succeeded)
    brief.coverage = {
      dispatched: agents.length,
      succeeded: succeeded.length,
      failed: failed.length,
      agents: agents.map((a) => a.id),
    };
  }

  // 8. Store research brief in DB (with signal_data for Fix 1)
  await storeResearchBrief(db, brief);

  // 9. Determine final status and update investigation run
  let finalStatus: string;
  if (failed.length === 0) {
    finalStatus = 'completed';
  } else if (succeeded.length > 0) {
    finalStatus = 'partial';
  } else {
    finalStatus = 'failed';
  }
  await completeInvestigationRun(db, runId, finalStatus);
  await logStep(
    db,
    runId,
    `Investigation ${finalStatus}: ${succeeded.length} succeeded, ${failed.length} failed`,
  );

  return brief;
}
