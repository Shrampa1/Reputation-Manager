import { useMemo, useState } from 'react';
import { AlertCircle, Inbox as InboxIcon, Loader2, Lock, Mail } from 'lucide-react';
import { requestOutcome } from '@/lib/reviewRequests';
import { relativeTime } from '@/lib/activity';
import type { ReviewRequest } from '@/types';

const toneClass = {
  slate: 'bg-slate-100 text-slate-500',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-600',
};

type Filter = 'all' | 'feedback' | 'waiting';

export function ReviewRequestsPanel({
  requests,
  loading,
  error,
}: {
  requests: ReviewRequest[];
  loading: boolean;
  error: string | null;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const sent = requests.filter((r) => r.status === 'sent');
  const responded = sent.filter((r) => r.rating !== null);
  const toReviewPage = sent.filter((r) => r.clicked_review_at);
  const feedbackCount = requests.filter((r) => r.feedback).length;

  const shown = useMemo(() => {
    if (filter === 'feedback') return requests.filter((r) => r.feedback);
    if (filter === 'waiting') return requests.filter((r) => r.status === 'sent' && r.rating === null);
    return requests;
  }, [requests, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-slate-900">{sent.length}</p>
          <p className="text-xs text-slate-400">Sent</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-sky-600">{sent.length ? Math.round((responded.length / sent.length) * 100) : 0}%</p>
          <p className="text-xs text-slate-400">Responded</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-600">{toReviewPage.length}</p>
          <p className="text-xs text-slate-400">Went to review page</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {([
          ['all', 'All'],
          ['waiting', 'No response'],
          ['feedback', `Private feedback${feedbackCount ? ` (${feedbackCount})` : ''}`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="card p-8 text-center">
          <InboxIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            {requests.length === 0 ? 'No review requests yet. Send your first one to a happy customer.' : 'Nothing here.'}
          </p>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 p-0 overflow-hidden">
          {shown.map((r) => {
            const outcome = requestOutcome(r);
            return (
              <li key={r.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-50 text-sky-600 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{r.customer_name}</p>
                      <span className={`badge ${toneClass[outcome.tone]}`}>{outcome.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {r.email} · {relativeTime(r.created_at)}
                    </p>
                    {r.status === 'failed' && r.error && <p className="text-xs text-rose-600 mt-1">{r.error}</p>}
                    {r.feedback && (
                      <div className="mt-2 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-1">
                          <Lock className="w-3 h-3" /> Private feedback
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-line">{r.feedback}</p>
                        <a href={`mailto:${r.email}`} className="inline-block mt-2 text-xs font-medium text-sky-600 hover:underline">
                          Reply to {r.customer_name.split(' ')[0]}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
