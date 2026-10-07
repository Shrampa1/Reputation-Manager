import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, CreditCard, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { LIMIT_LABELS, openBillingPortal, startCheckout, usePlan, type LimitKey, type PlanId } from '@/lib/billing';

const USAGE_ORDER: LimitKey[] = ['website_audits_per_day', 'review_requests_per_month', 'competitors', 'team_members', 'businesses'];

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

export function BillingPage() {
  const { organization, can } = useLocationContext();
  const { plans, usage, loading, error, reload } = usePlan();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isOwner = can('billing.manage');

  // Back from Lemon Squeezy checkout: the webhook may take a few seconds to arrive
  useEffect(() => {
    if (params.get('checkout') !== 'success') return;
    setNotice('Thanks! Your payment went through. Your new plan will appear here in a few seconds.');
    setParams({}, { replace: true });
    const timers = [3000, 8000, 15000].map((ms) => setTimeout(reload, ms));
    return () => timers.forEach(clearTimeout);
  }, [params, setParams, reload]);

  const choose = async (plan: PlanId) => {
    setBusy(plan);
    setActionError(null);
    try {
      const res = await startCheckout(plan);
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      setNotice('Your plan is being changed. It updates here in a few seconds.');
      setTimeout(reload, 4000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Couldn’t start checkout');
    } finally {
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy('portal');
    setActionError(null);
    try {
      const { url } = await openBillingPortal();
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Couldn’t open billing');
    } finally {
      setBusy(null);
    }
  };

  const current = usage?.plan ?? 'free';
  const sub = usage?.subscription;
  const paid = sub && sub.provider === 'lemonsqueezy' && current !== 'free';

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Plan & billing</h1>
        <p className="text-sm text-slate-500 mt-1">{organization?.name}: your plan, what you’ve used, and upgrades.</p>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm flex items-start gap-2" role="status">
          <Check className="w-4 h-4 shrink-0 mt-0.5" /> {notice}
        </div>
      )}
      {(error || actionError) && (
        <p className="text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {actionError ?? error}
        </p>
      )}

      {loading && !usage ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-600"><CreditCard className="w-5 h-5" /></div>
                <div>
                  <p className="text-xs text-slate-400">Current plan</p>
                  <p className="text-lg font-bold text-slate-900">{plans.find((p) => p.id === current)?.name ?? current}</p>
                  {sub && current !== 'free' && (
                    <p className="text-xs text-slate-500">
                      {sub.status === 'cancelled' && sub.ends_at
                        ? `Cancelled. Active until ${formatDate(sub.ends_at)}`
                        : sub.status === 'on_trial' && sub.trial_ends_at
                          ? `Free trial until ${formatDate(sub.trial_ends_at)}`
                          : sub.status === 'past_due'
                            ? 'Payment failed: update your card to keep this plan'
                            : sub.renews_at
                              ? `Renews ${formatDate(sub.renews_at)}`
                              : sub.provider === 'manual'
                                ? 'Set by Reputation Engine support'
                                : null}
                    </p>
                  )}
                </div>
              </div>
              {isOwner && paid && (
                <button onClick={portal} disabled={busy !== null} className="btn-secondary">
                  {busy === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />} Manage billing & invoices
                </button>
              )}
            </div>

            {usage && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {USAGE_ORDER.map((key) => {
                  const used = usage.usage[key] ?? 0;
                  const limit = key === 'businesses' ? usage.business_allowance : usage.limits?.[key] ?? 0;
                  const unlimited = limit < 0;
                  const pct = unlimited || !limit ? 0 : Math.min(100, (used / limit) * 100);
                  return (
                    <div key={key} className="p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{LIMIT_LABELS[key]}</span>
                        <span className="font-semibold text-slate-700">{used} / {unlimited ? '∞' : limit}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 mt-2 overflow-hidden">
                        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => {
              const isCurrent = p.id === current;
              const isUpgrade = p.sort > (plans.find((x) => x.id === current)?.sort ?? 0);
              return (
                <div key={p.id} className={`card p-5 flex flex-col ${isCurrent ? 'ring-2 ring-sky-400' : ''}`}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">{p.name}</h2>
                    {isCurrent && <span className="badge bg-sky-50 text-sky-600">Current</span>}
                    {p.id === 'pro' && !isCurrent && <span className="badge bg-violet-50 text-violet-600"><Sparkles className="w-3 h-3" /> Popular</span>}
                  </div>
                  <p className="text-2xl font-bold text-slate-900 mt-2">{p.price_label}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{f}</li>
                    ))}
                  </ul>
                  {p.id !== 'free' && !isCurrent && (
                    isOwner ? (
                      <button onClick={() => choose(p.id)} disabled={busy !== null} className={`${isUpgrade ? 'btn-primary' : 'btn-secondary'} w-full mt-5`}>
                        {busy === p.id && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isUpgrade ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400 mt-5">Ask the business owner to change the plan.</p>
                    )
                  )}
                  {p.id === 'free' && !isCurrent && paid && isOwner && (
                    <button onClick={portal} disabled={busy !== null} className="btn-ghost w-full mt-5 text-slate-500">Cancel subscription</button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400">Payments are handled securely by Lemon Squeezy. Prices exclude any local taxes they add at checkout.</p>
        </>
      )}
    </div>
  );
}
