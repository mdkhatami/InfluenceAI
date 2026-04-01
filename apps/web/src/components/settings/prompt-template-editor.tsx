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
  updated_at?: string;
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
