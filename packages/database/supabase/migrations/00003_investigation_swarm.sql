-- Migration: 00003_investigation_swarm.sql
-- Phase 1: Investigation Swarm tables

-- Investigation runs (one per signal investigation)
create table investigation_runs (
  id uuid primary key default uuid_generate_v4(),
  signal_id uuid not null references content_signals(id) on delete cascade,
  status text not null default 'pending', -- 'pending', 'running', 'completed', 'partial', 'failed'
  config jsonb default '{}',
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
  signal_id uuid not null references content_signals(id) on delete cascade,
  signal_data jsonb not null, -- Fix 1: store full signal object for decoupling
  top_findings jsonb not null default '[]',
  connections jsonb default '[]',
  suggested_angles jsonb default '[]',
  unusual_fact text,
  agent_briefs_summary jsonb default '[]', -- lightweight summary of agent contributions
  coverage jsonb not null default '{}', -- { dispatched, succeeded, failed, agents[] }
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours'),
  unique(signal_id) -- prevent duplicate investigations per signal
);

-- Indexes
create index idx_investigation_runs_signal on investigation_runs(signal_id);
create index idx_investigation_runs_status on investigation_runs(status);
create index idx_agent_briefs_run on agent_briefs(investigation_run_id);
create index idx_agent_briefs_agent on agent_briefs(agent_id);
create index idx_research_briefs_signal on research_briefs(signal_id);
create index idx_research_briefs_created on research_briefs(created_at);

-- RLS policies (matching existing pattern — allow authenticated users full access)
alter table investigation_runs enable row level security;
alter table agent_briefs enable row level security;
alter table research_briefs enable row level security;

create policy "Authenticated users can manage investigation_runs"
  on investigation_runs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage agent_briefs"
  on agent_briefs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can manage research_briefs"
  on research_briefs for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
