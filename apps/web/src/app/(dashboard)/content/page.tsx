'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn, getStatusColor, getPillarColor, formatNumber } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import type { ContentStatus, Platform } from '@influenceai/core';
import {
  Plus,
  Search,
  Linkedin,
  Instagram,
  Youtube,
  Twitter,
  FileText,
  Filter,
} from 'lucide-react';

// --- Mock Data ---

interface MockContent {
  id: string;
  title: string;
  pillarSlug: string;
  platform: Platform;
  status: ContentStatus;
  engagement?: { views: number; likes: number; comments: number };
  createdAt: string;
}

const mockContent: MockContent[] = [
  { id: '1', title: '3 GitHub Repos Rewriting the AI Stack in 2026', pillarSlug: 'breaking-ai-news', platform: 'linkedin', status: 'published', engagement: { views: 12400, likes: 342, comments: 47 }, createdAt: '2026-03-24T08:00:00Z' },
  { id: '2', title: 'OpenAI\'s Org Restructuring Signals a Seismic Shift in AI Strategy', pillarSlug: 'breaking-ai-news', platform: 'linkedin', status: 'published', engagement: { views: 8900, likes: 256, comments: 38 }, createdAt: '2026-03-23T09:00:00Z' },
  { id: '3', title: 'Why RAG Is Quietly Replacing Fine-Tuning Everywhere', pillarSlug: 'reshared-posts', platform: 'linkedin', status: 'scheduled', createdAt: '2026-03-25T06:00:00Z' },
  { id: '4', title: 'The LLM Routing Pattern That Saved Us $40K/Month', pillarSlug: 'inside-the-machine', platform: 'linkedin', status: 'approved', createdAt: '2026-03-25T05:30:00Z' },
  { id: '5', title: 'I Tested 7 AI Code Assistants. Here\'s What Actually Works.', pillarSlug: 'hype-detector', platform: 'youtube', status: 'in_review', createdAt: '2026-03-25T04:00:00Z' },
  { id: '6', title: 'Claude 4 vs GPT-5: A Real-World Benchmark Nobody Is Talking About', pillarSlug: 'hype-detector', platform: 'instagram', status: 'draft', createdAt: '2026-03-25T03:00:00Z' },
  { id: '7', title: 'How to Build an AI Agent That Actually Ships', pillarSlug: 'live-demos', platform: 'youtube', status: 'published', engagement: { views: 24300, likes: 890, comments: 124 }, createdAt: '2026-03-21T10:00:00Z' },
  { id: '8', title: 'The 5 AI Jobs That Will Exist in 2028 (And How to Prepare)', pillarSlug: 'strategy-career', platform: 'linkedin', status: 'in_review', createdAt: '2026-03-25T02:00:00Z' },
  { id: '9', title: 'My $2K AI Podcast Experiment Failed. Here\'s What I Learned.', pillarSlug: 'failure-lab', platform: 'linkedin', status: 'published', engagement: { views: 15600, likes: 521, comments: 89 }, createdAt: '2026-03-20T09:00:00Z' },
  { id: '10', title: 'Inside Anthropic\'s Approach to AI Safety: What Most People Miss', pillarSlug: 'inside-the-machine', platform: 'linkedin', status: 'draft', createdAt: '2026-03-25T01:00:00Z' },
  { id: '11', title: 'Multimodal AI: 3 Use Cases That Are Actually Production-Ready', pillarSlug: 'breaking-ai-news', platform: 'instagram', status: 'scheduled', createdAt: '2026-03-24T15:00:00Z' },
  { id: '12', title: 'The Agentic Workflow Pattern Every Dev Should Know', pillarSlug: 'reshared-posts', platform: 'twitter', status: 'published', engagement: { views: 5200, likes: 187, comments: 23 }, createdAt: '2026-03-22T11:00:00Z' },
  { id: '13', title: 'Building a RAG Pipeline from Scratch with LangChain', pillarSlug: 'live-demos', platform: 'youtube', status: 'in_review', createdAt: '2026-03-24T14:00:00Z' },
  { id: '14', title: 'AI Won\'t Replace You. Someone Using AI Will.', pillarSlug: 'strategy-career', platform: 'linkedin', status: 'published', engagement: { views: 31200, likes: 1240, comments: 203 }, createdAt: '2026-03-19T08:00:00Z' },
  { id: '15', title: 'This Open-Source LLM Just Beat GPT-4 on HumanEval', pillarSlug: 'breaking-ai-news', platform: 'linkedin', status: 'draft', createdAt: '2026-03-25T00:30:00Z' },
  { id: '16', title: 'Voice Cloning in 2026: What\'s Possible and What\'s Ethical', pillarSlug: 'hype-detector', platform: 'youtube', status: 'in_review', createdAt: '2026-03-24T16:00:00Z' },
  { id: '17', title: 'How We Automated 80% of Our Content Pipeline', pillarSlug: 'inside-the-machine', platform: 'linkedin', status: 'published', engagement: { views: 9400, likes: 312, comments: 56 }, createdAt: '2026-03-18T09:00:00Z' },
  { id: '18', title: 'The Real Cost of Running AI in Production', pillarSlug: 'failure-lab', platform: 'instagram', status: 'draft', createdAt: '2026-03-24T20:00:00Z' },
];

const platformIcons: Record<Platform, typeof Linkedin> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

const statusLabels: Record<ContentStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  revision_requested: 'Revision',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
};

const statusBadgeVariant: Record<ContentStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  in_review: 'warning',
  revision_requested: 'warning',
  approved: 'default',
  scheduled: 'default',
  published: 'success',
  rejected: 'destructive',
  archived: 'outline',
};

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState('all');

  const filteredContent = activeTab === 'all'
    ? mockContent
    : mockContent.filter((c) => c.status === activeTab);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Content Library</h1>
          <p className="mt-1 text-zinc-400">{mockContent.length} total pieces of content</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Content
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="in_review">In Review</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search content..."
              className="bg-transparent text-sm text-zinc-50 placeholder-zinc-500 outline-none w-48"
            />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-3 w-3" />
            Filter
          </Button>
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
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Pillar</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Platform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Engagement</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredContent.map((item) => {
                  const pillar = PILLARS.find((p) => p.slug === item.pillarSlug);
                  const PlatformIcon = platformIcons[item.platform];
                  return (
                    <tr key={item.id} className="cursor-pointer transition-colors hover:bg-zinc-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                          <span className="text-sm font-medium text-zinc-50 line-clamp-1">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {pillar && (
                          <Badge className={cn('text-xs', getPillarColor(pillar.color))}>
                            {pillar.name.split(' \u2192')[0]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <PlatformIcon className="h-4 w-4 text-zinc-400" />
                          <span className="text-sm capitalize text-zinc-400">{item.platform}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusBadgeVariant[item.status]}>
                          {statusLabels[item.status]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {item.engagement ? (
                          <div className="text-sm text-zinc-300">
                            <span>{formatNumber(item.engagement.views)} views</span>
                            <span className="mx-1 text-zinc-600">&middot;</span>
                            <span>{formatNumber(item.engagement.likes)} likes</span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-600">&mdash;</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-zinc-500">
                          {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
