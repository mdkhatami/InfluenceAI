'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PILLARS } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn, getPillarColor } from '@/lib/utils';
import {
  User,
  LogOut,
  Loader2,
} from 'lucide-react';

interface UserInfo {
  email: string;
  name: string;
  avatarUrl?: string;
}

export default function SettingsPage() {
  const router = useRouter();

  // User state
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Pillar toggle state
  const [pillarStates, setPillarStates] = useState<Record<string, boolean>>(
    Object.fromEntries(PILLARS.map((p) => [p.slug, true])),
  );
  const [pillarsLoading, setPillarsLoading] = useState(true);
  const [pillarSaving, setPillarSaving] = useState<string | null>(null);

  // Load user
  useEffect(() => {
    async function loadUser() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setUser({
            email: data.user.email || '',
            name:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name ||
              data.user.email?.split('@')[0] ||
              'Operator',
            avatarUrl: data.user.user_metadata?.avatar_url,
          });
        }
      } catch {
        // Supabase not configured
      } finally {
        setUserLoading(false);
      }
    }
    loadUser();
  }, []);

  // Load pillar toggles
  const fetchPillarToggles = useCallback(async () => {
    setPillarsLoading(true);
    try {
      const res = await fetch('/api/settings/pillar-toggles');
      if (res.ok) {
        const data = await res.json();
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

  useEffect(() => {
    fetchPillarToggles();
  }, [fetchPillarToggles]);

  // Toggle pillar handler
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
        setPillarStates((prev) => ({ ...prev, [slug]: !newValue }));
      }
    } catch {
      setPillarStates((prev) => ({ ...prev, [slug]: !newValue }));
    } finally {
      setPillarSaving(null);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Settings</h1>
        <p className="mt-1 text-sm text-zinc-400">Manage your profile and content configuration</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {userLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="h-14 w-14 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
                    <User className="h-7 w-7 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-50">
                    {user?.name || 'AI Operator'}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {user?.email || 'Not signed in'}
                  </p>
                </div>
              </div>
              {user && (
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Sign Out
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content Pillars Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Content Pillars</CardTitle>
            <p className="text-sm text-zinc-400">
              {pillarsLoading ? (
                <Loader2 className="inline h-3 w-3 animate-spin" />
              ) : (
                `${Object.values(pillarStates).filter(Boolean).length} of ${PILLARS.length} active`
              )}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
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
                        ? 'bg-violet-500'
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
    </div>
  );
}
