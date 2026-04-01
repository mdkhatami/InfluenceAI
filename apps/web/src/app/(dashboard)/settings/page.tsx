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
