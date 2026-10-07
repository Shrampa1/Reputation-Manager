import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Check, KeyRound, Loader2, Lock, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { supabase } from '@/lib/supabase';
import { fetchTeam, ROLE_INFO } from '@/lib/team';
import type { PermissionInfo } from '@/lib/permissions';
import type { TeamMember } from '@/types';

type Choice = 'default' | 'allow' | 'restrict';

function roleDefault(info: PermissionInfo, role: TeamMember['role']) {
  return role === 'owner' ? info.owner_default : role === 'admin' ? info.admin_default : info.member_default;
}

/**
 * Role access: grant or restrict individual features for a person without changing their role.
 * Owners manage admins and members; super admins can also manage owners.
 */
export function RoleAccessPage() {
  const { user } = useAuth();
  const { organization, isOwnerLike, role: myRole } = useLocationContext();
  const [catalog, setCatalog] = useState<PermissionInfo[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    setError(null);
    try {
      const [cat, team, ov] = await Promise.all([
        supabase.from('permission_catalog').select('*').order('sort'),
        fetchTeam(organization.id),
        supabase.rpc('get_member_permission_overrides', { p_org: organization.id }),
      ]);
      if (cat.error) throw new Error(cat.error.message);
      if (ov.error) throw new Error(ov.error.message);
      setCatalog((cat.data as PermissionInfo[]) ?? []);
      setMembers(team);
      const map: Record<string, Record<string, boolean>> = {};
      for (const row of (ov.data as { user_id: string; permission: string; allowed: boolean }[]) ?? []) {
        (map[row.user_id] ??= {})[row.permission] = row.allowed;
      }
      setOverrides(map);
      setSelected((prev) => prev ?? team.find((m) => m.user_id !== user?.id && m.role !== 'owner')?.user_id ?? team[0]?.user_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t load access settings');
    } finally {
      setLoading(false);
    }
  }, [organization, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const member = members.find((m) => m.user_id === selected) ?? null;
  const areas = useMemo(() => [...new Set(catalog.map((c) => c.area))], [catalog]);

  if (!isOwnerLike) return <Navigate to="/" replace />;

  const editable = (m: TeamMember) => m.user_id !== user?.id && (m.role !== 'owner' || myRole === 'superadmin');
  const lockReason = (m: TeamMember) =>
    m.user_id === user?.id ? 'You can’t change your own access.' : m.role === 'owner' && myRole !== 'superadmin' ? 'Only a super admin can change the owner’s access.' : null;

  const setChoice = async (m: TeamMember, info: PermissionInfo, choice: Choice) => {
    if (!organization) return;
    const key = `${m.user_id}:${info.permission}`;
    setBusy(key);
    setError(null);
    const allowed = choice === 'default' ? null : choice === 'allow';
    const { error: rpcError } = await supabase.rpc('set_member_permission', {
      p_org: organization.id,
      p_user: m.user_id,
      p_permission: info.permission,
      p_allowed: allowed,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setOverrides((prev) => {
      const next = { ...prev, [m.user_id]: { ...(prev[m.user_id] ?? {}) } };
      if (allowed === null) delete next[m.user_id][info.permission];
      else next[m.user_id][info.permission] = allowed;
      return next;
    });
  };

  const resetAll = async (m: TeamMember) => {
    for (const perm of Object.keys(overrides[m.user_id] ?? {})) {
      const info = catalog.find((c) => c.permission === perm);
      if (info) await setChoice(m, info, 'default');
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-6 h-6 text-sky-600" /> Role access</h1>
        <p className="text-sm text-slate-500 mt-1">
          Give or take away individual features for a person without changing their role. Everything else follows their role.
        </p>
      </div>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* People */}
          <div className="card p-2 h-fit">
            <ul>
              {members.map((m) => {
                const count = Object.keys(overrides[m.user_id] ?? {}).length;
                const active = m.user_id === selected;
                return (
                  <li key={m.user_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(m.user_id)}
                      aria-current={active}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left ${active ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold shrink-0">
                        {(m.full_name || m.email).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900 truncate">{m.full_name || m.email}{m.user_id === user?.id ? ' (you)' : ''}</span>
                        <span className={`badge mt-0.5 ${ROLE_INFO[m.role].color}`}>{ROLE_INFO[m.role].label}</span>
                      </span>
                      {count > 0 && <span className="badge bg-amber-50 text-amber-700 shrink-0">{count} custom</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-slate-400 px-2.5 pt-2 pb-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Super admins always have full access and aren’t listed.
            </p>
          </div>

          {/* Permissions for the selected person */}
          <div className="md:col-span-2 card p-5">
            {!member ? (
              <p className="text-sm text-slate-500">Choose a person.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-900 truncate">{member.full_name || member.email}</p>
                    <p className="text-xs text-slate-500">{ROLE_INFO[member.role].label} · {member.email}</p>
                  </div>
                  {editable(member) && Object.keys(overrides[member.user_id] ?? {}).length > 0 && (
                    <button onClick={() => resetAll(member)} disabled={busy !== null} className="btn-ghost text-xs text-slate-500">
                      <RotateCcw className="w-3.5 h-3.5" /> Reset all to role defaults
                    </button>
                  )}
                </div>
                {lockReason(member) && (
                  <p className="mb-4 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> {lockReason(member)}</p>
                )}
                <div className="space-y-5">
                  {areas.map((area) => (
                    <div key={area}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">{area}</p>
                      <ul className="divide-y divide-slate-50">
                        {catalog.filter((c) => c.area === area).map((info) => {
                          const ov = overrides[member.user_id]?.[info.permission];
                          const choice: Choice = ov === undefined ? 'default' : ov ? 'allow' : 'restrict';
                          const def = roleDefault(info, member.role);
                          const effective = ov ?? def;
                          const key = `${member.user_id}:${info.permission}`;
                          return (
                            <li key={info.permission} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${effective ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'}`}>
                                  {effective ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900">{info.label}</p>
                                  <p className="text-xs text-slate-500">{info.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit shrink-0" role="radiogroup" aria-label={info.label}>
                                {([
                                  ['default', `Default (${def ? 'on' : 'off'})`],
                                  ['allow', 'Allow'],
                                  ['restrict', 'Restrict'],
                                ] as [Choice, string][]).map(([c, label]) => (
                                  <button
                                    key={c}
                                    type="button"
                                    role="radio"
                                    aria-checked={choice === c}
                                    disabled={!editable(member) || busy !== null}
                                    onClick={() => choice !== c && setChoice(member, info, c)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:cursor-not-allowed ${
                                      choice === c
                                        ? c === 'allow' ? 'bg-emerald-500 text-white' : c === 'restrict' ? 'bg-rose-500 text-white' : 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                  >
                                    {busy === key && choice !== c ? '…' : label}
                                  </button>
                                ))}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-5">Changes apply right away and are recorded in the activity log.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
