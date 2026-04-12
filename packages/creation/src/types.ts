import type { Platform, ScoredSignal } from '@influenceai/core';
import type { ResearchBrief, Finding } from '@influenceai/intelligence';

// Re-export for convenience
export type { ResearchBrief, Finding } from '@influenceai/intelligence';
export type { Platform, ScoredSignal } from '@influenceai/core';

// --- Angle Types ---

export type AngleType =
  | 'contrarian'
  | 'practical'
  | 'prediction'
  | 'historical_parallel'
  | 'hidden_connection'
  | 'career_impact'
  | 'unraveling'
  | 'david_vs_goliath'
  | 'financial_signal'
  | 'geopolitical_chess';

export interface AngleCard {
  id: string;
  researchBriefId: string;
  angleType: AngleType;
  hook: string;
  thesis: string;
  supportingFindings: Finding[];
  domainSource: string;
  estimatedEngagement: 'high' | 'medium' | 'low';
  reasoning: string;
  status: 'generated' | 'selected' | 'dismissed';
  createdAt: Date;
}

/** Raw LLM output before mapping to AngleCard */
export interface RawAngle {
  type: AngleType;
  hook: string;
  thesis: string;
  findingRefs: number[];
  primaryDomain: string;
  engagement: 'high' | 'medium' | 'low';
  reasoning: string;
}

// --- Story Types ---

export interface StoryBeat {
  name: string;
  instruction: string;
  maxLength: string;
}

export interface StoryArc {
  id: string;
  name: string;
  structure: StoryBeat[];
  bestFor: AngleType[];
  platformFit: Record<Platform, number>;
}

/** LLM output for story planning step */
export interface StoryPlan {
  beats: Array<{
    beatName: string;
    content: string;
    findings: string;
  }>;
}

// --- Voice Types ---

export interface StyleRule {
  rule: string;
  evidence: string;
  strength: number; // 0-1
}

export interface ExtractedStance {
  topic: string;
  position: string;
}

/** Full stance with confidence tracking (per master spec) */
export interface Stance extends ExtractedStance {
  confidence: number;
  lastExpressed: Date;
}

export interface ExemplarPost {
  contentItemId: string;
  platform: Platform;
  title: string;
  body: string;
  qualityScore: number;
  editDistance: number;
}

export interface VoiceProfile {
  id: string;
  version: number;
  confidence: number; // 0-1, reaches 1.0 at 50 edits
  editsAnalyzed: number; // Fix 3: track total edits analyzed
  styleRules: StyleRule[];
  vocabularyPreferences: {
    preferred: string[];
    avoided: string[];
  };
  openingPatterns: string[];
  ctaPatterns: string[];
  toneDescriptor: string;
  stances: Stance[];
  exemplarPosts: ExemplarPost[]; // Fix 3: JSONB instead of UUID[]
  isActive: boolean;
  updatedAt: Date;
}

/** LLM output from voice analysis */
export interface VoiceAnalysis {
  styleRules: StyleRule[];
  vocabularyPreferences: {
    preferred: string[];
    avoided: string[];
  };
  openingPatterns: string[];
  ctaPatterns: string[];
  toneDescriptor: string;
  stances: ExtractedStance[];
}

// --- Draft Types ---

export interface Draft {
  title: string;
  body: string;
  qualityScore: number;
  storyPlan: string; // JSON stringified StoryPlan
}

// --- Creation Result (Fix 16: discriminated union) ---

export type CreationResult =
  | { phase: 'angles_only'; angleCards: AngleCard[] }
  | {
      phase: 'complete';
      angleCards: AngleCard[];
      selectedAngle: AngleCard;
      storyArc: StoryArc;
      draft: Draft;
    };
