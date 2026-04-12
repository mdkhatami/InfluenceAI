import type { ResearchBrief } from './types';

/**
 * Reconstruct a ResearchBrief from a database row.
 * Shared by API routes that read from the research_briefs table.
 */
export function parseBriefFromRow(row: Record<string, any>): ResearchBrief {
  return {
    id: row.id,
    signalId: row.signal_id,
    signal: row.signal_data,
    topFindings: row.top_findings,
    connections: row.connections || [],
    suggestedAngles: row.suggested_angles || [],
    unusualFact: row.unusual_fact || '',
    agentBriefs: [],
    coverage: row.coverage || { dispatched: 0, succeeded: 0, failed: 0, agents: [] },
    createdAt: new Date(row.created_at),
    expiresAt: row.expires_at ? new Date(row.expires_at) : new Date(Date.now() + 48 * 60 * 60 * 1000),
  } as ResearchBrief;
}
