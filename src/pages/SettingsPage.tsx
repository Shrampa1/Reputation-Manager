import { useEffect, useState } from 'react';
import { Link, useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Check,
  ChevronRight,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Plug,
  ShieldCheck,
  User as UserIcon,
  Users,
  History,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { supabase } from '@/lib/supabase';
import { displayName, getInitials } from '@/lib/user';
import { ReviewSettingsCard } from '@/components/reviews/ReviewSettingsCard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

const roleLabel: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-violet-50 text-violet-600' },
  admin: { label: 'Admin', color: 'bg-sky-50 text-sky-600' },
  member: { label: 'Member', color: 'bg-slate-100 text-slate-600' },
};

type Status = { kind: 'success' | 'error'; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role={status.kind === 'error' ? 'alert' : 'status'}
      className={`flex items-center gap-1.5 text-sm ${status.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}
    >
      {status.kind === 'success' && <Check className="w-4 h-4 shrink-0" />}
      {status.text}
    </p>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof UserIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
        <Icon className="w-[18px] h-[18px]" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { organization, location, role, isAdmin, updateOrganizationName } = useLocationContext();
  const navigate = useNavigate();
  const { hash } = useRouterLocation();

  // Links like /settings#review-requests jump to that section
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    el?.scrollIntoView({ block: 'start' });
  }, [hash]);

  // ---- Profile
  const [fullName, setFullName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameStatus, setNameStatus] = useState<Status>(null);

  // ---- Email
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<Status>(null);

  // ---- Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);

  // ---- Business
  const [businessName, setBusinessName] = useState('');
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessStatus, setBusinessStatus] = useState<Status>(null);

  const savedFullName = (user?.user_metadata?.full_name as string | undefined) ?? '';
  useEffect(() => setFullName(savedFullName), [savedFullName]);
  useEffect(() => setBusinessName(organization?.name ?? ''), [organization?.name]);

  const pendingEmail = user?.new_email;

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    setNameStatus(null);
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    setSavingName(false);
    setNameStatus(error ? { kind: 'error', text: error.message } : { kind: 'success', text: 'Name saved' });
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!EMAIL_RE.test(email)) {
      setEmailStatus({ kind: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (email.toLowerCase() === user?.email?.toLowerCase()) {
      setEmailStatus({ kind: 'error', text: 'That’s already your email address.' });
      return;
    }
    setSavingEmail(true);
    setEmailStatus(null);
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/settings` }
    );
    setSavingEmail(false);
    if (error) {
      setEmailStatus({ kind: 'error', text: error.message });
    } else {
      setNewEmail('');
      setEmailStatus({ kind: 'success', text: `Check ${email} (and your current inbox) for a confirmation link.` });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setPasswordStatus({ kind: 'error', text: `Use at least ${MIN_PASSWORD} characters.` });
      return;
    }
    if (password !== confirmPassword) {
      setPasswordStatus({ kind: 'error', text: 'The passwords don’t match.' });
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      setPasswordStatus({ kind: 'error', text: error.message });
    } else {
      setPassword('');
      setConfirmPassword('');
      setPasswordStatus({ kind: 'success', text: 'Password updated' });
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBusiness(true);
    setBusinessStatus(null);
    const { error } = await updateOrganizationName(businessName);
    setSavingBusiness(false);
    setBusinessStatus(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Business name saved' });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const roleInfo = role ? roleLabel[role] : null;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Profile & Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account, sign-in details and business.</p>
      </div>

      {/* Identity summary */}
      <div className="card p-5 flex items-center gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-lg font-semibold shrink-0">
          {getInitials(user)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900 truncate">{displayName(user)}</p>
          <p className="text-sm text-slate-500 truncate">{user?.email}</p>
        </div>
        {roleInfo && <span className={`badge ${roleInfo.color} shrink-0`}>{roleInfo.label}</span>}
      </div>

      {/* Profile */}
      <form onSubmit={handleSaveName} className="card p-5">
        <SectionHeader icon={UserIcon} title="Profile" subtitle="How your name appears in the app" />
        <label htmlFor="settings-name" className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="settings-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            maxLength={100}
            className="input-field flex-1"
          />
          <button type="submit" disabled={savingName || fullName.trim() === savedFullName} className="btn-primary shrink-0">
            {savingName && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
        <div className="mt-2">
          <StatusLine status={nameStatus} />
        </div>
      </form>

      {/* Email */}
      <form onSubmit={handleChangeEmail} className="card p-5">
        <SectionHeader icon={Mail} title="Email address" subtitle="Used to sign in and for account notices" />
        <p className="text-sm text-slate-600 mb-3">
          Current: <span className="font-medium text-slate-900">{user?.email}</span>
          {pendingEmail && (
            <span className="block text-xs text-amber-600 mt-1">
              Waiting for confirmation of {pendingEmail}. Check that inbox for the link.
            </span>
          )}
        </p>
        <label htmlFor="settings-email" className="block text-sm font-medium text-slate-700 mb-1.5">New email</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="settings-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="name@business.com"
            autoComplete="email"
            className="input-field flex-1"
          />
          <button type="submit" disabled={savingEmail || !newEmail.trim()} className="btn-primary shrink-0">
            {savingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
            Change email
          </button>
        </div>
        <div className="mt-2">
          <StatusLine status={emailStatus} />
        </div>
      </form>

      {/* Password */}
      <form onSubmit={handleChangePassword} className="card p-5">
        <SectionHeader icon={KeyRound} title="Password" subtitle={`At least ${MIN_PASSWORD} characters`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="settings-password" className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
            <input
              id="settings-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="settings-password-confirm" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm new password</label>
            <input
              id="settings-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="input-field"
            />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
          <button type="submit" disabled={savingPassword || !password || !confirmPassword} className="btn-primary sm:w-auto">
            {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password
          </button>
          <StatusLine status={passwordStatus} />
        </div>
      </form>

      {/* Business */}
      <form onSubmit={handleSaveBusiness} className="card p-5">
        <SectionHeader icon={Building2} title="Business" subtitle="Your organization in Reputation Engine" />
        <label htmlFor="settings-business" className="block text-sm font-medium text-slate-700 mb-1.5">Business name</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="settings-business"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={!isAdmin}
            maxLength={200}
            className="input-field flex-1 disabled:bg-slate-50 disabled:text-slate-500"
          />
          {isAdmin && (
            <button
              type="submit"
              disabled={savingBusiness || !businessName.trim() || businessName.trim() === organization?.name}
              className="btn-primary shrink-0"
            >
              {savingBusiness && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          )}
        </div>
        {!isAdmin && <p className="text-xs text-slate-400 mt-1.5">Only owners and admins can rename the business.</p>}
        <div className="mt-2">
          <StatusLine status={businessStatus} />
        </div>

        <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          <Link to="/seo" className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">Location details</p>
              <p className="text-xs text-slate-500 truncate">
                {location ? [location.address, location.phone].filter(Boolean).join(' · ') || 'Add address and phone' : 'No location yet'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </Link>
          <Link to="/team" className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
            <Users className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900">Team</p>
              <p className="text-xs text-slate-500">{role === 'owner' ? 'Invite people and manage roles' : 'See who has access'}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
          </Link>
          {isAdmin && (
            <>
              <Link to="/integrations" className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
                <Plug className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">Integrations</p>
                  <p className="text-xs text-slate-500">Google, Facebook, Instagram and Twilio</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </Link>
              <Link to="/activity" className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
                <History className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">Activity log</p>
                  <p className="text-xs text-slate-500">Who changed what, and when</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </Link>
            </>
          )}
        </div>
      </form>

      <ReviewSettingsCard />

      {/* Session */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
            <ShieldCheck className="w-[18px] h-[18px]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Sign out</h2>
            <p className="text-sm text-slate-500">Sign out of Reputation Engine on this device.</p>
          </div>
        </div>
        <button onClick={handleSignOut} className="btn-secondary text-rose-600 hover:bg-rose-50">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
