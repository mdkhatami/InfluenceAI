import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const pillarColorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  red: 'bg-red-500/10 text-red-400 border-red-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export function getPillarColor(color: string): string {
  return pillarColorMap[color] ?? pillarColorMap.blue;
}

const statusColorMap: Record<string, string> = {
  draft: 'bg-zinc-500/10 text-zinc-400',
  pending_review: 'bg-amber-500/10 text-amber-400',
  in_review: 'bg-amber-500/10 text-amber-400',
  revision_requested: 'bg-orange-500/10 text-orange-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  scheduled: 'bg-blue-500/10 text-blue-400',
  published: 'bg-green-500/10 text-green-400',
  rejected: 'bg-red-500/10 text-red-400',
  archived: 'bg-zinc-500/10 text-zinc-500',
};

export function getStatusColor(status: string): string {
  return statusColorMap[status] ?? statusColorMap.draft;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

const automationColorMap: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  low: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  manual: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export function getAutomationColor(level: string): string {
  return automationColorMap[level] ?? automationColorMap.manual;
}

export function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
