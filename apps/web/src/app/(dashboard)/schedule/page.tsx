export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Clock, Linkedin, Instagram, Youtube, Twitter } from 'lucide-react';
import { getScheduledContent } from '@/lib/queries/content';
import { PILLARS } from '@influenceai/core';

const pillarColors: Record<string, string> = {
  'breaking-ai-news': 'border-l-blue-500 bg-blue-500/5',
  'reshared-posts': 'border-l-violet-500 bg-violet-500/5',
  'strategy-career': 'border-l-amber-500 bg-amber-500/5',
  'hype-detector': 'border-l-red-500 bg-red-500/5',
  'inside-the-machine': 'border-l-indigo-500 bg-indigo-500/5',
  'failure-lab': 'border-l-orange-500 bg-orange-500/5',
  'live-demos': 'border-l-emerald-500 bg-emerald-500/5',
};

const platformIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  linkedin: Linkedin,
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
};

function getWeekDays() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: d.toISOString().split('T')[0],
      isToday: d.toDateString() === today.toDateString(),
    };
  });
}

export default async function SchedulePage() {
  const weekDays = getWeekDays();

  let scheduledItems: Awaited<ReturnType<typeof getScheduledContent>> = [];
  try {
    scheduledItems = await getScheduledContent();
  } catch (error) {
    console.error('Failed to fetch scheduled content:', error);
  }

  // Group items by date (use scheduled_at, fallback to created_at)
  const itemsByDate: Record<string, typeof scheduledItems> = {};
  for (const item of scheduledItems) {
    const dateStr = new Date(item.scheduled_at ?? item.created_at).toISOString().split('T')[0];
    if (!itemsByDate[dateStr]) itemsByDate[dateStr] = [];
    itemsByDate[dateStr].push(item);
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-50">Publishing Schedule</h1>
          <p className="mt-1 text-zinc-400">Plan and manage your content calendar</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-500 to-violet-500 text-white hover:from-blue-600 hover:to-violet-600">
          <Plus className="mr-2 h-4 w-4" />
          Schedule Content
        </Button>
      </div>

      {/* Week View Calendar */}
      <Card>
        <CardHeader>
          <CardTitle>This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayItems = itemsByDate[day.fullDate] ?? [];
              return (
                <div key={day.fullDate} className="min-h-[200px]">
                  {/* Day Header */}
                  <div
                    className={cn(
                      'mb-2 rounded-lg px-2 py-1.5 text-center',
                      day.isToday
                        ? 'bg-blue-500/10 border border-blue-500/30'
                        : 'bg-zinc-800/50',
                    )}
                  >
                    <div className={cn('text-xs font-medium', day.isToday ? 'text-blue-400' : 'text-zinc-400')}>
                      {day.label}
                    </div>
                    <div className={cn('text-sm font-semibold', day.isToday ? 'text-blue-300' : 'text-zinc-200')}>
                      {day.date}
                    </div>
                  </div>

                  {/* Day Items */}
                  <div className="space-y-2">
                    {dayItems.map((item) => {
                      const PlatformIcon = platformIcons[item.platform] || Linkedin;
                      const time = new Date(item.scheduled_at ?? item.created_at)
                        .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'cursor-pointer rounded-lg border-l-2 p-2 transition hover:brightness-110',
                            pillarColors[item.pillar_slug] || 'border-l-zinc-500 bg-zinc-800/50',
                          )}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-2.5 w-2.5 text-zinc-500" />
                            <span className="text-[10px] text-zinc-500">{time}</span>
                            <PlatformIcon className="ml-auto h-3 w-3 text-zinc-500" />
                          </div>
                          <p className="text-[11px] font-medium leading-tight text-zinc-300 line-clamp-2">
                            {item.title}
                          </p>
                        </div>
                      );
                    })}
                    {dayItems.length === 0 && (
                      <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-zinc-800">
                        <span className="text-[10px] text-zinc-600">No posts</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduledItems.length === 0 && (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-800">
              <p className="text-sm text-zinc-500">No scheduled content yet</p>
            </div>
          )}
          {scheduledItems.slice(0, 5).map((item) => {
            const PlatformIcon = platformIcons[item.platform] || Linkedin;
            const scheduledDate = new Date(item.scheduled_at ?? item.created_at);
            const pillar = PILLARS.find((p) => p.slug === item.pillar_slug);
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700"
              >
                <div className="text-center min-w-[48px]">
                  <div className="text-xs text-zinc-500">
                    {scheduledDate.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-semibold text-zinc-200">
                    {scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>
                </div>
                <div className="h-10 w-px bg-zinc-800" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-50 truncate">{item.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {pillar ? pillar.name.split(' \u2192')[0] : item.pillar_slug}
                    </Badge>
                  </div>
                </div>
                <PlatformIcon className="h-4 w-4 flex-shrink-0 text-zinc-500" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
