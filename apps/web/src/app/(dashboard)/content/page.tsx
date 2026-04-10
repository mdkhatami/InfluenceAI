export const dynamic = 'force-dynamic';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, getStatusColor, getPillarColor, formatNumber } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  Plus,
  Search,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { getContentItems } from '@/lib/queries/content';

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const statusLabels: Record<string, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
};

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending_review: 'warning',
  approved: 'default',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
};

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

export default async function ContentLibrary({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status && params.status !== 'all' ? params.status : undefined;
  const search = params.search || undefined;
  const page = parseInt(params.page ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let items: Array<{
    id: string;
    title: string;
    pillar_slug: string;
    platform: string;
    status: string;
    created_at: string;
    metadata?: Record<string, unknown>;
  }> = [];
  let total = 0;

  try {
    const result = await getContentItems({ status, search, limit, offset });
    items = result.items;
    total = result.total;
  } catch (e) {
    // Fallback to empty on error
  }

  const activeTab = params.status ?? 'all';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Content Library</h1>
          <p className="mt-1 text-zinc-400">{total} total pieces of content</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Content
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/content?status=${tab.value}${search ? `&search=${search}` : ''}`}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-300'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="text"
              name="search"
              defaultValue={search ?? ''}
              placeholder="Search content..."
              className="bg-transparent text-sm text-zinc-50 placeholder-zinc-500 outline-none w-48"
            />
            {status && <input type="hidden" name="status" value={status} />}
          </form>
        </div>
      </div>

      {/* Content Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Pillar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No content found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
                    const PlatformIcon = platformIcons[item.platform] ?? FileText;
                    return (
                      <tr key={item.id} className="cursor-pointer transition-colors hover:bg-zinc-800/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-50 line-clamp-1">{item.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {pillar && (
                            <Badge className={cn('text-xs', getPillarColor(pillar.color))}>
                              {pillar.name.split(' \u2192')[0]}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformIcon className="h-4 w-4 text-zinc-400" />
                            <span className="text-sm capitalize text-zinc-400">{item.platform}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusBadgeVariant[item.status] ?? 'secondary'}>
                            {statusLabels[item.status] ?? item.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-zinc-500">
                            {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/content?status=${activeTab}${search ? `&search=${search}` : ''}&page=${page - 1}`}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            {offset + limit < total && (
              <Link href={`/content?status=${activeTab}${search ? `&search=${search}` : ''}&page=${page + 1}`}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
