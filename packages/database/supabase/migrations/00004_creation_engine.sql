-- Migration: 00004_creation_engine.sql
-- Phase 2: Creation Engine tables (angle_cards, content_edits, voice_profiles)

-- Angle cards generated per research brief
CREATE TABLE angle_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_brief_id UUID REFERENCES research_briefs(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES content_signals(id),
  angle_type TEXT NOT NULL,
  hook TEXT NOT NULL,
  thesis TEXT NOT NULL,
  supporting_findings JSONB DEFAULT '[]',
  domain_source TEXT,
  estimated_engagement TEXT DEFAULT 'medium',
  reasoning TEXT,
  story_arc TEXT,
  status TEXT DEFAULT 'generated',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_angle_cards_brief ON angle_cards(research_brief_id);
CREATE INDEX idx_angle_cards_status ON angle_cards(status);

-- Edit tracking for Voice DNA
CREATE TABLE content_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
  before_title TEXT,
  before_body TEXT,
  after_title TEXT,
  after_body TEXT,
  edit_distance INTEGER DEFAULT 0,
  analyzed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_edits_analyzed ON content_edits(analyzed) WHERE analyzed = false;

-- Voice profile (versioned, one active at a time)
-- Fix 3: exemplar_posts is JSONB (not UUID[]), edits_analyzed tracks total edits
CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL DEFAULT 1,
  confidence FLOAT DEFAULT 0,
  style_rules JSONB DEFAULT '[]',
  vocabulary_preferences JSONB DEFAULT '{}',
  opening_patterns JSONB DEFAULT '[]',
  cta_patterns JSONB DEFAULT '[]',
  tone_descriptor TEXT,
  stances JSONB DEFAULT '[]',
  exemplar_posts JSONB DEFAULT '[]',
  edits_analyzed INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_voice_profiles_active ON voice_profiles(is_active) WHERE is_active = true;

-- Enforce at most one active voice profile (prevents race condition in analyzer)
CREATE UNIQUE INDEX idx_voice_profiles_single_active ON voice_profiles ((true)) WHERE is_active = true;

-- RLS policies (matching existing pattern: auth.uid() IS NOT NULL)
ALTER TABLE angle_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read angle_cards"
  ON angle_cards FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert angle_cards"
  ON angle_cards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update angle_cards"
  ON angle_cards FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read content_edits"
  ON content_edits FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert content_edits"
  ON content_edits FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage voice_profiles"
  ON voice_profiles FOR ALL USING (auth.uid() IS NOT NULL);
