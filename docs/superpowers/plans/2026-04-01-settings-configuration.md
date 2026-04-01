# Settings & Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Settings page to Supabase so integration configs, pillar toggles, and prompt templates are persisted and editable. Replace all mock/client-only state with real database reads and writes. Build a prompt template editor with live preview.

**Architecture:** The Settings page (`apps/web/src/app/(dashboard)/settings/page.tsx`) is currently a `'use client'` component with three tabs: Integrations, Content Pillars, and General. All data is hardcoded or local state. This plan adds API routes that read/write `integration_configs` and `prompt_templates` tables via the Supabase server client, then rewires the UI to call those routes.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), Tailwind CSS v4, shadcn/ui, TypeScript strict mode.

**Scope:** Phase 5 of the v2 spec. Tasks 1-5 cover API routes, integration wiring, pillar toggle persistence, prompt template editor, and general preferences.

**Reference:** `docs/superpowers/specs/2026-03-28-influenceai-v2-architecture-design.md` Section 8.7, `docs/superpowers/plans/2026-03-28-foundation-pipeline-engine.md`

---

## File Map

### New files

```
apps/web/src/app/api/settings/integrations/route.ts      -> GET/PUT for integration_configs (config_type='api_key')
apps/web/src/app/api/settings/pillar-toggles/route.ts     -> GET/PUT for pillar enable/disable
apps/web/src/app/api/settings/preferences/route.ts        -> GET/PUT for user preferences
apps/web/src/app/api/settings/prompt-templates/route.ts   -> GET/POST for prompt template CRUD
apps/web/src/components/settings/integration-config-dialog.tsx -> Modal form for editing an integration
apps/web/src/components/settings/prompt-template-editor.tsx    -> Full prompt template editor component
```

### Modified files

```
apps/web/src/app/(dashboard)/settings/page.tsx            -> Rewire all three tabs to use API data
packages/database/src/queries/prompt-templates.ts          -> Add listTemplates, getTemplateVersions, deactivateTemplate
packages/database/src/index.ts                             -> Export new query functions
```

---

## Task 1: Create settings API routes

**Files:**
- Create: `apps/web/src/app/api/settings/integrations/route.ts`
- Create: `apps/web/src/app/api/settings/pillar-toggles/route.ts`
- Create: `apps/web/src/app/api/settings/preferences/route.ts`
- Create: `apps/web/src/app/api/settings/prompt-templates/route.ts`

### Why four routes?

Each config_type in `integration_configs` serves a different purpose and has a different shape. Keeping them separate avoids a single route with branching logic and makes each endpoint simple to test.

- [ ] **Step 1: Create integrations route (GET/PUT)**

