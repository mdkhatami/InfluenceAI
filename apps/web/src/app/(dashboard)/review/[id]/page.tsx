export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getContentItem } from '@/lib/queries/content';
import { cn, getPillarColor, getRelativeTime } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  ArrowLeft,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Star,
} from 'lucide-react';

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

const statusVariants: Record<string, 'default' | 'warning' | 'success' | 'destructive' | 'secondary'> = {
  pending_review: 'warning',
  approved: 'success',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let item: {
    id: string;
    title: string;
    body: string | null;
    platform: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    quality_score: number | null;
    status: string;
    created_at: string;
  } | null = null;

  try {
    item = await getContentItem(id);
  } catch {
    notFound();
  }

  if (!item) notFound();

  const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
  const PlatformIcon = platformIcons[item.platform] ?? FileText;

  const pipelineLabel = item.pipeline_slug
    ? item.pipeline_slug
        .split('-')
        .map((w: string) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Review
      </Link>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant={statusVariants[item.status] ?? 'secondary'}>
              {statusLabels[item.status] ?? item.status}
            </Badge>
            {pipelineLabel && (
              <Badge variant="secondary" className="text-xs">
                {pipelineLabel}
              </Badge>
            )}
            {pillar && (
              <Badge className={cn('text-xs', getPillarColor(pillar.color))}>
                {pillar.name.split(' →')[0]}
              </Badge>
            )}
            {item.quality_score !== null && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Star className="h-3 w-3" />
                {item.quality_score}/10
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl">{item.title}</CardTitle>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <div className="flex items-center gap-1">
              <PlatformIcon className="h-3.5 w-3.5" />
              <span className="capitalize">{item.platform}</span>
            </div>
            <span>{getRelativeTime(item.created_at)}</span>
          </div>
        </CardHeader>
        <CardContent>
          {item.body ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                {item.body}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic">No content body available.</p>
          )}
        </CardContent>
      </Card>

      {/* Placeholder action note */}
      <div className="rounded-lg border border-dashed border-zinc-800 p-6 text-center">
        <p className="text-sm text-zinc-500">
          Full review actions (approve, edit, reject) coming in Phase 3.
        </p>
      </div>
    </div>
  );
}
