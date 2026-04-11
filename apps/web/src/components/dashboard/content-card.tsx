import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, getPillarColor, getRelativeTime } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Star,
  ArrowRight,
} from 'lucide-react';

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const platformColors: Record<string, string> = {
  linkedin: 'text-blue-400',
  instagram: 'text-pink-400',
  youtube: 'text-red-400',
  twitter: 'text-zinc-300',
};

interface ContentCardProps {
  item: {
    id: string;
    title: string;
    body: string | null;
    platform: string;
    pillar_slug: string;
    pipeline_slug?: string | null;
    quality_score: number | null;
    status: string;
    created_at: string;
  };
}

export function ContentCard({ item }: ContentCardProps) {
  const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
  const PlatformIcon = platformIcons[item.platform] ?? FileText;
  const platformColor = platformColors[item.platform] ?? 'text-zinc-400';

  const bodyPreview = item.body
    ? item.body.length > 150
      ? item.body.slice(0, 150) + '...'
      : item.body
    : null;

  const pipelineLabel = item.pipeline_slug
    ? item.pipeline_slug
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ')
    : null;

  return (
    <Card className="transition-all duration-200 hover:border-zinc-700">
      <CardContent className="p-5">
        {/* Top row: badges */}
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="ml-auto flex items-center gap-1.5">
            <PlatformIcon className={cn('h-3.5 w-3.5', platformColor)} />
            <span className="text-xs text-zinc-500 capitalize">{item.platform}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-3 text-base font-semibold text-zinc-50 line-clamp-1">
          {item.title}
        </h3>

        {/* Body preview */}
        {bodyPreview && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-400 line-clamp-3">
            {bodyPreview}
          </p>
        )}

        {/* Footer: time + action */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {getRelativeTime(item.created_at)}
          </span>
          <Link
            href={`/review/${item.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 transition-colors hover:text-violet-300"
          >
            Review
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
