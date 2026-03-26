import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRelativeTime } from '@/lib/utils';
import {
  CheckCircle,
  FileText,
  GitBranch,
  AlertTriangle,
  Send,
  Eye,
} from 'lucide-react';

const activities = [
  {
    id: '1',
    icon: GitBranch,
    text: 'GitHub Trends pipeline completed successfully',
    detail: '3 repos scored, 1 post generated',
    time: new Date(Date.now() - 12 * 60000).toISOString(),
    type: 'success' as const,
  },
  {
    id: '2',
    icon: FileText,
    text: 'New draft created: "5 AI Tools Rewriting Frontend Dev"',
    detail: 'From Signal Amplifier pipeline',
    time: new Date(Date.now() - 45 * 60000).toISOString(),
    type: 'info' as const,
  },
  {
    id: '3',
    icon: CheckCircle,
    text: 'Content approved: "Why RAG Is Replacing Fine-Tuning"',
    detail: 'Scheduled for tomorrow at 9:00 AM',
    time: new Date(Date.now() - 2 * 3600000).toISOString(),
    type: 'success' as const,
  },
  {
    id: '4',
    icon: Send,
    text: 'Published to LinkedIn: "OpenAI\'s Agents SDK Changes Everything"',
    detail: '1.2K impressions in first hour',
    time: new Date(Date.now() - 4 * 3600000).toISOString(),
    type: 'info' as const,
  },
  {
    id: '5',
    icon: AlertTriangle,
    text: 'Release Radar pipeline failed: API rate limit',
    detail: 'Will retry in 15 minutes',
    time: new Date(Date.now() - 5 * 3600000).toISOString(),
    type: 'warning' as const,
  },
  {
    id: '6',
    icon: Eye,
    text: 'Content milestone: "LLM Routing Strategies" hit 10K views',
    detail: 'Published 3 days ago on LinkedIn',
    time: new Date(Date.now() - 6 * 3600000).toISOString(),
    type: 'success' as const,
  },
];

const typeColors = {
  success: 'text-emerald-400',
  info: 'text-blue-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
};

export function ActivityFeed() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon className={`h-4 w-4 ${typeColors[activity.type]}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-50">{activity.text}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{activity.detail}</p>
                </div>
                <span className="text-xs text-zinc-500 whitespace-nowrap">
                  {getRelativeTime(activity.time)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
