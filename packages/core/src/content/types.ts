export type Platform = 'linkedin' | 'instagram' | 'youtube' | 'twitter';

export type ContentStatus =
  | 'draft'
  | 'in_review'
  | 'revision_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'rejected'
  | 'archived';

export type ContentFormat =
  | 'text_post'
  | 'carousel'
  | 'video_short'
  | 'video_long'
  | 'podcast_episode'
  | 'podcast_clip'
  | 'infographic'
  | 'thread';

export interface ContentItem {
  id: string;
  title: string;
  body: string;
  pillarSlug: string;
  pipelineSlug?: string;
  platform: Platform;
  format: ContentFormat;
  status: ContentStatus;
  scheduledAt?: string;
  publishedAt?: string;
  publishedUrl?: string;
  metadata: Record<string, unknown>;
  engagement?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ContentSignal {
  source: string;
  externalId: string;
  title: string;
  url: string;
  summary?: string;
  author?: string;
  score?: number;
  metadata: Record<string, unknown>;
  ingestedAt: string;
}
