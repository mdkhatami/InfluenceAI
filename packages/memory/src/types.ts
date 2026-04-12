import type { Platform } from '@influenceai/core';
export type { Platform } from '@influenceai/core';

// --- Content Memory Types ---

export interface Entity {
  name: string;
  type: 'company' | 'person' | 'technology' | 'concept' | 'regulation';
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface Prediction {
  statement: string;
  timeframe?: string;
  confidence: 'high' | 'medium' | 'low';
  status: 'open' | 'correct' | 'incorrect' | 'expired';
}

/** Extracted from content — simple topic+position, no confidence tracking (Fix 14) */
export interface ExtractedStance {
  topic: string;
  position: string;
}

export interface ContentMemoryEntry {
  id?: string;
  content_item_id: string;
  platform: Platform;
  pillar_slug: string;
  embedding: number[];
  entities: Entity[];
  topics: string[];
  predictions: Prediction[];
  stances: ExtractedStance[];
  platform_metrics?: Record<string, unknown>;
  published_at: string;
  created_at?: string;
  similarity?: number; // Present in search results
}

/** LLM output from content extraction */
export interface ContentExtraction {
  entities: Entity[];
  topics: string[];
  predictions: Array<{ statement: string; timeframe?: string; confidence: 'high' | 'medium' | 'low' }>;
  stances: ExtractedStance[];
}

// --- Trend Types ---

export interface TrendEntity {
  id?: string;
  name: string;
  type: string;
  github_repo?: string | null;
  npm_package?: string | null;
  pypi_package?: string | null;
  tracking_since?: Date;
  is_active: boolean;
}

export interface TrendDataPoint {
  id?: string;
  entity_id: string;
  measured_at: string;
  metrics: Record<string, number | null>;
}

export type TrendPhase = 'emerging' | 'accelerating' | 'peak' | 'plateau' | 'decelerating' | 'declining';
export type ContentSignal = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';

export interface TrendAnalysis {
  entityId: string;
  entityName: string;
  phase: TrendPhase;
  velocity: number;
  acceleration: number;
  patternMatch: { name: string; confidence: number } | null;
  signal: ContentSignal;
  chartData: Array<{ date: string; value: number }>;
  analyzedAt: Date;
}

// --- Collision Types ---

export interface CollisionSignalRef {
  id: string;
  title: string;
  domain: string;
}

export interface Collision {
  id: string;
  type: string;
  signalA: CollisionSignalRef;
  signalB: CollisionSignalRef;
  connectionNarrative: string;
  storyPotential: 'high' | 'medium' | 'low';
  suggestedAngle: string;
  status?: 'detected' | 'used' | 'dismissed';
  createdAt: Date;
}

/** Raw LLM output for collision detection */
export interface RawCollision {
  indexA: number;
  indexB: number;
  type: string;
  narrative: string;
  potential: 'high' | 'medium' | 'low';
  angle: string;
}

/** LLM output for entity metadata discovery */
export interface EntityMeta {
  githubRepo?: string;
  npmPackage?: string;
  pypiPackage?: string;
}

// --- Collection Result Types ---

export interface CollectResult {
  entitiesUpdated: number;
  errors: string[];
}
