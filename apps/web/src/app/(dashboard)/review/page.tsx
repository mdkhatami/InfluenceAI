'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn, getPillarColor } from '@/lib/utils';
import { PILLARS } from '@influenceai/core';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  Linkedin,
  Instagram,
  Youtube,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  Radio,
  Radar,
} from 'lucide-react';

interface ReviewItem {
  id: string;
  title: string;
  pipelineName: string;
  pipelineIcon: typeof GitBranch;
  pillarSlug: string;
  platforms: Array<{ icon: typeof Linkedin; name: string }>;
  content: string;
  generatedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

const mockPending: ReviewItem[] = [
  {
    id: 'r1',
    title: '3 GitHub Repos Rewriting the AI Stack This Week',
    pipelineName: 'GitHub Trends',
    pipelineIcon: GitBranch,
    pillarSlug: 'breaking-ai-news',
    platforms: [{ icon: Linkedin, name: 'LinkedIn' }],
    content: 'Everyone is talking about LLMs. But the real action is happening in the repos.\n\nThis week, 3 projects caught my eye:\n\n1. vLLM just hit 50K stars. Why? Because inference speed is the new moat. Their PagedAttention algorithm cuts memory waste by 90%.\n\n2. Instructor by @jxnlco makes structured outputs from LLMs dead simple. No more regex parsing. No more prayer-driven development.\n\n3. DSPy from Stanford is rewriting how we think about prompting. Instead of crafting prompts, you define signatures and let the framework optimize.\n\nThe pattern? Developer tooling around LLMs is maturing fast. The winners aren\'t building models \u2014 they\'re building the picks and shovels.',
    generatedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    status: 'pending',
  },
  {
    id: 'r2',
    title: 'Why Every Enterprise AI Project Starts with RAG Now',
    pipelineName: 'Signal Amplifier',
    pipelineIcon: Radio,
    pillarSlug: 'reshared-posts',
    platforms: [{ icon: Linkedin, name: 'LinkedIn' }, { icon: Instagram, name: 'Instagram' }],
    content: 'Interesting thread from @AndrewYNg on enterprise AI adoption.\n\nHis take: "Fine-tuning is overrated for 90% of enterprise use cases."\n\nHere\'s what I\'d add:\n\nRAG (Retrieval-Augmented Generation) has become the default architecture because:\n\n\u2022 No training costs\n\u2022 Data stays fresh automatically\n\u2022 You can audit every source\n\u2022 Hallucinations drop dramatically\n\nThe real insight? Companies don\'t need smarter models. They need smarter retrieval. The bottleneck was never the LLM \u2014 it was always the data pipeline.',
    generatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    status: 'pending',
  },
  {
    id: 'r3',
    title: 'Anthropic Just Changed the Agent Game with MCP',
    pipelineName: 'AI Release Radar',
    pipelineIcon: Radar,
    pillarSlug: 'breaking-ai-news',
    platforms: [{ icon: Linkedin, name: 'LinkedIn' }],
    content: 'Anthropic quietly released Model Context Protocol (MCP) and it\'s a bigger deal than most realize.\n\nWhat is it? An open standard for connecting AI models to external tools and data sources.\n\nWhy it matters:\n\n\u2022 Universal tool use: One protocol, any model\n\u2022 Stateful sessions: Context persists across interactions\n\u2022 Security-first: Sandboxed execution with audit trails\n\nThis is the USB-C moment for AI agents. Instead of every provider building proprietary tool integrations, MCP creates a shared standard.\n\nThe companies that adopt MCP early will have a massive integration advantage.',
    generatedAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    status: 'pending',
  },
  {
    id: 'r4',
    title: 'The Hidden Cost of Running AI in Production',
    pipelineName: 'Signal Amplifier',
    pipelineIcon: Radio,
    pillarSlug: 'inside-the-machine',
    platforms: [{ icon: Linkedin, name: 'LinkedIn' }, { icon: Youtube, name: 'YouTube' }],
    content: 'We spent $14K on AI API costs last month.\n\nBut the real cost was the 200 engineering hours we didn\'t account for.\n\nHere\'s the breakdown nobody talks about:\n\n\u2022 Prompt engineering & testing: 40 hrs\n\u2022 Monitoring & debugging hallucinations: 35 hrs\n\u2022 Building evaluation pipelines: 50 hrs\n\u2022 Rate limit handling & retry logic: 25 hrs\n\u2022 Cost optimization & caching: 50 hrs\n\nThe API bill is the tip of the iceberg. The operational overhead of AI in production is 3-5x what most teams budget for.\n\nLesson learned: budget for the humans, not just the tokens.',
    generatedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: 'pending',
  },
  {
    id: 'r5',
    title: 'Open-Source AI is Winning. Here\'s the Scoreboard.',
    pipelineName: 'GitHub Trends',
    pipelineIcon: GitBranch,
    pillarSlug: 'hype-detector',
    platforms: [{ icon: Linkedin, name: 'LinkedIn' }, { icon: Instagram, name: 'Instagram' }],
    content: 'Hot take: Open-source AI models will capture 60%+ market share by end of 2027.\n\nThe evidence is already here:\n\n\u2022 Llama 3.1 405B matches GPT-4 on most benchmarks\n\u2022 Mistral\'s models dominate the efficiency frontier\n\u2022 DeepSeek proved you can train frontier models for $5M\n\nBut here\'s the nuance most miss:\n\nOpen-source wins on flexibility and cost. Closed-source wins on ease of use and safety.\n\nThe real question isn\'t "which is better?" It\'s "which trade-offs matter for YOUR use case?"\n\nVerdict: Not hype. The shift is real and accelerating.',
    generatedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    status: 'pending',
  },
];

const mockApproved: ReviewItem[] = [
  {
    id: 'a1',
    title: 'LLM Routing: The Architecture Pattern Nobody Talks About',
    pipelineName: 'Signal Amplifier',
    pipelineIcon: Radio,
    pillarSlug: 'inside-the-machine',
    platforms: [{ icon: Linkedin, name: 'LinkedIn' }],
    content: 'We route 40% of our LLM calls to smaller models now. Our quality metrics didn\'t drop. Our costs dropped 65%...',
    generatedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: 'approved',
  },
];

const mockRejected: ReviewItem[] = [
  {
    id: 'x1',
    title: 'AI Will Replace All Software Engineers by 2028',
    pipelineName: 'Signal Amplifier',
    pipelineIcon: Radio,
    pillarSlug: 'hype-detector',
    platforms: [{ icon: Linkedin, name: 'LinkedIn' }],
    content: 'A viral claim from a VC went around this week suggesting all coding jobs will be automated...',
    generatedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    status: 'rejected',
  },
];

function ReviewCard({ item }: { item: ReviewItem }) {
  const [expanded, setExpanded] = useState(false);
  const pillar = PILLARS.find((p) => p.slug === item.pillarSlug);
  const PipelineIcon = item.pipelineIcon;

  return (
    <Card className="transition-all duration-200 hover:border-zinc-700">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <PipelineIcon className="h-3 w-3" />
            {item.pipelineName}
          </Badge>
          {pillar && (
            <Badge className={cn('text-xs', getPillarColor(pillar.color))}>
              {pillar.name.split(' \u2192')[0]}
            </Badge>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {item.platforms.map(({ icon: PIcon, name }) => (
              <div key={name} className="rounded-md bg-zinc-800 p-1.5" title={name}>
                <PIcon className="h-3.5 w-3.5 text-zinc-400" />
              </div>
            ))}
          </div>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-zinc-50">{item.title}</h3>

        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
          <Clock className="h-3 w-3" />
          <span>
            Generated {new Date(item.generatedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </span>
        </div>

        {/* Content Preview */}
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <p className={cn(
            'whitespace-pre-wrap text-sm leading-relaxed text-zinc-300',
            !expanded && 'line-clamp-4'
          )}>
            {item.content}
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>

        {/* Actions */}
        {item.status === 'pending' && (
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 shadow-none">
              <CheckCircle className="mr-2 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button size="sm" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 shadow-none">
              <MessageSquare className="mr-2 h-3.5 w-3.5" />
              Request Changes
            </Button>
            <Button size="sm" className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 shadow-none">
              <XCircle className="mr-2 h-3.5 w-3.5" />
              Reject
            </Button>
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

export default function ReviewPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-zinc-50">Review Queue</h1>
        <Badge variant="warning" className="text-sm">{mockPending.length} pending</Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({mockPending.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({mockApproved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({mockRejected.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="space-y-4">
            {mockPending.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="approved">
          <div className="space-y-4">
            {mockApproved.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rejected">
          <div className="space-y-4">
            {mockRejected.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
