'use client';

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

const VIOLET = '#8b5cf6';
const EMERALD = '#10b981';
const BAR_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: '0.5rem',
  fontSize: '12px',
  color: '#e4e4e7',
} as const;

function formatDay(value: string): string {
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ContentVolumeChart({
  data,
}: {
  data: { date: string; total: number; approved: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={VIOLET} stopOpacity={0.4} />
            <stop offset="95%" stopColor={VIOLET} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={EMERALD} stopOpacity={0.4} />
            <stop offset="95%" stopColor={EMERALD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          tick={{ fontSize: 11, fill: '#71717a' }}
          stroke="#3f3f46"
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11, fill: '#71717a' }} stroke="#3f3f46" allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label) => formatDay(label as string)}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Generated"
          stroke={VIOLET}
          fill="url(#totalGrad)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="approved"
          name="Approved"
          stroke={EMERALD}
          fill="url(#approvedGrad)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BreakdownBarChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-zinc-500">
        No data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#71717a' }}
          stroke="#3f3f46"
          interval={0}
        />
        <YAxis tick={{ fontSize: 11, fill: '#71717a' }} stroke="#3f3f46" allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#27272a55' }} />
        <Bar dataKey="value" name="Items" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
