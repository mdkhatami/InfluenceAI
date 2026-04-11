import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Newspaper, Github, Radio, Rss } from 'lucide-react';

interface SourceSignal {
  title: string;
  url: string;
  summary: string | null;
  source: string;
  source_type: string | null;
}

interface SourceSignalCardProps {
  signal: SourceSignal | null;
}

const sourceTypeIcons: Record<string, typeof Github> = {
  github_trending: Github,
  rss: Rss,
  hackernews: Newspaper,
  twitter: Radio,
};

const sourceTypeLabels: Record<string, string> = {
  github_trending: 'GitHub Trending',
  rss: 'RSS Feed',
  hackernews: 'Hacker News',
  twitter: 'Twitter/X',
};

export function SourceSignalCard({ signal }: SourceSignalCardProps) {
  if (!signal) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardContent className="p-4">
          <p className="text-sm text-zinc-500">No source signal linked</p>
        </CardContent>
      </Card>
    );
  }

  const SourceIcon = sourceTypeIcons[signal.source_type ?? ''] ?? Newspaper;
  const sourceLabel = sourceTypeLabels[signal.source_type ?? ''] ?? signal.source;
  const truncatedSummary =
    signal.summary && signal.summary.length > 200
      ? signal.summary.slice(0, 200) + '...'
      : signal.summary;

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-zinc-400">
            Source Signal
          </CardTitle>
          <Badge variant="secondary" className="gap-1 text-xs">
            <SourceIcon className="h-3 w-3" />
            {sourceLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <h4 className="font-medium text-zinc-200">{signal.title}</h4>

        {truncatedSummary && (
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {truncatedSummary}
          </p>
        )}

        {signal.url && (
          <a
            href={signal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-400 transition-colors hover:text-violet-300"
          >
            <ExternalLink className="h-3 w-3" />
            View original source
          </a>
        )}
      </CardContent>
    </Card>
  );
}
