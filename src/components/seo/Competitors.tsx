import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, Plus, RefreshCw, Search, Swords, Trash2, TrendingDown } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { searchPlaces } from '@/lib/google';
import { useWebsiteAudits } from '@/lib/websiteAudit';
import { relativeTime } from '@/lib/activity';
import { addCompetitor, refreshCompetitor, removeCompetitor, summarizeOwnAudit, useCompetitors, type WebsiteSummary } from '@/lib/competitors';
import type { PlaceCandidate } from '@/types';

interface Column {
  key: string;
  name: string;
  isYou: boolean;
  rating: number | null;
  reviews: number | null;
  site: WebsiteSummary | null;
  siteError: string | null;
}

type Better = 'higher' | 'lower' | 'none';

interface Row {
  label: string;
  value: (c: Column) => number | string | boolean | null;
  format?: (v: number | string | boolean) => string;
  better: Better;
  storeOnly?: boolean;
}

// null (shown as —) when the check didn't apply, e.g. product checks on a non-store site
const pass = (id: string) => (c: Column) => (c.site?.checks[id] ? c.site.checks[id] === 'pass' : null);
const cwvRank: Record<string, number> = { FAST: 3, AVERAGE: 2, SLOW: 1 };

const ROWS: Row[] = [
  { label: 'Google rating', value: (c) => c.rating, format: (v) => `${Number(v).toFixed(1)}★`, better: 'higher' },
  { label: 'Google reviews', value: (c) => c.reviews, format: (v) => Number(v).toLocaleString(), better: 'higher' },
  { label: 'Site health', value: (c) => c.site?.overall_score ?? null, format: (v) => `${v}/100`, better: 'higher' },
  { label: 'SEO checks', value: (c) => c.site?.scores.seo_checks ?? null, better: 'higher' },
  { label: 'Mobile speed', value: (c) => c.site?.scores.performance_mobile ?? null, better: 'higher' },
  { label: 'Desktop speed', value: (c) => c.site?.scores.performance_desktop ?? null, better: 'higher' },
  { label: 'Google SEO score', value: (c) => c.site?.scores.lighthouse_seo ?? null, better: 'higher' },
  {
    label: 'Real-visitor speed',
    value: (c) => (c.site?.cwv ? cwvRank[c.site.cwv] ?? null : null),
    format: (v) => ({ 3: 'Good', 2: 'Needs work', 1: 'Poor' } as Record<number, string>)[Number(v)] ?? '—',
    better: 'higher',
  },
  { label: 'HTTPS', value: pass('https'), better: 'higher' },
  { label: 'XML sitemap', value: pass('sitemap'), better: 'higher' },
  { label: 'Structured data', value: pass('schema'), better: 'higher' },
  { label: 'Business markup', value: pass('business-schema'), better: 'higher' },
  { label: 'Broken links', value: (c) => c.site?.broken_links ?? null, better: 'lower' },
  { label: 'Words on homepage', value: (c) => c.site?.word_count ?? null, format: (v) => Number(v).toLocaleString(), better: 'higher' },
  { label: 'Product markup', value: pass('product-schema'), better: 'higher', storeOnly: true },
  { label: 'Price & stock in search', value: pass('offer'), better: 'higher', storeOnly: true },
  { label: 'Review stars in search', value: pass('rating'), better: 'higher', storeOnly: true },
  { label: 'Platform', value: (c) => c.site?.platform ?? null, better: 'none' },
];

function cellText(row: Row, v: number | string | boolean | null) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return row.format ? row.format(v) : String(v);
}

function bestValue(row: Row, cols: Column[]) {
  if (row.better === 'none') return null;
  const values = cols.map((c) => row.value(c)).filter((v) => v !== null && v !== undefined).map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v)));
  if (values.length < 2) return null;
  const best = row.better === 'higher' ? Math.max(...values) : Math.min(...values);
  const worst = row.better === 'higher' ? Math.min(...values) : Math.max(...values);
  return best === worst ? null : best;
}

