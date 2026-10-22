import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Gauge, Loader2, Plus, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { npsTone, useSurveys, type NpsNumbers, type NpsStats } from '@/lib/surveys';
import { Modal } from '@/components/ui/Modal';

const PERIODS: [number | null, string][] = [[30, '30 days'], [90, '90 days'], [365, '12 months'], [null, 'All time']];

/** C3: Net Promoter Score surveys. Unhappy answers become follow-ups for the team. */
export function SurveysPage() {
  const { can } = useLocationContext();
  const canEdit = can('reviews.request');
  const { surveys, stats, days, setDays, loading, error, create, remove } = useSurveys();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Customer surveys</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ask customers how likely they are to recommend you (0–10). Happy customers are invited to review you; unhappy ones become follow-ups for your team.
          </p>
        </div>
        {canEdit && <button type="button" onClick={() => setCreating(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> New survey</button>}
      </div>
      {error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load surveys: {error}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : surveys.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <Gauge className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No surveys yet</p>
          <p className="text-sm text-slate-500">Create one, then email it to customers, send it automatically when a job is completed, or share its link and QR code.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1 flex-wrap" role="group" aria-label="Period">
            {PERIODS.map(([d, label]) => (
              <button key={label} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
                className={`px-3 py-1 rounded-full text-xs font-medium ${days === d ? 'bg-sky-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
          {stats && <Overview stats={stats} firstSurvey={surveys[0].id} />}
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Survey</th>
                  <th className="px-4 py-2 font-medium">NPS</th>
                  <th className="px-4 py-2 font-medium">Answers</th>
                  <th className="px-4 py-2 font-medium hidden sm:table-cell">Response rate</th>
                  <th className="px-4 py-2 sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {surveys.map((s) => {
                  const n = stats?.surveys[s.id];
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/surveys/${s.id}`} className="font-medium text-slate-900 hover:text-sky-700">{s.name}</Link>
                        <p className="text-xs text-slate-500">
                          <span className={`inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{s.status === 'active' ? 'Active' : 'Paused'}</span>
                          {s.settings.auto_lead_completed && <span className="ml-2">Auto-sends after completed jobs</span>}
                        </p>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${npsTone(n?.nps ?? null)}`}>{n?.nps ?? '—'}</td>
                      <td className="px-4 py-3">{n?.responses ?? 0}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">{n?.response_rate != null ? `${n.response_rate}%` : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit && (
                          <button type="button" onClick={() => { if (window.confirm(`Delete “${s.name}” and all its answers?`)) remove(s.id); }} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Delete ${s.name}`}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {creating && <CreateSurveyModal onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}

function Overview({ stats, firstSurvey }: { stats: NpsStats; firstSurvey: string }) {
  const o: NpsNumbers = stats.overall;
  const share = (n: number) => (o.responses ? Math.round((n / o.responses) * 100) : 0);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="card p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Promoter Score</p>
        <p className={`text-5xl font-bold mt-2 ${npsTone(o.nps)}`}>{o.nps ?? '—'}</p>
        <p className="text-xs text-slate-500 mt-1">From −100 to 100. Above 0 is good, above 50 is excellent.</p>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 mt-4" aria-hidden>
          <div className="bg-emerald-500" style={{ width: `${share(o.promoters)}%` }} />
          <div className="bg-amber-400" style={{ width: `${share(o.passives)}%` }} />
          <div className="bg-rose-500" style={{ width: `${share(o.detractors)}%` }} />
        </div>
        <dl className="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div><dt className="text-slate-500">Promoters (9–10)</dt><dd className="font-semibold text-emerald-700">{o.promoters} · {share(o.promoters)}%</dd></div>
          <div><dt className="text-slate-500">Passives (7–8)</dt><dd className="font-semibold text-amber-700">{o.passives} · {share(o.passives)}%</dd></div>
          <div><dt className="text-slate-500">Detractors (0–6)</dt><dd className="font-semibold text-rose-700">{o.detractors} · {share(o.detractors)}%</dd></div>
        </dl>
      </section>
      <section className="card p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Answers</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{o.responses}</p>
          <p className="text-xs text-slate-500">{o.emailed} emailed{o.response_rate != null ? ` · ${o.response_rate}% answered` : ''}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Need a follow-up</p>
          <p className={`text-3xl font-bold mt-1 ${stats.open_follow_ups ? 'text-rose-600' : 'text-slate-900'}`}>{stats.open_follow_ups}</p>
          {stats.open_follow_ups > 0 && <Link to={`/surveys/${firstSurvey}?filter=follow_up`} className="text-xs text-sky-600 hover:underline">See unhappy customers</Link>}
        </div>
      </section>
      <section className="card p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">NPS by month</p>
        {stats.months.length === 0 ? <p className="text-sm text-slate-500">No answers in the last 12 months.</p> : (
          <ul className="space-y-1.5">
            {stats.months.slice(-6).map((m) => (
              <li key={m.month} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-slate-500 shrink-0">{new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span>
                {/* −100…100 drawn from the middle */}
                <span className="flex-1 h-2 bg-slate-100 rounded-full relative overflow-hidden">
                  <span className={`absolute top-0 h-full ${m.nps >= 0 ? 'bg-emerald-500 left-1/2' : 'bg-rose-500 right-1/2'}`} style={{ width: `${Math.abs(m.nps) / 2}%` }} />
                </span>
                <span className={`w-8 text-right font-semibold ${npsTone(m.nps)}`}>{m.nps}</span>
                <span className="w-10 text-right text-slate-400">{m.responses}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateSurveyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<{ id: string }> }) {
  const navigate = useNavigate();
  const [name, setName] = useState('After the job');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await onCreate(name);
      navigate(`/surveys/${s.id}?tab=settings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t create the survey');
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title="New survey">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="ns-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name (only your team sees it)</label>
          <input id="ns-name" className="input-field" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="text-xs text-slate-500">It starts with the standard NPS question. You can change every text afterwards.</p>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary text-sm">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Create</button>
        </div>
      </form>
    </Modal>
  );
}
