import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  Gauge,
  Info,
  Link2,
  Loader2,
  Monitor,
  Search,
  ShoppingBag,
  Smartphone,
  Sparkles,
  X,
  FileSearch,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { getFixPlan, isPageSpeed, runWebsiteAudit, scoreTone, useWebsiteAudits } from '@/lib/websiteAudit';
import { relativeTime } from '@/lib/activity';
import type { AuditCheck, AuditCheckCategory, AuditCheckStatus, WebsiteAudit } from '@/types';

const PROGRESS = [
  'Loading your page…',
  'Checking whether Google can index it…',
  'Reading robots.txt and your sitemap…',
  'Testing links…',
  'Measuring speed with Google PageSpeed (mobile and desktop)…',
  'Checking product pages…',
  'Adding up your score…',
];

const statusStyle: Record<AuditCheckStatus, { icon: typeof Check; color: string; label: string }> = {
  fail: { icon: X, color: 'bg-rose-50 text-rose-600', label: 'Issue' },
  warn: { icon: AlertTriangle, color: 'bg-amber-50 text-amber-600', label: 'Improve' },
  pass: { icon: Check, color: 'bg-emerald-50 text-emerald-600', label: 'Good' },
  info: { icon: Info, color: 'bg-slate-100 text-slate-500', label: 'Info' },
};

const SECTIONS: { key: string; title: string; icon: typeof Search; categories: AuditCheckCategory[] }[] = [
  { key: 'indexing', title: 'Indexing & crawlability', icon: FileSearch, categories: ['indexing', 'security'] },
  { key: 'onpage', title: 'On-page SEO', icon: FileText, categories: ['onpage'] },
  { key: 'links', title: 'Links', icon: Link2, categories: ['links'] },
  { key: 'performance', title: 'Speed & Core Web Vitals', icon: Gauge, categories: ['performance'] },
  { key: 'ecommerce', title: 'Online store', icon: ShoppingBag, categories: ['ecommerce'] },
];

const statusOrder: Record<AuditCheckStatus, number> = { fail: 0, warn: 1, pass: 2, info: 3 };
const priorityStyle = { high: 'bg-rose-50 text-rose-600', medium: 'bg-amber-50 text-amber-600', low: 'bg-slate-100 text-slate-500' };
const fieldCategory: Record<string, { label: string; color: string }> = {
  FAST: { label: 'Good', color: 'text-emerald-600' },
  AVERAGE: { label: 'Needs improvement', color: 'text-amber-600' },
  SLOW: { label: 'Poor', color: 'text-rose-600' },
};

function ScoreRing({ score, size = 112, label }: { score: number | null | undefined; size?: number; label?: string }) {
  const tone = scoreTone(score);
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} strokeWidth="8" className="stroke-slate-100" fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            className={`${tone.ring} transition-all duration-700`}
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${size >= 100 ? 'text-3xl' : 'text-lg'} ${tone.text}`}>{score ?? '—'}</span>
          {size >= 100 && <span className="text-[11px] text-slate-400">/ 100</span>}
        </div>
      </div>
      {label && <p className="text-xs font-medium text-slate-600 mt-1.5 text-center">{label}</p>}
    </div>
  );
}

function CheckRow({ c }: { c: AuditCheck }) {
  const s = statusStyle[c.status];
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${s.color}`} title={s.label}>
        <s.icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{c.title}</p>
        <p className="text-xs text-slate-500 mt-0.5 break-words">{c.detail}</p>
      </div>
    </li>
  );
}

function Section({ title, icon: Icon, checks, children, defaultOpen }: { title: string; icon: typeof Search; checks: AuditCheck[]; children?: React.ReactNode; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const fails = checks.filter((c) => c.status === 'fail').length;
  const warns = checks.filter((c) => c.status === 'warn').length;
  const sorted = [...checks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  return (
    <div className="card p-0 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/60">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-sm font-bold text-slate-900 flex-1">{title}</span>
        {fails > 0 && <span className="badge bg-rose-50 text-rose-600">{fails} issue{fails === 1 ? '' : 's'}</span>}
        {warns > 0 && <span className="badge bg-amber-50 text-amber-600">{warns} to improve</span>}
        {fails === 0 && warns === 0 && checks.length > 0 && <span className="badge bg-emerald-50 text-emerald-600">All good</span>}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {sorted.length > 0 && <ul className="divide-y divide-slate-50">{sorted.map((c) => <CheckRow key={c.id} c={c} />)}</ul>}
          {children}
        </div>
      )}
    </div>
  );
}

