import { Badge } from '@/components/ui/badge';

interface RelevanceScoreBadgeProps {
  score: number;
}

export function RelevanceScoreBadge({ score }: RelevanceScoreBadgeProps) {
  const variant = score >= 8 ? 'success' : score >= 5 ? 'warning' : 'outline';

  return (
    <Badge variant={variant}>
      {score.toFixed(1)}
    </Badge>
  );
}
