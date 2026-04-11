'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  ClipboardCheck,
  FileText,
  Workflow,
  Settings,
  Sparkles,
  User,
  LogOut,
} from 'lucide-react';

const navItems = [
  { label: 'Review', icon: ClipboardCheck, href: '/' },
  { label: 'Content', icon: FileText, href: '/content' },
  { label: 'Pipelines', icon: Workflow, href: '/pipelines' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

interface UserInfo {
  email: string;
  name: string;
  avatarUrl?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);

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
        // Supabase not configured — show default
      }
    }
    loadUser();
  }, []);

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
                  ? 'bg-zinc-800 text-zinc-50 border-l-2 border-violet-500 pl-[10px]'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-violet-400' : '')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User Area */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-9 w-9 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
              <User className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-50 truncate">
              {user?.name || 'AI Operator'}
            </p>
            <p className="text-[10px] text-zinc-500 truncate">
              {user?.email || 'Not signed in'}
            </p>
          </div>
          {user && (
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