function SpeedDetails({ audit }: { audit: WebsiteAudit }) {
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const psi = audit.results.pagespeed?.[device];
  return (
    <div className="mt-3 space-y-4">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit" role="tablist" aria-label="Device">
        {(['mobile', 'desktop'] as const).map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={device === d}
            onClick={() => setDevice(d)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${device === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {d === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
            {d === 'mobile' ? 'Mobile' : 'Desktop'}
          </button>
        ))}
      </div>

      {!isPageSpeed(psi) ? (
        <p className="text-sm text-slate-500 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          {psi?.error ?? 'Speed test not available for this audit.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ScoreRing score={psi.scores.performance} size={72} label="Performance" />
            <ScoreRing score={psi.scores.seo} size={72} label="Google SEO" />
            <ScoreRing score={psi.scores.accessibility} size={72} label="Accessibility" />
            <ScoreRing score={psi.scores.best_practices} size={72} label="Best practices" />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Real visitors (Core Web Vitals){psi.field.source === 'origin' ? ' · whole site' : ''}
            </p>
            {psi.field.metrics.length === 0 ? (
              <p className="text-xs text-slate-500">Not enough Chrome visitors yet for Google to report real-world data.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {psi.field.metrics.map((m) => {
                  const cat = fieldCategory[m.category] ?? { label: m.category, color: 'text-slate-600' };
                  const value =
                    m.id === 'CUMULATIVE_LAYOUT_SHIFT_SCORE' ? (m.percentile / 100).toFixed(2) : m.percentile >= 1000 ? `${(m.percentile / 1000).toFixed(1)} s` : `${m.percentile} ms`;
                  return (
                    <div key={m.id} className="p-3 rounded-xl bg-slate-50">
                      <p className="text-xs text-slate-500">{m.label}</p>
                      <p className="text-lg font-bold text-slate-900">{value}</p>
                      <p className={`text-xs font-medium ${cat.color}`}>{cat.label}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Lab test</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {psi.metrics.map((m) => (
                <div key={m.id} className="p-2.5 rounded-xl border border-slate-100">
                  <p className="text-[11px] text-slate-500 leading-tight">{m.title}</p>
                  <p className={`text-sm font-bold ${scoreTone(m.score === null ? null : m.score * 100).text}`}>{m.value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {psi.opportunities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Biggest speed wins</p>
              <ul className="space-y-1.5">
                {psi.opportunities.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-700">{o.title}</span>
                    {o.savings && <span className="text-xs text-amber-600 font-medium shrink-0">{o.savings}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {psi.seo_issues.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Google Lighthouse SEO flags</p>
              <ul className="list-disc ml-5 space-y-1 text-sm text-slate-700">
                {psi.seo_issues.map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AuditReport({ audit, onPlan }: { audit: WebsiteAudit; onPlan: (a: WebsiteAudit) => void }) {
  const { can } = useLocationContext();
  const canAudit = can('seo.audit');
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const checks = audit.results.checks ?? [];
  const counts = {
    fail: checks.filter((c) => c.status === 'fail').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    pass: checks.filter((c) => c.status === 'pass').length,
  };
  const r = audit.results;
  const host = (() => {
    try {
      return new URL(audit.final_url ?? audit.url).hostname;
    } catch {
      return audit.url;
    }
  })();

  const handlePlan = async () => {
    setPlanning(true);
    setPlanError(null);
    try {
      onPlan(await getFixPlan(audit.id));
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Couldn’t create the plan');
    } finally {
      setPlanning(false);
    }
  };

  if (audit.status === 'failed') {
    return (
      <div className="card p-5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-900">We couldn’t check {host}</p>
          <p className="text-sm text-slate-500 mt-1">{audit.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div className="card p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex items-center gap-4">
            <ScoreRing score={audit.overall_score} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Site health</p>
              <a href={audit.final_url ?? audit.url} target="_blank" rel="noopener noreferrer" className="text-base font-bold text-slate-900 hover:underline break-all inline-flex items-center gap-1">
                {host} <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </a>
              <p className="text-xs text-slate-400 mt-0.5">Checked {relativeTime(audit.created_at)}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {audit.platform && <span className="badge bg-slate-100 text-slate-600">{audit.platform}</span>}
                {audit.is_ecommerce && (
                  <span className="badge bg-violet-50 text-violet-600">
                    <ShoppingBag className="w-3 h-3" /> Online store
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 md:ml-auto">
            <ScoreRing score={audit.scores.seo_checks} size={64} label="SEO checks" />
            <ScoreRing score={audit.scores.performance_mobile} size={64} label="Mobile speed" />
            <ScoreRing score={audit.scores.performance_desktop} size={64} label="Desktop speed" />
            <ScoreRing score={audit.scores.lighthouse_seo} size={64} label="Google SEO" />
            <ScoreRing score={audit.scores.accessibility} size={64} label="Accessibility" />
            <ScoreRing score={audit.scores.best_practices} size={64} label="Best practices" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
          <span className="badge bg-rose-50 text-rose-600">{counts.fail} issue{counts.fail === 1 ? '' : 's'}</span>
          <span className="badge bg-amber-50 text-amber-600">{counts.warn} to improve</span>
          <span className="badge bg-emerald-50 text-emerald-600">{counts.pass} passed</span>
        </div>
      </div>

      {/* AI fix plan */}
      <div className="card p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">AI fix plan</h3>
            <p className="text-xs text-slate-400">What to fix first, in plain English{audit.platform ? `, with ${audit.platform} steps` : ''}</p>
          </div>
          {audit.recommendations && (
            <button onClick={handlePlan} disabled={planning || !canAudit} className="btn-ghost text-xs">
              {planning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Redo
            </button>
          )}
        </div>
        {!audit.recommendations ? (
          <div className="text-center py-4">
            <button onClick={handlePlan} disabled={planning || !canAudit} className="btn-primary">
              {planning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {planning ? 'Writing your plan… (up to a minute)' : 'Get my fix plan'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed">{audit.recommendations.summary}</p>
            <ol className="space-y-2.5">
              {audit.recommendations.actions.map((a, i) => (
                <li key={i} className="p-3.5 rounded-xl border border-slate-100">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-400 w-5">{i + 1}.</span>
                    <p className="text-sm font-semibold text-slate-900 flex-1 min-w-0">{a.title}</p>
                    <span className={`badge ${priorityStyle[a.priority] ?? priorityStyle.medium}`}>{a.priority}</span>
                    <span className="badge bg-slate-100 text-slate-500">{a.category}</span>
                  </div>
                  <div className="ml-7 mt-1.5 space-y-1.5 text-sm">
                    <p className="text-slate-500">{a.impact}</p>
                    <p className="text-slate-700"><span className="font-medium">How: </span>{a.how_to_fix}</p>
                    {a.platform_tip && (
                      <p className="text-xs text-sky-700 bg-sky-50 rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold">Where: </span>{a.platform_tip}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
        {planError && <p className="text-sm text-rose-600 mt-2" role="alert">{planError}</p>}
      </div>

      {/* Detailed sections */}
      {SECTIONS.filter((s) => s.key !== 'ecommerce' || audit.is_ecommerce).map((s) => {
        const sectionChecks = checks.filter((c) => s.categories.includes(c.category));
        return (
          <Section
            key={s.key}
            title={s.title}
            icon={s.icon}
            checks={sectionChecks}
            defaultOpen={sectionChecks.some((c) => c.status === 'fail') || s.key === 'performance'}
          >
            {s.key === 'indexing' && (
              <div className="mt-3 p-3 rounded-xl bg-sky-50/60 border border-sky-100 text-xs text-slate-600 space-y-1.5">
                <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Is my site actually in Google?
                </p>
                <p>
                  These checks show whether Google <em>can</em> index your pages. To see which pages Google <em>has</em> indexed,
                  verify your site in{' '}
                  <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                    Google Search Console
                  </a>{' '}
                  (free) and submit your sitemap{r.sitemap?.url ? ` (${r.sitemap.url})` : ''}. Quick check: search Google for{' '}
                  <span className="font-mono bg-white px-1 rounded">site:{host.replace(/^www\./, '')}</span>.
                </p>
              </div>
            )}
            {s.key === 'links' && r.links && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-50"><p className="text-base font-bold text-slate-900">{r.links.internal}</p><p className="text-[11px] text-slate-500">Internal</p></div>
                  <div className="p-2 rounded-lg bg-slate-50"><p className="text-base font-bold text-slate-900">{r.links.external}</p><p className="text-[11px] text-slate-500">External</p></div>
                  <div className="p-2 rounded-lg bg-slate-50"><p className="text-base font-bold text-slate-900">{r.links.broken.length}</p><p className="text-[11px] text-slate-500">Broken</p></div>
                </div>
                {r.links.broken.length > 0 && (
                  <ul className="space-y-1">
                    {r.links.broken.map((b) => (
                      <li key={b.url} className="flex items-center gap-2 text-xs">
                        <span className="badge bg-rose-50 text-rose-600 shrink-0">{b.status || 'error'}</span>
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:underline truncate">{b.url}</a>
                      </li>
                    ))}
                  </ul>
                )}
                {r.links.unverified > 0 && (
                  <p className="text-xs text-slate-400">{r.links.unverified} external link(s) couldn’t be verified because the other site blocks automated checks.</p>
                )}
                <p className="text-xs text-slate-400">
                  Backlinks (other sites linking to you) need a paid data provider and aren’t included yet.
                </p>
              </div>
            )}
            {s.key === 'performance' && <SpeedDetails audit={audit} />}
            {s.key === 'ecommerce' && (r.ecommerce?.productPages.length ?? 0) > 0 && (
              <div className="mt-3 overflow-x-auto -mx-1">
                <table className="w-full text-xs min-w-[520px]">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="font-medium py-1.5 px-1">Product page</th>
                      {['Schema', 'Price', 'Stock', 'Stars', 'SKU/GTIN', 'Alt missing'].map((h) => <th key={h} className="font-medium py-1.5 px-1 text-center">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {r.ecommerce!.productPages.map((p) => {
                      const yes = (v: boolean) => (v ? <Check className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <X className="w-3.5 h-3.5 text-rose-500 mx-auto" />);
                      let path = p.url;
                      try {
                        path = new URL(p.url).pathname;
                      } catch { /* keep full url */ }
                      return (
                        <tr key={p.url} className="border-t border-slate-100">
                          <td className="py-2 px-1 max-w-[220px]">
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:underline block truncate" title={p.title ?? p.url}>{path}</a>
                          </td>
                          <td className="py-2 px-1">{yes(p.hasProductSchema)}</td>
                          <td className="py-2 px-1">{yes(p.hasPrice)}</td>
                          <td className="py-2 px-1">{yes(p.hasAvailability)}</td>
                          <td className="py-2 px-1">{yes(p.hasRating)}</td>
                          <td className="py-2 px-1">{yes(p.hasIdentifier)}</td>
                          <td className="py-2 px-1 text-center text-slate-600">{p.imagesMissingAlt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        );
      })}
    </div>
  );
}

export function WebsiteHealth() {
  const { location, can } = useLocationContext();
  const canAudit = can('seo.audit');
  const { audits, loading, error: loadError, upsertLocal } = useWebsiteAudits();
  const [url, setUrl] = useState('');
  const [storeMode, setStoreMode] = useState<'auto' | 'yes' | 'no'>('auto');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!url && (location?.website || audits[0]?.url)) setUrl(location?.website || audits[0].url);
  }, [location?.website, audits]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS.length - 1)), 7000);
    return () => clearInterval(t);
  }, [running]);

  const selected = useMemo(() => audits.find((a) => a.id === selectedId) ?? audits[0] ?? null, [audits, selectedId]);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return setError('Enter your website address.');
    setRunning(true);
    setError(null);
    try {
      const audit = await runWebsiteAudit(url.trim(), storeMode === 'auto' ? null : storeMode === 'yes');
      upsertLocal(audit);
      setSelectedId(audit.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleRun} className="card p-5" noValidate>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 text-sky-600">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Website Health Check</h2>
            <p className="text-xs text-slate-400">Indexing, SEO score, links, speed and online-store checks for any page of your site</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="audit-url" className="sr-only">Website or page address</label>
          <input
            id="audit-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbusiness.com or a product page URL"
            className="input-field flex-1"
            disabled={running}
            inputMode="url"
          />
          <label htmlFor="audit-store" className="sr-only">Online store</label>
          <select id="audit-store" value={storeMode} onChange={(e) => setStoreMode(e.target.value as typeof storeMode)} disabled={running} className="input-field sm:!w-auto">
            <option value="auto">Store: auto-detect</option>
            <option value="yes">It’s an online store</option>
            <option value="no">Not a store</option>
          </select>
          <button type="submit" disabled={running || !canAudit} title={canAudit ? undefined : 'You don’t have access to run website checks'} className="btn-primary shrink-0">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {running ? 'Checking…' : 'Run check'}
          </button>
        </div>
        {running && (
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-2" role="status">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
            {PROGRESS[step]} This usually takes 30–90 seconds.
          </p>
        )}
        {error && <p className="text-sm text-rose-600 mt-3" role="alert">{error}</p>}
      </form>

      {loadError && <p className="text-sm text-rose-600" role="alert">{loadError}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : !selected ? (
        !running && (
          <div className="card p-8 text-center">
            <Gauge className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-900">No checks yet</p>
            <p className="text-sm text-slate-500 mt-1">Run your first website check to get an SEO score and a fix list.</p>
          </div>
        )
      ) : (
        <>
          {audits.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="audit-history" className="text-xs font-medium text-slate-500 shrink-0">Past checks</label>
              <select id="audit-history" value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className="input-field !py-1.5 text-sm">
                {audits.map((a) => {
                  let host = a.url;
                  try {
                    host = new URL(a.final_url ?? a.url).hostname + new URL(a.final_url ?? a.url).pathname.replace(/\/$/, '');
                  } catch { /* keep */ }
                  return (
                    <option key={a.id} value={a.id}>
                      {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {host} · {a.overall_score ?? '—'}/100
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          <AuditReport key={selected.id} audit={selected} onPlan={upsertLocal} />
        </>
      )}
    </div>
  );
}
