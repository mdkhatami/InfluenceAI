import type { AutomationLevel } from '../pillars/types';

export type PipelineStatus = 'idle' | 'running' | 'success' | 'failed' | 'disabled' | 'partial_success';

export interface PipelineStep {
  id: string;
  name: string;
  type: 'ingest' | 'filter' | 'generate' | 'visual' | 'audio_video' | 'review' | 'publish';
  description: string;
  automated: boolean;
}

export interface PipelineConfig {
  slug: string;
  name: string;
  icon: string;
  description: string;
  automationLevel: AutomationLevel;
  outputVolume: string;
  schedule?: string; // cron expression
  pillarSlugs: string[]; // which pillars this feeds
  steps: PipelineStep[];
  keyTools: string[];
  color: string;
}

export interface PipelineRun {
  id: string;
  pipelineSlug: string;
  status: PipelineStatus;
  startedAt: string;
  completedAt?: string;
  itemsGenerated: number;
  error?: string;
  logs: PipelineLog[];
}

export interface PipelineLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
}
