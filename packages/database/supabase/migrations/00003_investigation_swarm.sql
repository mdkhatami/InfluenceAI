-- Migration: 00003_investigation_swarm.sql
-- Phase 1: Investigation Swarm tables

-- Investigation runs (one per signal investigation)
create table investigation_runs (
  id uuid primary key default uuid_generate_v4(),
  signal_id uuid not null references content_signals(id) on delete cascade,
  status text not null default 'pending', -- 'pending', 'running', 'completed', 'partial', 'failed'
  trigger_type text, -- 'batch' or 'manual'
  config jsonb default '{}',
  agents_dispatched integer default 0,
  agents_succeeded integer default 0,
  agents_failed integer default 0,
  agents_list text[] default '{}',
  started_at timestamptz default now(),
  completed_at timestamptz,
  error text
);

-- Agent briefs (individual agent outputs per investigation run)
create table agent_briefs (
  id uuid primary key default uuid_generate_v4(),
  investigation_run_id uuid not null references investigation_runs(id) on delete cascade,
  agent_id text not null, -- 'tech', 'finance', 'geopolitics', 'industry', 'deveco', 'history'
  status text not null default 'pending', -- 'success', 'partial', 'failed'
  findings jsonb default '[]',
  narrative_hooks jsonb default '[]',
  confidence numeric default 0,
  sources jsonb default '[]',
  raw_data jsonb,
  created_at timestamptz default now()
);

-- Research briefs (synthesized output from all agents)
create table research_briefs (
  id uuid primary key default uuid_generate_v4(),
  investigation_run_id uuid references investigation_runs(id) on delete cascade,
  signal_id uuid not null references content_signals(id) on delete cascade,
  signal_data jsonb not null, -- Fix 1: store full signal object for decoupling
  top_findings jsonb not null default '[]',
  connections jsonb default '[]',
  suggested_angles jsonb default '[]',
  unusual_fact text,
  agent_briefs_summary jsonb default '[]', -- lightweight summary of agent contributions
  coverage jsonb not null default '{}', -- { dispatched, succeeded, failed, agents[] }
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '48 hours'),
  unique(signal_id) -- prevent duplicate investigations per signal
);

-- Investigation logs (separate from pipeline_logs to avoid FK conflicts)
create table investigation_logs (
  id uuid primary key default uuid_generate_v4(),
  investigation_run_id uuid not null references investigation_runs(id) on delete cascade,
  level text not null default 'info', -- 'info', 'warn', 'error'
  message text not null,
  created_at timestamptz default now()
);

-- Indexes
create index idx_investigation_runs_signal on investigation_runs(signal_id);
create index idx_investigation_runs_status on investigation_runs(status);
create index idx_agent_briefs_run on agent_briefs(investigation_run_id);
create index idx_agent_briefs_agent on agent_briefs(agent_id);
create index idx_research_briefs_signal on research_briefs(signal_id);
create index idx_research_briefs_created on research_briefs(created_at);
create index idx_investigation_logs_run on investigation_logs(investigation_run_id);

-- RLS policies (matching existing pattern — auth.uid() IS NOT NULL)
alter table investigation_runs enable row level security;
alter table agent_briefs enable row level security;
alter table research_briefs enable row level security;
alter table investigation_logs enable row level security;

create policy "auth_full_access" on investigation_runs for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_full_access" on agent_briefs for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_full_access" on research_briefs for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "auth_full_access" on investigation_logs for all
  using (auth.uid() is not null) with check (auth.uid() is not null);