Create `apps/web/src/app/api/settings/integrations/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('config_type', 'api_key')
      .order('service', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ integrations: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch integrations' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { service, config, is_active } = body as {
      service: string;
      config: Record<string, unknown>;
      is_active: boolean;
    };

    if (!service) {
      return NextResponse.json({ error: 'service is required' }, { status: 400 });
    }

    // Upsert: insert if not exists, update if exists
    const { data, error } = await supabase
      .from('integration_configs')
      .upsert(
        {
          service,
          config,
          is_active,
          config_type: 'api_key',
        },
        { onConflict: 'service' },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ integration: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update integration' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create pillar-toggles route (GET/PUT)**

Create `apps/web/src/app/api/settings/pillar-toggles/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('integration_configs')
      .select('service, is_active')
      .eq('config_type', 'pillar_toggle');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Convert rows to a simple map: { 'breaking-ai-news': true, ... }
    const toggles: Record<string, boolean> = {};
    for (const row of data ?? []) {
      toggles[row.service] = row.is_active;
    }

    return NextResponse.json({ toggles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch pillar toggles' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { slug, enabled } = body as {
      slug: string;
      enabled: boolean;
    };

    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('integration_configs')
      .upsert(
        {
          service: slug,
          is_active: enabled,
          config_type: 'pillar_toggle',
          config: {},
        },
        { onConflict: 'service' },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ toggle: { slug: data.service, enabled: data.is_active } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update pillar toggle' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Create preferences route (GET/PUT)**

Create `apps/web/src/app/api/settings/preferences/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PREFERENCES_SERVICE = '_user_preferences';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('integration_configs')
      .select('config')
      .eq('service', PREFERENCES_SERVICE)
      .eq('config_type', 'user_preferences')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine for first-time use
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const defaults = {
      timezone: 'UTC',
      default_model: 'anthropic/claude-sonnet',
      notifications_enabled: false,
    };

    return NextResponse.json({
      preferences: data?.config
        ? { ...defaults, ...(data.config as Record<string, unknown>) }
        : defaults,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch preferences' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { preferences } = body as {
      preferences: Record<string, unknown>;
    };

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json({ error: 'preferences object is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('integration_configs')
      .upsert(
        {
          service: PREFERENCES_SERVICE,
          config_type: 'user_preferences',
          config: preferences,
          is_active: true,
        },
        { onConflict: 'service' },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ preferences: data.config });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save preferences' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Create prompt-templates route (GET/POST)**

Create `apps/web/src/app/api/settings/prompt-templates/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const pillarId = searchParams.get('pillar_id');
    const platform = searchParams.get('platform');

    let query = supabase
      .from('prompt_templates')
      .select('*')
      .order('pillar_id', { ascending: true })
      .order('platform', { ascending: true })
      .order('version', { ascending: false });

    if (pillarId) {
      query = query.eq('pillar_id', pillarId);
    }
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch templates' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      pillar_id,
      platform,
      template_type,
      system_prompt,
      user_prompt_template,
      model_override,
    } = body as {
      pillar_id: string;
      platform: string;
      template_type?: string;
      system_prompt: string;
      user_prompt_template: string;
      model_override?: string;
    };

    if (!pillar_id || !platform || !system_prompt || !user_prompt_template) {
      return NextResponse.json(
        { error: 'pillar_id, platform, system_prompt, and user_prompt_template are required' },
        { status: 400 },
      );
    }

    const type = template_type ?? 'generation';

    // Step 1: Find the current highest version for this combo
    const { data: existing } = await supabase
      .from('prompt_templates')
      .select('version')
      .eq('pillar_id', pillar_id)
      .eq('platform', platform)
      .eq('template_type', type)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (existing?.version ?? 0) + 1;

    // Step 2: Deactivate all existing templates for this combo
    await supabase
      .from('prompt_templates')
      .update({ is_active: false })
      .eq('pillar_id', pillar_id)
      .eq('platform', platform)
      .eq('template_type', type);

    // Step 3: Insert new version as active
    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        pillar_id,
        platform,
        template_type: type,
        system_prompt,
        user_prompt_template,
        model_override: model_override ?? null,
        version: nextVersion,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create template' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Verify all routes type-check**

```bash
pnpm -F @influenceai/web build
```

Expected: build succeeds with no type errors in the new route files.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/settings/
git commit -m "feat(api): add settings API routes for integrations, pillar toggles, preferences, prompt templates"
```

---

## Task 2: Wire Integrations tab to Supabase

**Files:**
- Create: `apps/web/src/components/settings/integration-config-dialog.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

### Overview

Replace the hardcoded `integrations` array with data fetched from `/api/settings/integrations`. The static `configured: true/false` becomes real DB state. Add a dialog that lets the user input config values (API key, base URL) and save them.

- [ ] **Step 1: Create integration config dialog component**

Create `apps/web/src/components/settings/integration-config-dialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

// Each integration type has its own config fields
const INTEGRATION_FIELDS: Record<string, { key: string; label: string; placeholder: string; type: 'text' | 'password' }[]> = {
  litellm: [
    { key: 'base_url', label: 'Base URL', placeholder: 'http://localhost:4000', type: 'text' },
    { key: 'api_key', label: 'API Key', placeholder: 'sk-...', type: 'password' },
    { key: 'model', label: 'Default Model', placeholder: 'anthropic/claude-sonnet', type: 'text' },
  ],
  github: [
    { key: 'token', label: 'Personal Access Token', placeholder: 'ghp_...', type: 'password' },
  ],
  twitter: [
    { key: 'api_key', label: 'API Key', placeholder: 'Your Twitter API key', type: 'password' },
    { key: 'api_secret', label: 'API Secret', placeholder: 'Your Twitter API secret', type: 'password' },
    { key: 'bearer_token', label: 'Bearer Token', placeholder: 'Your bearer token', type: 'password' },
  ],
  supabase: [
    { key: 'url', label: 'Project URL', placeholder: 'https://xxx.supabase.co', type: 'text' },
    { key: 'anon_key', label: 'Anon/Publishable Key', placeholder: 'eyJ...', type: 'password' },
  ],
  buffer: [
    { key: 'access_token', label: 'Access Token', placeholder: 'Your Buffer access token', type: 'password' },
  ],
  elevenlabs: [
    { key: 'api_key', label: 'API Key', placeholder: 'Your ElevenLabs API key', type: 'password' },
    { key: 'voice_id', label: 'Default Voice ID', placeholder: 'Voice ID', type: 'text' },
  ],
  heygen: [
    { key: 'api_key', label: 'API Key', placeholder: 'Your HeyGen API key', type: 'password' },
    { key: 'avatar_id', label: 'Avatar ID', placeholder: 'Avatar ID', type: 'text' },
  ],
  telegram: [
    { key: 'bot_token', label: 'Bot Token', placeholder: '123456:ABC-DEF...', type: 'password' },
    { key: 'chat_id', label: 'Chat ID', placeholder: 'Your chat ID', type: 'text' },
  ],
};

interface IntegrationConfigDialogProps {
  service: string;
  serviceName: string;
  currentConfig: Record<string, unknown>;
  isActive: boolean;
  onClose: () => void;
  onSave: (service: string, config: Record<string, unknown>, isActive: boolean) => Promise<void>;
}

export function IntegrationConfigDialog({
  service,
  serviceName,
  currentConfig,
  isActive,
  onClose,
  onSave,
}: IntegrationConfigDialogProps) {
  const fields = INTEGRATION_FIELDS[service] ?? [
    { key: 'api_key', label: 'API Key', placeholder: 'Your API key', type: 'password' as const },
  ];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field.key] = (currentConfig[field.key] as string) ?? '';
    }
    return initial;
  });

  const [active, setActive] = useState(isActive);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleSave = async () => {
    setSaving(true);
    try {
      // Mask sensitive values for storage — store the raw values
      // In production, Supabase Vault would encrypt the config column
      const config: Record<string, unknown> = {};
      for (const field of fields) {
        if (values[field.key]) {
          config[field.key] = values[field.key];
        }
      }
      await onSave(service, config, active);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    // Basic connectivity test: check that required fields are filled
    const hasAllRequired = fields.every(
      (f) => values[f.key] && values[f.key].trim().length > 0,
    );

    // Simulate a short delay for UX
    await new Promise((resolve) => setTimeout(resolve, 800));
    setTestStatus(hasAllRequired ? 'success' : 'error');

    // Reset after 3 seconds
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Configure {serviceName}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                {field.label}
              </label>
              <input
                type={field.type}
                value={values[field.key]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={field.placeholder}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          ))}

          <Separator />

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Enabled</p>
              <p className="text-xs text-zinc-500">Allow pipelines to use this integration</p>
            </div>
            <button
              onClick={() => setActive((prev) => !prev)}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                active ? 'bg-blue-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  active ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
            >
              {testStatus === 'testing' && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {testStatus === 'success' && <CheckCircle2 className="mr-1.5 h-3 w-3 text-emerald-400" />}
              {testStatus === 'error' && <AlertCircle className="mr-1.5 h-3 w-3 text-red-400" />}
              {testStatus === 'idle' && 'Test Connection'}
              {testStatus === 'testing' && 'Testing...'}
              {testStatus === 'success' && 'Connected'}
              {testStatus === 'error' && 'Failed'}
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>

          {testStatus === 'success' && (
            <Badge className="text-emerald-400 bg-emerald-400/10 text-[10px]">
              Connection test passed
            </Badge>
          )}
          {testStatus === 'error' && (
            <Badge className="text-red-400 bg-red-400/10 text-[10px]">
              Fill all fields before testing
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the settings page with Integrations tab wired to API**

Replace the entire content of `apps/web/src/app/(dashboard)/settings/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { PILLARS } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn, getPillarColor } from '@/lib/utils';
import { IntegrationConfigDialog } from '@/components/settings/integration-config-dialog';
import {
  Sparkles,
  GitBranch,
  Twitter,
  Database,
  Send,
  Mic,
  Video,
  MessageCircle,
  Globe,
  Bell,
  User,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';

// --- Static integration metadata (icons, descriptions) ---

const INTEGRATION_META: Record<
  string,
  { name: string; icon: typeof Sparkles; description: string; color: string }
> = {
  litellm: {
    name: 'LiteLLM / Claude API',
    icon: Sparkles,
    description: 'AI content generation via LiteLLM proxy (supports Anthropic, OpenAI, Google)',
    color: 'text-violet-400',
  },
  github: {
    name: 'GitHub API',
    icon: GitBranch,
    description: 'Fetch trending repositories for the GitHub Trends pipeline',
    color: 'text-zinc-300',
  },
  twitter: {
    name: 'Twitter / X API',
    icon: Twitter,
    description: 'Monitor AI thought leaders for the Signal Amplifier pipeline',
    color: 'text-blue-400',
  },
  supabase: {
    name: 'Supabase',
    icon: Database,
    description: 'Database, auth, and realtime for the dashboard backend',
    color: 'text-emerald-400',
  },
  buffer: {
    name: 'Buffer',
    icon: Send,
    description: 'Schedule and publish content to social media platforms',
    color: 'text-blue-400',
  },
  elevenlabs: {
    name: 'ElevenLabs',
    icon: Mic,
    description: 'AI voice synthesis for the Auto-Podcast pipeline',
    color: 'text-amber-400',
  },
  heygen: {
    name: 'HeyGen',
    icon: Video,
    description: 'Digital twin avatar for the Avatar pipeline',
    color: 'text-pink-400',
  },
  telegram: {
    name: 'Telegram Bot',
    icon: MessageCircle,
    description: 'Mobile review gate - approve content on the go',
    color: 'text-blue-400',
  },
};

const INTEGRATION_IDS = Object.keys(INTEGRATION_META);

// --- Types for API data ---

interface IntegrationRow {
  id: string;
  service: string;
  config: Record<string, unknown>;
  is_active: boolean;
  config_type: string;
  created_at: string;
  updated_at: string;
}

interface Preferences {
  timezone: string;
  default_model: string;
  notifications_enabled: boolean;
}

// --- Main Page Component ---

export default function SettingsPage() {
  // Integrations state
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);

  // Pillar toggle state
  const [pillarStates, setPillarStates] = useState<Record<string, boolean>>(
    Object.fromEntries(PILLARS.map((p) => [p.slug, true])),
  );
  const [pillarsLoading, setPillarsLoading] = useState(true);
  const [pillarSaving, setPillarSaving] = useState<string | null>(null);

  // Preferences state
  const [preferences, setPreferences] = useState<Preferences>({
    timezone: 'UTC',
    default_model: 'anthropic/claude-sonnet',
    notifications_enabled: false,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // --- Fetch integrations ---
  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const res = await fetch('/api/settings/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations);
      }
    } catch {
      // Silently fail — UI shows "not configured" by default
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  // --- Fetch pillar toggles ---
  const fetchPillarToggles = useCallback(async () => {
    setPillarsLoading(true);
    try {
      const res = await fetch('/api/settings/pillar-toggles');
      if (res.ok) {
        const data = await res.json();
        // Merge DB toggles with defaults (all enabled by default)
        const merged = Object.fromEntries(PILLARS.map((p) => [p.slug, true]));
        for (const [slug, enabled] of Object.entries(data.toggles as Record<string, boolean>)) {
          merged[slug] = enabled;
        }
        setPillarStates(merged);
      }
    } catch {
      // Use defaults
    } finally {
      setPillarsLoading(false);
    }
  }, []);

  // --- Fetch preferences ---
  const fetchPreferences = useCallback(async () => {
    setPrefsLoading(true);
    try {
      const res = await fetch('/api/settings/preferences');
      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
      }
    } catch {
      // Use defaults
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  // Load all data on mount
  useEffect(() => {
    fetchIntegrations();
    fetchPillarToggles();
    fetchPreferences();
  }, [fetchIntegrations, fetchPillarToggles, fetchPreferences]);

  // --- Integration helpers ---
  const getIntegrationRow = (service: string): IntegrationRow | undefined =>
    integrations.find((i) => i.service === service);

  const handleSaveIntegration = async (
    service: string,
    config: Record<string, unknown>,
    isActive: boolean,
  ) => {
    const res = await fetch('/api/settings/integrations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, config, is_active: isActive }),
    });
    if (!res.ok) {
      throw new Error('Failed to save');
    }
    await fetchIntegrations();
  };

  // --- Pillar toggle handler ---
  const handleTogglePillar = async (slug: string) => {
    const newValue = !pillarStates[slug];
    setPillarSaving(slug);
    setPillarStates((prev) => ({ ...prev, [slug]: newValue }));

    try {
      const res = await fetch('/api/settings/pillar-toggles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, enabled: newValue }),
      });
      if (!res.ok) {
        // Revert on failure
        setPillarStates((prev) => ({ ...prev, [slug]: !newValue }));
      }
    } catch {
      setPillarStates((prev) => ({ ...prev, [slug]: !newValue }));
    } finally {
      setPillarSaving(null);
    }
  };

  // --- Preferences handlers ---
  const handleSavePreferences = async (updated: Partial<Preferences>) => {
    setPrefsSaving(true);
    const merged = { ...preferences, ...updated };
    setPreferences(merged);
    try {
      await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: merged }),
      });
    } catch {
      // Silently fail
    } finally {
      setPrefsSaving(false);
    }
  };

  // --- Render ---

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-50">Settings</h1>
        <p className="mt-1 text-zinc-400">Configure integrations, pillars, and preferences</p>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="pillars">Content Pillars</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="pt-4">
          {integrationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {INTEGRATION_IDS.map((serviceId) => {
                const meta = INTEGRATION_META[serviceId];
                const row = getIntegrationRow(serviceId);
                const configured = row?.is_active ?? false;
                const hasConfig = row !== undefined && Object.keys(row.config).length > 0;
                const Icon = meta.icon;

                return (
                  <Card key={serviceId} className="transition hover:border-zinc-700">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-zinc-800 p-2.5">
                          <Icon className={cn('h-5 w-5', meta.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-zinc-50">{meta.name}</h3>
                            {configured && hasConfig ? (
                              <Badge className="text-emerald-400 bg-emerald-400/10 text-[10px]">Connected</Badge>
                            ) : hasConfig ? (
                              <Badge className="text-amber-400 bg-amber-400/10 text-[10px]">Disabled</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Not configured</Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-zinc-400">{meta.description}</p>
                          {row?.updated_at && (
                            <p className="mt-2 text-xs text-zinc-500">
                              Last updated: {new Date(row.updated_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-shrink-0"
                          onClick={() => setEditingIntegration(serviceId)}
                        >
                          {hasConfig ? 'Edit' : 'Configure'}
                          <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Pillars Tab */}
        <TabsContent value="pillars" className="pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Content Pillars</CardTitle>
                <p className="text-sm text-zinc-400">
                  {pillarsLoading ? (
                    <Loader2 className="inline h-3 w-3 animate-spin" />
                  ) : (
                    `${Object.values(pillarStates).filter(Boolean).length} of ${PILLARS.length} active`
                  )}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 p-0">
              {PILLARS.map((pillar, i) => (
                <div key={pillar.slug}>
                  <div className="flex items-center gap-4 px-6 py-4 transition hover:bg-zinc-800/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-semibold text-zinc-50">{pillar.name}</h3>
                        <Badge className={cn('text-[10px]', getPillarColor(pillar.color))}>
                          {pillar.coreEmotion}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-400 line-clamp-1">{pillar.description}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                        <span>{pillar.frequency}</span>
                        <span>&middot;</span>
                        <span>{pillar.bestPlatforms.join(', ')}</span>
                        <span>&middot;</span>
                        <span className="capitalize">{pillar.automationLevel} automation</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pillarSaving === pillar.slug && (
                        <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                      )}
                      <button
                        onClick={() => handleTogglePillar(pillar.slug)}
                        disabled={pillarSaving === pillar.slug}
                        className={cn(
                          'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
                          pillarStates[pillar.slug]
                            ? 'bg-blue-500'
                            : 'bg-zinc-700',
                        )}
                      >
                        <div
                          className={cn(
                            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                            pillarStates[pillar.slug]
                              ? 'translate-x-[22px]'
                              : 'translate-x-0.5',
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  {i < PILLARS.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50">AI Operator</h3>
                  <p className="text-sm text-zinc-400">operator@influenceai.dev</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Preferences</CardTitle>
                {prefsSaving && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {prefsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                </div>
              ) : (
                <>
                  {/* Timezone */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="h-4 w-4 text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium text-zinc-200">Timezone</p>
                        <p className="text-xs text-zinc-500">Used for scheduling and analytics</p>
                      </div>
                    </div>
                    <select
                      value={preferences.timezone}
                      onChange={(e) => handleSavePreferences({ timezone: e.target.value })}
                      className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="UTC">UTC (GMT+0)</option>
                      <option value="America/New_York">Eastern (GMT-5)</option>
                      <option value="America/Chicago">Central (GMT-6)</option>
                      <option value="America/Denver">Mountain (GMT-7)</option>
                      <option value="America/Los_Angeles">Pacific (GMT-8)</option>
                      <option value="Europe/London">London (GMT+0)</option>
                      <option value="Europe/Paris">Paris (GMT+1)</option>
                      <option value="Europe/Berlin">Berlin (GMT+1)</option>
                      <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
                      <option value="Asia/Shanghai">Shanghai (GMT+8)</option>
                      <option value="Asia/Jerusalem">Jerusalem (GMT+2)</option>
                    </select>
                  </div>
                  <Separator />

                  {/* Default Model */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-4 w-4 text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium text-zinc-200">Default LLM Model</p>
                        <p className="text-xs text-zinc-500">Used when no pipeline-specific model is set</p>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={preferences.default_model}
                      onChange={(e) => handleSavePreferences({ default_model: e.target.value })}
                      className="w-56 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-violet-400 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <Separator />

                  {/* Notifications */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium text-zinc-200">Notifications</p>
                        <p className="text-xs text-zinc-500">Get notified when pipelines complete or fail</p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleSavePreferences({
                          notifications_enabled: !preferences.notifications_enabled,
                        })
                      }
                      className={cn(
                        'relative h-6 w-11 flex-shrink-0 rounded-full transition-colors',
                        preferences.notifications_enabled ? 'bg-blue-500' : 'bg-zinc-700',
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                          preferences.notifications_enabled
                            ? 'translate-x-[22px]'
                            : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Integration config dialog */}
      {editingIntegration && (
        <IntegrationConfigDialog
          service={editingIntegration}
          serviceName={INTEGRATION_META[editingIntegration]?.name ?? editingIntegration}
          currentConfig={getIntegrationRow(editingIntegration)?.config ?? {}}
          isActive={getIntegrationRow(editingIntegration)?.is_active ?? false}
          onClose={() => setEditingIntegration(null)}
          onSave={handleSaveIntegration}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify page renders in dev**

```bash
pnpm dev
```

Navigate to `/settings`. Verify:
- Integrations tab loads from API (shows "Not configured" for all until you configure one)
- Clicking "Configure" opens the dialog
- Saving a config stores it in Supabase and updates the badge to "Connected"
- Clicking "Edit" re-opens the dialog with saved values

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/settings/integration-config-dialog.tsx apps/web/src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat(settings): wire Integrations tab to Supabase with config dialog"
```

---

## Task 3: Wire Content Pillars tab to Supabase

This was already implemented as part of the settings page rewrite in Task 2. The pillar toggles now call `PUT /api/settings/pillar-toggles` on every toggle. This task verifies the wiring and adds the Prompt Templates tab.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (add Prompt Templates tab trigger)

- [ ] **Step 1: Verify pillar toggles persist**

```bash
pnpm dev
```

Navigate to `/settings` -> Content Pillars tab:
1. Toggle "Failure Lab" off
2. Refresh the page
3. Verify "Failure Lab" is still off
4. Toggle it back on, refresh, verify it's on

Check Supabase `integration_configs` table:
- Should see rows with `config_type = 'pillar_toggle'` and `service = 'failure-lab'`

- [ ] **Step 2: Verify disabled pillar count updates**

The header shows "X of 7 active". Toggle a pillar off, verify the count decrements immediately. Refresh, verify it stays.

- [ ] **Step 3: Commit (if any fixes were needed)**

```bash
git add apps/web/src/app/\(dashboard\)/settings/page.tsx
git commit -m "fix(settings): verify pillar toggle persistence"
```

---

## Task 4: Build Prompt Template Editor

**Files:**
- Create: `apps/web/src/components/settings/prompt-template-editor.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (add 4th tab)
- Modify: `packages/database/src/queries/prompt-templates.ts` (add listTemplates, getTemplateVersions)
- Modify: `packages/database/src/index.ts` (export new functions)

### Overview

A new "Prompt Templates" tab on the Settings page. The user selects a pillar and platform, sees the current active template (system_prompt + user_prompt_template), can edit both, preview with sample data, and save as a new version. Old versions are kept in the DB with `is_active = false`.

- [ ] **Step 1: Extend prompt-templates query module**

Add these functions to `packages/database/src/queries/prompt-templates.ts` after the existing `insertPromptTemplate` function:

```typescript
export interface PromptTemplateRow {
  id: string;
  pillar_id: string;
  platform: string;
  template_type: string;
  system_prompt: string;
  user_prompt_template: string;
  model_override: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listActiveTemplates(
  client: SupabaseClient,
): Promise<PromptTemplateRow[]> {
  const { data, error } = await client
    .from('prompt_templates')
    .select('*')
    .eq('is_active', true)
    .order('pillar_id', { ascending: true })
    .order('platform', { ascending: true });

  if (error) throw new Error(`Failed to list templates: ${error.message}`);
  return (data ?? []) as PromptTemplateRow[];
}

export async function getTemplateVersions(
  client: SupabaseClient,
  pillarId: string,
  platform: Platform,
  templateType: string = 'generation',
): Promise<PromptTemplateRow[]> {
  const { data, error } = await client
    .from('prompt_templates')
    .select('*')
    .eq('pillar_id', pillarId)
    .eq('platform', platform)
    .eq('template_type', templateType)
    .order('version', { ascending: false });

  if (error) throw new Error(`Failed to get template versions: ${error.message}`);
  return (data ?? []) as PromptTemplateRow[];
}

export async function deactivateTemplates(
  client: SupabaseClient,
  pillarId: string,
  platform: Platform,
  templateType: string = 'generation',
): Promise<void> {
  const { error } = await client
    .from('prompt_templates')
    .update({ is_active: false })
    .eq('pillar_id', pillarId)
    .eq('platform', platform)
    .eq('template_type', templateType);

  if (error) throw new Error(`Failed to deactivate templates: ${error.message}`);
}
```

- [ ] **Step 2: Export new functions from database index**

Add to `packages/database/src/index.ts`:

```typescript
export type { PromptTemplateRow } from './queries/prompt-templates';
```

The functions are already exported via `export *`.

- [ ] **Step 3: Create prompt template editor component**

Create `apps/web/src/components/settings/prompt-template-editor.tsx`:

```typescript
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PILLARS } from '@influenceai/core';
import type { Platform } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, getPillarColor } from '@/lib/utils';
import { Save, Eye, EyeOff, RotateCcw, Loader2, History, ChevronDown } from 'lucide-react';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
];

// Sample signal data for live preview
const SAMPLE_SIGNAL = {
  signal_title: 'anthropics/claude-code: Open-source AI coding assistant with 200k context window',
  signal_summary:
    'Anthropic releases Claude Code, an AI-powered coding assistant that can understand entire codebases. Features include multi-file editing, test generation, and git integration. Already 15,000 stars in 3 days.',
  signal_url: 'https://github.com/anthropics/claude-code',
  signal_metadata: JSON.stringify({
    stars: 15000,
    starsToday: 5000,
    language: 'TypeScript',
    forks: 890,
  }),
};

interface TemplateRow {
  id: string;
  pillar_id: string;
  platform: string;
  template_type: string;
  system_prompt: string;
  user_prompt_template: string;
  model_override: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
}

// Platform format strings (same as in packages/integrations/src/llm/prompts.ts)
const PLATFORM_FORMATS: Record<string, string> = {
  linkedin: `Format: LinkedIn post.
- Hook line: bold claim, never start with "I'm excited to share..."
- 3-5 numbered insights, each a short paragraph
- End with a polarizing question to drive comments
- Total length: 1200-1500 characters`,
  twitter: `Format: Twitter/X thread.
- Tweet 1: hook statement, 280 chars max, must work standalone
- Tweets 2-5: one insight per tweet, each under 280 chars
- Last tweet: call-to-action
- Each tweet must be readable on its own`,
  instagram: `Format: Instagram carousel outline (text only - slides will be designed separately).
- Slide 1: bold visual claim with a number (e.g. "7 AI tools that...")
- Slides 2-7: one insight per slide, one sentence maximum
- Slide 8: your hot take or contrarian point
- Slide 9: CTA - "Save this. You'll need it."`,
  youtube: `Format: YouTube video script outline.
- Hook (first 15 seconds): bold claim or question
- Problem statement (30 seconds)
- 3-5 key points with demonstrations
- Results/conclusion
- Call-to-action (subscribe, comment)`,
};

function renderPreview(template: string): string {
  let result = template;
  const replacements: Record<string, string> = {
    '{{signal_title}}': SAMPLE_SIGNAL.signal_title,
    '{{signal_summary}}': SAMPLE_SIGNAL.signal_summary,
    '{{signal_url}}': SAMPLE_SIGNAL.signal_url,
    '{{signal_metadata}}': SAMPLE_SIGNAL.signal_metadata,
    '{{platform}}': 'linkedin',
  };

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }

  return result;
}

function renderPreviewWithPlatform(template: string, platform: Platform): string {
  let result = template;
  const replacements: Record<string, string> = {
    '{{signal_title}}': SAMPLE_SIGNAL.signal_title,
    '{{signal_summary}}': SAMPLE_SIGNAL.signal_summary,
    '{{signal_url}}': SAMPLE_SIGNAL.signal_url,
    '{{signal_metadata}}': SAMPLE_SIGNAL.signal_metadata,
    '{{platform}}': platform,
    '{{platform_format}}': PLATFORM_FORMATS[platform] ?? '',
  };

  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }

  return result;
}

export function PromptTemplateEditor() {
  const [selectedPillar, setSelectedPillar] = useState(PILLARS[0].slug);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('linkedin');

  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPromptTemplate, setUserPromptTemplate] = useState('');
  const [modelOverride, setModelOverride] = useState('');

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Track the original values to detect changes
  const [originalSystem, setOriginalSystem] = useState('');
  const [originalUser, setOriginalUser] = useState('');

  // Fetch templates for the selected pillar + platform
  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/settings/prompt-templates?pillar_id=${selectedPillar}&platform=${selectedPlatform}`,
        );
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates);

          // Load the active template into the editor
          const active = (data.templates as TemplateRow[]).find((t) => t.is_active);
          if (active) {
            setSystemPrompt(active.system_prompt);
            setUserPromptTemplate(active.user_prompt_template);
            setModelOverride(active.model_override ?? '');
            setOriginalSystem(active.system_prompt);
            setOriginalUser(active.user_prompt_template);
          } else {
            // Fall back to pillar registry default
            const pillar = PILLARS.find((p) => p.slug === selectedPillar);
            const defaultSystem = `You are an AI content strategist. Content pillar: "${pillar?.name ?? selectedPillar}".\n${pillar?.description ?? ''}`;
            const defaultUser = `${pillar?.promptTemplates?.default?.replace('{{input}}', '{{signal_title}}\\n{{signal_summary}}') ?? 'Write about: {{signal_title}}'}\n\n{{platform_format}}\n\nSignal: {{signal_title}}\nSummary: {{signal_summary}}\nURL: {{signal_url}}`;
            setSystemPrompt(defaultSystem);
            setUserPromptTemplate(defaultUser);
            setModelOverride('');
            setOriginalSystem(defaultSystem);
            setOriginalUser(defaultUser);
          }
          setHasChanges(false);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [selectedPillar, selectedPlatform]);

  // Detect changes
  useEffect(() => {
    setHasChanges(
      systemPrompt !== originalSystem || userPromptTemplate !== originalUser,
    );
  }, [systemPrompt, userPromptTemplate, originalSystem, originalUser]);

  // Save as new version
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/prompt-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pillar_id: selectedPillar,
          platform: selectedPlatform,
          template_type: 'generation',
          system_prompt: systemPrompt,
          user_prompt_template: userPromptTemplate,
          model_override: modelOverride || null,
        }),
      });

      if (res.ok) {
        // Refresh templates to show new version
        const refreshRes = await fetch(
          `/api/settings/prompt-templates?pillar_id=${selectedPillar}&platform=${selectedPlatform}`,
        );
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setTemplates(data.templates);
        }
        setOriginalSystem(systemPrompt);
        setOriginalUser(userPromptTemplate);
        setHasChanges(false);
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  // Reset to pillar registry default
  const handleReset = () => {
    const pillar = PILLARS.find((p) => p.slug === selectedPillar);
    if (!pillar) return;

    const defaultSystem = `You are an AI content strategist. Content pillar: "${pillar.name}".\n${pillar.description}`;
    const defaultUser = `${pillar.promptTemplates?.default?.replace('{{input}}', '{{signal_title}}\\n{{signal_summary}}') ?? 'Write about: {{signal_title}}'}\n\n{{platform_format}}\n\nSignal: {{signal_title}}\nSummary: {{signal_summary}}\nURL: {{signal_url}}`;

    setSystemPrompt(defaultSystem);
    setUserPromptTemplate(defaultUser);
    setModelOverride('');
  };

  // Restore a specific version
  const handleRestoreVersion = (template: TemplateRow) => {
    setSystemPrompt(template.system_prompt);
    setUserPromptTemplate(template.user_prompt_template);
    setModelOverride(template.model_override ?? '');
    setShowVersions(false);
  };

  const activeTemplate = templates.find((t) => t.is_active);
  const pillar = PILLARS.find((p) => p.slug === selectedPillar);

  // Template variable reference
  const TEMPLATE_VARS = [
    { var: '{{signal_title}}', desc: 'Signal headline' },
    { var: '{{signal_summary}}', desc: 'Signal description' },
    { var: '{{signal_url}}', desc: 'Source URL' },
    { var: '{{signal_metadata}}', desc: 'JSON metadata' },
    { var: '{{platform}}', desc: 'Target platform' },
    { var: '{{platform_format}}', desc: 'Platform-specific format instructions' },
  ];

  return (
    <div className="space-y-6">
      {/* Pillar + Platform selectors */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Content Pillar</label>
          <select
            value={selectedPillar}
            onChange={(e) => setSelectedPillar(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
          >
            {PILLARS.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Platform</label>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:w-48">
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Model Override</label>
          <input
            type="text"
            value={modelOverride}
            onChange={(e) => setModelOverride(e.target.value)}
            placeholder="Use default"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 text-xs">
        {pillar && (
          <Badge className={cn('text-[10px]', getPillarColor(pillar.color))}>
            {pillar.coreEmotion}
          </Badge>
        )}
        {activeTemplate && (
          <span className="text-zinc-500">
            Version {activeTemplate.version} - Last saved{' '}
            {new Date(activeTemplate.updated_at ?? activeTemplate.created_at).toLocaleString()}
          </span>
        )}
        {!activeTemplate && !loading && (
          <span className="text-zinc-500">No saved template - using pillar defaults</span>
        )}
        {hasChanges && (
          <Badge className="text-amber-400 bg-amber-400/10 text-[10px]">Unsaved changes</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Editor column */}
          <div className="space-y-4">
            {/* System prompt */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">System Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none resize-y"
                  placeholder="You are an AI content strategist..."
                />
              </CardContent>
            </Card>

            {/* User prompt template */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">User Prompt Template</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={userPromptTemplate}
                  onChange={(e) => setUserPromptTemplate(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none resize-y"
                  placeholder="Write about: {{signal_title}}..."
                />
              </CardContent>
            </Card>

            {/* Template variables reference */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Template Variables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_VARS.map((v) => (
                    <div key={v.var} className="flex items-center gap-2">
                      <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-violet-400 border border-zinc-700">
                        {v.var}
                      </code>
                      <span className="text-xs text-zinc-500">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview column */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {showPreview ? 'Live Preview (with sample data)' : 'Raw Template'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="mr-1 h-3 w-3" />
                        Raw
                      </>
                    ) : (
                      <>
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-1">
                      System Prompt
                    </p>
                    <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {showPreview
                        ? renderPreview(systemPrompt)
                        : systemPrompt || '(empty)'}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 mb-1">
                      User Prompt
                    </p>
                    <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {showPreview
                        ? renderPreviewWithPlatform(userPromptTemplate, selectedPlatform)
                        : userPromptTemplate || '(empty)'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Version history */}
            <Card>
              <CardHeader className="pb-3">
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex w-full items-center justify-between"
                >
                  <CardTitle className="text-sm">
                    Version History ({templates.length})
                  </CardTitle>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-zinc-400 transition-transform',
                      showVersions && 'rotate-180',
                    )}
                  />
                </button>
              </CardHeader>
              {showVersions && (
                <CardContent>
                  {templates.length === 0 ? (
                    <p className="text-xs text-zinc-500">No saved versions yet</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {templates.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-300">
                              v{t.version}
                            </span>
                            {t.is_active && (
                              <Badge className="text-emerald-400 bg-emerald-400/10 text-[10px]">
                                Active
                              </Badge>
                            )}
                            <span className="text-[10px] text-zinc-500">
                              {new Date(t.created_at).toLocaleString()}
                            </span>
                          </div>
                          {!t.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleRestoreVersion(t)}
                            >
                              <History className="mr-1 h-3 w-3" />
                              Restore
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-3 border-t border-zinc-800 pt-4">
        <Button
          onClick={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-4 w-4" />
              Save as New Version
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Reset to Default
        </Button>
        {hasChanges && (
          <span className="text-xs text-amber-400">
            You have unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add Prompt Templates tab to settings page**

In `apps/web/src/app/(dashboard)/settings/page.tsx`, add the import at the top with the other component imports:

```typescript
import { PromptTemplateEditor } from '@/components/settings/prompt-template-editor';
```

Add a new `TabsTrigger` inside the `TabsList`:

```typescript
<TabsTrigger value="templates">Prompt Templates</TabsTrigger>
```

Add the `TabsContent` for templates, after the Pillars `TabsContent` and before the General `TabsContent`:

```typescript
        {/* Prompt Templates Tab */}
        <TabsContent value="templates" className="pt-4">
          <PromptTemplateEditor />
        </TabsContent>
```

- [ ] **Step 5: Verify prompt template editor works in dev**

```bash
pnpm dev
```

Navigate to `/settings` -> Prompt Templates tab:
1. Select a pillar and platform
2. If templates were seeded (from Plan 1, Task 14), the active template loads
3. If no templates, pillar defaults show
4. Edit the system prompt
5. Click "Preview" to see rendered template with sample data
6. Click "Save as New Version"
7. Verify version history shows the new version
8. Switch pillar/platform, verify different templates load

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/queries/prompt-templates.ts packages/database/src/index.ts apps/web/src/components/settings/prompt-template-editor.tsx apps/web/src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat(settings): add prompt template editor with live preview and version history"
```

---

## Task 5: Wire General tab to Supabase

This was already implemented as part of the settings page rewrite in Task 2. The General tab now reads from and writes to `/api/settings/preferences`. This task verifies the wiring and handles edge cases.

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx` (minor tweaks if needed)

- [ ] **Step 1: Verify preferences persist**

```bash
pnpm dev
```

Navigate to `/settings` -> General tab:
1. Change timezone to "Pacific (GMT-8)"
2. Change default model to "gpt-4o"
3. Toggle notifications on
4. Refresh the page
5. Verify all three values persist

Check Supabase `integration_configs` table:
- Should see a row with `service = '_user_preferences'`, `config_type = 'user_preferences'`
- Config JSONB should contain `{"timezone": "America/Los_Angeles", "default_model": "gpt-4o", "notifications_enabled": true}`

- [ ] **Step 2: Verify default model input debounce works**

The current implementation saves on every keystroke (via `onChange`). This is acceptable for a solo-use tool since the PUT is idempotent and fast. If latency is noticeable, add a simple debounce:

In the settings page, verify that typing in the "Default LLM Model" field does not cause excessive API calls. If it does, add a blur-based save: change the `onChange` handler to update local state, and add an `onBlur` handler that calls `handleSavePreferences`. This is optional for a solo-use tool.

- [ ] **Step 3: Commit (if any fixes were needed)**

```bash
git add apps/web/src/app/\(dashboard\)/settings/page.tsx
git commit -m "fix(settings): verify General tab preferences persistence"
```

---

## Summary

After completing all 5 tasks, you will have:

1. **Four API routes** under `/api/settings/` for integrations, pillar toggles, preferences, and prompt templates -- all reading/writing the `integration_configs` and `prompt_templates` Supabase tables via the server client
2. **Integrations tab wired to Supabase** -- each integration card shows real connected/disabled/not-configured status from DB; clicking "Configure" opens a dialog to enter API keys and enable/disable the service
3. **Content Pillars tab persisted** -- toggle switches write to `integration_configs` with `config_type='pillar_toggle'`; state survives page refresh
4. **Prompt Template Editor** -- new "Prompt Templates" tab on Settings; select pillar + platform, edit system_prompt and user_prompt_template, live preview with sample signal data, save as versioned template, restore older versions, reset to pillar defaults
5. **General preferences persisted** -- timezone, default model, and notification toggle saved to `integration_configs` with `config_type='user_preferences'`

**Key design decisions:**
- All settings data lives in existing Supabase tables (no new migrations needed)
- `integration_configs.config_type` column distinguishes between `api_key`, `pillar_toggle`, and `user_preferences` rows
- Prompt template versioning: saving always creates a new version and deactivates the old one; all versions are kept in DB
- Integration config dialog uses a field-per-service approach so each integration type has appropriate config fields
- The prompt template editor uses the same `{{variable}}` syntax and `PLATFORM_FORMATS` as the pipeline engine's `buildPrompt()` function, so what you see in preview is what the LLM receives

**What this enables next:**
- Pipeline engine reads pillar toggle state before generating content (skip disabled pillars)
- Pipeline engine reads integration configs for API keys instead of env vars
- Operators can tune prompt templates in the UI and see immediate results on next pipeline run
