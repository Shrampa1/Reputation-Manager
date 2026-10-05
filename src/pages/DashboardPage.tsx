import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useReviews, useLeads, useSmartTasks } from '@/hooks/useSupabaseData';
import type { KPI } from '@/types';

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

export function DashboardPage() {
  const navigate = useNavigate();
  const { reviews, loading: reviewsLoading } = useReviews();
  const { leads, loading: leadsLoading } = useLeads();
  const { tasks, loading: tasksLoading, completeTask } = useSmartTasks();

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1)
    : '—';
  const leadsToday = leads.filter((l) => {
    const today = new Date().toISOString().slice(0, 10);
    return l.created_at.slice(0, 10) === today;
  }).length;
  const pendingTasks = tasks.length;

  const kpis: KPI[] = [
    { label: 'Average Star Rating', value: avgRating, subtext: `across ${totalReviews} reviews`, trend: 'up', trendValue: 'Live data', icon: 'star', accent: 'amber' },
    { label: 'Total Reviews', value: String(totalReviews), subtext: `${reviews.filter((r) => !r.is_replied).length} need replies`, trend: 'up', trendValue: 'Live data', icon: 'reviews', accent: 'blue' },
    { label: 'Leads Captured Today', value: String(leadsToday), subtext: `${leads.filter((l) => l.stage === 'new_lead').length} new total`, trend: 'up', trendValue: 'Live data', icon: 'leads', accent: 'emerald' },
    { label: 'Pending Smart Tasks', value: String(pendingTasks), subtext: tasks.filter((t) => t.priority === 'high').length > 0 ? `${tasks.filter((t) => t.priority === 'high').length} high priority` : 'none high priority', trend: 'flat', trendValue: 'Live data', icon: 'tasks', accent: 'violet' },
  ];

  const isLoading = reviewsLoading || leadsLoading || tasksLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Here's what's happening with your business today.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50">
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-sm">
            <span className="font-semibold text-slate-900">All systems</span>{' '}
            <span className="text-slate-500">healthy</span>
          </div>
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
                  <div className={`flex items-center gap-1 mt-2 ${trendColorMap[kpi.trend]}`}>
                    <TrendIcon className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{kpi.trendValue}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Smart Action Engine + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Smart Action Engine */}
            <div className="lg:col-span-2 card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Smart Action Engine</h2>
                    <p className="text-xs text-slate-400">AI-powered recommendations</p>
                  </div>
                </div>
                <span className="badge bg-sky-50 text-sky-600">
                  <Sparkles className="w-3 h-3" /> {tasks.length} suggestions
                </span>
              </div>

              <div className="space-y-3">
                {tasks.length === 0 && (
                  <div className="text-center py-8">
                    <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">All tasks completed. You're all caught up!</p>
                  </div>
                )}
                {tasks.map((task) => {
                  const priority = priorityMap[task.priority] || priorityMap.medium;
                  return (
                    <div
                      key={task.id}
                      className="group flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-sky-200 hover:bg-sky-50/30 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${priority.color}`}>{priority.label}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{task.description}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => completeTask(task.id)}
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                          title="Mark complete"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(task.action_route || '/')}
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
                    <p className="text-xs text-slate-500">Send to a recent customer</p>
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
              <button className="text-xs font-medium text-sky-600 hover:text-sky-700">View all</button>
            </div>
            <div className="space-y-3">
              {reviews.slice(0, 2).map((review) => (
                <div key={review.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                    <Star className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-slate-700 flex-1 min-w-0">
                    {review.is_replied ? 'Replied to' : 'New'} {review.rating}-star review from {review.author_name}
                  </p>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(review.review_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
              {leads.slice(0, 2).map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <p className="text-sm text-slate-700 flex-1 min-w-0">
                    New lead: {lead.customer_name} via {lead.channel.replace('_', ' ')}
                  </p>
                  <span className="text-xs text-slate-400 shrink-0">
                    {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
              {reviews.length === 0 && leads.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400">No recent activity yet.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
