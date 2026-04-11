'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ErrorBoundary } from '@/components/error-boundary';

const routeMeta: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Review', subtitle: 'Pending Content' },
  '/content': { title: 'Content', subtitle: 'Library' },
  '/pipelines': { title: 'Pipelines', subtitle: 'Automation' },
  '/settings': { title: 'Settings', subtitle: 'Configuration' },
};

function getRouteMeta(pathname: string) {
  if (routeMeta[pathname]) return routeMeta[pathname];
  if (pathname.startsWith('/pipelines/')) return { title: 'Pipelines', subtitle: 'Detail' };
  if (pathname.startsWith('/review/')) return { title: 'Review', subtitle: 'Detail' };
  return { title: 'InfluenceAI' };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = getRouteMeta(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-64">
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <ScrollArea className="flex-1">
          <main className="p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
