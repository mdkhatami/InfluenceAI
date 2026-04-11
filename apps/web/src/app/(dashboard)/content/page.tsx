export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Search,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Star,
} from 'lucide-react';
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

const PLATFORM_OPTIONS = [
  { value: '', label: 'All Platforms' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
];

export default async function ContentLibrary({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; platform?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status && params.status !== 'all' ? params.status : undefined;
  const search = params.search || undefined;
  const platform = params.platform || undefined;
  const page = parseInt(params.page ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  let items: Array<{
    id: string;
    title: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    platform: string;
    status: string;
    quality_score: number | null;
    created_at: string;
  }> = [];
  let total = 0;

  try {
    const result = await getContentItems({ status, search, platform, limit, offset });
    items = result.items;
    total = result.total;
  } catch {
    // Fallback to empty on error
  }

  const activeTab = params.status ?? 'all';
  const activePlatform = params.platform ?? '';

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const s = overrides.status ?? params.status;
    if (s && s !== 'all') p.set('status', s);
    const srch = overrides.search !== undefined ? overrides.search : params.search;
    if (srch) p.set('search', srch);
    const plat = overrides.platform !== undefined ? overrides.platform : params.platform;
    if (plat) p.set('platform', plat);
    const pg = overrides.page ?? params.page;
    if (pg && pg !== '1') p.set('page', pg);
    const qs = p.toString();
    return qs ? `/content?${qs}` : '/content';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Content Library</h1>
        <p className="mt-1 text-sm text-zinc-400">{total} total pieces of content</p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status tabs */}
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildUrl({ status: tab.value, page: '1' })}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.value
                  ? 'bg-zinc-800 text-zinc-50'
                  : 'text-zinc-400 hover:text-zinc-300'
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Platform filter */}
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {PLATFORM_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildUrl({ platform: opt.value || undefined, page: '1' })}
                className={cn(
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  activePlatform === opt.value
                    ? 'bg-zinc-800 text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-300'
                )}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Search */}
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
            {platform && <input type="hidden" name="platform" value={platform} />}
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Pipeline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Quality</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-500">
                      No content found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const PlatformIcon = platformIcons[item.platform] ?? FileText;
                    const pipelineLabel = item.pipeline_slug
                      ? item.pipeline_slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
                      : null;

                    return (
                      <tr key={item.id} className="transition-colors hover:bg-zinc-800/50">
                        <td className="px-6 py-4">
                          <Link
                            href={`/review/${item.id}`}
                            className="flex items-center gap-3 group"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-50 line-clamp-1 group-hover:text-violet-400 transition-colors">
                              {item.title}
                            </span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <PlatformIcon className="h-4 w-4 text-zinc-400" />
                            <span className="text-sm capitalize text-zinc-400">{item.platform}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {pipelineLabel ? (
                            <Badge variant="secondary" className="text-xs">
                              {pipelineLabel}
                            </Badge>
                          ) : (
                            <span className="text-xs text-zinc-600">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={statusBadgeVariant[item.status] ?? 'secondary'}>
                            {statusLabels[item.status] ?? item.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {item.quality_score !== null ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-400" />
                              <span className="text-sm text-zinc-300">{item.quality_score}/10</span>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">--</span>
                          )}
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
              <Link href={buildUrl({ page: String(page - 1) })}>
                <Button variant="outline" size="sm">Previous</Button>
              </Link>
            )}
            {offset + limit < total && (
              <Link href={buildUrl({ page: String(page + 1) })}>
                <Button variant="outline" size="sm">Next</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
