'use client';

import { cn } from '@/lib/utils';
import { Search, Bell, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-800 px-6">
      {/* Left: Title */}
      <div>
        {subtitle && (
          <p className="text-xs text-zinc-500 mb-0.5">{subtitle}</p>
        )}
        <h1 className="text-lg font-semibold text-zinc-50">{title}</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-50">
          <Search className="h-4 w-4" />
        </Button>

        <Button variant="ghost" size="icon" className="relative text-zinc-400 hover:text-zinc-50">
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-zinc-900" />
        </Button>

        <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 cursor-pointer transition-opacity hover:opacity-90">
          <User className="h-4 w-4 text-white" />
        </div>
      </div>
    </header>
  );
}
