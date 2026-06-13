'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ErrorBoundary } from '@/components/error-boundary';

const routeMeta: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: "Today's Menu", subtitle: 'Daily Briefing' },
  '/signals': { title: 'Signals', subtitle: 'Inbox' },
  '/content': { title: 'Content', subtitle: 'Library' },
  '/pipelines': { title: 'Pipelines', subtitle: 'Automation' },
  '/trends': { title: 'Trends', subtitle: 'Tracking' },
  '/analytics': { title: 'Analytics', subtitle: 'Insights' },
  '/settings': { title: 'Settings', subtitle: 'Configuration' },
};

function getRouteMeta(pathname: string) {
  if (routeMeta[pathname]) return routeMeta[pathname];
  if (pathname.startsWith('/pipelines/')) return { title: 'Pipelines', subtitle: 'Detail' };
  if (pathname.startsWith('/review/')) return { title: 'Review', subtitle: 'Detail' };
  if (pathname.startsWith('/investigate/')) return { title: 'Investigate', subtitle: 'Research Swarm' };
  if (pathname.startsWith('/trends/')) return { title: 'Trends', subtitle: 'Detail' };
  return { title: 'InfluenceAI' };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = getRouteMeta(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile sidebar whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col lg:pl-64">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <ScrollArea className="flex-1">
          <main className="p-4 sm:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
