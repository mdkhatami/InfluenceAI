-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Content signals (raw ingested data from sources)
create table content_signals (
  id uuid primary key default uuid_generate_v4(),
  source text not null, -- 'github', 'twitter', 'rss', 'hackernews', 'arxiv'
  external_id text not null,
  title text not null,
  url text,
  summary text,
  author text,
  score numeric default 0,
  metadata jsonb default '{}',
  ingested_at timestamptz default now(),
  unique(source, external_id)
);

-- Content items (generated content pieces)
create table content_items (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  body text not null default '',
  pillar_slug text not null,
  pipeline_slug text,
  platform text not null, -- 'linkedin', 'instagram', 'youtube', 'twitter'
  format text not null default 'text_post',
  status text not null default 'draft',
  signal_id uuid references content_signals(id),
  scheduled_at timestamptz,
  published_at timestamptz,
  published_url text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Pipeline runs (execution history)
create table pipeline_runs (
  id uuid primary key default uuid_generate_v4(),
  pipeline_slug text not null,
  status text not null default 'running', -- 'running', 'success', 'failed'
  started_at timestamptz default now(),
  completed_at timestamptz,
  items_generated integer default 0,
  error text,
  metadata jsonb default '{}'
);

-- Pipeline run logs
create table pipeline_logs (
  id uuid primary key default uuid_generate_v4(),
  run_id uuid references pipeline_runs(id) on delete cascade,
  level text not null default 'info', -- 'info', 'warn', 'error'
  step text not null,
  message text not null,
  created_at timestamptz default now()
);

-- Content analytics snapshots
create table content_analytics (
  id uuid primary key default uuid_generate_v4(),
  content_id uuid references content_items(id) on delete cascade,
  platform text not null,
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  recorded_at timestamptz default now()
);

-- Integration configs (API keys stored here, encrypted via Supabase vault in prod)
create table integration_configs (
  id uuid primary key default uuid_generate_v4(),
  service text not null unique, -- 'litellm', 'github', 'twitter', 'buffer', etc.
  is_active boolean default false,
  config jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes
create index idx_content_items_status on content_items(status);
create index idx_content_items_pillar on content_items(pillar_slug);
create index idx_content_items_platform on content_items(platform);
create index idx_content_items_scheduled on content_items(scheduled_at) where scheduled_at is not null;
create index idx_pipeline_runs_slug on pipeline_runs(pipeline_slug);
create index idx_pipeline_runs_status on pipeline_runs(status);
create index idx_content_signals_source on content_signals(source);

-- Updated at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger content_items_updated_at
  before update on content_items
  for each row execute function update_updated_at();

create trigger integration_configs_updated_at
  before update on integration_configs
  for each row execute function update_updated_at();
