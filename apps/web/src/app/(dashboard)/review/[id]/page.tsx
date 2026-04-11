import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getContentItem, getAdjacentPendingItems } from '@/lib/queries/content';
import { EditableTitle } from '@/components/dashboard/editable-title';
import { EditableBody } from '@/components/dashboard/editable-body';
import { ReviewActions } from '@/components/dashboard/review-actions';
import { SourceSignalCard } from '@/components/dashboard/source-signal-card';
import { KeyboardShortcuts } from '@/components/dashboard/keyboard-shortcuts';
import { Badge } from '@/components/ui/badge';
import { getStatusColor } from '@/lib/utils';
import { PILLARS, PIPELINES } from '@influenceai/core';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  Star,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const platformLabels: Record<string, string> = {
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
  twitter: 'Twitter/X',
};

function getQualityColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-red-400';
}

function getQualityBg(score: number): string {
  if (score >= 8) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 6) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // getContentItem uses .single() which throws on not-found
  let item;
  try {
    item = await getContentItem(id);
  } catch {
    notFound();
  }

  if (!item) notFound();

  const { previousId, nextId } = await getAdjacentPendingItems(id);

  const PlatformIcon = platformIcons[item.platform] ?? Linkedin;
  const platformLabel = platformLabels[item.platform] ?? item.platform;
  const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
  const pipeline = PIPELINES.find((p) => p.slug === item.pipeline_slug);
  const signal = item.content_signals ?? null;

  return (
    <div className="pb-16">
      {/* Top navigation bar */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Review Queue
        </Link>

        <div className="flex items-center gap-2">
          {previousId ? (
            <Link
              href={`/review/${previousId}`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              <ChevronLeft className="h-3 w-3" />
              Previous
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-600">
              <ChevronLeft className="h-3 w-3" />
              Previous
            </span>
          )}
          {nextId ? (
            <Link
              href={`/review/${nextId}`}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              Next
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-600">
              Next
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* === Left column (65%): Content === */}
        <div className="space-y-4">
          {/* Platform badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-2.5 py-1">
              <PlatformIcon className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">
                {platformLabel}
              </span>
            </div>
            {pillar && (
              <Badge variant="secondary" className="text-xs">
                {pillar.name}
              </Badge>
            )}
          </div>

          {/* Editable Title */}
          <EditableTitle initialTitle={item.title} contentId={item.id} />

          {/* Editable Body */}
          <EditableBody
            initialBody={item.body ?? ''}
            contentId={item.id}
            platform={item.platform}
          />
        </div>

        {/* === Right column (35%): Metadata + Actions === */}
        <div className="space-y-4">
          {/* Source Signal */}
          <SourceSignalCard signal={signal} />

          {/* Metadata card */}
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-medium text-zinc-400">Details</h3>

            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Status</span>
              <Badge
                className={`text-xs ${getStatusColor(item.status)}`}
              >
                {item.status.replace(/_/g, ' ')}
              </Badge>
            </div>

            {/* Pipeline */}
            {pipeline && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Pipeline</span>
                <Link
                  href={`/pipelines/${item.pipeline_slug}`}
                  className="text-xs text-violet-400 transition-colors hover:text-violet-300"
                >
                  {pipeline.name}
                </Link>
              </div>
            )}

            {/* Quality Score */}
            {item.quality_score !== null && item.quality_score !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Quality Score</span>
                <div
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 ${getQualityBg(item.quality_score)}`}
                >
                  <Star
                    className={`h-3 w-3 ${getQualityColor(item.quality_score)}`}
                  />
                  <span
                    className={`text-xs font-semibold ${getQualityColor(item.quality_score)}`}
                  >
                    {item.quality_score}/10
                  </span>
                </div>
              </div>
            )}

            {/* Created */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Created</span>
              <div className="flex items-center gap-1 text-xs text-zinc-300">
                <Clock className="h-3 w-3 text-zinc-500" />
                {new Date(item.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
            </div>

            {/* Generation model */}
            {item.generation_model && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Model</span>
                <span className="text-xs text-zinc-300">
                  {item.generation_model}
                </span>
              </div>
            )}

            {/* Token usage */}
            {item.token_usage && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">Tokens</span>
                <span className="text-xs text-zinc-300">
                  {typeof item.token_usage === 'object' &&
                  item.token_usage !== null &&
                  'totalTokens' in item.token_usage
                    ? (
                        item.token_usage as { totalTokens: number }
                      ).totalTokens.toLocaleString()
                    : '-'}
                </span>
              </div>
            )}
          </div>

          {/* Review Actions */}
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-medium text-zinc-400">Actions</h3>
            <ReviewActions
              contentId={item.id}
              currentStatus={item.status}
              nextId={nextId}
              body={item.body ?? ''}
            />
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts (renders the hints bar) */}
      <KeyboardShortcuts
        contentId={item.id}
        nextId={nextId}
        previousId={previousId}
        body={item.body ?? ''}
      />
    </div>
  );
}
