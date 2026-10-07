import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ExternalLink,
  FileSearch,
  Loader2,
  MousePointerClick,
  Eye,
  Percent,
  RefreshCw,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { startOAuth } from '@/lib/integrations';
import { relativeTime } from '@/lib/activity';
import {
  formatNumber,
  gscCoverage,
  gscInspect,
  gscOverview,
  gscSelectSite,
  gscStatus,
  pctChange,
  siteLabel,
  type GscStatus,
  type Snapshot,
} from '@/lib/searchConsole';
import type { GscCoverage, GscInspection, GscOverview } from '@/types';

type View = 'queries' | 'pages' | 'indexing' | 'sitemaps';

function Change({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 0.5) return <span className="text-xs text-slate-400">no change</span>;
  const good = inverse ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? 'text-emerald-600' : 'text-rose-500'}`}>
      <Icon className="w-3.5 h-3.5" />
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

/** Clicks (bars) and impressions (line) per day, each scaled to its own max. */
function TrendChart({ series }: { series: GscOverview['series'] }) {
  if (series.length < 2) return <p className="text-sm text-slate-400 py-8 text-center">Not enough data for a chart yet.</p>;
  const W = 600;
  const H = 140;
  const maxClicks = Math.max(1, ...series.map((s) => s.clicks));
  const maxImpr = Math.max(1, ...series.map((s) => s.impressions));
  const step = W / series.length;
  const line = series
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${(i + 0.5) * step},${H - (s.impressions / maxImpr) * (H - 10)}`)
    .join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" preserveAspectRatio="none" role="img" aria-label="Clicks and impressions per day">
        {series.map((s, i) => (
          <rect
            key={s.date}
            x={i * step + step * 0.15}
            width={step * 0.7}
            y={H - (s.clicks / maxClicks) * (H - 10)}
            height={(s.clicks / maxClicks) * (H - 10)}
            className="fill-sky-400/70"
          >
            <title>{`${s.date}: ${s.clicks} clicks, ${s.impressions} impressions`}</title>
          </rect>
        ))}
        <path d={line} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" className="stroke-violet-500" />
      </svg>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
        <span>{series[0].date}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Clicks</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-500" /> Impressions</span>
        </span>
        <span>{series[series.length - 1].date}</span>
      </div>
    </div>
  );
}

function pathOf(url: string) {
  try {
    const u = new URL(url);
    return u.pathname + u.search || '/';
  } catch {
    return url;
  }
}

