import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function getRelativeTime(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getAutomationColor(level: string): string {
  switch (level) {
    case 'high': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'low': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    case 'manual': return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
    default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
  }
}

export function getPillarColor(color: string): string {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    violet: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
    amber: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    emerald: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    red: 'text-red-400 bg-red-400/10 border-red-400/20',
    indigo: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20',
    orange: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    pink: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  };
  return colors[color] || colors.blue;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'published': return 'text-emerald-400 bg-emerald-400/10';
    case 'approved': case 'scheduled': return 'text-blue-400 bg-blue-400/10';
    case 'in_review': return 'text-amber-400 bg-amber-400/10';
    case 'draft': return 'text-zinc-400 bg-zinc-400/10';
    case 'rejected': return 'text-red-400 bg-red-400/10';
    default: return 'text-zinc-400 bg-zinc-400/10';
  }
}
