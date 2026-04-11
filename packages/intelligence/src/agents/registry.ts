import type { InvestigationAgent } from './base';

// Agents are registered as they're implemented.
// The dispatcher (Task 7) will create agent instances with an injected LLM client.
// Agents can also be registered here for discovery via registerAgent().
export const allAgents: InvestigationAgent[] = [];

export function registerAgent(agent: InvestigationAgent): void {
  // Avoid duplicates
  if (!allAgents.find((a) => a.id === agent.id)) {
    allAgents.push(agent);
  }
}

export function getAgent(id: string): InvestigationAgent | undefined {
  return allAgents.find((a) => a.id === id);
}

// Agent class exports for the dispatcher to instantiate with an LLM client
export { TechAgent } from './tech';
