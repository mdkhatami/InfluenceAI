'use client';

import { cn } from '@/lib/utils';

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-zinc-800/50',
        className,
      )}
    />
  );
}

/**
 * Stats row skeleton -- 4 stat cards
 */
export function StatsRowSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * Card grid skeleton -- configurable number of cards
 */
export function CardGridSkeleton({ count = 6, columns = 3 }: { count?: number; columns?: number }) {
  const colClass =
    columns === 2
      ? 'md:grid-cols-2'
      : columns === 3
        ? 'md:grid-cols-2 xl:grid-cols-3'
        : 'md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={cn('grid grid-cols-1 gap-6', colClass)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-20" />
            </div>
          </div>
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-3/4" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 flex-1 rounded-md" />
            <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Table skeleton -- header + rows
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex gap-4 border-b border-zinc-800 px-6 py-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-zinc-800/50 px-6 py-4 last:border-0">
          {Array.from({ length: 5 }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Chart skeleton
 */
export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-1 h-3 w-56" />
      <Skeleton className="mt-4 h-[320px] w-full rounded-lg" />
    </div>
  );
}

/**
 * Full page skeleton for Command Center
 */
export function CommandCenterSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <StatsRowSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ChartSkeleton />
        </div>
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i}>
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                  <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <CardGridSkeleton count={8} columns={2} />
    </div>
  );
}

/**
 * Full page skeleton for Pipelines
 */
export function PipelinesSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <StatsRowSkeleton />
      <CardGridSkeleton count={8} columns={3} />
    </div>
  );
}

/**
 * Full page skeleton for Content / Review
 */
export function ContentSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}

/**
 * Full page skeleton for Analytics
 */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <StatsRowSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}

/**
 * Full page skeleton for Schedule
 */
export function ScheduleSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800">
        {/* Day headers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={`h-${i}`} className="bg-zinc-900 p-3">
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
        {/* Day cells */}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`c-${i}`} className="min-h-[120px] bg-zinc-900/50 p-2">
            <Skeleton className="h-3 w-6" />
            {i % 3 === 0 && <Skeleton className="mt-2 h-6 w-full rounded" />}
            {i % 5 === 0 && <Skeleton className="mt-1 h-6 w-full rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}
