'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getPipeline } from '@influenceai/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatsCard } from '@/components/dashboard/stats-card';
import { cn, getAutomationColor } from '@/lib/utils';
import {
  ArrowLeft,
  Play,
  Activity,
  CheckCircle,
  Clock,
  FileText,
  GitBranch,
  Filter,
  Sparkles,
  Eye,
  Send,
  ChevronRight,
  RotateCw,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Pencil,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const pipeline = getPipeline('github-trends')!;

// --- Mock Data ---

const mockStats = {
  totalRuns: 47,
  successRate: '95.7%',
  avgTime: '2.3 min',
  postsPublished: 43,
};

const weeklyRuns = [
  { day: 'Mon', runs: 1, success: 1 },
  { day: 'Tue', runs: 1, success: 1 },
  { day: 'Wed', runs: 1, success: 0 },
  { day: 'Thu', runs: 2, success: 2 },
  { day: 'Fri', runs: 1, success: 1 },
  { day: 'Sat', runs: 1, success: 1 },
  { day: 'Sun', runs: 0, success: 0 },
];

const mockRuns = [
  { id: 'run-047', startedAt: '2026-03-26T08:00:00Z', duration: '2m 14s', status: 'success', items: 1 },
  { id: 'run-046', startedAt: '2026-03-25T08:00:00Z', duration: '2m 31s', status: 'success', items: 1 },
  { id: 'run-045', startedAt: '2026-03-24T08:00:00Z', duration: '1m 58s', status: 'success', items: 1 },
  { id: 'run-044', startedAt: '2026-03-23T08:00:00Z', duration: '3m 02s', status: 'failed', items: 0 },
  { id: 'run-043', startedAt: '2026-03-22T08:00:00Z', duration: '2m 45s', status: 'success', items: 1 },
  { id: 'run-042', startedAt: '2026-03-21T08:00:00Z', duration: '2m 10s', status: 'success', items: 1 },
  { id: 'run-041', startedAt: '2026-03-20T08:00:00Z', duration: '2m 22s', status: 'success', items: 1 },
  { id: 'run-040', startedAt: '2026-03-19T08:00:00Z', duration: '2m 55s', status: 'success', items: 1 },
  { id: 'run-039', startedAt: '2026-03-18T08:00:00Z', duration: '4m 12s', status: 'failed', items: 0 },
  { id: 'run-038', startedAt: '2026-03-17T08:00:00Z', duration: '2m 08s', status: 'success', items: 1 },
];

const mockContent = [
  {
    id: 'gc-1',
    title: '3 AI repos blowing up on GitHub right now — and what you can build with them',
    preview: 'A repo just hit 5K stars in 48 hours and nobody is talking about it yet. Here\'s why it matters for anyone building AI products...',
    status: 'published',
    createdAt: '2026-03-26T08:02:00Z',
    platforms: ['linkedin'],
  },
  {
    id: 'gc-2',
    title: 'This open-source alternative to GPT-4 just changed the game',
    preview: 'Forget the hype. This repo is actually delivering results that rival closed models — and you can run it on a single GPU...',
    status: 'approved',
    createdAt: '2026-03-25T08:03:00Z',
    platforms: ['linkedin'],
  },
  {
    id: 'gc-3',
    title: 'The GitHub repo every AI engineer will be using by next month',
    preview: 'I\'ve been tracking AI repos for 6 months. This one is different. Here\'s a real workflow you can set up in 10 minutes...',
    status: 'in_review',
    createdAt: '2026-03-24T08:01:00Z',
    platforms: ['linkedin', 'twitter'],
  },
  {
    id: 'gc-4',
    title: 'Stop building RAG from scratch — this repo does 90% of the work',
    preview: 'RAG pipelines are tedious to build. This trending project abstracts away the pain points while keeping you in control...',
    status: 'published',
    createdAt: '2026-03-23T08:04:00Z',
    platforms: ['linkedin'],
  },
  {
    id: 'gc-5',
    title: 'The AI agent framework nobody expected just went viral on GitHub',
    preview: 'While everyone debates multi-agent architectures, this repo quietly shipped a working solution. Here\'s what makes it different...',
    status: 'draft',
    createdAt: '2026-03-22T08:02:00Z',
    platforms: ['linkedin'],
  },
];

const stepTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  ingest: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  filter: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  generate: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  review: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  publish: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

const statusColors: Record<string, string> = {
  published: 'text-emerald-400 bg-emerald-400/10',
  approved: 'text-blue-400 bg-blue-400/10',
  in_review: 'text-amber-400 bg-amber-400/10',
  draft: 'text-zinc-400 bg-zinc-400/10',
  rejected: 'text-red-400 bg-red-400/10',
};

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
      <p className="mb-1 text-xs font-medium text-zinc-400">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-300">{entry.name}:</span>
          <span className="font-medium text-zinc-50">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function GitHubTrendsPage() {
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 3000);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/pipelines"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-50">{pipeline.name}</h1>
              <Badge className={cn('text-xs', getAutomationColor(pipeline.automationLevel))}>
                High Automation
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-zinc-400">{pipeline.description}</p>
          </div>
        </div>
        <Button
          onClick={handleRun}
          disabled={isRunning}
          className="bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:from-blue-600 hover:to-violet-600"
        >
          {isRunning ? (
            <>
              <RotateCw className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Pipeline
            </>
          )}
        </Button>
      </div>

      {/* Pipeline Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400">Pipeline Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {pipeline.steps.map((step, i) => {
              const colors = stepTypeColors[step.type] || stepTypeColors.ingest;
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex min-w-[160px] flex-col items-center rounded-xl border p-4 transition-all',
                      colors.bg,
                      colors.border,
                    )}
                  >
                    <div className={cn('mb-2 rounded-full p-2', colors.bg)}>
                      {step.type === 'ingest' && <GitBranch className={cn('h-4 w-4', colors.text)} />}
                      {step.type === 'filter' && <Filter className={cn('h-4 w-4', colors.text)} />}
                      {step.type === 'generate' && <Sparkles className={cn('h-4 w-4', colors.text)} />}
                      {step.type === 'review' && <Eye className={cn('h-4 w-4', colors.text)} />}
                      {step.type === 'publish' && <Send className={cn('h-4 w-4', colors.text)} />}
                    </div>
                    <span className={cn('text-xs font-medium', colors.text)}>{step.name}</span>
                    <span className="mt-1 text-[10px] text-zinc-500">
                      {step.automated ? 'Automated' : 'Manual'}
                    </span>
                  </div>
                  {i < pipeline.steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-600" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Run History</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="content">Generated Content</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard title="Total Runs" value={String(mockStats.totalRuns)} change="Since launch" changeType="neutral" icon={Activity} />
            <StatsCard title="Success Rate" value={mockStats.successRate} change="+2.1% this month" changeType="positive" icon={CheckCircle} />
            <StatsCard title="Avg Generation Time" value={mockStats.avgTime} change="-0.4s improvement" changeType="positive" icon={Clock} />
            <StatsCard title="Posts Published" value={String(mockStats.postsPublished)} change="+7 this week" changeType="positive" icon={FileText} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Runs This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyRuns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#71717a' }} stroke="#27272a" />
                      <YAxis tick={{ fontSize: 12, fill: '#71717a' }} stroke="#27272a" />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="success" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Successful" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Scheduled Run</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="rounded-full bg-blue-500/10 p-4">
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
                <p className="mt-4 text-lg font-semibold text-zinc-50">Tomorrow at 8:00 AM</p>
                <p className="mt-1 text-sm text-zinc-400">Daily schedule: 0 8 * * *</p>
                <p className="mt-4 text-xs text-zinc-500">
                  Last generated content preview:
                </p>
                <p className="mt-2 max-w-md text-center text-sm leading-relaxed text-zinc-300">
                  &ldquo;3 AI repos blowing up on GitHub right now — and what you can build with them&rdquo;
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Run History Tab */}
        <TabsContent value="history" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Run ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Started At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {mockRuns.map((run) => (
                      <tr key={run.id} className="transition hover:bg-zinc-800/50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-zinc-300">{run.id}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">
                          {new Date(run.startedAt).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{run.duration}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <Badge className={run.status === 'success' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}>
                            {run.status === 'success' ? (
                              <CheckCircle className="mr-1 h-3 w-3" />
                            ) : (
                              <XCircle className="mr-1 h-3 w-3" />
                            )}
                            {run.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">{run.items}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Schedule</CardTitle>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Cron Expression</span>
                  <code className="rounded bg-zinc-800 px-2 py-1 text-sm text-blue-400">0 8 * * *</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Human Readable</span>
                  <span className="text-sm text-zinc-200">Daily at 8:00 AM UTC</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Timezone</span>
                  <span className="text-sm text-zinc-200">UTC</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Filters</CardTitle>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Languages</span>
                  <div className="flex gap-1">
                    {['Python', 'TypeScript', 'Rust'].map((lang) => (
                      <Badge key={lang} variant="secondary" className="text-xs">{lang}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Min Stars</span>
                  <span className="text-sm text-zinc-200">100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Topics</span>
                  <div className="flex gap-1">
                    {['AI', 'ML', 'LLM'].map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>LLM Model</CardTitle>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Provider</span>
                  <span className="text-sm text-zinc-200">LiteLLM Proxy</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Model</span>
                  <code className="rounded bg-zinc-800 px-2 py-1 text-sm text-violet-400">anthropic/claude-sonnet</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Temperature</span>
                  <span className="text-sm text-zinc-200">0.8</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Max Tokens</span>
                  <span className="text-sm text-zinc-200">1,500</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Output</CardTitle>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Target Platform</span>
                  <Badge className="text-blue-400 bg-blue-400/10">LinkedIn</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Content Format</span>
                  <span className="text-sm text-zinc-200">Text Post</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Review Required</span>
                  <span className="text-sm text-emerald-400">Yes</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Prompt Template</CardTitle>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-zinc-800 p-4 text-sm leading-relaxed text-zinc-300">
                {`System: You are an AI content strategist who creates engaging LinkedIn posts
about trending GitHub repositories...

User: Here are the top trending AI/ML GitHub repositories today:
{{repos}}

Write a LinkedIn post about the top 3 most interesting repos.
Focus on what someone can BUILD with them today.`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generated Content Tab */}
        <TabsContent value="content" className="space-y-4 pt-4">
          {mockContent.map((item) => (
            <Card key={item.id} className="transition hover:border-zinc-700">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={statusColors[item.status] || 'text-zinc-400 bg-zinc-400/10'}>
                        {item.status.replace('_', ' ')}
                      </Badge>
                      {item.platforms.map((p) => (
                        <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                      <span className="text-xs text-zinc-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-50">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.preview}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10">
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 hover:bg-amber-400/10">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
