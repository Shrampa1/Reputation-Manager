import { supabase } from '@/lib/supabase';
import type { ActivityCategory, ActivityEntry } from '@/types';

export const ACTIVITY_PAGE_SIZE = 50;

export const CATEGORY_INFO: Record<ActivityCategory, { label: string; color: string }> = {
  team: { label: 'Team', color: 'bg-violet-50 text-violet-600' },
  integrations: { label: 'Integrations', color: 'bg-sky-50 text-sky-600' },
  posts: { label: 'Posts', color: 'bg-pink-50 text-pink-600' },
  leads: { label: 'Leads', color: 'bg-emerald-50 text-emerald-600' },
  reviews: { label: 'Reviews', color: 'bg-amber-50 text-amber-600' },
  business: { label: 'Business', color: 'bg-slate-100 text-slate-600' },
};

/**
 * Newest first. To load the next page, pass the last entry you already have as `after`.
 * Pages by (created_at, id) because rows written in one transaction share a timestamp.
 */
export async function fetchActivity(
  organizationId: string,
  options: { category?: ActivityCategory | 'all'; after?: Pick<ActivityEntry, 'created_at' | 'id'> } = {}
): Promise<ActivityEntry[]> {
  let query = supabase
    .from('activity_log')
    .select('id, organization_id, actor_id, actor_label, category, action, summary, entity_id, metadata, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(ACTIVITY_PAGE_SIZE);
  if (options.category && options.category !== 'all') query = query.eq('category', options.category);
  if (options.after) {
    const { created_at, id } = options.after;
    // Values are quoted because timestamps contain "." and ":"
    query = query.or(`created_at.lt."${created_at}",and(created_at.eq."${created_at}",id.lt.${id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as ActivityEntry[]) ?? [];
}

export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
