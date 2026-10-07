import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Palette } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { useLeads, useReviews } from '@/hooks/useSupabaseData';
import { useReviewRequests } from '@/lib/reviewRequests';
import { useWebsiteAudits } from '@/lib/websiteAudit';
import { DEFAULT_BRAND_COLOR, useReportSettings } from '@/lib/reportSettings';
import { compareField } from '@/lib/google';
import { formatNumber, gscOverview, gscStatus } from '@/lib/searchConsole';
import type { GscOverview } from '@/types';

type SectionKey = 'reviews' | 'google' | 'website' | 'search' | 'leads';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'reviews', label: 'Reviews' },
  { key: 'google', label: 'Google listing' },
  { key: 'website', label: 'Website health' },
  { key: 'search', label: 'Google search' },
  { key: 'leads', label: 'Leads & review requests' },
];

const DAY = 86_400_000;

function Stat({ label, value, note, color }: { label: string; value: string; note?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 break-inside-avoid">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-0.5" style={{ color: color ?? '#0f172a' }}>{value}</p>
      {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid-page">
      <h2 className="text-lg font-bold text-slate-900 pb-1.5 mb-3 border-b-2" style={{ borderColor: color }}>{title}</h2>
      {children}
    </section>
  );
}

/** A print-ready report of the business's online presence. "Download PDF" uses the browser's Save as PDF. */
export function ReportPage() {
  const { location, organization, can, loading: contextLoading } = useLocationContext();
  const { settings, loading: settingsLoading } = useReportSettings();
  const { reviews, loading: reviewsLoading } = useReviews();
  const { leads, loading: leadsLoading } = useLeads();
  const { requests } = useReviewRequests(500);
  const { audits, loading: auditsLoading } = useWebsiteAudits(1);
  const [days, setDays] = useState(30);
  const [enabled, setEnabled] = useState<Record<SectionKey, boolean>>({ reviews: true, google: true, website: true, search: true, leads: true });
  const [gsc, setGsc] = useState<GscOverview | null>(null);
  const [gscState, setGscState] = useState<'loading' | 'none' | 'ready'>('loading');

  useEffect(() => {
    let cancelled = false;
    setGscState('loading');
    gscStatus()
      .then(async (s) => {
        if (!s.connected) return !cancelled && setGscState('none');
        const { snapshot } = await gscOverview(days >= 90 ? 90 : 28);
        if (!cancelled) {
          setGsc(snapshot.data);
          setGscState('ready');
        }
      })
      .catch(() => !cancelled && setGscState('none'));
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    document.title = `${settings?.brand_name || organization?.name || 'Business'} report`;
  }, [settings?.brand_name, organization?.name]);

  const color = settings?.brand_color ?? DEFAULT_BRAND_COLOR;
  const since = Date.now() - days * DAY;
  const periodLabel = `${new Date(since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const r = useMemo(() => {
    const inPeriod = reviews.filter((x) => new Date(x.review_date).getTime() >= since);
    const avg = (list: typeof reviews) => (list.length ? list.reduce((s, x) => s + x.rating, 0) / list.length : null);
    const dist = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((x) => x.rating === stars).length }));
    return {
      total: reviews.length,
      avgAll: avg(reviews),
      inPeriod,
      avgPeriod: avg(inPeriod),
      replyRate: reviews.length ? Math.round((reviews.filter((x) => x.is_replied).length / reviews.length) * 100) : null,
      dist,
      highlights: inPeriod.filter((x) => x.rating >= 4 && x.content.trim()).slice(0, 3),
    };
  }, [reviews, since]);

  const periodRequests = requests.filter((x) => x.status === 'sent' && new Date(x.created_at).getTime() >= since);
  const periodLeads = leads.filter((l) => new Date(l.created_at).getTime() >= since);
  const audit = audits[0] ?? null;
  const loading = settingsLoading || reviewsLoading || leadsLoading || auditsLoading;

  if (!location) return null;
  if (!contextLoading && !can('reports.download')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="card p-8 max-w-md text-center">
          <h1 className="text-base font-bold text-slate-900">You don’t have access to reports</h1>
          <p className="text-sm text-slate-500 mt-1">Ask the owner of your business if you need access.</p>
          <Link to="/" className="btn-secondary mt-4">Back to dashboard</Link>
        </div>
      </div>
    );
  }
  const brand = settings?.brand_name || organization?.name || location.name;
  const g = location.google_listing;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; } }
      `}</style>

      {/* Toolbar (not printed) */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <Link to="/" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Back</Link>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-field !w-auto !py-1.5 text-sm" aria-label="Report period">
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm" role="group" aria-label="Sections">
            {SECTIONS.map((s) => (
              <label key={s.key} className="flex items-center gap-1.5 text-slate-600">
                <input type="checkbox" checked={enabled[s.key]} onChange={(e) => setEnabled({ ...enabled, [s.key]: e.target.checked })} className="rounded border-slate-300" />
                {s.label}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Link to="/settings#branding" className="btn-secondary text-xs"><Palette className="w-3.5 h-3.5" /> Branding</Link>
            <button onClick={() => window.print()} disabled={loading} className="btn-primary text-sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PDF
            </button>
          </div>
        </div>
        <p className="max-w-4xl mx-auto px-4 pb-2 text-xs text-slate-400">In the print window, choose “Save as PDF” as the destination.</p>
      </div>

      {/* The report */}
      <article className="max-w-4xl mx-auto bg-white my-6 print:my-0 p-8 sm:p-12 print:p-0 shadow-sm print:shadow-none rounded-2xl print:rounded-none text-slate-800">
        <header className="flex items-start justify-between gap-6 pb-6 border-b-4" style={{ borderColor: color }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color }}>Online presence report</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">{location.name}</h1>
            <p className="text-sm text-slate-500 mt-1">{periodLabel}</p>
            {settings?.prepared_by && <p className="text-sm text-slate-500 mt-3">Prepared by {settings.prepared_by}</p>}
          </div>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={brand} className="max-h-16 max-w-[180px] object-contain" />
          ) : (
            <p className="text-lg font-bold" style={{ color }}>{brand}</p>
          )}
        </header>

        {/* At a glance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <Stat label="Average rating" value={r.avgAll !== null ? `${r.avgAll.toFixed(1)}★` : '—'} note={`${r.total} reviews in total`} color={color} />
          <Stat label="New reviews" value={String(r.inPeriod.length)} note={r.avgPeriod !== null ? `avg ${r.avgPeriod.toFixed(1)}★ this period` : 'this period'} />
          <Stat label="Google rating" value={location.google_rating != null ? `${Number(location.google_rating).toFixed(1)}★` : '—'} note={location.google_review_count != null ? `${location.google_review_count} Google reviews` : 'not connected'} />
          <Stat label="Website health" value={audit?.overall_score != null ? `${audit.overall_score}/100` : '—'} note={audit ? `checked ${new Date(audit.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'no check yet'} />
        </div>

        {enabled.reviews && (
          <Section title="Reviews" color={color}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                {r.dist.map((d) => {
                  const pct = r.total ? (d.count / r.total) * 100 : 0;
                  return (
                    <div key={d.stars} className="flex items-center gap-2 text-sm">
                      <span className="w-8 text-slate-500">{d.stars}★</span>
                      <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="w-8 text-right text-slate-600">{d.count}</span>
                    </div>
                  );
                })}
                {r.replyRate !== null && <p className="text-sm text-slate-600 pt-2">Replied to <b>{r.replyRate}%</b> of reviews.</p>}
              </div>
              <div className="space-y-2">
                {r.highlights.length === 0 && <p className="text-sm text-slate-500">No new 4–5 star reviews with comments this period.</p>}
                {r.highlights.map((h) => (
                  <blockquote key={h.id} className="text-sm italic text-slate-700 border-l-4 pl-3 break-inside-avoid" style={{ borderColor: color }}>
                    “{h.content.length > 220 ? `${h.content.slice(0, 217)}…` : h.content}”
                    <span className="block not-italic text-xs text-slate-500 mt-0.5">— {h.author_name}, {h.rating}★</span>
                  </blockquote>
                ))}
              </div>
            </div>
          </Section>
        )}

        {enabled.google && (
          <Section title="Google listing" color={color}>
            {!location.gbp_place_id ? (
              <p className="text-sm text-slate-500">Google listing not connected.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 font-medium w-28"></th>
                    <th className="py-1 font-medium">Business details</th>
                    <th className="py-1 font-medium">On Google</th>
                    <th className="py-1 font-medium w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(['name', 'address', 'phone', 'website'] as const).map((k) => {
                    const st = compareField(k, location[k], g?.[k]);
                    return (
                      <tr key={k} className="border-t border-slate-100 align-top">
                        <td className="py-1.5 text-xs font-semibold text-slate-500 capitalize">{k}</td>
                        <td className="py-1.5 break-words">{location[k] || '—'}</td>
                        <td className="py-1.5 break-words">{g?.[k] || '—'}</td>
                        <td className={`py-1.5 text-xs font-semibold ${st === 'match' ? 'text-emerald-600' : st === 'mismatch' ? 'text-rose-600' : 'text-amber-600'}`}>
                          {st === 'match' ? 'Consistent' : st === 'mismatch' ? 'Different' : 'Missing'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Section>
        )}

        {enabled.website && (
          <Section title="Website health" color={color}>
            {!audit || audit.status !== 'complete' ? (
              <p className="text-sm text-slate-500">No website check yet.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-3">{audit.final_url}{audit.platform ? ` · ${audit.platform}` : ''}{audit.is_ecommerce ? ' · online store' : ''}</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {([
                    ['Overall', audit.overall_score],
                    ['SEO checks', audit.scores.seo_checks],
                    ['Mobile speed', audit.scores.performance_mobile],
                    ['Desktop speed', audit.scores.performance_desktop],
                    ['Google SEO', audit.scores.lighthouse_seo],
                    ['Accessibility', audit.scores.accessibility],
                  ] as [string, number | null | undefined][]).map(([label, v]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-2 text-center break-inside-avoid">
                      <p className={`text-xl font-bold ${v == null ? 'text-slate-400' : v >= 90 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{v ?? '—'}</p>
                      <p className="text-[11px] text-slate-500">{label}</p>
                    </div>
                  ))}
                </div>
                {audit.recommendations?.actions?.length ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-900 mb-1">Recommended next steps</p>
                    <p className="text-sm text-slate-600 mb-2">{audit.recommendations.summary}</p>
                    <ol className="list-decimal ml-5 space-y-1 text-sm">
                      {audit.recommendations.actions.slice(0, 6).map((a, i) => (
                        <li key={i} className="break-inside-avoid"><b>{a.title}</b> — {a.impact}</li>
                      ))}
                    </ol>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-900 mb-1">Issues found</p>
                    <ul className="list-disc ml-5 space-y-1 text-sm">
                      {(audit.results.checks ?? []).filter((c) => c.status === 'fail').slice(0, 6).map((c) => (
                        <li key={c.id}><b>{c.title}</b> — {c.detail}</li>
                      ))}
                      {(audit.results.checks ?? []).every((c) => c.status !== 'fail') && <li>No critical issues.</li>}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Section>
        )}

        {enabled.search && (
          <Section title="Google search performance" color={color}>
            {gscState === 'loading' && <p className="text-sm text-slate-400">Loading…</p>}
            {gscState === 'none' && <p className="text-sm text-slate-500">Google Search Console not connected.</p>}
            {gscState === 'ready' && gsc && (
              <>
                <p className="text-xs text-slate-500 mb-2">{gsc.range.startDate} to {gsc.range.endDate}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Clicks" value={formatNumber(gsc.totals.clicks)} note={`previous: ${formatNumber(gsc.previousTotals.clicks)}`} />
                  <Stat label="Impressions" value={formatNumber(gsc.totals.impressions)} note={`previous: ${formatNumber(gsc.previousTotals.impressions)}`} />
                  <Stat label="Click-through rate" value={`${(gsc.totals.ctr * 100).toFixed(1)}%`} />
                  <Stat label="Avg. position" value={gsc.totals.position ? gsc.totals.position.toFixed(1) : '—'} />
                </div>
                {gsc.queries.length > 0 && (
                  <table className="w-full text-sm mt-4">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="py-1 font-medium">Top searches</th>
                        <th className="py-1 font-medium text-right">Clicks</th>
                        <th className="py-1 font-medium text-right">Impressions</th>
                        <th className="py-1 font-medium text-right">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gsc.queries.slice(0, 10).map((q) => (
                        <tr key={q.query} className="border-t border-slate-100">
                          <td className="py-1.5">{q.query}</td>
                          <td className="py-1.5 text-right">{formatNumber(q.clicks)}</td>
                          <td className="py-1.5 text-right">{formatNumber(q.impressions)}</td>
                          <td className="py-1.5 text-right">{q.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </Section>
        )}

        {enabled.leads && (
          <Section title="Leads & review requests" color={color}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="New leads" value={String(periodLeads.length)} />
              <Stat label="Jobs completed" value={String(periodLeads.filter((l) => l.stage === 'completed' || l.stage === 'review_requested').length)} note="of new leads" />
              <Stat label="Review requests" value={String(periodRequests.length)} />
              <Stat
                label="Response rate"
                value={periodRequests.length ? `${Math.round((periodRequests.filter((x) => x.rating !== null).length / periodRequests.length) * 100)}%` : '—'}
                note={`${periodRequests.filter((x) => x.clicked_review_at).length} went to the review page`}
              />
            </div>
          </Section>
        )}

        <footer className="mt-10 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          {!settings?.hide_app_branding && <span>Made with Reputation Engine</span>}
        </footer>
      </article>
    </div>
  );
}
