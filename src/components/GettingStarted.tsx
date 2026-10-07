import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Rocket, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import type { Integration } from '@/types';

interface Step {
  key: string;
  title: string;
  description: string;
  to: string;
  done: boolean;
  optional?: boolean;
}

const hiddenKey = (orgId: string) => `getting-started-hidden:${orgId}`;

/**
 * Dashboard checklist for a new business: the handful of steps that get it to its first
 * useful result. Disappears when everything required is done, or when hidden.
 */
export function GettingStarted({ integrations }: { integrations: Integration[] }) {
  const { location, organization, isAdmin } = useLocationContext();
  const [counts, setCounts] = useState<{ audits: number; requests: number } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!organization) return;
    try {
      setHidden(localStorage.getItem(hiddenKey(organization.id)) === '1');
    } catch {
      /* storage unavailable: show the checklist */
    }
  }, [organization]);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    Promise.all([
      supabase.from('website_audits').select('id', { count: 'exact', head: true }).eq('location_id', location.id),
      supabase.from('review_requests').select('id', { count: 'exact', head: true }).eq('location_id', location.id),
    ]).then(([a, r]) => {
      if (!cancelled) setCounts({ audits: a.count ?? 0, requests: r.count ?? 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [location]);

  if (!location || !organization || !isAdmin || !counts || hidden) return null;

  const steps: Step[] = [
    { key: 'website', title: 'Add your website', description: 'So we can check its health and compare it with Google.', to: '/seo?tab=google', done: Boolean(location.website) },
    { key: 'google', title: 'Connect your Google listing', description: 'Shows your rating and imports your latest Google reviews.', to: '/seo?tab=google', done: Boolean(location.gbp_place_id) },
    { key: 'audit', title: 'Run your first website check', description: 'Get an SEO score and an AI fix plan in about a minute.', to: '/seo', done: counts.audits > 0 },
    { key: 'link', title: 'Add your review link', description: 'Where customers go to leave you a review.', to: '/settings#review-requests', done: Boolean(location.review_link) },
    { key: 'request', title: 'Ask a happy customer for a review', description: 'Send your first review request by email.', to: '/reviews', done: counts.requests > 0 },
    {
      key: 'gsc',
      title: 'Connect Google Search Console',
      description: 'See your searches, clicks and which pages Google has indexed.',
      to: '/seo?tab=search',
      done: integrations.some((i) => i.provider === 'search_console' && i.status === 'connected'),
      optional: true,
    },
  ];
  const required = steps.filter((s) => !s.optional);
  const doneCount = required.filter((s) => s.done).length;
  if (doneCount === required.length) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(hiddenKey(organization.id), '1');
    } catch {
      /* hidden for this visit only */
    }
  };

  return (
    <div className="card p-5 border-sky-100 bg-gradient-to-br from-white to-sky-50/50">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shrink-0">
          <Rocket className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900">Get started with {organization.name}</h2>
          <p className="text-xs text-slate-500">{doneCount} of {required.length} done · about 5 minutes in total</p>
          <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden max-w-xs">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all" style={{ width: `${(doneCount / required.length) * 100}%` }} />
          </div>
        </div>
        <button onClick={hide} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Hide checklist" aria-label="Hide getting started checklist">
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link
              to={s.to}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${s.done ? 'border-transparent bg-white/60' : 'border-slate-200 bg-white hover:border-sky-300'}`}
            >
              <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5 ${s.done ? 'bg-emerald-500 text-white' : 'border-2 border-slate-300'}`}>
                {s.done && <Check className="w-3.5 h-3.5" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-semibold ${s.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                  {s.title}{s.optional && <span className="ml-1.5 text-[11px] font-normal text-slate-400 no-underline">(optional)</span>}
                </span>
                {!s.done && <span className="block text-xs text-slate-500 mt-0.5">{s.description}</span>}
              </span>
              {!s.done && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-1" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
