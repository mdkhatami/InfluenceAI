import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPipeline } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  getPipelineRunDetail,
  getPipelineLogsAsc,
  getRunContentItems,
} from '@/lib/queries/pipelines';
import { LogTimeline } from '@/components/dashboard/log-timeline';
import {
  ArrowLeft,
  Radio,
  Filter,
  FileText,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'In progress...';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function getRunStatusBadge(status: string) {
  const map: Record<string, { variant: 'success' | 'destructive' | 'warning' | 'default' | 'secondary'; label: string }> = {
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'destructive', label: 'Failed' },
    partial_success: { variant: 'warning', label: 'Partial Success' },
    running: { variant: 'default', label: 'Running' },
  };
  const entry = map[status] ?? { variant: 'secondary' as const, label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function getPlatformLabel(platform: string): string {
  const map: Record<string, string> = {
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
    instagram: 'Instagram',
    youtube: 'YouTube',
  };
  return map[platform] ?? platform;
}

function getContentStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending_review: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    published: 'border-green-500/20 bg-green-500/10 text-green-400',
    rejected: 'border-red-500/20 bg-red-500/10 text-red-400',
    draft: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
    scheduled: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
  };
  return map[status] ?? map.draft;
}

export default async function PipelineRunDetailPage({
  params,
}: {
  params: Promise<{ slug: string; runId: string }>;
}) {
  const { slug, runId } = await params;

  const [run, logs, contentItems] = await Promise.all([
    getPipelineRunDetail(runId),
    getPipelineLogsAsc(runId),
    getRunContentItems(runId),
  ]);

  if (!run) notFound();

  const pipeline = getPipeline(slug);
  const pipelineName = pipeline?.name ?? slug;
  const duration = formatDuration(run.started_at ?? run.created_at, run.completed_at);
  const startedDate = new Date(run.started_at ?? run.created_at);
  const errorCount = logs.filter((l: { level: string }) => l.level === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href={`/pipelines/${slug}`}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-50">{pipelineName}</h1>
            {getRunStatusBadge(run.status)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span className="font-mono text-xs text-zinc-500" title={runId}>
              Run {runId.slice(0, 8)}...
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span>
              {startedDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              at{' '}
              {startedDate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="text-zinc-600">&middot;</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>

      {/* Run Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Radio className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Signals Ingested</p>
                <p className="text-xl font-bold text-zinc-50">{run.signals_ingested ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Filter className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Signals Filtered</p>
                <p className="text-xl font-bold text-zinc-50">{run.signals_filtered ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-500/10 p-2">
                <FileText className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Items Generated</p>
                <p className="text-xl font-bold text-zinc-50">{run.items_generated ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-400">Errors</p>
                <p className="text-xl font-bold text-zinc-50">{errorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Execution Log */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">
              Execution Log ({logs.length} entries)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogTimeline logs={logs} />
          </CardContent>
        </Card>
      )}

      {/* Generated Content */}
      {contentItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">
              Generated Content ({contentItems.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contentItems.map((item: {
              id: string;
              title: string;
              platform: string;
              status: string;
              quality_score: number | null;
              created_at: string;
            }) => (
              <Link
                key={item.id}
                href={`/review/${item.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 p-4 transition hover:border-zinc-700 hover:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-50">
                    {item.title || 'Untitled'}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {getPlatformLabel(item.platform)}
                    </Badge>
                    <Badge className={getContentStatusColor(item.status)}>
                      {item.status.replace('_', ' ')}
                    </Badge>
                    {item.quality_score != null && (
                      <span className="text-xs text-zinc-500">
                        Score: {item.quality_score}/10
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="ml-4 h-4 w-4 shrink-0 text-zinc-500" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Error Details */}
      {run.error && (
        <Card className="border-red-500/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-red-400">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm leading-relaxed text-red-300">
              {run.error}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {logs.length === 0 && contentItems.length === 0 && !run.error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-zinc-400">No log entries or content found for this run.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
