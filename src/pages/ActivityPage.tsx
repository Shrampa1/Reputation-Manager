import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarDays,
  ExternalLink,
  History,
  Inbox,
  Loader2,
  Plug,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { ACTIVITY_PAGE_SIZE, CATEGORY_INFO, dayLabel, fetchActivity, relativeTime } from '@/lib/activity';
import type { ActivityCategory, ActivityEntry } from '@/types';

const CATEGORY_ICONS: Record<ActivityCategory, typeof Users> = {
  team: Users,
  integrations: Plug,
  posts: CalendarDays,
  leads: Inbox,
  reviews: Star,
  business: Building2,
};

const FILTERS: (ActivityCategory | 'all')[] = ['all', 'team', 'posts', 'leads', 'reviews', 'integrations', 'business'];

export function ActivityPage() {
  const { organization } = useLocationContext();
  const organizationId = organization?.id;

  const [filter, setFilter] = useState<ActivityCategory | 'all'>('all');
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchActivity(organizationId, { category: filter });
      setEntries(rows);
      setHasMore(rows.length === ACTIVITY_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load activity');
    } finally {
      setLoading(false);
    }
  }, [organizationId, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!organizationId || entries.length === 0) return;
    setLoadingMore(true);
    try {
      const last = entries[entries.length - 1];
      const rows = await fetchActivity(organizationId, { category: filter, after: last });
      setEntries((prev) => [...prev, ...rows]);
      setHasMore(rows.length === ACTIVITY_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more activity');
    } finally {
      setLoadingMore(false);
    }
  };

  // New entries appear live
  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`activity:${organizationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          const entry = payload.new as ActivityEntry;
          if (filter !== 'all' && entry.category !== filter) return;
          setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, filter]);

  // Keep "5 min ago" labels fresh
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityEntry[] }[] = [];
    for (const entry of entries) {
      const label = dayLabel(entry.created_at, new Date(now));
      const group = out[out.length - 1];
      if (group && group.label === label) group.items.push(entry);
      else out.push({ label, items: [entry] });
    }
    return out;
  }, [entries, now]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Activity</h1>
        <p className="text-sm text-slate-500 mt-1">
          Everything your team and Reputation Engine changed in {organization?.name || 'your business'}. Visible to owners and admins.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1" role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All' : CATEGORY_INFO[f].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : error && entries.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
          <button onClick={load} className="btn-secondary mt-3">Try again</button>
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 mx-auto mb-3">
            <History className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-slate-700">No activity yet</p>
          <p className="text-sm text-slate-500 mt-1">
            {filter === 'all' ? 'Changes your team makes will show up here.' : `Nothing in ${CATEGORY_INFO[filter].label} yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-1">{group.label}</h2>
              <ul className="card divide-y divide-slate-100 overflow-hidden">
                {group.items.map((entry) => {
                  const Icon = CATEGORY_ICONS[entry.category] ?? History;
                  const info = CATEGORY_INFO[entry.category];
                  const url = typeof entry.metadata?.url === 'string' ? entry.metadata.url : null;
                  return (
                    <li key={entry.id} className="flex items-start gap-3 p-3.5">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${info?.color ?? 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 break-words">{entry.summary}</p>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                          {entry.actor_label ? (
                            <span className="font-medium text-slate-500">{entry.actor_label}</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 font-medium text-slate-500">
                              <Zap className="w-3 h-3" />
                              Automatic
                            </span>
                          )}
                          <span aria-hidden>·</span>
                          <time dateTime={entry.created_at} title={new Date(entry.created_at).toLocaleString()}>
                            {relativeTime(entry.created_at, now)}
                          </time>
                          {url && (
                            <>
                              <span aria-hidden>·</span>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-sky-600 hover:text-sky-700">
                                View post
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {error && <p className="text-sm text-rose-600 text-center">{error}</p>}

          {hasMore && (
            <div className="text-center">
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary">
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? 'Loading…' : 'Load older activity'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
