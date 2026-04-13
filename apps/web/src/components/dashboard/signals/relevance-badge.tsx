import { Badge } from '@/components/ui/badge';

interface RelevanceBadgeProps {
  score: number;
}

export function RelevanceBadge({ score }: RelevanceBadgeProps) {
  const variant = score >= 8 ? 'success' : score >= 5 ? 'warning' : 'outline';

  return (
    <Badge variant={variant}>
      {score.toFixed(1)}
    </Badge>
  );
}
