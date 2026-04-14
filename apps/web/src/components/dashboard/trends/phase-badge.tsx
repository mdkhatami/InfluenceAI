import { Badge } from '@/components/ui/badge';

interface PhaseBadgeProps {
  phase: string;
}

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  const config = getPhaseConfig(phase);

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function getPhaseConfig(phase: string) {
  switch (phase) {
    case 'emerging':
      return { label: 'Emerging', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    case 'accelerating':
      return { label: 'Accelerating', className: 'bg-green-900 text-green-300 border-green-800' };
    case 'peak':
      return { label: 'Peak', className: 'bg-amber-900 text-amber-300 border-amber-800' };
    case 'decelerating':
      return { label: 'Decelerating', className: 'bg-red-900 text-red-400 border-red-800' };
    case 'plateau':
      return { label: 'Plateau', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    case 'declining':
      return { label: 'Declining', className: 'bg-red-950 text-red-400 border-red-900' };
    default:
      return { label: phase, className: 'bg-zinc-800 text-zinc-400' };
  }
}
