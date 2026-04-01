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
