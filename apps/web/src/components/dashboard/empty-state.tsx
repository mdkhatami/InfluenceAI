'use client';

import { cn } from '@/lib/utils';
import {
  FileText,
  Workflow,
  BarChart3,
  CalendarDays,
  CheckCircle,
  Inbox,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 p-8 text-center',
        className,
      )}
    >
      <div className="rounded-full bg-zinc-800/50 p-4">
        <Icon className="h-8 w-8 text-zinc-500" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-zinc-300">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Pre-configured empty states for each dashboard section

export function EmptyContent() {
  return (
    <EmptyState
      icon={FileText}
      title="No content yet"
      description="Content will appear here once your pipelines generate their first drafts. Run a pipeline to get started."
    />
  );
}

export function EmptyPipelines() {
  return (
    <EmptyState
      icon={Workflow}
      title="No pipeline runs"
      description="Your pipelines are configured but have not run yet. Trigger a pipeline manually or wait for the next scheduled run."
    />
  );
}

export function EmptyReviewQueue() {
  return (
    <EmptyState
      icon={CheckCircle}
      title="Review queue is empty"
      description="No content is waiting for review. All caught up!"
    />
  );
}

export function EmptyAnalytics() {
  return (
    <EmptyState
      icon={BarChart3}
      title="No analytics data"
      description="Analytics will appear here once content has been published and engagement data is collected."
    />
  );
}

export function EmptySchedule() {
  return (
    <EmptyState
      icon={CalendarDays}
      title="Nothing scheduled"
      description="No content is scheduled for publishing this week. Approve content from the review queue to schedule it."
    />
  );
}
