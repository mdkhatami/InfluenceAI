import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getRelativeTime } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import { FileText } from 'lucide-react';

interface ActivityItem {
  id: string;
  title: string;
  pillar_slug: string;
  status: string;
  created_at: string;
}

const statusVerb: Record<string, string> = {
  pending_review: 'Generated for review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
};

const statusColor: Record<string, string> = {
  pending_review: 'text-amber-400',
  approved: 'text-emerald-400',
  scheduled: 'text-blue-400',
  published: 'text-green-400',
  rejected: 'text-red-400',
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">No recent activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => {
            const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
            const verb = statusVerb[item.status] ?? item.status;
            const color = statusColor[item.status] ?? 'text-zinc-400';
            return (
              <div key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <FileText className={`h-4 w-4 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-50">{verb}: &ldquo;{item.title}&rdquo;</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{pillar?.name.split(' \u2192')[0] ?? item.pillar_slug}</p>
                </div>
                <span className="text-xs text-zinc-500 whitespace-nowrap">
                  {getRelativeTime(item.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
