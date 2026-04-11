import type { ScoredSignal, Platform } from '@influenceai/core';

// --- Agent Framework Types ---

export type InvestigationRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

export interface InvestigationContext {
  existingBriefs?: AgentBrief[];
  relatedSignals?: ScoredSignal[];
}

export interface InvestigationAgent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  timeout: number;
  investigate(signal: ScoredSignal, context?: InvestigationContext): Promise<AgentBrief>;
}

// --- Core Investigation Types ---

export interface Finding {
  type: 'fact' | 'comparison' | 'prediction' | 'contradiction' | 'trend';
  headline: string;
  detail: string;
  importance: 'high' | 'medium' | 'low';
  data?: Record<string, unknown>;
}

export interface SourceCitation {
  title: string;
  url: string;
  source: string;
  accessedAt: Date;
}

export interface AgentBrief {
  agentId: string;
  status: 'success' | 'partial' | 'failed';
  findings: Finding[];
  narrativeHooks: string[];
  confidence: number;
  sources: SourceCitation[];
  rawData?: Record<string, unknown>;
}

export interface Connection {
  findingA: Finding;
  findingB: Finding;
  relationship: string;
  narrativeHook: string;
}

export interface ResearchBrief {
  id: string;
  signalId: string;
  signal: ScoredSignal;
  topFindings: Finding[];
  connections: Connection[];
  suggestedAngles: string[];
  unusualFact: string;
  agentBriefs: AgentBrief[];
  coverage: {
    dispatched: number;
    succeeded: number;
    failed: number;
    agents: string[];
  };
  createdAt: Date;
  expiresAt: Date;
}

// --- LLM Extraction Types (per agent) ---

export interface TechExtraction {
  findings: Finding[];
  hooks: string[];
  sources: SourceCitation[];
}

export interface HistoryExtraction {
  hasParallel: boolean;
  findings: Finding[];
  hooks: string[];
  confidence: number;
}

export interface FinanceExtraction {
  findings: Finding[];
  hooks: string[];
  sources: SourceCitation[];
}

export interface GeopoliticsExtraction {
  findings: Finding[];
  hooks: string[];
  sources: SourceCitation[];
}

export interface IndustryExtraction {
  findings: Finding[];
  hooks: string[];
  sources: SourceCitation[];
}

export interface DevEcoExtraction {
  findings: Finding[];
  hooks: string[];
  sources: SourceCitation[];
}

export interface SynthesisOutput {
  rankedFindings: Finding[];
  connections: Connection[];
  angles: string[];
  unusualFact: string;
}
