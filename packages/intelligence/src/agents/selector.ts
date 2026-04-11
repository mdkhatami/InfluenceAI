import type { ScoredSignal } from '@influenceai/core';
import type { InvestigationAgent } from './base';
import { allAgents } from './registry';

interface AgentTrigger {
  agentId: string;
  alwaysRun: boolean;
  keywords: string[];
}

const AGENT_TRIGGERS: AgentTrigger[] = [
  { agentId: 'tech', alwaysRun: true, keywords: [] },
  { agentId: 'history', alwaysRun: true, keywords: [] },
  { agentId: 'finance', alwaysRun: false, keywords: ['funding', 'acquisition', 'ipo', 'revenue', 'valuation', 'stock', 'investor', 'billion', 'million', 'series a', 'series b', 'market cap', 'earnings', 'profit'] },
  { agentId: 'geopolitics', alwaysRun: false, keywords: ['regulation', 'eu ai act', 'policy', 'government', 'ban', 'compliance', 'legislation', 'congress', 'senate', 'executive order', 'sanctions', 'export control', 'china', 'national security'] },
  { agentId: 'industry', alwaysRun: false, keywords: ['enterprise', 'startup', 'disruption', 'market', 'competitor', 'adoption', 'hiring', 'layoff', 'product launch', 'partnership', 'saas', 'platform'] },
  { agentId: 'deveco', alwaysRun: false, keywords: ['github', 'npm', 'pypi', 'framework', 'library', 'developer', 'open source', 'stars', 'fork', 'package', 'sdk', 'api', 'benchmark', 'release'] },
];

export function selectAgents(signal: ScoredSignal, enabledAgents: string[]): InvestigationAgent[] {
  const text = `${signal.title} ${signal.summary}`.toLowerCase();

  const selectedIds = new Set<string>();

  for (const trigger of AGENT_TRIGGERS) {
    if (!enabledAgents.includes(trigger.agentId)) continue;
    if (trigger.alwaysRun || trigger.keywords.some(kw => text.includes(kw))) {
      selectedIds.add(trigger.agentId);
    }
  }

  // Return actual agent instances from registry, falling back to stub objects
  return Array.from(selectedIds).map(id => {
    const agent = allAgents.find(a => a.id === id);
    if (agent) return agent;
    // Stub for agents not yet registered (during development)
    return {
      id,
      name: id,
      description: `${id} agent`,
      enabled: true,
      timeout: 30000,
      investigate: async () => ({ agentId: id, status: 'failed' as const, findings: [], narrativeHooks: [], confidence: 0, sources: [] }),
    };
  });
}
