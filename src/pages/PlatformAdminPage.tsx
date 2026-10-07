import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, LogIn, LogOut, Search, ShieldCheck } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { callFunction } from '@/lib/functions';

interface AdminBusiness {
  id: string;
  name: string;
  created_at: string;
  owner_email: string | null;
  members: number;
  plan: 'free' | 'pro' | 'agency';
  plan_status: string | null;
  plan_provider: string | null;
  website: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  you_are_member: boolean;
  your_role: string | null;
}

const planStyle = { free: 'bg-slate-100 text-slate-600', pro: 'bg-sky-50 text-sky-600', agency: 'bg-violet-50 text-violet-600' };

/** For the app owner (platform_admins): every business on Reputation Engine. */
export function PlatformAdminPage() {
  const { isPlatformAdmin, switchOrganization, refresh } = useLocationContext();
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminBusiness[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { businesses } = await callFunction<{ businesses: AdminBusiness[] }>('platform-admin', { action: 'list' });
      setRows(businesses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t load businesses');
    }
  }, []);

  useEffect(() => {
    if (isPlatformAdmin) load();
  }, [isPlatformAdmin, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || [r.name, r.owner_email, r.website].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, query]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    return { all: list.length, pro: list.filter((r) => r.plan === 'pro').length, agency: list.filter((r) => r.plan === 'agency').length };
  }, [rows]);

  if (!isPlatformAdmin) return <Navigate to="/" replace />;

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const open = (b: AdminBusiness) =>
    act(`open-${b.id}`, async () => {
      // Super admins have owner-level access everywhere, so no need to join the team
      await switchOrganization(b.id);
      navigate('/');
    });

  const leave = (b: AdminBusiness) =>
    act(`leave-${b.id}`, async () => {
      await callFunction('platform-admin', { action: 'leave', organizationId: b.id });
      await refresh();
      await load();
    });

  const setPlan = (b: AdminBusiness, plan: string) =>
    act(`plan-${b.id}`, async () => {
      await callFunction('platform-admin', { action: 'set-plan', organizationId: b.id, plan });
      await load();
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-violet-600" /> Super admin</h1>
        <p className="text-sm text-slate-500 mt-1">Every business on Reputation Engine. As a super admin you have owner-level access to all of them; anything you change is recorded under your name in that business’s activity log.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 sm:p-4"><p className="text-xs text-slate-400">Businesses</p><p className="text-2xl font-bold text-slate-900">{totals.all}</p></div>
        <div className="card p-3 sm:p-4"><p className="text-xs text-slate-400">Pro</p><p className="text-2xl font-bold text-sky-600">{totals.pro}</p></div>
        <div className="card p-3 sm:p-4"><p className="text-xs text-slate-400">Agency</p><p className="text-2xl font-bold text-violet-600">{totals.agency}</p></div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by business, owner email or website…" aria-label="Search businesses" className="input-field pl-10" />
      </div>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

      {rows === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="font-medium p-3">Business</th>
                <th className="font-medium p-3">Owner</th>
                <th className="font-medium p-3">Plan</th>
                <th className="font-medium p-3 text-right">Team</th>
                <th className="font-medium p-3">Google</th>
                <th className="font-medium p-3">Created</th>
                <th className="font-medium p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-t border-slate-50 align-middle">
                  <td className="p-3">
                    <p className="font-semibold text-slate-900">{b.name}</p>
                    {b.website && <p className="text-xs text-slate-400 truncate max-w-[220px]">{b.website}</p>}
                  </td>
                  <td className="p-3 text-slate-600">{b.owner_email ?? '—'}</td>
                  <td className="p-3">
                    <select
                      value={b.plan}
                      onChange={(e) => setPlan(b, e.target.value)}
                      disabled={busy !== null || b.plan_provider === 'lemonsqueezy'}
                      title={b.plan_provider === 'lemonsqueezy' ? 'Paid through Lemon Squeezy' : 'Set a plan without billing'}
                      aria-label={`Plan for ${b.name}`}
                      className={`rounded-lg border-0 text-xs font-semibold px-2 py-1 ${planStyle[b.plan]}`}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="agency">Agency</option>
                    </select>
                    {b.plan_status && b.plan_status !== 'active' && <span className="block text-[11px] text-amber-600 mt-0.5">{b.plan_status}</span>}
                  </td>
                  <td className="p-3 text-right text-slate-600">{b.members}</td>
                  <td className="p-3 text-slate-600">{b.google_rating != null ? `${Number(b.google_rating).toFixed(1)}★ (${b.google_review_count ?? 0})` : '—'}</td>
                  <td className="p-3 text-slate-500">{new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => open(b)} disabled={busy !== null} className="btn-secondary !py-1.5 text-xs">
                        {busy === `open-${b.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />} Open
                      </button>
                      {b.you_are_member && b.your_role !== 'owner' && (
                        <button onClick={() => leave(b)} disabled={busy !== null} className="btn-ghost !py-1.5 text-xs text-slate-500" title="Remove yourself from this business">
                          {busy === `leave-${b.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">No businesses match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
