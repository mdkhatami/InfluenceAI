-- InfluenceAI Database Schema
-- Requires PostgreSQL 14+ with pgcrypto extension

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE platform AS ENUM (
  'linkedin',
  'instagram',
  'youtube',
  'twitter'
);

CREATE TYPE content_status AS ENUM (
  'draft',
  'in_review',
  'revision_requested',
  'approved',
  'scheduled',
  'published',
  'rejected',
  'archived'
);

CREATE TYPE content_format AS ENUM (
  'text_post',
  'carousel',
  'video_short',
  'video_long',
  'podcast_episode',
  'podcast_clip',
  'infographic',
  'thread'
);

CREATE TYPE pipeline_status AS ENUM (
  'idle',
  'running',
  'success',
  'failed',
  'disabled'
);

CREATE TYPE log_level AS ENUM (
  'info',
  'warn',
  'error'
);

CREATE TYPE review_action AS ENUM (
  'approve',
  'reject',
  'request_revision'
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. Content Items
CREATE TABLE content_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  pillar_slug text NOT NULL,
  pipeline_slug text,
  platform    platform NOT NULL,
  format      content_format NOT NULL,
  status      content_status NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  published_url text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_content_items_status ON content_items (status);
CREATE INDEX idx_content_items_platform ON content_items (platform);
CREATE INDEX idx_content_items_pillar_slug ON content_items (pillar_slug);
CREATE INDEX idx_content_items_pipeline_slug ON content_items (pipeline_slug);
CREATE INDEX idx_content_items_created_at ON content_items (created_at DESC);
CREATE INDEX idx_content_items_scheduled_at ON content_items (scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- 2. Content Signals
CREATE TABLE content_signals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL,
  external_id text NOT NULL,
  title       text NOT NULL,
  url         text NOT NULL,
  summary     text,
  author      text,
  score       integer DEFAULT 0,
  metadata    jsonb NOT NULL DEFAULT '{}',
  ingested_at timestamptz NOT NULL DEFAULT now(),
  processed   boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_content_signals_source ON content_signals (source);
CREATE INDEX idx_content_signals_processed ON content_signals (processed);
CREATE INDEX idx_content_signals_ingested_at ON content_signals (ingested_at DESC);
CREATE UNIQUE INDEX idx_content_signals_source_external_id ON content_signals (source, external_id);

-- 3. Pipeline Runs
CREATE TABLE pipeline_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_slug   text NOT NULL,
  status          pipeline_status NOT NULL DEFAULT 'idle',
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  items_generated integer NOT NULL DEFAULT 0,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_runs_pipeline_slug ON pipeline_runs (pipeline_slug);
CREATE INDEX idx_pipeline_runs_status ON pipeline_runs (status);
CREATE INDEX idx_pipeline_runs_started_at ON pipeline_runs (started_at DESC);

-- 4. Pipeline Logs
CREATE TABLE pipeline_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid NOT NULL REFERENCES pipeline_runs (id) ON DELETE CASCADE,
  level      log_level NOT NULL DEFAULT 'info',
  step       text NOT NULL,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pipeline_logs_run_id ON pipeline_logs (run_id);
CREATE INDEX idx_pipeline_logs_level ON pipeline_logs (level);
CREATE INDEX idx_pipeline_logs_created_at ON pipeline_logs (created_at DESC);

-- 5. Content Analytics
CREATE TABLE content_analytics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    uuid NOT NULL REFERENCES content_items (id) ON DELETE CASCADE,
  platform      platform NOT NULL,
  views         integer NOT NULL DEFAULT 0,
  likes         integer NOT NULL DEFAULT 0,
  comments      integer NOT NULL DEFAULT 0,
  shares        integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_analytics_content_id ON content_analytics (content_id);
CREATE INDEX idx_content_analytics_platform ON content_analytics (platform);
CREATE INDEX idx_content_analytics_snapshot_date ON content_analytics (snapshot_date DESC);
CREATE UNIQUE INDEX idx_content_analytics_content_platform_date
  ON content_analytics (content_id, platform, snapshot_date);

-- 6. Integration Configs
CREATE TABLE integration_configs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service    text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT false,
  config     jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER integration_configs_updated_at
  BEFORE UPDATE ON integration_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. Review Comments
CREATE TABLE review_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES content_items (id) ON DELETE CASCADE,
  comment    text NOT NULL,
  action     review_action NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_comments_content_id ON review_comments (content_id);
CREATE INDEX idx_review_comments_action ON review_comments (action);
CREATE INDEX idx_review_comments_created_at ON review_comments (created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_comments ENABLE ROW LEVEL SECURITY;

-- Allow service role full access to all tables
CREATE POLICY "Service role has full access to content_items"
  ON content_items FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to content_signals"
  ON content_signals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to pipeline_runs"
  ON pipeline_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to pipeline_logs"
  ON pipeline_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to content_analytics"
  ON content_analytics FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to integration_configs"
  ON integration_configs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to review_comments"
  ON review_comments FOR ALL
  USING (auth.role() = 'service_role');

-- Allow authenticated users to read content
CREATE POLICY "Authenticated users can read content_items"
  ON content_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read content_signals"
  ON content_signals FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read pipeline_runs"
  ON pipeline_runs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read pipeline_logs"
  ON pipeline_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read content_analytics"
  ON content_analytics FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read review_comments"
  ON review_comments FOR SELECT
  USING (auth.role() = 'authenticated');
