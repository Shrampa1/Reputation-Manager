import { useMemo, useState } from 'react';
import { AlertCircle, Crosshair, Loader2, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import { addKeyword, deleteKeyword, rankColor, scanKeyword, topRivals, updateKeyword, useRankings, type RankKeyword, type RankScan } from '@/lib/rankings';

/** Phase B2: where the business shows up in Google Maps results across town, per keyword. */
export function RankingsPage() {
  const { location, can } = useLocationContext();
  const { keywords, scans, loading, error, reload } = useRankings();
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ keyword: '', grid_size: 5, radius_km: 5 });
  const [busy, setBusy] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const canEdit = can('business.edit');
  const canScan = can('seo.audit');

  const byKeyword = useMemo(() => {
    const m = new Map<string, RankScan[]>();
    for (const s of scans) m.set(s.keyword_id, [...(m.get(s.keyword_id) ?? []), s]);
    return m;
  }, [scans]);
  const current = keywords.find((k) => k.id === selected) ?? keywords[0] ?? null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    setBusy('add');
    const { error: err } = await addKeyword(location.id, { keyword: form.keyword, grid_size: form.grid_size, radius_km: form.radius_km });
    setBusy(null);
    setPageError(err);
    if (!err) {
      setForm({ ...form, keyword: '' });
      await reload();
    }
  };

  const scan = async (k: RankKeyword) => {
    setBusy(k.id);
    setPageError(null);
    try {
      await scanKeyword(k.id);
      setSelected(k.id);
      await reload();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (k: RankKeyword) => {
    if (!window.confirm(`Stop tracking “${k.keyword}” and delete its history?`)) return;
    const { error: err } = await deleteKeyword(k.id);
    setPageError(err);
    reload();
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Local rankings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Where your Google listing ranks for a search, at points across your area. Green means top 3 in the map results.
        </p>
      </div>

      {location && !location.gbp_place_id && (
        <div className="card p-4 text-sm text-amber-800 bg-amber-50/60 border-amber-200">Link your Google listing in Settings first; rankings are checked for that listing.</div>
      )}

      {canEdit && (
        <form onSubmit={add} className="card p-4 flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label htmlFor="rk-keyword" className="block text-sm font-medium text-slate-700 mb-1.5">Track a search</label>
            <input id="rk-keyword" className="input-field" placeholder="e.g. emergency plumber" value={form.keyword} maxLength={80} onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
          </div>
          <div>
            <label htmlFor="rk-grid" className="block text-sm font-medium text-slate-700 mb-1.5">Grid</label>
            <select id="rk-grid" className="input-field" value={form.grid_size} onChange={(e) => setForm({ ...form, grid_size: Number(e.target.value) })}>
              <option value={3}>3 × 3</option><option value={5}>5 × 5</option><option value={7}>7 × 7</option>
            </select>
          </div>
          <div>
            <label htmlFor="rk-radius" className="block text-sm font-medium text-slate-700 mb-1.5">Area</label>
            <select id="rk-radius" className="input-field" value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: Number(e.target.value) })}>
              {[1, 2, 3, 5, 8, 10, 15, 25].map((r) => <option key={r} value={r}>{r} km around you</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy === 'add' || form.keyword.trim().length < 2} className="btn-primary">
            {busy === 'add' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Track
          </button>
        </form>
      )}

      {(error || pageError) && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {pageError ?? error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : keywords.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          <Crosshair className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          No searches tracked yet. Add the searches your customers use, like “plumber near me”.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
          <ul className="card divide-y divide-slate-100 p-0 overflow-hidden self-start">
            {keywords.map((k) => {
              const hist = byKeyword.get(k.id) ?? [];
              const last = hist[0], prev = hist[1];
              const delta = last?.avg_rank != null && prev?.avg_rank != null ? Math.round((prev.avg_rank - last.avg_rank) * 10) / 10 : null;
              return (
                <li key={k.id} className={`p-3 cursor-pointer ${current?.id === k.id ? 'bg-sky-50/60' : 'hover:bg-slate-50'}`} onClick={() => setSelected(k.id)}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{k.keyword}</p>
                      <p className="text-xs text-slate-500">
                        {last ? <>Avg #{last.avg_rank ?? '–'} · top 3 in {last.top3_points}/{last.total_points}</> : 'Not scanned yet'}
                        {delta !== null && delta !== 0 && (
                          <span className={`ml-1 inline-flex items-center gap-0.5 ${delta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(delta)}
                          </span>
                        )}
                      </p>
                    </div>
                    {canScan && (
                      <button onClick={(e) => { e.stopPropagation(); scan(k); }} disabled={busy !== null} aria-label={`Scan ${k.keyword} now`} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50">
                        {busy === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); remove(k); }} aria-label={`Stop tracking ${k.keyword}`} className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {current && <KeywordDetail keyword={current} history={byKeyword.get(current.id) ?? []} canEdit={canEdit} onChanged={reload} />}
        </div>
      )}
      <p className="text-xs text-slate-400">
        Checked through Google’s Places search at each point, which closely follows the Google Maps results; what one person sees can differ a little
        (their exact location and search history). Scans run weekly, or with the refresh button (once an hour).
      </p>
    </div>
  );
}

function KeywordDetail({ keyword, history, canEdit, onChanged }: { keyword: RankKeyword; history: RankScan[]; canEdit: boolean; onChanged: () => void }) {
  const [index, setIndex] = useState(0);
  const scan = history[Math.min(index, history.length - 1)];
  if (!scan) {
    return <div className="card p-6 text-sm text-slate-500 text-center">Press the refresh button to run the first scan for “{keyword.keyword}”.</div>;
  }
  const n = scan.grid_size;
  const centre = Math.floor((n * n) / 2);
  const rivals = topRivals(scan, true);
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-base font-semibold text-slate-900">“{keyword.keyword}”</p>
          <p className="text-xs text-slate-500">{n}×{n} grid over {scan.radius_km} km · {relativeTime(scan.created_at)}</p>
        </div>
        {history.length > 1 && (
          <select className="input-field !w-auto !py-1 text-xs" value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Scan date">
            {history.map((h, i) => <option key={h.id} value={i}>{new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</option>)}
          </select>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-200 p-2"><p className="text-xl font-bold text-slate-900">{scan.avg_rank ?? '–'}</p><p className="text-[11px] text-slate-500">average position</p></div>
        <div className="rounded-xl border border-slate-200 p-2"><p className="text-xl font-bold text-emerald-600">{scan.top3_points}/{scan.total_points}</p><p className="text-[11px] text-slate-500">points in the top 3</p></div>
        <div className="rounded-xl border border-slate-200 p-2"><p className="text-xl font-bold text-slate-900">{Math.round((scan.found_points / scan.total_points) * 100)}%</p><p className="text-[11px] text-slate-500">of the area finds you</p></div>
      </div>
      <div className="mx-auto max-w-sm">
        <p className="text-[11px] text-slate-400 text-center mb-1">North</p>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} role="img" aria-label={`Ranking heatmap for ${keyword.keyword}`}>
          {scan.points.map((p, i) => (
            <div key={i} title={`${p.rank ? `#${p.rank}` : 'Not in top 20'} at ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`}
              className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold ${rankColor(p.rank)} ${i === centre ? 'ring-2 ring-offset-2 ring-slate-900' : ''}`}>
              {p.rank ?? '20+'}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500" />1–3</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-lime-400" />4–10</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400" />11–20</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-500" />not in top 20</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full ring-2 ring-slate-900" />your location</span>
        </div>
      </div>
      {rivals.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-1">Who takes #1 instead</p>
          <ul className="text-sm text-slate-600 space-y-0.5">
            {rivals.map((r) => <li key={r.name}>{r.name} <span className="text-slate-400">· #1 at {r.points} point{r.points === 1 ? '' : 's'}</span></li>)}
          </ul>
        </div>
      )}
      {history.length > 1 && (
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-1">Average position over time</p>
          <div className="flex items-end gap-1 h-16">
            {[...history].reverse().map((h) => (
              <div key={h.id} title={`${new Date(h.created_at).toLocaleDateString()}: #${h.avg_rank ?? '–'}`} className="flex-1 bg-sky-400 rounded-t" style={{ height: `${h.avg_rank ? Math.max(6, ((21 - h.avg_rank) / 20) * 100) : 4}%` }} />
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Taller is better.</p>
        </div>
      )}
      {canEdit && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="rounded border-slate-300" checked={keyword.weekly} onChange={async () => { await updateKeyword(keyword.id, { weekly: !keyword.weekly }); onChanged(); }} />
          Scan automatically every week
        </label>
      )}
    </div>
  );
}
