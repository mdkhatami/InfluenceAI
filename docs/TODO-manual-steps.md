# Manual Steps — InfluenceAI v2

## Task 15: End-to-End Verification (Phases 1-2)

These steps require live credentials and can't be automated by CI.

### Prerequisites

Ensure these env vars are set in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
LLM_BASE_URL=<your-llm-endpoint>
LLM_API_KEY=<your-llm-api-key>
LLM_MODEL=<your-model>
TRIGGER_SECRET_KEY=<from-trigger-dev-dashboard>
TRIGGER_PROJECT_ID=<from-trigger-dev-dashboard>
```

### Steps

- [ ] **1. Apply database migration**
  Run `packages/database/supabase/migrations/00002_v2_schema_updates.sql` via Supabase SQL Editor or CLI.

- [ ] **2. Seed prompt templates**
  ```bash
  pnpm seed:templates
  ```
  Expected: `Seeded 21 prompt templates` (7 pillars x 3 platforms)

- [ ] **3. Start Trigger.dev dev**
  ```bash
  npx trigger dev
  ```
  Expected: connects to Trigger.dev cloud, registers `github-trends-pipeline` task

- [ ] **4. Test manual trigger**
  In a separate terminal with dev server running:
  ```bash
  curl -X POST http://localhost:3000/api/pipelines/github-trends/trigger
  ```
  Expected: `{"success":true,"pipelineId":"github-trends","triggerRunId":"...","message":"Pipeline github-trends triggered successfully"}`

- [ ] **5. Verify data in Supabase**
  Check in Supabase Dashboard:
  - `pipeline_runs` — new row with `pipeline_slug = 'github-trends'`
  - `content_signals` — new GitHub trending repo entries
  - `content_items` — new rows with `status = 'pending_review'`, `quality_score` set
  - `pipeline_logs` — step-by-step log entries
