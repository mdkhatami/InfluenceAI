import { Badge } from '@/components/ui/badge';

interface Finding {
  type: string;
  headline: string;
  detail: string;
  importance: string;
}

interface Connection {
  relationship: string;
  narrative_hook: string;
}

interface ResearchBriefViewProps {
  brief: {
    top_findings: Finding[];
    connections?: Connection[];
    unusual_fact?: string;
    suggested_angles?: string[];
    coverage: {
      dispatched: number;
      succeeded: number;
      failed: number;
    };
  };
}

export function ResearchBriefView({ brief }: ResearchBriefViewProps) {
  return (
    <div className="space-y-6">
      {/* Coverage Bar */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-zinc-400">Coverage:</span>
          <span className="text-green-400">{brief.coverage.succeeded} succeeded</span>
          {brief.coverage.failed > 0 && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-red-400">{brief.coverage.failed} failed</span>
            </>
          )}
        </div>
      </div>

      {/* Top Findings */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-50">Top Findings</h3>
        <div className="space-y-3">
          {brief.top_findings.map((finding, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex items-start gap-2">
                <Badge
                  variant={finding.importance === 'high' ? 'default' : 'outline'}
                  className={
                    finding.importance === 'high'
                      ? 'bg-red-900 text-red-300'
                      : finding.importance === 'medium'
                      ? 'bg-amber-900 text-amber-300'
                      : 'bg-zinc-800 text-zinc-400'
                  }
                >
                  {finding.importance}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-50">{finding.headline}</p>
                  <p className="mt-1 text-xs text-zinc-400">{finding.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Domain Connections */}
      {brief.connections && brief.connections.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-50">Cross-Domain Connections</h3>
          <div className="space-y-2">
            {brief.connections.map((conn, idx) => (
              <div key={idx} className="text-sm">
                <span className="text-violet-400">• </span>
                <span className="text-zinc-300">{conn.narrative_hook}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unusual Fact */}
      {brief.unusual_fact && (
        <div className="rounded-lg border border-violet-800 bg-violet-950/20 p-4">
          <h3 className="mb-2 text-sm font-medium text-violet-300">Most Surprising</h3>
          <p className="text-sm text-zinc-300">{brief.unusual_fact}</p>
        </div>
      )}

      {/* Suggested Angles */}
      {brief.suggested_angles && brief.suggested_angles.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-50">Suggested Angles</h3>
          <div className="flex flex-wrap gap-2">
            {brief.suggested_angles.map((angle, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {angle}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
