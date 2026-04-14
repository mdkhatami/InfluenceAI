'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2, XCircle, Circle } from 'lucide-react';

interface AgentProgress {
  agent_id: string;
  status: 'success' | 'running' | 'pending' | 'failed';
  duration_ms?: number;
  findings_count?: number;
}

interface InvestigationProgressProps {
  runId: string;
  onComplete?: () => void;
}

export function InvestigationProgress({ runId, onComplete }: InvestigationProgressProps) {
  const [agents, setAgents] = useState<AgentProgress[]>([]);
  const [overallStatus, setOverallStatus] = useState<'running' | 'completed' | 'failed'>('running');

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const poll = async () => {
      try {
        const res = await fetch(`/api/investigate/run/${runId}/status`);
        const data = await res.json();

        setAgents(data.agents || []);
        setOverallStatus(data.status);

        if (data.status !== 'running') {
          clearInterval(interval);
          onComplete?.();
        }
      } catch (error) {
        console.error('Failed to poll status:', error);
      }
    };

    poll();
    interval = setInterval(poll, 2000);

    return () => clearInterval(interval);
  }, [runId, onComplete]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-4 text-sm font-medium text-zinc-50">Agent Progress</h3>

      <div className="space-y-2">
        {agents.map((agent) => (
          <div key={agent.agent_id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              {agent.status === 'success' && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {agent.status === 'running' && (
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              )}
              {agent.status === 'pending' && (
                <Circle className="h-4 w-4 text-zinc-600" />
              )}
              {agent.status === 'failed' && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}

              <span className="text-zinc-300">
                {formatAgentName(agent.agent_id)}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-500">
              {agent.duration_ms && (
                <span>{(agent.duration_ms / 1000).toFixed(1)}s</span>
              )}
              {agent.findings_count !== undefined && (
                <span>{agent.findings_count} findings</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAgentName(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
