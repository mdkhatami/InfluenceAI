'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';

interface PipelineTriggerProps {
  pipelineSlug: string;
  disabled?: boolean;
}

export function PipelineTrigger({ pipelineSlug, disabled }: PipelineTriggerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleTrigger = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/pipelines/${pipelineSlug}/trigger`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to trigger pipeline');
      router.refresh();
    } catch (error) {
      console.error('Failed to trigger pipeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button size="sm" variant="default" onClick={handleTrigger} disabled={disabled || isLoading}>
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Play className="h-4 w-4 mr-1" />
          Run Now
        </>
      )}
    </Button>
  );
}
