'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContentActions } from '@/components/dashboard/content-actions';
import { cn, getPillarColor } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  Clock,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  ChevronDown,
  ChevronUp,
  Star,
} from 'lucide-react';

const platformIcons: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

interface ReviewCardProps {
  item: {
    id: string;
    title: string;
    body: string | null;
    platform: string;
    pillar_slug: string;
    quality_score: number | null;
    status: string;
    created_at: string;
    pipeline_slug?: string | null;
  };
}

export function ReviewCard({ item }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
  const PlatformIcon = platformIcons[item.platform] || Linkedin;

  return (
    <Card className="transition-all duration-200 hover:border-zinc-700">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          {item.pipeline_slug && (
            <Badge variant="secondary" className="gap-1 text-xs">
              {item.pipeline_slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}
            </Badge>
          )}
          {pillar && (
            <Badge className={cn('text-xs', getPillarColor(pillar.color))}>
              {pillar.name.split(' \u2192')[0]}
            </Badge>
          )}
          {item.quality_score !== null && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Star className="h-3 w-3" />
              {item.quality_score}/10
            </Badge>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <div className="rounded-md bg-zinc-800 p-1.5" title={item.platform}>
              <PlatformIcon className="h-3.5 w-3.5 text-zinc-400" />
            </div>
          </div>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-zinc-50">{item.title}</h3>

        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="h-3 w-3" />
          <span>
            Generated {new Date(item.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </span>
        </div>

        {/* Content Preview */}
        {item.body && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <p className={cn(
              'whitespace-pre-wrap text-sm leading-relaxed text-zinc-300',
              !expanded && 'line-clamp-4'
            )}>
              {item.body}
            </p>
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}

        {/* Actions */}
        {item.status === 'pending_review' && (
          <div className="mt-4">
            <ContentActions
              contentId={item.id}
              currentStatus={item.status}
              currentBody={item.body ?? undefined}
            />
          </div>
        )}

        {item.status === 'approved' && (
          <div className="mt-4">
            <Badge variant="success">Approved</Badge>
          </div>
        )}

        {item.status === 'rejected' && (
          <div className="mt-4">
            <Badge variant="destructive">Rejected</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
