'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function SignalFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== '' && value !== '0' && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset to page 1 when filters change
    router.push(`/signals?${params.toString()}`);
  };

  return (
    <div className="flex gap-3">
      <select
        className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
        value={searchParams.get('source') || ''}
        onChange={(e) => handleFilterChange('source', e.target.value)}
      >
        <option value="">All Sources</option>
        <option value="github">GitHub</option>
        <option value="rss">RSS</option>
        <option value="hackernews">HackerNews</option>
        <option value="arxiv">ArXiv</option>
      </select>

      <select
        className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
        value={searchParams.get('timeRange') || 'all'}
        onChange={(e) => handleFilterChange('timeRange', e.target.value)}
      >
        <option value="all">All Time</option>
        <option value="24h">Last 24h</option>
        <option value="7d">Last 7d</option>
        <option value="30d">Last 30d</option>
      </select>

      <select
        className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
        value={searchParams.get('minScore') || '0'}
        onChange={(e) => handleFilterChange('minScore', e.target.value)}
      >
        <option value="0">All Scores</option>
        <option value="3">3+</option>
        <option value="5">5+</option>
        <option value="7">7+</option>
      </select>
    </div>
  );
}
