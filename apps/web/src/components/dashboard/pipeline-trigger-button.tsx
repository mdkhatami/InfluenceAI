'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface PipelineTriggerButtonProps {
  pipelineSlug: string;
  pipelineName: string;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
  className?: string;
}

export function PipelineTriggerButton({
  pipelineSlug,
  pipelineName,
  size = 'sm',
  variant = 'default',
  className,
}: PipelineTriggerButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrigger = async () => {
    setIsLoading(true);
    setError(null);
    setLastRunId(null);
    try {
      const response = await fetch(`/api/pipelines/${pipelineSlug}/trigger`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger pipeline');
      }

      if (data.runId) {
        setLastRunId(data.runId);
      }

      toast.success(`${pipelineName} started`, {
        description: `Generated ${data.itemsGenerated ?? 0} items in ${((data.durationMs ?? 0) / 1000).toFixed(1)}s`,
      });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
      toast.error(`${pipelineName} failed`, {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size={size}
        variant={variant}
        onClick={handleTrigger}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Run Now
          </>
        )}
      </Button>

      {lastRunId && (
        <Link
          href={`/pipelines/${pipelineSlug}/runs/${lastRunId}`}
          className="flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-violet-400 transition hover:bg-violet-500/10 hover:text-violet-300"
        >
          <ExternalLink className="h-3 w-3" />
          View Run
        </Link>
      )}

      {error && (
        <p className="text-center text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