function InspectionRow({ r }: { r: GscInspection }) {
  const ok = r.verdict === 'PASS';
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
        {ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-900 hover:underline break-all">{pathOf(r.url)}</a>
        <p className="text-xs text-slate-500 mt-0.5">
          {r.coverageState}
          {r.lastCrawlTime && ` · last crawled ${relativeTime(r.lastCrawlTime)}`}
          {r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical && ' · Google chose a different canonical'}
        </p>
        {r.richResults.length > 0 && (
          <p className="text-[11px] text-slate-400 mt-0.5">
            Rich results: {r.richResults.map((x) => `${x.type}${x.issues ? ` (${x.issues} issue${x.issues === 1 ? '' : 's'})` : ''}`).join(', ')}
          </p>
        )}
      </div>
      {r.link && (
        <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline shrink-0 inline-flex items-center gap-0.5">
          Details <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </li>
  );
}

function IndexingPanel({ site }: { site: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot<GscCoverage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [single, setSingle] = useState<GscInspection | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    gscCoverage({ cachedOnly: true })
      .then((r) => !cancelled && setSnapshot(r.snapshot))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Couldn’t load'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [site]);

  const runCheck = async () => {
    setRunning(true);
    setError(null);
    try {
      setSnapshot((await gscCoverage({ refresh: true })).snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check failed');
    } finally {
      setRunning(false);
    }
  };

  const inspectOne = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setInspecting(true);
    setSingleError(null);
    setSingle(null);
    try {
      setSingle((await gscInspect(url.trim())).result);
    } catch (err) {
      setSingleError(err instanceof Error ? err.message : 'Inspection failed');
    } finally {
      setInspecting(false);
    }
  };

  const c = snapshot?.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">Is Google indexing your pages?</p>
          <p className="text-xs text-slate-500">
            Asks Google about up to 30 pages from your sitemap.{snapshot && ` Last checked ${relativeTime(snapshot.created_at)}.`}
          </p>
        </div>
        <button onClick={runCheck} disabled={running} className="btn-primary shrink-0">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
          {running ? 'Asking Google… (up to a minute)' : snapshot ? 'Check again' : 'Check indexing'}
        </button>
      </div>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      {loading && <Loader2 className="w-5 h-5 text-sky-500 animate-spin mx-auto" />}

      {c && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 text-center">
              <p className="text-xl font-bold text-slate-900">{c.sampled}</p>
              <p className="text-xs text-slate-500">Pages checked</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-center">
              <p className="text-xl font-bold text-emerald-600">{c.indexed}</p>
              <p className="text-xs text-slate-500">Indexed</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 text-center">
              <p className="text-xl font-bold text-rose-600">{c.notIndexed}</p>
              <p className="text-xs text-slate-500">Not indexed</p>
            </div>
          </div>
          {c.partial && <p className="text-xs text-amber-600">Google’s daily inspection limit was reached, so only part of the sample was checked.</p>}
          {c.reasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Why pages aren’t indexed</p>
              <ul className="space-y-1">
                {c.reasons.map((r) => (
                  <li key={r.reason} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{r.reason}</span>
                    <span className="badge bg-rose-50 text-rose-600">{r.count}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400 mt-2">
                “Discovered/Crawled – currently not indexed” usually means Google doesn’t see enough value yet: improve the content and link to the page from other pages.
                “Duplicate” or “Alternate page” means Google indexed another version instead.
              </p>
            </div>
          )}
          <ul className="divide-y divide-slate-50">{c.results.map((r) => <InspectionRow key={r.url} r={r} />)}</ul>
        </>
      )}

      <form onSubmit={inspectOne} className="pt-3 border-t border-slate-100" noValidate>
        <label htmlFor="gsc-inspect" className="block text-sm font-semibold text-slate-900 mb-1.5">Check one page</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input id="gsc-inspect" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://${siteLabel(site)}/your-page`} className="input-field flex-1" />
          <button type="submit" disabled={inspecting} className="btn-secondary shrink-0">
            {inspecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Inspect
          </button>
        </div>
        {singleError && <p className="text-sm text-rose-600 mt-2" role="alert">{singleError}</p>}
        {single && <ul className="mt-2"><InspectionRow r={single} /></ul>}
      </form>
    </div>
  );
}

export function SearchConsole() {
  const { can } = useLocationContext();
  // Feature access (role default or Role access override)
  const isAdmin = can('integrations.manage');
  const [status, setStatus] = useState<GscStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [days, setDays] = useState(28);
  const [snapshot, setSnapshot] = useState<Snapshot<GscOverview> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('queries');
  const [queryFilter, setQueryFilter] = useState('');
  const [quickWins, setQuickWins] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    gscStatus()
      .then(setStatus)
      .catch((err) => setStatusError(err instanceof Error ? err.message : 'Couldn’t load Search Console'));
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        setSnapshot((await gscOverview(days, refresh)).snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Couldn’t load Search Console data');
      } finally {
        setLoading(false);
      }
    },
    [days]
  );

  useEffect(() => {
    if (status?.connected) load();
  }, [status?.connected, status?.site, load]);

  const connect = async () => {
    setConnecting(true);
    try {
      await startOAuth('search_console');
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Couldn’t start the Google connection');
      setConnecting(false);
    }
  };

  const changeSite = async (siteUrl: string) => {
    try {
      const r = await gscSelectSite(siteUrl);
      setSnapshot(null);
      setStatus((s) => (s ? { ...s, site: r.site, sites: r.sites } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t switch property');
    }
  };

  const o = snapshot?.data;
  const queries = useMemo(() => {
    let rows = o?.queries ?? [];
    if (quickWins) rows = rows.filter((q) => q.position >= 8 && q.position <= 20 && q.impressions >= 10);
    const f = queryFilter.trim().toLowerCase();
    return f ? rows.filter((q) => q.query.includes(f)) : rows;
  }, [o, quickWins, queryFilter]);

  if (!status && !statusError) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;
  }

  if (statusError || !status?.connected) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-600 shrink-0"><Search className="w-5 h-5" /></div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">Connect Google Search Console</h2>
            <p className="text-sm text-slate-500 mt-1">
              See exactly which of your pages Google has indexed (and why others aren’t), the searches people use to find you,
              your clicks, impressions and average ranking, and the status of your sitemaps.
            </p>
            <ul className="text-xs text-slate-500 mt-3 space-y-1 list-disc ml-4">
              <li>Free, read-only. Nothing is changed in your Google account.</li>
              <li>Your site must already be added and verified at search.google.com/search-console under the Google account you use.</li>
            </ul>
            {statusError && <p className="text-sm text-rose-600 mt-3" role="alert">{statusError}</p>}
            {isAdmin ? (
              <button onClick={connect} disabled={connecting} className="btn-primary mt-4">
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Connect with Google
              </button>
            ) : (
              <p className="text-sm text-slate-500 mt-4">Ask an owner or admin to connect Search Console.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const t = o?.totals;
  const p = o?.previousTotals;
  const kpis = t && p
    ? [
        { label: 'Clicks', icon: MousePointerClick, value: formatNumber(t.clicks), change: pctChange(t.clicks, p.clicks), inverse: false },
        { label: 'Impressions', icon: Eye, value: formatNumber(t.impressions), change: pctChange(t.impressions, p.impressions), inverse: false },
        { label: 'Click-through rate', icon: Percent, value: `${(t.ctr * 100).toFixed(1)}%`, change: pctChange(t.ctr, p.ctr), inverse: false },
        { label: 'Avg. position', icon: TrendingUp, value: t.position ? t.position.toFixed(1) : '—', change: pctChange(t.position, p.position), inverse: true },
      ]
    : [];

  return (
    <div className="space-y-4">
      {status.status === 'error' && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-rose-200">
          <p className="text-sm text-rose-600 flex-1 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {status.lastError ?? 'Search Console needs to be reconnected.'}
          </p>
          {isAdmin && <button onClick={connect} className="btn-secondary text-xs">Reconnect</button>}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-medium text-slate-500 shrink-0">Property</span>
          {isAdmin && status.sites.length > 1 ? (
            <select value={status.site ?? ''} onChange={(e) => changeSite(e.target.value)} className="input-field !py-1.5 text-sm" aria-label="Search Console property">
              {status.sites.map((s) => <option key={s} value={s}>{siteLabel(s)}</option>)}
            </select>
          ) : (
            <span className="text-sm font-semibold text-slate-900 truncate">{siteLabel(status.site)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-field !py-1.5 !w-auto text-sm" aria-label="Date range">
            <option value={7}>Last 7 days</option>
            <option value={28}>Last 28 days</option>
            <option value={90}>Last 3 months</option>
          </select>
          <button onClick={() => load(true)} disabled={loading} className="btn-secondary !py-1.5 text-xs" title="Fetch fresh data from Google">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>
      {snapshot && (
        <p className="text-xs text-slate-400 -mt-2">
          {o?.range.startDate} to {o?.range.endDate} (Google’s data runs ~2 days behind) · updated {relativeTime(snapshot.created_at)}
        </p>
      )}
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

      {!o && loading && <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>}

      {o && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="card p-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1"><k.icon className="w-3.5 h-3.5" />{k.label}</div>
                <p className="text-2xl font-bold text-slate-900">{k.value}</p>
                <Change value={k.change} inverse={k.inverse} />
              </div>
            ))}
          </div>

          <div className="card p-5">
            <TrendChart series={o.series} />
            {o.devices.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
                {o.devices.map((d) => (
                  <span key={d.device} className="badge bg-slate-100 text-slate-600">
                    {d.device.charAt(0) + d.device.slice(1).toLowerCase()}: {formatNumber(d.clicks)} clicks
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit max-w-full overflow-x-auto mb-4" role="tablist">
              {([
                ['queries', 'Searches'],
                ['pages', 'Pages'],
                ['indexing', 'Indexing'],
                ['sitemaps', `Sitemaps (${o.sitemaps.length})`],
              ] as [View, string][]).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {view === 'queries' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input value={queryFilter} onChange={(e) => setQueryFilter(e.target.value)} placeholder="Filter searches…" aria-label="Filter searches" className="input-field flex-1" />
                  <button
                    type="button"
                    aria-pressed={quickWins}
                    onClick={() => setQuickWins((v) => !v)}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium ${quickWins ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'}`}
                    title="Searches where you rank 8–20: small improvements can move you onto page 1"
                  >
                    Quick wins (rank 8–20)
                  </button>
                </div>
                {queries.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No searches match.</p>
                ) : (
                  <div className="overflow-x-auto -mx-1">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead>
                        <tr className="text-left text-xs text-slate-400">
                          <th className="font-medium py-1.5 px-1">Search</th>
                          <th className="font-medium py-1.5 px-1 text-right">Clicks</th>
                          <th className="font-medium py-1.5 px-1 text-right">Impressions</th>
                          <th className="font-medium py-1.5 px-1 text-right">CTR</th>
                          <th className="font-medium py-1.5 px-1 text-right">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queries.map((q) => (
                          <tr key={q.query} className="border-t border-slate-100">
                            <td className="py-2 px-1 text-slate-800">
                              {q.query}
                              {q.position >= 8 && q.position <= 20 && q.impressions >= 10 && <span className="badge bg-amber-50 text-amber-700 ml-2">almost page 1</span>}
                            </td>
                            <td className="py-2 px-1 text-right font-medium">{formatNumber(q.clicks)}</td>
                            <td className="py-2 px-1 text-right text-slate-600">{formatNumber(q.impressions)}</td>
                            <td className="py-2 px-1 text-right text-slate-600">{(q.ctr * 100).toFixed(1)}%</td>
                            <td className="py-2 px-1 text-right text-slate-600">{q.position.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {view === 'pages' && (
              <div className="space-y-4">
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="text-left text-xs text-slate-400">
                        <th className="font-medium py-1.5 px-1">Page</th>
                        <th className="font-medium py-1.5 px-1 text-right">Clicks</th>
                        <th className="font-medium py-1.5 px-1 text-right">Change</th>
                        <th className="font-medium py-1.5 px-1 text-right">Impressions</th>
                        <th className="font-medium py-1.5 px-1 text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.pages.map((pg) => (
                        <tr key={pg.page} className="border-t border-slate-100">
                          <td className="py-2 px-1 max-w-[280px]">
                            <a href={pg.page} target="_blank" rel="noopener noreferrer" className="text-slate-800 hover:underline block truncate" title={pg.page}>{pathOf(pg.page)}</a>
                          </td>
                          <td className="py-2 px-1 text-right font-medium">{formatNumber(pg.clicks)}</td>
                          <td className="py-2 px-1 text-right"><Change value={pctChange(pg.clicks, pg.prevClicks)} /></td>
                          <td className="py-2 px-1 text-right text-slate-600">{formatNumber(pg.impressions)}</td>
                          <td className="py-2 px-1 text-right text-slate-600">{pg.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {o.losingPages.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                    <p className="text-sm font-semibold text-slate-900 mb-1.5">Pages losing clicks</p>
                    <ul className="space-y-1">
                      {o.losingPages.map((l) => (
                        <li key={l.page} className="flex items-center justify-between gap-3 text-sm">
                          <a href={l.page} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:underline truncate">{pathOf(l.page)}</a>
                          <span className="text-xs text-rose-600 shrink-0">{l.prevClicks} → {l.clicks} clicks</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {view === 'indexing' && status.site && <IndexingPanel site={status.site} />}

            {view === 'sitemaps' &&
              (o.sitemaps.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-6">
                  No sitemaps submitted. In Search Console, go to Sitemaps and submit your sitemap URL (often /sitemap.xml) so Google finds every page.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {o.sitemaps.map((s) => (
                    <li key={s.path} className="py-2.5 flex items-start gap-3">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${s.errors ? 'bg-rose-50 text-rose-600' : s.warnings ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {s.errors ? <X className="w-3.5 h-3.5" /> : s.warnings ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 break-all">{s.path}</p>
                        <p className="text-xs text-slate-500">
                          {s.submitted ? `${s.submitted.toLocaleString()} URLs submitted` : s.isIndex ? 'Sitemap index' : 'No URL count'}
                          {s.lastDownloaded && ` · read by Google ${relativeTime(s.lastDownloaded)}`}
                          {s.isPending && ' · pending'}
                          {s.errors > 0 && ` · ${s.errors} error${s.errors === 1 ? '' : 's'}`}
                          {s.warnings > 0 && ` · ${s.warnings} warning${s.warnings === 1 ? '' : 's'}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
