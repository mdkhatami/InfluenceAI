'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';
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

  const handleTrigger = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pipelines/${pipelineSlug}/trigger`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger pipeline');
      }

      toast.success(`${pipelineName} started`, {
        description: `Generated ${data.itemsGenerated ?? 0} items in ${((data.durationMs ?? 0) / 1000).toFixed(1)}s`,
      });
      router.refresh();
    } catch (error) {
      toast.error(`${pipelineName} failed`, {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
  );
}
