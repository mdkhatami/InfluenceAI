export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getContentItems } from '@/lib/queries/content';
import { ContentCard } from '@/components/dashboard/content-card';
import { Badge } from '@/components/ui/badge';
import { Inbox } from 'lucide-react';

const PIPELINE_OPTIONS = [
  { value: '', label: 'All Pipelines' },
  { value: 'github-trends', label: 'GitHub Trends' },
  { value: 'signal-amplifier', label: 'Signal Amplifier' },
  { value: 'release-radar', label: 'Release Radar' },
];

const PLATFORM_OPTIONS = [
  { value: '', label: 'All Platforms' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
];

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const pipeline = params.pipeline || undefined;
  const platform = params.platform || undefined;

  let items: Array<{
    id: string;
    title: string;
    body: string | null;
    platform: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    quality_score: number | null;
    status: string;
    created_at: string;
  }> = [];
  let total = 0;

  try {
    const result = await getContentItems({
      status: 'pending_review',
      pipeline,
      platform,
      limit: 50,
    });
    items = result.items;
    total = result.total;
  } catch {
    // Fallback to empty on error
  }

  function buildFilterUrl(key: string, value: string) {
    const p = new URLSearchParams();
    if (key === 'pipeline' && value) p.set('pipeline', value);
    else if (pipeline) p.set('pipeline', pipeline);
    if (key === 'platform' && value) p.set('platform', value);
    else if (platform) p.set('platform', platform);
    const qs = p.toString();
    return qs ? `/?${qs}` : '/';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Review Queue</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {total} item{total !== 1 ? 's' : ''} pending review
          </p>
        </div>
        {total > 0 && (
          <Badge variant="warning" className="text-sm">
            {total} pending
          </Badge>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pipeline filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500">Pipeline</label>
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {PIPELINE_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildFilterUrl('pipeline', opt.value)}
                className={
                  (pipeline ?? '') === opt.value
                    ? 'rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-50'
                    : 'rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-300'
                }
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Platform filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-500">Platform</label>
          <div className="flex gap-1 rounded-lg bg-zinc-900 p-1">
            {PLATFORM_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={buildFilterUrl('platform', opt.value)}
                className={
                  (platform ?? '') === opt.value
                    ? 'rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-50'
                    : 'rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-300'
                }
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Content List */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 py-16">
          <Inbox className="h-10 w-10 text-zinc-600" />
          <p className="mt-3 text-sm font-medium text-zinc-400">No content pending review</p>
          <p className="mt-1 text-xs text-zinc-500">
            Run a pipeline to generate content, or adjust your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
