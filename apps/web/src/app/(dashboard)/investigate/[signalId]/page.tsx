'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { InvestigationProgress } from '@/components/dashboard/investigation/investigation-progress';

type InvestigationResult = {
  researchBriefId: string;
  runId: string | null;
  status: string;
  coverage: { dispatched: number; succeeded: number; failed: number };
  angleCards?: Array<Record<string, unknown>>;
};

export default function InvestigatePage() {
  const params = useParams<{ signalId: string }>();
  const router = useRouter();
  const [investigating, setInvestigating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startInvestigation = async () => {
    setInvestigating(true);
    setError(null);
    try {
      const res = await fetch(`/api/investigate/signal/${params.signalId}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Investigation failed');
        return;
      }
      setRunId(data.runId);
      setResult(data);
    } catch {
      setError('Failed to start investigation');
    } finally {
      setInvestigating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Investigate Signal</h1>
        <p className="text-sm text-zinc-400 mt-1">Signal ID: {params.signalId}</p>
      </div>

      {!result && !investigating && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400 mb-4">
            Launch the investigation swarm to analyze this signal across multiple domains.
          </p>
          <Button onClick={startInvestigation} disabled={investigating}>
            Start Investigation
          </Button>
        </div>
      )}

      {runId && (
        <InvestigationProgress runId={runId} />
      )}

      {error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 p-4">
          <p className="text-sm text-red-400">{error}</p>
          <Button size="sm" className="mt-2" onClick={startInvestigation}>
            Retry
          </Button>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-zinc-100">Investigation Complete</h3>
              <span className={`text-sm ${result.status === 'completed' ? 'text-green-400' : 'text-amber-400'}`}>
                {result.status}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-2">
              {result.coverage.succeeded}/{result.coverage.dispatched} agents succeeded
              {result.coverage.failed > 0 && ` (${result.coverage.failed} failed)`}
            </p>
          </div>

          {result.status === 'already_investigated' && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-sm text-zinc-400">
                This signal has already been investigated.
              </p>
              <Button size="sm" className="mt-2" variant="outline" onClick={() => router.push('/')}>
                Back to Menu
              </Button>
            </div>
          )}

          <Button onClick={() => router.push('/')}>
            Back to Daily Menu
          </Button>
        </div>
      )}
    </div>
  );
}
