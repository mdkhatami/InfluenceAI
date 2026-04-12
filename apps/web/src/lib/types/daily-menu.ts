export type MenuItemReadiness = 'ready_to_post' | 'pick_an_angle' | 'callback' | 'trend_alert' | 'story_seed';
export type MenuItemType = 'researched_signal' | 'prediction_check' | 'trend_change' | 'collision';

export interface DailyMenuItem {
  id: string;
  priority: number;
  readiness: MenuItemReadiness;
  type: MenuItemType;
  title: string;
  reason: string;
  estimatedEffort: string;
  platforms: string[];
  pillar: string;
  // Optional references depending on type
  draftId?: string;
  signalId?: string;
  researchBriefId?: string;
  angleCards?: any[]; // AngleCard[] from creation package
  predictionId?: string;
  trendAnalysisId?: string;
  collisionId?: string;
  createdAt?: string;
}

export interface DailyMenuStats {
  signalsProcessed: number;
  briefsGenerated: number;
  draftsReady: number;
  callbacksFound: number;
  trendAlerts: number;
  collisionsDetected: number;
}

export interface DailyMenu {
  id: string;
  date: string;
  generatedAt: Date;
  items: DailyMenuItem[];
  stats: DailyMenuStats;
}

export interface CallbackItem {
  type: 'callback';
  contentItemId: string;
  prediction: {
    statement: string;
    timeframe?: string;
    confidence: 'high' | 'medium' | 'low';
    status: string;
  };
  resolution: 'correct' | 'wrong' | 'partially_correct';
  evidence: string;
}

export interface BatchStepResult {
  name: string;
  [key: string]: unknown;
}

export interface BatchResult {
  startedAt: Date;
  completedAt?: Date;
  status?: 'completed' | 'failed';
  error?: string;
  steps: BatchStepResult[];
}
