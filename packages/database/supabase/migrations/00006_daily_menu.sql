-- Migration: 00006_daily_menu.sql
-- Phase 4: Daily Menu

-- Daily menus (one per day, regenerated daily)
CREATE TABLE daily_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ DEFAULT now(),
  items JSONB NOT NULL DEFAULT '[]',
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_daily_menus_date ON daily_menus(menu_date DESC);

-- RLS (matching existing pattern)
ALTER TABLE daily_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage daily_menus"
  ON daily_menus FOR ALL USING (auth.uid() IS NOT NULL);
