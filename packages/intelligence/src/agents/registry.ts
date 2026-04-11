import type { InvestigationAgent } from './base';

// Agents are registered as they're implemented
export const allAgents: InvestigationAgent[] = [];

export function getAgent(id: string): InvestigationAgent | undefined {
  return allAgents.find(a => a.id === id);
}
