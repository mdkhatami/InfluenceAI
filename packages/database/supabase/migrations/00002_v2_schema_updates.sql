-- InfluenceAI v2 Schema Updates
-- Adds columns to existing tables and creates prompt_templates table

-- ============================================================
-- 1. content_signals: add source_type, dedup_hash, raw_data, scored_relevance
-- ============================================================

ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS dedup_hash text;
ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}';
ALTER TABLE content_signals ADD COLUMN IF NOT EXISTS scored_relevance float;

UPDATE content_signals SET source_type = source WHERE source_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_signals_dedup_hash ON content_signals(dedup_hash) WHERE dedup_hash IS NOT NULL;

-- ============================================================
-- 2. content_items: add platform-level fields, quality score, regeneration tracking
-- ============================================================

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS pipeline_run_id uuid REFERENCES pipeline_runs(id);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS signal_id uuid REFERENCES content_signals(id);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS prompt_template_id uuid;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS generation_model text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS quality_score integer;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS token_usage jsonb;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS replaces_id uuid REFERENCES content_items(id);
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS replaced_by_id uuid REFERENCES content_items(id);

UPDATE content_items SET status = 'pending_review' WHERE status = 'in_review';
UPDATE content_items SET status = 'pending_review' WHERE status = 'draft';
UPDATE content_items SET status = 'rejected' WHERE status = 'archived';
UPDATE content_items SET status = 'approved' WHERE status = 'revision_requested';

CREATE INDEX IF NOT EXISTS idx_content_items_quality ON content_items(quality_score DESC NULLS LAST) WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_content_items_pipeline_run ON content_items(pipeline_run_id) WHERE pipeline_run_id IS NOT NULL;

-- ============================================================
-- 3. pipeline_runs: add trigger_task_id, counts, pipeline_id
-- ============================================================

ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS trigger_task_id text;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS signals_ingested integer DEFAULT 0;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS signals_filtered integer DEFAULT 0;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS pipeline_id text;

UPDATE pipeline_runs SET pipeline_id = pipeline_slug WHERE pipeline_id IS NULL;

-- ============================================================
-- 4. integration_configs: add config_type
-- ============================================================

ALTER TABLE integration_configs ADD COLUMN IF NOT EXISTS config_type text DEFAULT 'api_key';

-- ============================================================
-- 5. New table: prompt_templates
-- ============================================================

CREATE TABLE IF NOT EXISTS prompt_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  pillar_id text NOT NULL,
  platform text NOT NULL,
  template_type text NOT NULL DEFAULT 'generation',
  system_prompt text NOT NULL,
  user_prompt_template text NOT NULL,
  model_override text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pillar_id, platform, template_type, version)
);

CREATE TRIGGER prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_prompt_templates_active
  ON prompt_templates(pillar_id, platform, template_type)
  WHERE is_active = true;

-- ============================================================
-- 6. RLS Policies (all tables)
-- ============================================================

ALTER TABLE content_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'content_signals', 'content_items', 'pipeline_runs',
    'pipeline_logs', 'content_analytics', 'integration_configs',
    'prompt_templates'
  ])
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "auth_full_access" ON %I FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
      tbl
    );
  END LOOP;
END $$;
