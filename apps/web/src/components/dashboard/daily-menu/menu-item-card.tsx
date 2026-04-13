'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AnglePicker } from './angle-picker';
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
  const router = useRouter();
  const config = readinessConfig[item.readiness] || readinessConfig.ready_to_post;

  // Special rendering for pick_an_angle items
  if (item.readiness === 'pick_an_angle') {
    return (
      <div className="rounded-lg border-l-4 border-l-violet-500 border border-zinc-800 bg-zinc-900 p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-medium text-zinc-50">{item.title}</h3>
              <p className="text-xs text-zinc-400">{item.reason}</p>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{item.estimatedEffort}</span>
                {item.platforms && item.platforms.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{item.platforms.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {item.angleCards && item.angleCards.length > 0 && (
            <AnglePicker
              angles={item.angleCards}
              onSelect={async (angleId) => {
                try {
                  const res = await fetch('/api/creation/draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      researchBriefId: item.researchBriefId,
                      angleCardId: angleId,
                    }),
                  });

                  const result = await res.json();
                  if (result.contentItemId) {
                    router.push('/review');
                  }
                } catch (err) {
                  console.error('Failed to generate draft:', err);
                }
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Default rendering for other readiness types
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
      // Handled in MenuItemCard component directly
      return null;

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

