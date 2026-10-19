import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Loader2,
  Lock,
  Megaphone,
  Pause,
  Pencil,
  Play,
  Plug,
  RefreshCw,
  Rocket,
  X,
} from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { startOAuth } from '@/lib/integrations';
import {
  ACCOUNT_STATUS,
  OBJECTIVE_LABEL,
  boostPost,
  campaignState,
  compact,
  listBoostablePosts,
  money,
  selectAdAccount,
  selectBoostPage,
  setCampaignBudget,
  setCampaignStatus,
  useAdsOverview,
  type AdCampaign,
  type AdsOverview,
  type AdsRange,
  type BoostablePost,
} from '@/lib/ads';
import { Modal } from '@/components/ui/Modal';

type Banner = { kind: 'success' | 'error'; text: string } | null;

const RANGES: { value: AdsRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const TONE_CLASS = {
  good: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-slate-100 text-slate-600',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-rose-50 text-rose-700',
};

export function AdsPage() {
  const { can } = useLocationContext();
  const [range, setRange] = useState<AdsRange>('30d');
  const { data, loading, error, reload } = useAdsOverview(range);
  const [banner, setBanner] = useState<Banner>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [budgetFor, setBudgetFor] = useState<AdCampaign | null>(null);
  const [boostOpen, setBoostOpen] = useState(false);
  const [busyCampaign, setBusyCampaign] = useState<string | null>(null);

  // Back from the Meta login: /ads?integration=meta_ads&status=connected|error&message=…
  useEffect(() => {
    if (searchParams.get('integration') !== 'meta_ads') return;
    const status = searchParams.get('status');
    setBanner(
      status === 'connected'
        ? { kind: 'success', text: 'Meta Ads connected.' }
        : { kind: 'error', text: `Couldn't connect Meta Ads: ${searchParams.get('message') || 'unknown error'}` },
    );
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const connect = async () => {
    setBanner(null);
    setConnecting(true);
    try {
      await startOAuth('meta_ads');
    } catch (err) {
      setConnecting(false);
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Could not start the connection' });
    }
  };

  const toggleStatus = async (c: AdCampaign) => {
    const next = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setBusyCampaign(c.id);
    setBanner(null);
    try {
      await setCampaignStatus(c.id, next);
      setBanner({ kind: 'success', text: `${next === 'PAUSED' ? 'Paused' : 'Resumed'} “${c.name}”.` });
      await reload();
    } catch (err) {
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Could not update the campaign' });
    } finally {
      setBusyCampaign(null);
    }
  };

  const canConnect = can('integrations.manage');
  const canManage = Boolean(data?.can_manage);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Ads</h1>
          <p className="text-sm text-slate-500 mt-1">See what your Facebook and Instagram ads cost and bring in, and boost your best posts.</p>
        </div>
        {data?.connected && !data.needs_reconnect && !data.plan_locked && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 rounded-xl bg-slate-100" role="tablist" aria-label="Date range">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  role="tab"
                  aria-selected={range === r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    range === r.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {canManage && (
              <button onClick={() => setBoostOpen(true)} className="btn-primary">
                <Rocket className="w-4 h-4" />
                Boost a post
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="badge bg-sky-50 text-sky-700"><Facebook className="w-3 h-3" />Meta (Facebook + Instagram)</span>
        <span className="badge bg-slate-100 text-slate-400" title="Coming soon">TikTok Ads · coming soon</span>
      </div>

      {banner && (
        <div
          role="status"
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
            banner.kind === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}
        >
          {banner.kind === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <p className="flex-1 break-words">{banner.text}</p>
          <button onClick={() => setBanner(null)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : error && !data ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
          <button onClick={reload} className="btn-secondary mt-3"><RefreshCw className="w-4 h-4" />Try again</button>
        </div>
      ) : !data ? null : data.plan_locked ? (
        <PlanLocked />
      ) : !data.connected ? (
        <ConnectCard canConnect={canConnect} connecting={connecting} onConnect={connect} />
      ) : data.needs_reconnect ? (
        <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Reconnect Meta Ads</p>
            <p className="text-sm text-slate-500 mt-0.5">{data.last_error || 'The connection to Meta stopped working.'}</p>
          </div>
          {canConnect && (
            <button onClick={connect} disabled={connecting} className="btn-primary">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Reconnect
            </button>
          )}
        </div>
      ) : (
        <Dashboard
          data={data}
          loading={loading}
          canManage={canManage}
          canConnect={canConnect}
          connecting={connecting}
          busyCampaign={busyCampaign}
          onReconnect={connect}
          onToggle={toggleStatus}
          onEditBudget={setBudgetFor}
          onChanged={async (text) => {
            setBanner(text ? { kind: 'success', text } : null);
            await reload();
          }}
          onError={(text) => setBanner({ kind: 'error', text })}
        />
      )}

      {data?.account && (
        <BudgetModal
          campaign={budgetFor}
          currency={data.account.currency}
          onClose={() => setBudgetFor(null)}
          onSaved={async (text) => {
            setBudgetFor(null);
            setBanner({ kind: 'success', text });
            await reload();
          }}
        />
      )}

      {data?.account && (
        <BoostModal
          isOpen={boostOpen}
          currency={data.account.currency}
          onClose={() => setBoostOpen(false)}
          onBoosted={async (text) => {
            setBoostOpen(false);
            setBanner({ kind: 'success', text });
            await reload();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Empty states
function PlanLocked() {
  return (
    <div className="card p-6 sm:p-8 text-center max-w-xl mx-auto">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 mx-auto mb-3">
        <Lock className="w-5 h-5" />
      </div>
      <h2 className="text-base font-bold text-slate-900">Ads are included in Pro and Agency</h2>
      <p className="text-sm text-slate-500 mt-1">
        Connect your Meta ad account to see spend and results next to your reviews, pause or resume campaigns, change budgets
        and boost your best posts in a few clicks.
      </p>
      <Link to="/billing" className="btn-primary mt-4">See plans</Link>
    </div>
  );
}

function ConnectCard({ canConnect, connecting, onConnect }: { canConnect: boolean; connecting: boolean; onConnect: () => void }) {
  return (
    <div className="card p-6 sm:p-8 max-w-2xl">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-50 text-sky-600 mb-3">
        <Megaphone className="w-5 h-5" />
      </div>
      <h2 className="text-base font-bold text-slate-900">Connect your Meta ad account</h2>
      <ul className="text-sm text-slate-600 mt-2 space-y-1 list-disc pl-5">
        <li>Spend, reach, clicks and results for Facebook and Instagram ads</li>
        <li>Pause, resume and change daily budgets without opening Ads Manager</li>
        <li>Boost a Page post to people nearby or in the countries you choose</li>
      </ul>
      <p className="text-xs text-slate-400 mt-3">
        You need an ad account in Meta Ads Manager with a payment method, and admin or advertiser access to it.
      </p>
      {canConnect ? (
        <button onClick={onConnect} disabled={connecting} className="btn-primary mt-4">
          {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
          Connect Meta Ads
        </button>
      ) : (
        <p className="text-sm text-slate-500 mt-4">Ask the business owner to connect Meta Ads.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Dashboard
function Dashboard({
  data,
  loading,
  canManage,
  canConnect,
  connecting,
  busyCampaign,
  onReconnect,
  onToggle,
  onEditBudget,
  onChanged,
  onError,
}: {
  data: AdsOverview;
  loading: boolean;
  canManage: boolean;
  canConnect: boolean;
  connecting: boolean;
  busyCampaign: string | null;
  onReconnect: () => void;
  onToggle: (c: AdCampaign) => void;
  onEditBudget: (c: AdCampaign) => void;
  onChanged: (text: string | null) => Promise<void>;
  onError: (text: string) => void;
}) {
  const account = data.account!;
  const totals = data.totals!;
  const currency = account.currency;
  const accountIssue = account.status !== 1 ? ACCOUNT_STATUS[account.status] : null;
  const [switching, setSwitching] = useState(false);

  const daysLeft = data.token_expires_at
    ? Math.ceil((new Date(data.token_expires_at).getTime() - Date.now()) / 86_400_000)
    : null;

  const switchAccount = async (id: string) => {
    setSwitching(true);
    try {
      await selectAdAccount(id);
      await onChanged(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not switch account');
    } finally {
      setSwitching(false);
    }
  };

  const tiles = [
    { label: 'Spent', value: money(totals.spend, currency) },
    { label: 'Reach', value: compact(totals.reach), hint: 'People who saw an ad' },
    { label: 'Impressions', value: compact(totals.impressions) },
    { label: 'Clicks', value: compact(totals.clicks) },
    { label: 'Click rate', value: `${totals.ctr.toFixed(2)}%` },
    { label: 'Cost per click', value: money(totals.cpc, currency) },
  ];

  return (
    <div className={`space-y-5 ${loading ? 'opacity-60 pointer-events-none' : ''}`} aria-busy={loading}>
      <div className="card p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">Ad account</p>
          {(data.accounts?.length ?? 0) > 1 && canManage ? (
            <select
              value={account.id}
              disabled={switching}
              onChange={(e) => switchAccount(e.target.value)}
              className="input-field !py-1.5 mt-1 max-w-sm"
              aria-label="Ad account"
            >
              {data.accounts!.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.business ? ` · ${a.business}` : ''} ({a.currency})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-semibold text-slate-900 truncate">{account.name}</p>
          )}
          <p className="text-xs text-slate-400 mt-1">
            {currency}{account.timezone ? ` · ${account.timezone}` : ''}
          </p>
        </div>
        <a href={account.ads_manager_url} target="_blank" rel="noreferrer" className="btn-secondary text-sm self-start md:self-auto">
          <ExternalLink className="w-4 h-4" />
          Open Ads Manager
        </a>
      </div>

      {accountIssue && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p><b>{accountIssue.label}.</b> {accountIssue.hint}</p>
        </div>
      )}

      {daysLeft !== null && daysLeft <= 10 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3.5 rounded-xl bg-sky-50 border border-sky-100 text-sm text-sky-800">
          <p className="flex-1">
            Meta asks you to sign in again every 60 days. Your connection ends {daysLeft <= 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}.
          </p>
          {canConnect && (
            <button onClick={onReconnect} disabled={connecting} className="btn-secondary text-sm">
              <RefreshCw className="w-4 h-4" />
              Reconnect now
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4" title={t.hint}>
            <p className="text-xs text-slate-500">{t.label}</p>
            <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>

      <SpendChart daily={data.daily ?? []} currency={currency} />

      <section>
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Campaigns</h2>
        {(data.campaigns?.length ?? 0) === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500">
            No campaigns in this ad account yet. {canManage ? 'Boost a post to start your first one.' : ''}
          </div>
        ) : (
          <ul className="space-y-3">
            {data.campaigns!.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                currency={currency}
                canManage={canManage}
                busy={busyCampaign === c.id}
                onToggle={() => onToggle(c)}
                onEditBudget={() => onEditBudget(c)}
              />
            ))}
          </ul>
        )}
      </section>

      {canManage && (data.pages?.length ?? 0) > 1 && (
        <PagePicker pages={data.pages!} pageId={data.page_id ?? null} onChanged={onChanged} onError={onError} />
      )}
    </div>
  );
}

function CampaignCard({
  campaign: c,
  currency,
  canManage,
  busy,
  onToggle,
  onEditBudget,
}: {
  campaign: AdCampaign;
  currency: string;
  canManage: boolean;
  busy: boolean;
  onToggle: () => void;
  onEditBudget: () => void;
}) {
  const state = campaignState(c);
  const canToggle = c.status === 'ACTIVE' || c.status === 'PAUSED';
  const stats = [
    { label: 'Spent', value: money(c.spend, currency) },
    { label: 'Reach', value: compact(c.reach) },
    { label: 'Clicks', value: compact(c.clicks) },
    { label: 'Click rate', value: `${c.ctr.toFixed(2)}%` },
    ...(c.result_label && c.result_label !== 'Reach' ? [{ label: c.result_label, value: compact(c.results) }] : []),
  ];
  return (
    <li className="card p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 break-words">{c.name}</p>
            <span className={`badge ${TONE_CLASS[state.tone]}`}>{state.label}</span>
            {c.boosted_from_app && <span className="badge bg-indigo-50 text-indigo-600"><Rocket className="w-3 h-3" />Boosted here</span>}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {OBJECTIVE_LABEL[c.objective] ?? c.objective}
            {' · '}
            {c.daily_budget !== null
              ? `${money(c.daily_budget, currency)} a day`
              : c.lifetime_budget !== null
              ? `${money(c.lifetime_budget, currency)} total`
              : 'Budget set per ad set'}
            {c.stop_time ? ` · ends ${new Date(c.stop_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            {c.budget_editable && c.daily_budget !== null && (
              <button onClick={onEditBudget} className="btn-ghost text-sm" title="Change daily budget">
                <Pencil className="w-4 h-4" />
                Budget
              </button>
            )}
            {canToggle && (
              <button onClick={onToggle} disabled={busy} className="btn-secondary text-sm">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : c.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {c.status === 'ACTIVE' ? 'Pause' : 'Resume'}
              </button>
            )}
          </div>
        )}
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-slate-100">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] text-slate-400">{s.label}</dt>
            <dd className="text-sm font-semibold text-slate-800 tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

// Daily spend: one series, so no legend; hover/focus shows the day's numbers.
function SpendChart({ daily, currency }: { daily: { date: string; spend: number; clicks: number }[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(0, ...daily.map((d) => d.spend)), [daily]);
  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (daily.length === 0 || max === 0) {
    return (
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-900">Daily spend</h2>
        <p className="text-sm text-slate-400 mt-2">No spend in this period.</p>
      </div>
    );
  }
  const active = hover !== null ? daily[hover] : null;
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Daily spend</h2>
        <p className="text-xs text-slate-500 tabular-nums min-h-[1rem]" aria-live="polite">
          {active ? `${fmtDay(active.date)}: ${money(active.spend, currency)} · ${active.clicks} clicks` : `Highest day ${money(max, currency)}`}
        </p>
      </div>
      <div className="relative mt-3 h-36">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-100" aria-hidden />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" aria-hidden />
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-slate-200" onMouseLeave={() => setHover(null)}>
          {daily.map((d, i) => (
            <button
              key={d.date}
              type="button"
              className="group relative flex-1 h-full flex items-end focus:outline-none"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${fmtDay(d.date)}: ${money(d.spend, currency)}`}
            >
              <span
                className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-sky-600' : 'bg-sky-400'}`}
                style={{ height: `${Math.max(d.spend > 0 ? 2 : 0, (d.spend / max) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
        <span>{fmtDay(daily[0].date)}</span>
        <span>{fmtDay(daily[daily.length - 1].date)}</span>
      </div>
      <table className="sr-only">
        <caption>Daily spend</caption>
        <thead><tr><th>Day</th><th>Spend</th><th>Clicks</th></tr></thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}><td>{d.date}</td><td>{money(d.spend, currency)}</td><td>{d.clicks}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PagePicker({
  pages,
  pageId,
  onChanged,
  onError,
}: {
  pages: { id: string; name: string }[];
  pageId: string | null;
  onChanged: (text: string | null) => Promise<void>;
  onError: (text: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">Page for boosted posts</p>
        <p className="text-xs text-slate-400">“Boost a post” shows posts from this Facebook Page.</p>
      </div>
      <select
        value={pageId ?? ''}
        disabled={saving}
        aria-label="Page for boosted posts"
        onChange={async (e) => {
          setSaving(true);
          try {
            await selectBoostPage(e.target.value);
            await onChanged('Page for boosted posts updated.');
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Could not change the Page');
          } finally {
            setSaving(false);
          }
        }}
        className="input-field !py-1.5 sm:max-w-xs"
      >
        {pages.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------- Budget
function BudgetModal({
  campaign,
  currency,
  onClose,
  onSaved,
}: {
  campaign: AdCampaign | null;
  currency: string;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaign) {
      setValue(campaign.daily_budget !== null ? String(campaign.daily_budget) : '');
      setError(null);
    }
  }, [campaign]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await setCampaignBudget(campaign.id, amount);
      onSaved(`Daily budget for “${campaign.name}” is now ${money(amount, currency)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={campaign !== null} onClose={onClose} title="Change daily budget" subtitle={campaign?.name} maxWidth="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="ad-budget" className="block text-sm font-medium text-slate-700 mb-1.5">Daily budget ({currency})</label>
          <input
            id="ad-budget"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input-field tabular-nums"
            required
          />
          <p className="text-xs text-slate-400 mt-1">Meta may spend up to 75% more on some days but keeps the weekly average to this amount.</p>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save budget
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Boost
const COUNTRIES: [string, string][] = [
  ['PK', 'Pakistan'],
  ['AE', 'United Arab Emirates'],
  ['SA', 'Saudi Arabia'],
  ['US', 'United States'],
  ['GB', 'United Kingdom'],
  ['CA', 'Canada'],
  ['AU', 'Australia'],
  ['IN', 'India'],
  ['DE', 'Germany'],
  ['QA', 'Qatar'],
];

function BoostModal({
  isOpen,
  currency,
  onClose,
  onBoosted,
}: {
  isOpen: boolean;
  currency: string;
  onClose: () => void;
  onBoosted: (text: string) => void;
}) {
  const [posts, setPosts] = useState<BoostablePost[] | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [goal, setGoal] = useState<'reach' | 'engagement'>('reach');
  const [mode, setMode] = useState<'nearby' | 'countries'>('nearby');
  const [radius, setRadius] = useState(10);
  const [countries, setCountries] = useState<string[]>(['PK']);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [budget, setBudget] = useState('5');
  const [days, setDays] = useState(7);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPosts(null);
    setPostsError(null);
    setPostId(null);
    setConfirming(false);
    setError(null);
    listBoostablePosts()
      .then((p) => {
        setPosts(p);
        setPostId(p.find((x) => x.eligible)?.id ?? null);
      })
      .catch((err) => setPostsError(err instanceof Error ? err.message : 'Could not load your posts'));
  }, [isOpen]);

  const daily = Number(budget);
  const total = Number.isFinite(daily) ? daily * days : 0;

  const validate = () => {
    if (!postId) return 'Pick a post to boost.';
    if (!Number.isFinite(daily) || daily <= 0) return 'Enter a daily budget greater than 0.';
    if (mode === 'countries' && countries.length === 0) return 'Pick at least one country.';
    if (ageMin > ageMax) return 'The minimum age must be lower than the maximum.';
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      setConfirming(false);
      return;
    }
    if (!confirming) {
      setError(null);
      setConfirming(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await boostPost({
        post_id: postId!,
        goal,
        daily_budget: daily,
        days,
        audience:
          mode === 'nearby'
            ? { mode: 'nearby', radius_km: radius, age_min: ageMin, age_max: ageMax }
            : { mode: 'countries', countries, age_min: ageMin, age_max: ageMax },
      });
      onBoosted(`Your post is boosted. Meta reviews new ads, usually within a day, then it starts running (up to ${money(total, currency)} in total).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not boost the post');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Boost a post" subtitle="Show a Facebook Page post to more people" maxWidth="lg">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">1. Pick a post</p>
          {postsError ? (
            <p className="text-sm text-rose-600">{postsError}</p>
          ) : posts === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />Loading your Page posts…</div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-slate-500">No posts on your Page yet. Publish one from Social first.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto space-y-2 pr-1" role="radiogroup" aria-label="Post to boost">
              {posts.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={postId === p.id}
                    disabled={!p.eligible}
                    onClick={() => setPostId(p.id)}
                    className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      postId === p.id ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p.picture ? (
                      <img src={p.picture} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-slate-100" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-800 line-clamp-2 break-words">{p.message || 'Photo post'}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">
                        {new Date(p.created_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {!p.eligible && ' · can’t be boosted'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">2. Goal</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([
              ['reach', 'More people see it', 'Shows it to as many people as possible'],
              ['engagement', 'More likes and comments', 'Shows it to people likely to react'],
            ] as const).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGoal(value)}
                aria-pressed={goal === value}
                className={`p-3 rounded-xl border text-left ${goal === value ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="block text-sm font-medium text-slate-900">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">3. Who sees it</p>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 mb-3">
            {([['nearby', 'Near my business'], ['countries', 'Countries']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === 'nearby' ? (
            <div>
              <label htmlFor="boost-radius" className="text-xs text-slate-500">Within {radius} km of your business address</label>
              <input id="boost-radius" type="range" min={1} max={80} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map(([code, name]) => {
                const on = countries.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setCountries(on ? countries.filter((c) => c !== code) : [...countries, code])}
                    className={`px-2.5 py-1 rounded-full text-xs border ${on ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3 text-sm">
            <label htmlFor="boost-age-min" className="text-slate-500">Ages</label>
            <select id="boost-age-min" value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} className="input-field !w-auto !py-1.5">
              {[18, 21, 25, 30, 35, 40, 45, 50, 55, 60, 65].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="text-slate-400">to</span>
            <select aria-label="Maximum age" value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} className="input-field !w-auto !py-1.5">
              {[24, 30, 35, 40, 45, 50, 55, 60, 65].map((a) => <option key={a} value={a}>{a === 65 ? '65+' : a}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">4. Budget</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="boost-budget" className="text-xs text-slate-500">Per day ({currency})</label>
              <input id="boost-budget" type="number" inputMode="decimal" min="0.01" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} className="input-field tabular-nums mt-1" />
            </div>
            <div>
              <label htmlFor="boost-days" className="text-xs text-slate-500">For</label>
              <select id="boost-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-field mt-1">
                {[1, 3, 5, 7, 10, 14, 21, 30].map((d) => <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>)}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Total: up to <b className="tabular-nums">{money(total, currency)}</b>, charged by Meta to your ad account.
          </p>
        </div>

        {confirming && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
            This starts a paid ad. Meta can charge your ad account up to <b>{money(total, currency)}</b> over {days} day{days === 1 ? '' : 's'}.
            You can pause it any time from this page.
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button type="button" onClick={submit} disabled={saving || !posts?.length} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {confirming ? `Confirm and boost (${money(total, currency)})` : 'Review boost'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
