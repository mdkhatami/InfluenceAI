import { Badge } from '@/components/ui/badge';

interface SignalBadgeProps {
  signal: string;
}

export function SignalBadge({ signal }: SignalBadgeProps) {
  const config = getSignalConfig(signal);

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function getSignalConfig(signal: string) {
  switch (signal) {
    case 'strong_buy':
      return { label: 'Strong Buy', className: 'bg-green-900 text-green-300 border-green-800' };
    case 'buy':
      return { label: 'Buy', className: 'bg-green-900/50 text-green-400 border-green-800/50' };
    case 'hold':
      return { label: 'Hold', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    case 'sell':
      return { label: 'Sell', className: 'bg-amber-900/50 text-amber-400 border-amber-800/50' };
    case 'strong_sell':
      return { label: 'Strong Sell', className: 'bg-red-900 text-red-400 border-red-800' };
    default:
      return { label: signal, className: 'bg-zinc-800 text-zinc-400' };
  }
}
