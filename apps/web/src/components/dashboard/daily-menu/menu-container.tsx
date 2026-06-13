'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MenuHeader } from './menu-header';
import { MenuItemCard } from './menu-item-card';
import { Button } from '@/components/ui/button';
import type { DailyMenu } from '@/lib/types/daily-menu';

function dismissKey(date: string) {
  return `dailyMenuDismissed:${date}`;
}

export function DailyMenuContainer() {
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch('/api/daily-menu');
        const data = await res.json();
        setMenu(data.menu);
      } catch {
        // Silently handle - show empty state
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, []);

  // Load any items the user already dismissed today so they stay hidden on reload.
  useEffect(() => {
    if (!menu?.date) return;
    try {
      const raw = localStorage.getItem(dismissKey(menu.date));
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch {
      // localStorage unavailable — dismissals just won't persist
    }
  }, [menu?.date]);

  const dismissItem = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (menu?.date) {
        try {
          localStorage.setItem(dismissKey(menu.date), JSON.stringify([...next]));
        } catch {
          // ignore persistence failure
        }
      }
      return next;
    });
    toast.success('Dismissed from today’s menu');
  };

  const regenerateMenu = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/daily-menu', { method: 'POST' });
      const data = await res.json();
      setMenu(data.menu);
      setDismissed(new Set());
      if (data.menu?.date) {
        try {
          localStorage.removeItem(dismissKey(data.menu.date));
        } catch {
          // ignore
        }
      }
    } catch {
      toast.error('Failed to refresh menu');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-zinc-900 rounded-lg border border-zinc-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!menu || menu.items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
        <h3 className="text-lg font-medium text-zinc-100">No menu items yet</h3>
        <p className="text-sm text-zinc-400 mt-2">
          The overnight batch hasn&apos;t run yet, or there are no actionable items.
        </p>
        <Button className="mt-4" onClick={regenerateMenu} disabled={regenerating}>
          {regenerating ? 'Generating...' : 'Generate Now'}
        </Button>
      </div>
    );
  }

  const visibleItems = menu.items.filter((item) => !dismissed.has(item.id));

  return (
    <div>
      <MenuHeader stats={menu.stats} date={menu.date} />
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          variant="outline"
          onClick={regenerateMenu}
          disabled={regenerating}
        >
          {regenerating ? 'Refreshing...' : 'Refresh Menu'}
        </Button>
      </div>
      {visibleItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <h3 className="text-sm font-medium text-zinc-200">All caught up</h3>
          <p className="text-xs text-zinc-500 mt-1">
            You&apos;ve cleared every item on today&apos;s menu.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleItems.map((item) => (
            <MenuItemCard key={item.id} item={item} onDismiss={dismissItem} />
          ))}
        </div>
      )}
    </div>
  );
}
