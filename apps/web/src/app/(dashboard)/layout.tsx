'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ErrorBoundary } from '@/components/error-boundary';

const routeMeta: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Command Center', subtitle: 'Dashboard' },
  '/content': { title: 'Content Library', subtitle: 'Content' },
  '/pipelines': { title: 'Pipelines', subtitle: 'Automation' },
  '/review': { title: 'Review Queue', subtitle: 'Content' },
  '/schedule': { title: 'Schedule', subtitle: 'Calendar' },
  '/analytics': { title: 'Analytics', subtitle: 'Insights' },
  '/settings': { title: 'Settings', subtitle: 'Configuration' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meta = routeMeta[pathname] || { title: 'InfluenceAI' };

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
