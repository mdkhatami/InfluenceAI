'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LogEntry {
  id: string;
  run_id: string;
  step: string;
  level: string;
  message: string;
  created_at: string;
}

const stepColors: Record<string, { bg: string; text: string }> = {
  ingest: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  dedup: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  relevance: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  filter: { bg: 'bg-green-500/10', text: 'text-green-500' },
  generate: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
  runner: { bg: 'bg-red-500/10', text: 'text-red-500' },
};

const levelColors: Record<string, string> = {
  info: 'text-zinc-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

function getStepColor(step: string) {
  // Match on partial step name (e.g., "ingest_signals" matches "ingest")
  for (const [key, colors] of Object.entries(stepColors)) {
    if (step.toLowerCase().includes(key)) return colors;
  }
  return { bg: 'bg-zinc-500/10', text: 'text-zinc-500' };
}

function formatLogTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const COLLAPSE_THRESHOLD = 10;
const VISIBLE_ENDS = 5;

export function LogTimeline({ logs }: { logs: LogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = logs.length > COLLAPSE_THRESHOLD;
  const hiddenCount = logs.length - VISIBLE_ENDS * 2;

  const visibleLogs = !shouldCollapse || expanded
    ? logs
    : null; // handled inline for split rendering

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-3 bottom-3 w-px bg-zinc-800" />

      <div className="space-y-0">
        {shouldCollapse && !expanded ? (
          <>
            {/* First N entries */}
            {logs.slice(0, VISIBLE_ENDS).map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))}

            {/* Collapsed indicator */}
            <div className="relative flex items-center py-2 pl-6">
              <div className="absolute left-[5px] h-2.5 w-2.5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(true)}
                className="ml-2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                <ChevronDown className="mr-1 h-3 w-3" />
                Show all {logs.length} entries ({hiddenCount} hidden)
              </Button>
            </div>

            {/* Last N entries */}
            {logs.slice(-VISIBLE_ENDS).map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))}
          </>
        ) : (
          <>
            {(visibleLogs ?? logs).map((log) => (
              <LogEntryRow key={log.id} log={log} />
            ))}

            {shouldCollapse && expanded && (
              <div className="relative flex items-center py-2 pl-6">
                <div className="absolute left-[5px] h-2.5 w-2.5 rounded-full border-2 border-zinc-700 bg-zinc-900" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(false)}
                  className="ml-2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  <ChevronUp className="mr-1 h-3 w-3" />
                  Collapse
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LogEntryRow({ log }: { log: LogEntry }) {
  const stepColor = getStepColor(log.step);
  const levelColor = levelColors[log.level] ?? 'text-zinc-400';

  return (
    <div className="group relative flex items-start gap-3 py-1.5 pl-6">
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-[3px] top-[10px] h-3 w-3 rounded-full border-2 border-zinc-900',
          log.level === 'error'
            ? 'bg-red-500'
            : log.level === 'warn'
              ? 'bg-yellow-500'
              : 'bg-zinc-600',
        )}
      />

      {/* Timestamp */}
      <span className="w-[72px] shrink-0 pt-0.5 font-mono text-xs text-zinc-600">
        {formatLogTime(log.created_at)}
      </span>

      {/* Step badge */}
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium',
          stepColor.bg,
          stepColor.text,
        )}
      >
        {log.step}
      </span>

      {/* Level indicator + message */}
      <span className={cn('flex-1 text-sm', levelColor)}>
        {log.level !== 'info' && (
          <span className="mr-1 font-medium uppercase">[{log.level}]</span>
        )}
        {log.message}
      </span>
    </div>
  );
}
