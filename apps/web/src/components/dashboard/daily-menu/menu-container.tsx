'use client';

import { useEffect, useState } from 'react';
import { MenuHeader } from './menu-header';
import { MenuItemCard } from './menu-item-card';
import { Button } from '@/components/ui/button';
import type { DailyMenu } from '@/lib/types/daily-menu';

export function DailyMenuContainer() {
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

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

  const regenerateMenu = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/daily-menu', { method: 'POST' });
      const data = await res.json();
      setMenu(data.menu);
    } catch {
      // Handle error
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
      <div className="space-y-4">
        {menu.items.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
