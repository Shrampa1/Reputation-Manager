import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Star,
  MessageSquare,
  UserPlus,
  ListTodo,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Zap,
  Share2,
  Users,
  ChevronRight,
  Loader2,
  Check,
  AlertTriangle,
  PlugZap,
  X,
  FileDown,
} from 'lucide-react';
import { useReviews, useLeads, useSmartTasks, useSocialPosts, useIntegrations } from '@/hooks/useSupabaseData';
import { useLocationContext } from '@/context/LocationContext';
import { computeSuggestions, loadDismissed, saveDismissed } from '@/lib/suggestions';
import { CATEGORY_INFO, fetchActivity, relativeTime } from '@/lib/activity';
import type { ActivityEntry, KPI } from '@/types';

const iconMap = {
  star: Star,
  reviews: MessageSquare,
  leads: UserPlus,
  tasks: ListTodo,
};

const accentMap: Record<KPI['accent'], { bg: string; text: string; ring: string }> = {
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  blue: { bg: 'bg-sky-50', text: 'text-sky-600', ring: 'ring-sky-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
};

const trendIconMap = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
};

const trendColorMap = {
  up: 'text-emerald-600',
  down: 'text-rose-500',
  flat: 'text-slate-400',
};

const priorityMap: Record<string, { label: string; color: string }> = {
  high: { label: 'High Priority', color: 'bg-rose-50 text-rose-600' },
  medium: { label: 'Medium', color: 'bg-amber-50 text-amber-600' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-500' },
};

const DAY = 86_400_000;

function compare(current: number, previous: number): KPI['trend'] {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

/** A row in the Smart Action list: computed from data, or stored in smart_tasks */
interface ActionItem {
  key: string;
  title: string;
  description: string;
  route: string;
  priority: 'high' | 'medium' | 'low';
  onDone: () => void;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { location, organization, isAdmin } = useLocationContext();
  const { reviews, loading: reviewsLoading } = useReviews();
  const { leads, loading: leadsLoading } = useLeads();
  const { posts, loading: postsLoading } = useSocialPosts();
  const { integrations, loading: integrationsLoading } = useIntegrations();
  const { tasks, loading: tasksLoading, completeTask } = useSmartTasks();
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    if (location) setDismissed(loadDismissed(location.id));
  }, [location]);

  // Owners/admins see the real activity log; members get a summary of reviews and leads
  useEffect(() => {
    if (!isAdmin || !organization) return;
    let cancelled = false;
    fetchActivity(organization.id)
      .then((rows) => !cancelled && setActivity(rows.slice(0, 6)))
      .catch(() => !cancelled && setActivity([]));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, organization]);

  const now = Date.now();
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1) : '—';
  const inLast = (iso: string, fromDays: number, toDays = 0) => {
    const age = now - new Date(iso).getTime();
    return age >= toDays * DAY && age < fromDays * DAY;
  };
  const reviews30 = reviews.filter((r) => inLast(r.review_date, 30));
  const reviewsPrev30 = reviews.filter((r) => inLast(r.review_date, 60, 30));
  const avg30 = reviews30.length ? reviews30.reduce((s, r) => s + r.rating, 0) / reviews30.length : null;
  const todayKey = new Date().toDateString();
  const leadsToday = leads.filter((l) => new Date(l.created_at).toDateString() === todayKey).length;
  const leads7 = leads.filter((l) => inLast(l.created_at, 7)).length;
  const leadsPrev7 = leads.filter((l) => inLast(l.created_at, 14, 7)).length;

  const suggestions = useMemo(
    () => computeSuggestions({ reviews, leads, posts, integrations, location, isAdmin }),
    [reviews, leads, posts, integrations, location, isAdmin]
  );

  const dismiss = (id: string) => {
    if (!location) return;
    const next = { ...dismissed, [id]: Date.now() };
    setDismissed(next);
    saveDismissed(location.id, next);
  };

  const actions: ActionItem[] = [
    ...suggestions
      .filter((s) => !dismissed[s.id])
      .map((s) => ({ key: `s:${s.id}`, title: s.title, description: s.description, route: s.route, priority: s.priority, onDone: () => dismiss(s.id) })),
    ...tasks.map((t) => ({
      key: `t:${t.id}`,
      title: t.title,
      description: t.description,
      route: t.action_route || '/',
      priority: t.priority,
      onDone: () => completeTask(t.id),
    })),
  ];
  const highCount = actions.filter((a) => a.priority === 'high').length;

  const kpis: KPI[] = [
    {
      label: 'Average Star Rating',
      value: avgRating,
      subtext:
        location?.google_rating != null
          ? `Google: ${Number(location.google_rating).toFixed(1)}★ from ${location.google_review_count ?? 0} reviews`
          : `across ${totalReviews} review${totalReviews === 1 ? '' : 's'}`,
      trend: avg30 === null || totalReviews === 0 ? 'flat' : compare(Math.round(avg30 * 10), Math.round((Number(avgRating) || 0) * 10)),
      trendValue: avg30 === null ? 'No reviews in the last 30 days' : `${avg30.toFixed(1)} in the last 30 days`,
      icon: 'star',
      accent: 'amber',
    },
    {
      label: 'Total Reviews',
      value: String(totalReviews),
      subtext: `${reviews.filter((r) => !r.is_replied).length} need replies`,
      trend: compare(reviews30.length, reviewsPrev30.length),
      trendValue: `${reviews30.length} in 30 days (prev. ${reviewsPrev30.length})`,
      icon: 'reviews',
      accent: 'blue',
    },
    {
      label: 'Leads Captured Today',
      value: String(leadsToday),
      subtext: `${leads.filter((l) => l.stage === 'new_lead').length} waiting as New Lead`,
      trend: compare(leads7, leadsPrev7),
      trendValue: `${leads7} this week (prev. ${leadsPrev7})`,
      icon: 'leads',
      accent: 'emerald',
    },
    {
      label: 'Smart Actions',
      value: String(actions.length),
      subtext: highCount > 0 ? `${highCount} high priority` : 'none high priority',
      trend: 'flat',
      trendValue: actions.length === 0 ? 'All caught up' : 'See below',
      icon: 'tasks',
      accent: 'violet',
    },
  ];

  const isLoading = reviewsLoading || leadsLoading || tasksLoading || postsLoading;

  // Connection health for the header pill
  const brokenIntegrations = integrations.filter((i) => i.status === 'error');
  const connectedCount = integrations.filter((i) => i.status === 'connected').length;
  const health = integrationsLoading
    ? null
    : brokenIntegrations.length > 0
      ? { tone: 'rose' as const, icon: AlertTriangle, strong: `${brokenIntegrations.length} connection${brokenIntegrations.length === 1 ? '' : 's'}`, rest: 'need attention' }
      : connectedCount === 0
        ? { tone: 'slate' as const, icon: PlugZap, strong: 'No accounts', rest: 'connected yet' }
        : { tone: 'emerald' as const, icon: Sparkles, strong: 'All connections', rest: 'healthy' };
  const healthTone = {
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-500',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  const healthPill = health && (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
      <div className={`flex items-center justify-center w-7 h-7 rounded-lg ${healthTone[health.tone]}`}>
        <health.icon className="w-4 h-4" />
      </div>
      <div className="text-sm">
        <span className="font-semibold text-slate-900">{health.strong}</span> <span className="text-slate-500">{health.rest}</span>
      </div>
      {isAdmin && <ChevronRight className="w-4 h-4 text-slate-300" />}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Here's what's happening with your business today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {healthPill && (isAdmin ? <Link to="/integrations" className="hover:opacity-90 transition-opacity">{healthPill}</Link> : healthPill)}
          <Link to="/report" className="btn-secondary">
            <FileDown className="w-4 h-4" />
            Download report
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {kpis.map((kpi) => {
              const Icon = iconMap[kpi.icon];
              const accent = accentMap[kpi.accent];
              const TrendIcon = trendIconMap[kpi.trend];
              return (
                <div key={kpi.label} className="card card-hover p-4 sm:p-5 animate-slide-up">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${accent.bg} ${accent.text} ring-4 ${accent.ring}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{kpi.value}</p>
                  <p className="text-sm font-medium text-slate-700 mt-0.5">{kpi.label}</p>
                  <p className="text-xs text-slate-400 mt-1">{kpi.subtext}</p>
                  <div className={`flex items-start gap-1 mt-2 ${trendColorMap[kpi.trend]}`}>
                    <TrendIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span className="text-xs font-medium">{kpi.trendValue}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Smart Action Engine + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Smart Action Engine</h2>
                    <p className="text-xs text-slate-400">What needs your attention, based on your data</p>
                  </div>
                </div>
                <span className="badge bg-sky-50 text-sky-600">
                  <Sparkles className="w-3 h-3" /> {actions.length} suggestion{actions.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-3">
                {actions.length === 0 && (
                  <div className="text-center py-8">
                    <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">You're all caught up!</p>
                  </div>
                )}
                {actions.map((item) => {
                  const priority = priorityMap[item.priority] || priorityMap.medium;
                  const isComputed = item.key.startsWith('s:');
                  return (
                    <div
                      key={item.key}
                      className="group flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${priority.color}`}>{priority.label}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={item.onDone}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                          title={isComputed ? 'Hide for today' : 'Mark complete'}
                          aria-label={isComputed ? `Hide "${item.title}" for today` : `Mark "${item.title}" complete`}
                        >
                          {isComputed ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => navigate(item.route)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all group-hover:bg-sky-500"
                        >
                          Go
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-5">
              <h2 className="text-base font-bold text-slate-900 mb-1">Quick Actions</h2>
              <p className="text-xs text-slate-400 mb-4">Jump straight into a task</p>
              <div className="space-y-2.5">
                <button
                  onClick={() => navigate('/reviews')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-amber-50/50 border border-amber-100 hover:border-amber-200 transition-all text-left group"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600 group-hover:scale-105 transition-transform">
                    <Star className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">Request Review</p>
                    <p className="text-xs text-slate-500">Email a recent customer</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/social')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-violet-50 to-violet-50/50 border border-violet-100 hover:border-violet-200 transition-all text-left group"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 text-violet-600 group-hover:scale-105 transition-transform">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">Post to Social</p>
                    <p className="text-xs text-slate-500">Schedule or publish now</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-500 transition-colors" />
                </button>

                <button
                  onClick={() => navigate('/leads')}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-50/50 border border-emerald-100 hover:border-emerald-200 transition-all text-left group"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 group-hover:scale-105 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">View Leads</p>
                    <p className="text-xs text-slate-500">{leadsToday} new today</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">Recent Activity</h2>
              {isAdmin && (
                <Link to="/activity" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                  View all
                </Link>
              )}
            </div>
            {isAdmin ? (
              <div className="space-y-1">
                {activity === null && <Loader2 className="w-5 h-5 text-sky-500 animate-spin mx-auto my-4" />}
                {activity?.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No activity yet.</p>}
                {activity?.map((entry) => {
                  const cat = CATEGORY_INFO[entry.category];
                  return (
                    <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                      <span className={`badge ${cat.color} shrink-0 w-24 justify-center`}>{cat.label}</span>
                      <p className="text-sm text-slate-700 flex-1 min-w-0 truncate">
                        {entry.summary}
                        {entry.actor_label && <span className="text-slate-400"> · {entry.actor_label}</span>}
                      </p>
                      <span className="text-xs text-slate-400 shrink-0">{relativeTime(entry.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  ...reviews.slice(0, 3).map((r) => ({
                    key: `r:${r.id}`,
                    at: r.review_date,
                    icon: Star,
                    color: 'bg-amber-50 text-amber-600',
                    text: `${r.is_replied ? 'Replied to' : 'New'} ${r.rating}-star review from ${r.author_name}`,
                  })),
                  ...leads.slice(0, 3).map((l) => ({
                    key: `l:${l.id}`,
                    at: l.created_at,
                    icon: UserPlus,
                    color: 'bg-emerald-50 text-emerald-600',
                    text: `New lead: ${l.customer_name}`,
                  })),
                ]
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .slice(0, 5)
                  .map((item) => (
                    <div key={item.key} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${item.color}`}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <p className="text-sm text-slate-700 flex-1 min-w-0">{item.text}</p>
                      <span className="text-xs text-slate-400 shrink-0">{relativeTime(item.at)}</span>
                    </div>
                  ))}
                {reviews.length === 0 && leads.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No recent activity yet.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
