-- Migration: 00005_persistent_intelligence.sql
-- Phase 3: Persistent Intelligence (Content Memory, Trends, Collisions)

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Content Memory with vector embeddings
CREATE TABLE content_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE UNIQUE,
  platform TEXT,
  pillar_slug TEXT,
  embedding vector(1536),
  entities JSONB DEFAULT '[]',
  topics TEXT[] DEFAULT '{}',
  predictions JSONB DEFAULT '[]',
  stances JSONB DEFAULT '[]',
  platform_metrics JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fix 20: Use HNSW index instead of IVFFlat (works from row 1, correct recall at any count)
CREATE INDEX idx_content_memory_embedding ON content_memory
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_content_memory_published ON content_memory(published_at DESC);

-- pgvector similarity search RPC function
CREATE OR REPLACE FUNCTION match_content_memory(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid, content_item_id uuid, platform text, pillar_slug text,
  entities jsonb, topics text[], predictions jsonb, stances jsonb,
  published_at timestamptz, similarity float
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT cm.id, cm.content_item_id, cm.platform, cm.pillar_slug,
    cm.entities, cm.topics, cm.predictions, cm.stances, cm.published_at,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM content_memory cm
  WHERE 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END; $$;

-- Trend Entities (what we track over time)
CREATE TABLE trend_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  github_repo TEXT,
  npm_package TEXT,
  pypi_package TEXT,
  tracking_since TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trend Data Points (time-series metrics)
CREATE TABLE trend_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES trend_entities(id) ON DELETE CASCADE,
  measured_at DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, measured_at)
);
CREATE INDEX idx_trend_data_entity_date ON trend_data_points(entity_id, measured_at DESC);

-- Trend Analyses (computed phase/velocity per entity)
CREATE TABLE trend_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES trend_entities(id) ON DELETE CASCADE UNIQUE,
  phase TEXT,
  velocity FLOAT DEFAULT 0,
  acceleration FLOAT DEFAULT 0,
  pattern_match JSONB,
  signal TEXT DEFAULT 'hold',
  chart_data JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_trend_analyses_signal ON trend_analyses(signal);

-- Cross-Domain Collisions
CREATE TABLE collisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  signal_a JSONB NOT NULL,
  signal_b JSONB NOT NULL,
  connection_narrative TEXT NOT NULL,
  story_potential TEXT DEFAULT 'medium',
  suggested_angle TEXT,
  status TEXT DEFAULT 'detected',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_collisions_status ON collisions(status);
CREATE INDEX idx_collisions_created ON collisions(created_at DESC);

-- RLS policies (matching existing pattern: auth.uid() IS NOT NULL)
ALTER TABLE content_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE collisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage content_memory"
  ON content_memory FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage trend_entities"
  ON trend_entities FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage trend_data_points"
  ON trend_data_points FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage trend_analyses"
  ON trend_analyses FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage collisions"
  ON collisions FOR ALL USING (auth.uid() IS NOT NULL);
