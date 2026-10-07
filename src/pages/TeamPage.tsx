import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Clock,
  Crown,
  Loader2,
  LogOut,
  Mail,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { Modal } from '@/components/ui/Modal';
import {
  ROLE_INFO,
  changeRole,
  fetchTeam,
  inviteMember,
  permissionsFor,
  removeMember,
  transferOwnership,
} from '@/lib/team';
import type { MemberRole, TeamMember } from '@/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = { kind: 'success' | 'error'; text: string } | null;
type Confirm = { action: 'remove' | 'transfer' | 'leave'; member: TeamMember } | null;

function memberInitials(m: TeamMember) {
  const source = m.full_name?.trim() || m.email.split('@')[0];
  const parts = m.full_name?.trim() ? source.split(/\s+/) : source.split(/[._-]/);
  return parts.filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TeamPage() {
  const { user } = useAuth();
  const { organization, role: myRole, can: canAccess, isSuperAdmin, refresh: refreshContext, loading: orgLoading, error: orgError } = useLocationContext();
  const canManageTeam = canAccess('team.manage');
  const navigate = useNavigate();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, 'owner'>>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<Status>(null);

  const organizationId = organization?.id;

  const load = useCallback(async () => {
    if (!organizationId) {
      if (!orgLoading) {
        setMembers([]);
        setLoadError(orgError ?? 'You’re not part of a business yet.');
        setLoading(false);
      }
      return;
    }
    setLoadError(null);
    try {
      setMembers(await fetchTeam(organizationId));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the team');
    } finally {
      setLoading(false);
    }
  }, [organizationId, orgLoading, orgError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!EMAIL_RE.test(email)) {
      setInviteStatus({ kind: 'error', text: 'Enter a valid email address.' });
      return;
    }
    setInviting(true);
    setInviteStatus(null);
    try {
      const { emailSent } = await inviteMember(email, inviteRole);
      setInviteEmail('');
      setInviteRole('member');
      setInviteStatus({
        kind: 'success',
        text: emailSent ? `Invite sent to ${email}.` : `${email} already had an account and was added to your team.`,
      });
      await load();
    } catch (err) {
      setInviteStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not send the invite' });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (member: TeamMember, role: Exclude<MemberRole, 'owner'>) => {
    if (!organizationId || role === member.role) return;
    setBusyUserId(member.user_id);
    setStatus(null);
    try {
      await changeRole(organizationId, member.user_id, role);
      setMembers((prev) => prev.map((m) => (m.user_id === member.user_id ? { ...m, role } : m)));
      setStatus({ kind: 'success', text: `${member.full_name || member.email} is now ${ROLE_INFO[role].label.toLowerCase()}.` });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not change the role' });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirm || !organizationId) return;
    const { action, member } = confirm;
    const name = member.full_name || member.email;
    setBusyUserId(member.user_id);
    setStatus(null);
    try {
      if (action === 'transfer') {
        await transferOwnership(organizationId, member.user_id);
        setStatus({ kind: 'success', text: `${name} is now the owner. You're an admin.` });
        await Promise.all([load(), refreshContext()]);
      } else {
        await removeMember(organizationId, member.user_id);
        if (action === 'leave') {
          setConfirm(null);
          await refreshContext();
          navigate('/settings');
          return;
        }
        setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
        setStatus({ kind: 'success', text: `${name} was removed from the team.` });
      }
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setBusyUserId(null);
      setConfirm(null);
    }
  };

  const confirmCopy = confirm
    ? {
        remove: {
          title: `Remove ${confirm.member.full_name || confirm.member.email}?`,
          body: 'They’ll lose access to this business right away. You can invite them again later.',
          button: 'Remove',
          danger: true,
        },
        transfer: {
          title: `Make ${confirm.member.full_name || confirm.member.email} the owner?`,
          body: myRole === 'superadmin'
            ? 'There can only be one owner. The current owner becomes an admin.'
            : 'There can only be one owner. You’ll become an admin and won’t be able to change roles or transfer ownership back yourself.',
          button: 'Transfer ownership',
          danger: true,
        },
        leave: {
          title: `Leave ${organization?.name || 'this business'}?`,
          body: 'You’ll lose access to its reviews, leads and posts. An owner or admin can invite you again.',
          button: 'Leave business',
          danger: true,
        },
      }[confirm.action]
    : null;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-1">
            Who has access to {organization?.name || 'your business'} and what they can do.
          </p>
        </div>
        {!loading && (
          <span className="badge bg-slate-100 text-slate-600 self-start sm:self-auto">
            <Users className="w-3 h-3" />
            {members.length} {members.length === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>

      {isSuperAdmin && myRole === 'superadmin' && (
        <p className="text-xs text-violet-700 bg-violet-50 rounded-xl px-3 py-2">
          You’re viewing as a super admin: you have owner-level access here without being on the team.
        </p>
      )}

      {/* Invite */}
      {canManageTeam && myRole !== 'member' ? (
        <form onSubmit={handleInvite} className="card p-5" noValidate>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sky-50 text-sky-600 shrink-0">
              <UserPlus className="w-[18px] h-[18px]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Invite someone</h2>
              <p className="text-sm text-slate-500">They’ll get an email with a link to join and set a password.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="invite-email" className="sr-only">Email address</label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@business.com"
              autoComplete="off"
              className="input-field flex-1"
            />
            <label htmlFor="invite-role" className="sr-only">Role</label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Exclude<MemberRole, 'owner'>)}
              className="input-field sm:w-36"
            >
              <option value="member">Member</option>
              {(myRole === 'owner' || myRole === 'superadmin') && <option value="admin">Admin</option>}
            </select>
            <button type="submit" disabled={inviting || !inviteEmail.trim()} className="btn-primary shrink-0">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
          {myRole === 'admin' && (
            <p className="text-xs text-slate-400 mt-1.5">Only the owner can invite admins.</p>
          )}
          {inviteStatus && (
            <p
              role={inviteStatus.kind === 'error' ? 'alert' : 'status'}
              className={`flex items-center gap-1.5 text-sm mt-2 ${inviteStatus.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}
            >
              {inviteStatus.kind === 'success' && <Check className="w-4 h-4 shrink-0" />}
              {inviteStatus.text}
            </p>
          )}
        </form>
      ) : (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600">
          <ShieldCheck className="w-4 h-4 shrink-0 text-slate-400" />
          Ask an owner or admin if you need to add someone to the team.
        </div>
      )}

      {status && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${
            status.kind === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
          }`}
        >
          {status.kind === 'error' ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Check className="w-4 h-4 mt-0.5 shrink-0" />}
          {status.text}
        </div>
      )}

      {/* Members */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        ) : loadError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-rose-600">{loadError}</p>
            <button
              onClick={() => {
                setLoading(true);
                if (organizationId) load();
                else refreshContext();
              }}
              className="btn-secondary mt-3"
            >
              Try again
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => {
              const can = permissionsFor(myRole, user?.id, m, canManageTeam);
              const isSelf = m.user_id === user?.id;
              const pending = !m.last_sign_in_at;
              const busy = busyUserId === m.user_id;
              return (
                <li key={m.user_id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-sm font-semibold shrink-0">
                      {memberInitials(m)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {m.full_name || m.email}
                        {isSelf && <span className="ml-1.5 text-xs font-medium text-slate-400">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {m.full_name ? `${m.email} · ` : ''}
                        {pending ? (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Clock className="w-3 h-3" />
                            Invite pending
                          </span>
                        ) : (
                          `Joined ${formatDate(m.joined_at)}`
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0 pl-[52px] sm:pl-0">
                    {busy && <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />}
                    {can.changeRole ? (
                      <select
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => handleRoleChange(m, e.target.value as Exclude<MemberRole, 'owner'>)}
                        aria-label={`Role for ${m.full_name || m.email}`}
                        className="input-field !py-1.5 !w-28 text-sm"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className={`badge ${ROLE_INFO[m.role].color}`}>
                        {m.role === 'owner' && <Crown className="w-3 h-3" />}
                        {ROLE_INFO[m.role].label}
                      </span>
                    )}
                    {can.makeOwner && (
                      <button
                        onClick={() => setConfirm({ action: 'transfer', member: m })}
                        disabled={busy}
                        className="btn-ghost !px-2 text-xs"
                        title="Make owner"
                      >
                        <Crown className="w-4 h-4" />
                        <span className="sm:hidden lg:inline">Make owner</span>
                      </button>
                    )}
                    {can.remove && (
                      <button
                        onClick={() => setConfirm({ action: 'remove', member: m })}
                        disabled={busy}
                        className="btn-ghost !px-2 text-xs text-rose-600 hover:bg-rose-50"
                        title="Remove from team"
                      >
                        <UserMinus className="w-4 h-4" />
                        <span className="sm:hidden lg:inline">Remove</span>
                      </button>
                    )}
                    {can.leave && (
                      <button
                        onClick={() => setConfirm({ action: 'leave', member: m })}
                        disabled={busy}
                        className="btn-ghost !px-2 text-xs text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="w-4 h-4" />
                        Leave
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Roles explained */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-slate-900 mb-3">Roles</h2>
        <dl className="space-y-3">
          {(Object.keys(ROLE_INFO) as MemberRole[]).map((r) => (
            <div key={r} className="flex items-start gap-3">
              <dt className="shrink-0 w-20">
                <span className={`badge ${ROLE_INFO[r].color}`}>{ROLE_INFO[r].label}</span>
              </dt>
              <dd className="text-sm text-slate-600">{ROLE_INFO[r].description}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Modal isOpen={confirm !== null} onClose={() => !busyUserId && setConfirm(null)} title={confirmCopy?.title ?? ''} maxWidth="sm">
        <p className="text-sm text-slate-600">{confirmCopy?.body}</p>
        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={handleConfirm}
            disabled={busyUserId !== null}
            className={`btn-primary flex-1 ${confirmCopy?.danger ? '!bg-rose-600 hover:!bg-rose-700' : ''}`}
          >
            {busyUserId && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmCopy?.button}
          </button>
          <button onClick={() => setConfirm(null)} disabled={busyUserId !== null} className="btn-secondary">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
