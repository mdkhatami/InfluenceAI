'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { DailyMenuItem } from '@/lib/types/daily-menu';

const readinessConfig: Record<
  string,
  { label: string; color: string; borderColor: string }
> = {
  ready_to_post: {
    label: 'READY TO POST',
    color: 'text-green-400',
    borderColor: 'border-l-green-500',
  },
  pick_an_angle: {
    label: 'PICK AN ANGLE',
    color: 'text-violet-400',
    borderColor: 'border-l-violet-500',
  },
  callback: {
    label: 'CALLBACK OPPORTUNITY',
    color: 'text-amber-400',
    borderColor: 'border-l-amber-500',
  },
  trend_alert: {
    label: 'TREND ALERT',
    color: 'text-blue-400',
    borderColor: 'border-l-blue-500',
  },
  story_seed: {
    label: 'COLLISION DETECTED',
    color: 'text-orange-400',
    borderColor: 'border-l-orange-500',
  },
};

export function MenuItemCard({ item }: { item: DailyMenuItem }) {
  const config = readinessConfig[item.readiness] || readinessConfig.ready_to_post;

  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 border-l-4 ${config.borderColor}`}
    >
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className={config.color}>{config.label}</span>
        <span>&middot;</span>
        <span>{item.estimatedEffort}</span>
        {item.platforms.map((p) => (
          <span key={p} className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded">
            {p}
          </span>
        ))}
      </div>
      <h3 className="text-lg font-medium text-zinc-100 mt-1">{item.title}</h3>
      <p className="text-sm text-zinc-400 mt-1">{item.reason}</p>
      <MenuActions item={item} />
    </div>
  );
}

function MenuActions({ item }: { item: DailyMenuItem }) {
  const router = useRouter();

  switch (item.readiness) {
    case 'ready_to_post':
      return (
        <div className="flex gap-2 mt-3">
          {item.draftId && (
            <Button size="sm" onClick={() => router.push('/review')}>
              Review Draft
            </Button>
          )}
          <Button size="sm" variant="outline">
            Skip
          </Button>
        </div>
      );

    case 'pick_an_angle':
      return <AnglePickerInline item={item} />;

    case 'callback':
      return (
        <div className="flex gap-2 mt-3">
          <Button size="sm">Write Follow-Up</Button>
          <Button size="sm" variant="outline">
            Dismiss
          </Button>
        </div>
      );

    case 'trend_alert':
      return (
        <div className="flex gap-2 mt-3">
          <Button size="sm">Write Post</Button>
          <Button size="sm" variant="outline">
            Track Silently
          </Button>
          <Button size="sm" variant="outline">
            Skip
          </Button>
        </div>
      );

    case 'story_seed':
      return (
        <div className="flex gap-2 mt-3">
          <Button size="sm">Develop Story</Button>
          <Button size="sm" variant="outline">
            See Research
          </Button>
          <Button size="sm" variant="outline">
            Skip
          </Button>
        </div>
      );

    default:
      return null;
  }
}

function AnglePickerInline({ item }: { item: DailyMenuItem }) {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleSelect = async (angleId: string) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/creation/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          researchBriefId: item.researchBriefId,
          angleCardId: angleId,
          platform: 'linkedin',
        }),
      });
      const result = await res.json();
      if (result.contentItemId) {
        window.location.href = '/review';
      }
    } catch {
      setGenerating(false);
    }
  };

  if (!expanded) {
    return (
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={() => setExpanded(true)}>
          View {item.angleCards?.length || 0} Angles
        </Button>
        <Button size="sm" variant="outline">
          Skip
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 mt-3">
      {(item.angleCards || []).map((card: Record<string, unknown>) => (
        <div
          key={card.id as string}
          className="p-3 rounded-lg bg-zinc-800 border border-zinc-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-violet-400 uppercase">
              {(String(card.angle_type || '')).replace(/_/g, ' ')}
            </span>
            <span
              className={`text-xs ${
                card.estimated_engagement === 'high'
                  ? 'text-green-400'
                  : card.estimated_engagement === 'medium'
                    ? 'text-amber-400'
                    : 'text-zinc-500'
              }`}
            >
              {card.estimated_engagement as string} engagement
            </span>
          </div>
          <p className="text-zinc-100 mt-1 font-medium">
            &ldquo;{card.hook as string}&rdquo;
          </p>
          <p className="text-zinc-400 text-sm mt-1">{card.thesis as string}</p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-zinc-500">
              via {card.domain_source as string} agent
            </span>
            <Button
              size="sm"
              onClick={() => handleSelect(card.id as string)}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Select'}
            </Button>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>
        Collapse
      </Button>
    </div>
  );
}
