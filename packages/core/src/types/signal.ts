export type SignalSource = 'github' | 'rss' | 'hackernews' | 'arxiv' | 'reddit' | 'huggingface';

export interface Signal {
  sourceType: SignalSource;
  sourceId: string;
  title: string;
  summary: string;
  url: string;
  metadata: Record<string, unknown>;
  fetchedAt: Date;
}

export interface ScoredSignal extends Signal {
  score: number;
  scoreReason?: string;
}
