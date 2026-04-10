import type { Signal, ScoredSignal, SignalSource } from './signal';
import type { Platform } from '../content/types';

export type PipelineRunStatus = 'running' | 'completed' | 'partial_success' | 'failed';

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  pillar: string;
  platforms: Platform[];
  relevanceThreshold?: number;
  ingest: (config: Record<string, unknown>) => Promise<Signal[]>;
  filter: (signals: Signal[], config: Record<string, unknown>) => Promise<ScoredSignal[]>;
  generate: {
    model: string;
    filterModel?: string;
    maxTokens: number;
    temperature: number;
    topK: number;
  };
}

export interface PipelineRunResult {
  runId: string;
  pipelineId: string;
  status: PipelineRunStatus;
  signalsIngested: number;
  signalsFiltered: number;
  itemsGenerated: number;
  errors: string[];
  durationMs: number;
}

export interface StepResult {
  stepName: string;
  status: 'success' | 'failed';
  durationMs: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedContent {
  text: string;
  qualityScore: number;
  platform: Platform;
  model: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