export function Competitors() {
  const { location, can } = useLocationContext();
  // Feature access (role default or Role access override)
  const isAdmin = can('seo.competitors');
  const { competitors, loading, upsertLocal, removeLocal } = useCompetitors();
  const { audits } = useWebsiteAudits(1);
  const [query, setQuery] = useState('');
  const [website, setWebsite] = useState('');
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const columns: Column[] = useMemo(() => {
    const you: Column = {
      key: 'you',
      name: location?.name ?? 'You',
      isYou: true,
      rating: location?.google_rating != null ? Number(location.google_rating) : null,
      reviews: location?.google_review_count ?? null,
      site: summarizeOwnAudit(audits[0] ?? null),
      siteError: null,
    };
    return [
      you,
      ...competitors.map((c) => ({
        key: c.id,
        name: c.name,
        isYou: false,
        rating: c.google_rating != null ? Number(c.google_rating) : null,
        reviews: c.google_review_count,
        site: c.website_summary,
        siteError: c.website_error,
      })),
    ];
  }, [location, audits, competitors]);

  const anyStore = columns.some((c) => c.site?.is_ecommerce);
  const rows = ROWS.filter((r) => !r.storeOnly || anyStore);

  // Plain-English gaps where a competitor is ahead
  const insights = useMemo(() => {
    const you = columns[0];
    const others = columns.slice(1);
    const out: string[] = [];
    const ahead = (fn: (c: Column) => number | null) => others.filter((c) => {
      const a = fn(c);
      const b = fn(you);
      return a !== null && b !== null && a > b;
    });
    const byReviews = ahead((c) => c.reviews);
    if (byReviews.length) {
      const top = byReviews.sort((a, b) => (b.reviews ?? 0) - (a.reviews ?? 0))[0];
      out.push(`${top.name} has ${top.reviews?.toLocaleString()} Google reviews vs your ${you.reviews?.toLocaleString()}. Sending review requests to every completed job is the fastest way to close the gap.`);
    }
    const byRating = ahead((c) => c.rating);
    if (byRating.length) out.push(`${byRating.map((c) => c.name).join(', ')} ${byRating.length === 1 ? 'has' : 'have'} a higher Google rating than you.`);
    const bySpeed = ahead((c) => c.site?.scores.performance_mobile ?? null);
    if (bySpeed.length) out.push(`${bySpeed.map((c) => c.name).join(', ')} load${bySpeed.length === 1 ? 's' : ''} faster on phones. Check the speed wins in Website Health.`);
    const byHealth = ahead((c) => c.site?.overall_score ?? null);
    if (byHealth.length) out.push(`${byHealth.length} competitor${byHealth.length === 1 ? '' : 's'} score${byHealth.length === 1 ? 's' : ''} higher on site health.`);
    for (const [id, what] of [['business-schema', 'business details markup'], ['rating', 'review stars in Google results'], ['sitemap', 'an XML sitemap']] as const) {
      const theyHave = others.filter((c) => c.site?.checks[id] === 'pass');
      if (theyHave.length && you.site && you.site.checks[id] !== 'pass') out.push(`${theyHave.map((c) => c.name).join(', ')} ${theyHave.length === 1 ? 'has' : 'have'} ${what} and you don’t.`);
    }
    return out;
  }, [columns]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return setError('Type a competitor’s name and city.');
    run('search', async () => setResults(await searchPlaces(query.trim())));
  };

  const add = (input: { name?: string; website?: string; placeId?: string }, key: string) =>
    run(key, async () => {
      const { competitor, warning } = await addCompetitor(input);
      upsertLocal(competitor);
      setResults(null);
      setQuery('');
      setWebsite('');
      if (warning) setNotice(warning);
    });

  if (!location) return null;
  const full = competitors.length >= 5;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="card p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-50 text-violet-600"><Swords className="w-4 h-4" /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add a competitor</h2>
              <p className="text-xs text-slate-400">Find them on Google (rating, reviews and website), or just enter their website. Up to 5.</p>
            </div>
          </div>
          {full ? (
            <p className="text-sm text-slate-500">You’re tracking 5 competitors. Remove one to add another.</p>
          ) : (
            <div className="space-y-3">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2" noValidate>
                <label htmlFor="comp-query" className="sr-only">Competitor name and city</label>
                <input id="comp-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Best Plumbing Austin" className="input-field flex-1" />
                <button type="submit" disabled={busy !== null} className="btn-secondary shrink-0">
                  {busy === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Find on Google
                </button>
              </form>
              {results && results.length === 0 && <p className="text-sm text-slate-500">No matches on Google.</p>}
              {results && results.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {results.filter((p) => p.id !== location.gbp_place_id).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-xs text-slate-500 truncate">{p.address}{p.rating !== null ? ` · ★ ${p.rating.toFixed(1)} (${p.reviewCount})` : ''}</p>
                      </div>
                      <button onClick={() => add({ placeId: p.id, name: p.name }, p.id)} disabled={busy !== null} className="btn-primary !py-1.5 text-xs shrink-0">
                        {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!website.trim()) return setError('Enter the competitor’s website.');
                  add({ website: website.trim() }, 'website');
                }}
                className="flex flex-col sm:flex-row gap-2"
                noValidate
              >
                <label htmlFor="comp-website" className="sr-only">Competitor website</label>
                <input id="comp-website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="…or their website, e.g. competitor.com" className="input-field flex-1" inputMode="url" />
                <button type="submit" disabled={busy !== null} className="btn-secondary shrink-0">
                  {busy === 'website' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add website
                </button>
              </form>
              {busy && busy !== 'search' && <p className="text-xs text-slate-500" role="status">Checking their Google listing and website… this takes up to a minute.</p>}
            </div>
          )}
          {error && <p className="text-sm text-rose-600 mt-3" role="alert">{error}</p>}
          {notice && <p className="text-sm text-amber-600 mt-3">{notice}</p>}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : competitors.length === 0 ? (
        <div className="card p-8 text-center">
          <Swords className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-900">No competitors yet</p>
          <p className="text-sm text-slate-500 mt-1">Add the businesses you compete with to see how your reviews, rating and website stack up.</p>
        </div>
      ) : (
        <>
          {insights.length > 0 && (
            <div className="card p-5">
              <p className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5"><TrendingDown className="w-4 h-4 text-rose-500" /> Where competitors are ahead</p>
              <ul className="list-disc ml-5 space-y-1 text-sm text-slate-700">{insights.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          )}
          {!columns[0].site && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Run a Website Health check on your own site to compare website scores.
            </p>
          )}

          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${180 + columns.length * 150}px` }}>
              <thead>
                <tr className="border-b border-slate-100 align-bottom">
                  <th className="sticky left-0 bg-white text-left p-3 text-xs font-medium text-slate-400 w-44"></th>
                  {columns.map((c) => {
                    const comp = competitors.find((x) => x.id === c.key);
                    return (
                      <th key={c.key} className={`p-3 text-left align-bottom ${c.isYou ? 'bg-sky-50/60' : ''}`}>
                        <p className={`text-sm font-bold ${c.isYou ? 'text-sky-700' : 'text-slate-900'}`}>{c.isYou ? `${c.name} (you)` : c.name}</p>
                        {comp && (
                          <div className="flex items-center gap-1 mt-1">
                            {comp.google_maps_url && (
                              <a href={comp.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600" title="Google Maps"><ExternalLink className="w-3.5 h-3.5" /></a>
                            )}
                            <button
                              onClick={() => run(`r-${comp.id}`, async () => upsertLocal((await refreshCompetitor(comp.id)).competitor))}
                              disabled={busy !== null}
                              className="text-slate-400 hover:text-slate-600"
                              title={comp.refreshed_at ? `Refreshed ${relativeTime(comp.refreshed_at)}` : 'Refresh'}
                              aria-label={`Refresh ${comp.name}`}
                            >
                              {busy === `r-${comp.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => run(`d-${comp.id}`, async () => { await removeCompetitor(comp.id); removeLocal(comp.id); })}
                                disabled={busy !== null}
                                className="text-slate-400 hover:text-rose-600"
                                aria-label={`Remove ${comp.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        {c.siteError && <p className="text-[11px] font-normal text-amber-600 mt-1">{c.siteError}</p>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const best = bestValue(row, columns);
                  return (
                    <tr key={row.label} className="border-t border-slate-50">
                      <td className="sticky left-0 bg-white p-3 text-xs font-semibold text-slate-500">{row.label}</td>
                      {columns.map((c) => {
                        const v = row.value(c);
                        const numeric = v === null || v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : Number(v);
                        const isBest = best !== null && numeric === best;
                        const isNo = v === false;
                        return (
                          <td key={c.key} className={`p-3 ${c.isYou ? 'bg-sky-50/60' : ''}`}>
                            <span className={`${isBest ? 'font-bold text-emerald-600' : isNo ? 'text-rose-500' : 'text-slate-700'}`}>{cellText(row, v)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">Green = best in the group. Competitor data refreshes when you click refresh (at most every 6 hours).</p>
        </>
      )}
    </div>
  );
}
