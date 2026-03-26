'use client';

import { useState } from 'react';
import { PILLARS } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn, getPillarColor } from '@/lib/utils';
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
} from 'lucide-react';

// --- Integration Configs ---

const integrations = [
  {
    id: 'litellm',
    name: 'LiteLLM / Claude API',
    icon: Sparkles,
    description: 'AI content generation via LiteLLM proxy (supports Anthropic, OpenAI, Google)',
    configured: true,
    details: 'Model: anthropic/claude-sonnet',
    color: 'text-violet-400',
  },
  {
    id: 'github',
    name: 'GitHub API',
    icon: GitBranch,
    description: 'Fetch trending repositories for the GitHub Trends pipeline',
    configured: true,
    details: 'Using public API (rate limited)',
    color: 'text-zinc-300',
  },
  {
    id: 'twitter',
    name: 'Twitter / X API',
    icon: Twitter,
    description: 'Monitor AI thought leaders for the Signal Amplifier pipeline',
    configured: false,
    details: '',
    color: 'text-blue-400',
  },
  {
    id: 'supabase',
    name: 'Supabase',
    icon: Database,
    description: 'Database, auth, and realtime for the dashboard backend',
    configured: false,
    details: '',
    color: 'text-emerald-400',
  },
  {
    id: 'buffer',
    name: 'Buffer',
    icon: Send,
    description: 'Schedule and publish content to social media platforms',
    configured: false,
    details: '',
    color: 'text-blue-400',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    icon: Mic,
    description: 'AI voice synthesis for the Auto-Podcast pipeline',
    configured: false,
    details: '',
    color: 'text-amber-400',
  },
  {
    id: 'heygen',
    name: 'HeyGen',
    icon: Video,
    description: 'Digital twin avatar for the Avatar pipeline',
    configured: false,
    details: '',
    color: 'text-pink-400',
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    icon: MessageCircle,
    description: 'Mobile review gate — approve content on the go',
    configured: false,
    details: '',
    color: 'text-blue-400',
  },
];

export default function SettingsPage() {
  const [pillarStates, setPillarStates] = useState<Record<string, boolean>>(
    Object.fromEntries(PILLARS.map((p) => [p.slug, true])),
  );

  const togglePillar = (slug: string) => {
    setPillarStates((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {integrations.map((integration) => {
              const Icon = integration.icon;
              return (
                <Card key={integration.id} className="transition hover:border-zinc-700">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn('rounded-lg bg-zinc-800 p-2.5', integration.configured && 'bg-zinc-800')}>
                        <Icon className={cn('h-5 w-5', integration.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-zinc-50">{integration.name}</h3>
                          {integration.configured ? (
                            <Badge className="text-emerald-400 bg-emerald-400/10 text-[10px]">Connected</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Not configured</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-zinc-400">{integration.description}</p>
                        {integration.configured && integration.details && (
                          <p className="mt-2 text-xs text-zinc-500">{integration.details}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        {integration.configured ? 'Edit' : 'Configure'}
                        <ChevronRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Pillars Tab */}
        <TabsContent value="pillars" className="pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Content Pillars</CardTitle>
                <p className="text-sm text-zinc-400">{PILLARS.length} pillars configured</p>
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
                    <button
                      onClick={() => togglePillar(pillar.slug)}
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
                <Button variant="outline" size="sm" className="ml-auto">Edit Profile</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Timezone</p>
                    <p className="text-xs text-zinc-500">Used for scheduling and analytics</p>
                  </div>
                </div>
                <Badge variant="secondary">UTC (GMT+0)</Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Default LLM Model</p>
                    <p className="text-xs text-zinc-500">Used when no pipeline-specific model is set</p>
                  </div>
                </div>
                <code className="rounded bg-zinc-800 px-2 py-1 text-xs text-violet-400">anthropic/claude-sonnet</code>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Notifications</p>
                    <p className="text-xs text-zinc-500">Get notified when pipelines complete or fail</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
