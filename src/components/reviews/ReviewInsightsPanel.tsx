import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Lightbulb, Loader2, Lock, MessageSquareQuote, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { usePlan } from '@/lib/billing';
import { generateInsights, periodLabel, useReviewInsights, type InsightTheme, type ReviewInsight } from '@/lib/insights';

/** Reviews → Insights: AI summary of what customers praise and complain about. */
export function ReviewInsightsPanel() {
  const { location, can } = useLocationContext();
  const { usage, loading: planLoading } = usePlan();
  const { insights, loading, error, reload } = useReviewInsights(location?.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<30 | 90 | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const limits = (usage?.limits ?? {}) as Record<string, number | undefined>;
  const locked = !planLoading && limits.ai_insights === 0;
  const canGenerate = can('reviews.reply') && !locked;
  const selected = insights.find((i) => i.id === selectedId) ?? insights[0] ?? null;

  useEffect(() => {
    if (selectedId && !insights.some((i) => i.id === selectedId)) setSelectedId(null);
  }, [insights, selectedId]);

  const generate = async (days: 30 | 90) => {
    setBusy(days);
    setGenError(null);
    try {
      const created = await generateInsights(days);
      await reload();
      setSelectedId(created.id);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Could not generate insights');
    } finally {
      setBusy(null);
    }
  };

  if (locked) {
    return (
      <div className="card p-6 sm:p-8 text-center max-w-xl mx-auto">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-50 text-violet-600 mx-auto mb-3">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="text-base font-bold text-slate-900">AI review insights are part of Pro and Agency</h2>
        <p className="text-sm text-slate-500 mt-1">
          Every month, see what customers praise, what they keep complaining about and what to fix first, summarised from all your
          reviews and private feedback.
        </p>
        <Link to="/billing" className="btn-primary mt-4">See plans</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50 text-violet-600 shrink-0">
            <Sparkles className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">AI review insights</p>
            <p className="text-xs text-slate-500">
              Summarises your reviews and private feedback. A new summary arrives automatically at the start of each month.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {insights.length > 1 && (
            <select
              aria-label="Choose a summary"
              value={selected?.id ?? ''}
              onChange={(e) => setSelectedId(e.target.value)}
              className="input-field !py-1.5 !w-auto text-sm"
            >
              {insights.map((i) => (
                <option key={i.id} value={i.id}>{periodLabel(i)}{i.kind === 'monthly' ? ' (monthly)' : ''}</option>
              ))}
            </select>
          )}
          {canGenerate && ([30, 90] as const).map((d) => (
            <button key={d} onClick={() => generate(d)} disabled={busy !== null} className={d === 30 ? 'btn-primary text-sm' : 'btn-secondary text-sm'}>
              {busy === d ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {busy === d ? 'Reading reviews…' : `Last ${d} days`}
            </button>
          ))}
        </div>
      </div>

      {genError && (
        <p role="alert" className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {genError}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-6 text-center text-sm text-rose-600">Couldn’t load insights: {error}</div>
      ) : !selected ? (
        <div className="card p-8 text-center">
          <Sparkles className="w-8 h-8 text-violet-300 mx-auto mb-2" />
          <p className="text-sm text-slate-600 font-medium">No insights yet</p>
          <p className="text-sm text-slate-500 mt-1">
            {canGenerate ? 'Click “Last 30 days” to get your first summary. It takes about half a minute.' : 'Ask the business owner to generate the first summary.'}
          </p>
        </div>
      ) : (
        <InsightView insight={selected} />
      )}
    </div>
  );
}

function InsightView({ insight }: { insight: ReviewInsight }) {
  const s = insight.summary;
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-xs font-medium text-slate-400">{periodLabel(insight)}</p>
        <p className="text-lg font-semibold text-slate-900 mt-1 leading-snug">{s.headline}</p>
        <dl className="grid grid-cols-3 gap-3 mt-4">
          <Stat label="Reviews read" value={String(insight.review_count)} />
          <Stat label="Average rating" value={insight.avg_rating !== null ? `${insight.avg_rating.toFixed(1)} ★` : '–'} />
          <Stat label="Private feedback" value={String(insight.feedback_count)} />
        </dl>
        <Sentiment {...s.sentiment} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ThemeList title="What customers love" icon={ThumbsUp} tone="emerald" items={s.praise} empty="No clear praise themes in this period." />
        <ThemeList title="What to fix" icon={ThumbsDown} tone="rose" items={s.complaints} empty="No recurring complaints. Nice work." />
      </div>

      {s.suggestions.length > 0 && (
        <section className="card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Suggested next steps
          </h3>
          <ol className="mt-3 space-y-3">
            {s.suggestions.map((x, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold shrink-0">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{x.title}</p>
                  <p className="text-sm text-slate-600">{x.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.quotes.length > 0 && (
        <section className="card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MessageSquareQuote className="w-4 h-4 text-sky-500" /> Quotes worth sharing
          </h3>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            {s.quotes.map((q, i) => (
              <li key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs text-amber-500" aria-label={`${q.rating} out of 5 stars`}>{'★'.repeat(q.rating)}</p>
                <p className="text-sm text-slate-700 mt-1">“{q.text}”</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-2">Tip: turn one into a post with Social → Review-to-Graphic.</p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 text-center">
      <dd className="text-lg font-bold text-slate-900 tabular-nums">{value}</dd>
      <dt className="text-xs text-slate-500">{label}</dt>
    </div>
  );
}

/** Positive / mixed / negative share as one stacked bar, labelled so colour isn't the only cue. */
function Sentiment({ positive, neutral, negative }: { positive: number; neutral: number; negative: number }) {
  const parts = [
    { label: 'Positive', value: positive, bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
    { label: 'Mixed', value: neutral, bar: 'bg-slate-300', dot: 'bg-slate-300' },
    { label: 'Negative', value: negative, bar: 'bg-rose-500', dot: 'bg-rose-500' },
  ];
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-slate-500 mb-1.5">Sentiment</p>
      <div className="flex h-2.5 gap-[2px] rounded-full overflow-hidden bg-slate-100" role="img" aria-label={`Positive ${positive}%, mixed ${neutral}%, negative ${negative}%`}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.label} className={`${p.bar} h-full`} style={{ width: `${p.value}%` }} title={`${p.label}: ${p.value}%`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${p.dot}`} aria-hidden />
            {p.label} <b className="tabular-nums">{p.value}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function ThemeList({
  title,
  icon: Icon,
  tone,
  items,
  empty,
}: {
  title: string;
  icon: typeof ThumbsUp;
  tone: 'emerald' | 'rose';
  items: InsightTheme[];
  empty: string;
}) {
  const toneClass = tone === 'emerald' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
  return (
    <section className="card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className={`flex items-center justify-center w-6 h-6 rounded-lg ${toneClass}`}><Icon className="w-3.5 h-3.5" /></span>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 mt-3">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((t, i) => (
            <li key={i}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-900">{t.theme}</p>
                {t.mentions > 0 && <span className="badge bg-slate-100 text-slate-600">{t.mentions} mention{t.mentions === 1 ? '' : 's'}</span>}
              </div>
              <p className="text-sm text-slate-600 mt-0.5">{t.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
