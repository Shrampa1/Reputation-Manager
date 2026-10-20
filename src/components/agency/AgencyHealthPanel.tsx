import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCircle2, Loader2, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { saveAlertSettings, useAgencyHealth, useAlertSettings, type AlertSettings } from '@/lib/clientReports';

/** A5: every client business at a glance, the ones needing attention first. */
export function AgencyHealthPanel() {
  const { rows, loading } = useAgencyHealth();
  const { switchOrganization } = useLocationContext();
  const navigate = useNavigate();
  const attention = rows.filter((r) => r.needs_attention).length;

  const open = async (orgId: string, path: string) => {
    await switchOrganization(orgId);
    navigate(path);
  };

  return (
    <section className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Client health</h2>
          <p className="text-sm text-slate-500">
            {loading ? 'Loading…' : attention ? `${attention} of ${rows.length} businesses need attention.` : `All ${rows.length} businesses look fine.`}
          </p>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {rows.map((r) => {
            const trend = r.avg_rating_30d !== null && r.avg_rating_prev_30d !== null ? Math.round((r.avg_rating_30d - r.avg_rating_prev_30d) * 10) / 10 : null;
            return (
              <li key={r.organization_id} className={`p-3 ${r.needs_attention ? 'bg-amber-50/40' : ''}`}>
                <div className="flex items-start gap-3">
                  {r.needs_attention ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                      {r.google_rating !== null && <span className="text-xs text-slate-500 inline-flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{r.google_rating.toFixed(1)}</span>}
                      {trend !== null && trend !== 0 && (
                        <span className={`text-xs inline-flex items-center gap-0.5 ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{trend > 0 ? '+' : ''}{trend} this month
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {r.reviews_30d} reviews in 30 days · {r.unreplied} unreplied · {r.requests_30d ? `${Math.round((r.responses_30d / r.requests_30d) * 100)}% answered requests` : 'no requests sent'}
                    </p>
                    {r.reasons.length > 0 && <p className="text-xs text-amber-800 mt-1">{r.reasons.join(' · ')}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-xs">
                    <button onClick={() => open(r.organization_id, '/reviews')} className="font-medium text-sky-600 hover:underline">Reviews</button>
                    {r.pending_approvals > 0 && <button onClick={() => open(r.organization_id, '/approvals')} className="font-medium text-sky-600 hover:underline">Approvals</button>}
                    {r.broken_connections > 0 && <button onClick={() => open(r.organization_id, '/integrations')} className="font-medium text-sky-600 hover:underline">Reconnect</button>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AlertSettingsForm />
    </section>
  );
}

function AlertSettingsForm() {
  const { user } = useAuth();
  const { settings, loaded, reload } = useAlertSettings();
  const [form, setForm] = useState<AlertSettings>({ email: '', negative_reviews: true, max_rating: 2, daily_digest: true });
  const [on, setOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setOn(Boolean(settings));
    setForm(settings ?? { email: user?.email ?? '', negative_reviews: true, max_rating: 2, daily_digest: true });
  }, [loaded, settings, user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await saveAlertSettings(user.id, on ? form : null);
    setSaving(false);
    setMsg(error ?? 'Saved.');
    reload();
  };

  if (!loaded) return null;
  return (
    <form onSubmit={save} className="pt-3 border-t border-slate-100 space-y-2">
      <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><Bell className="w-4 h-4 text-violet-500" /> Alerts for you</p>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" className="rounded border-slate-300" checked={on} onChange={(e) => setOn(e.target.checked)} /> Email me about my businesses
      </label>
      {on && (
        <div className="space-y-2 pl-6">
          <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Alert email" required />
          <label className="flex items-center gap-2 text-sm text-slate-700 flex-wrap">
            <input type="checkbox" className="rounded border-slate-300" checked={form.negative_reviews} onChange={(e) => setForm({ ...form, negative_reviews: e.target.checked })} />
            Right away when a review of
            <select className="input-field !w-auto !py-0.5 text-sm" value={form.max_rating} onChange={(e) => setForm({ ...form, max_rating: Number(e.target.value) })} aria-label="Alert threshold">
              <option value={1}>1★</option><option value={2}>2★ or lower</option><option value={3}>3★ or lower</option>
            </select>
            arrives
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="rounded border-slate-300" checked={form.daily_digest} onChange={(e) => setForm({ ...form, daily_digest: e.target.checked })} />
            A daily digest of businesses needing attention (only on days when something does)
          </label>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-secondary text-sm">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save alerts</button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </form>
  );
}
