'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RelevanceBadge } from './relevance-badge';
import { ExternalLink, CheckCircle } from 'lucide-react';

interface SignalCardProps {
  signal: {
    id: string;
    source_type: string;
    title: string;
    summary: string | null;
    url: string | null;
    scored_relevance: number | null;
    ingested_at: string;
    has_research_brief?: boolean;
  };
}

export function SignalCard({ signal }: SignalCardProps) {
  const router = useRouter();
  const timeAgo = getTimeAgo(new Date(signal.ingested_at));

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {signal.source_type}
            </Badge>
            {signal.scored_relevance !== null && (
              <RelevanceBadge score={signal.scored_relevance} />
            )}
            <span className="text-xs text-zinc-500">{timeAgo}</span>
            {signal.has_research_brief && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
          </div>

          <h3 className="text-sm font-medium text-zinc-50">{signal.title}</h3>

          {signal.summary && (
            <p className="text-xs text-zinc-400 line-clamp-2">{signal.summary}</p>
          )}

          {signal.url && (
            <a
              href={signal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400"
            >
              <ExternalLink className="h-3 w-3" />
              {new URL(signal.url).hostname}
            </a>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {signal.has_research_brief ? (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => router.push(`/investigate/${signal.id}`)}
            >
              View Brief
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="text-xs"
              onClick={() => router.push(`/investigate/${signal.id}`)}
            >
              Investigate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
