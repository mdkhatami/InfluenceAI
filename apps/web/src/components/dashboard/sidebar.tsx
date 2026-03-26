'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  FileText,
  Workflow,
  CheckCircle,
  Calendar,
  BarChart3,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';

const navItems = [
  { label: 'Command Center', icon: LayoutDashboard, href: '/' },
  { label: 'Content', icon: FileText, href: '/content' },
  { label: 'Pipelines', icon: Workflow, href: '/pipelines' },
  { label: 'Review Queue', icon: CheckCircle, href: '/review' },
  { label: 'Schedule', icon: Calendar, href: '/schedule' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
];

const bottomNavItems = [
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          InfluenceAI
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-zinc-800 text-zinc-50 border-l-2 border-blue-500 pl-[10px]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-blue-400' : '')} />
              {item.label}
            </Link>
          );
        })}

        <div className="py-2">
          <Separator />
        </div>

        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-zinc-800 text-zinc-50 border-l-2 border-blue-500 pl-[10px]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-blue-400' : '')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Area */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-50 truncate">AI Operator</p>
            <Badge variant="secondary" className="mt-0.5 text-[10px] px-1.5 py-0">
              Solo Mode
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
