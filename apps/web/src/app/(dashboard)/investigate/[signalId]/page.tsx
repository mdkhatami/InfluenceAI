'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type InvestigationResult = {
  researchBriefId: string;
  status: string;
  coverage: { dispatched: number; succeeded: number; failed: number };
  angleCards?: Array<Record<string, unknown>>;
};

const AGENT_LABELS: Record<string, string> = {
  tech: 'Tech Deep-Dive',
  finance: 'Finance',
  geopolitics: 'Geopolitics',
  industry: 'Industry Impact',
  deveco: 'Dev Ecosystem',
  history: 'Historical Pattern',
};

export default function InvestigatePage() {
  const params = useParams<{ signalId: string }>();
  const router = useRouter();
  const [investigating, setInvestigating] = useState(false);
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

      {investigating && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400 mb-4">
            Investigating signal across multiple domains...
          </p>
          <div className="space-y-2">
            {Object.entries(AGENT_LABELS).map(([id, label]) => (
              <div key={id} className="flex items-center gap-3 text-sm">
                <div className="h-4 w-4 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
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
