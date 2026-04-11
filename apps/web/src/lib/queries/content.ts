import { createClient } from '@/lib/supabase/server';

export async function getContentItems(filters?: {
  status?: string;
  pillar?: string;
  platform?: string;
  pipeline?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from('content_items')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.pillar) query = query.eq('pillar_slug', filters.pillar);
  if (filters?.platform) query = query.eq('platform', filters.platform);
  if (filters?.pipeline) query = query.eq('pipeline_slug', filters.pipeline);
  if (filters?.search) query = query.ilike('title', `%${filters.search}%`);

  const limit = filters?.limit ?? 20;
  const offset = filters?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0 };
}

export async function getContentStats() {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [thisWeek, pendingReview, totalPublished] = await Promise.all([
    supabase.from('content_items').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('status', 'published'),
  ]);

  return {
    contentThisWeek: thisWeek.count ?? 0,
    pendingReview: pendingReview.count ?? 0,
    totalPublished: totalPublished.count ?? 0,
  };
}

export async function getContentByPillar() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('content_items').select('pillar_slug');
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const item of data ?? []) {
    counts[item.pillar_slug] = (counts[item.pillar_slug] ?? 0) + 1;
  }
  return counts;
}

export async function getContentPerDay(days: number = 14) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('content_items')
    .select('created_at')
    .gte('created_at', since.toISOString())
    .order('created_at');

  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const item of data ?? []) {
    const day = new Date(item.created_at).toISOString().split('T')[0];
    counts[day] = (counts[day] ?? 0) + 1;
  }

  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    result.push({ date: key, count: counts[key] ?? 0 });
  }
  return result;
}

export async function getScheduledContent() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .in('status', ['approved', 'scheduled'])
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getRecentActivity(limit: number = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('id, title, pillar_slug, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getContentItem(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_items')
    .select('*, content_signals(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}
