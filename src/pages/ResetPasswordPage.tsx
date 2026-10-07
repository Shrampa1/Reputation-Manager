import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';

const MIN_PASSWORD = 8;

/**
 * Where password-reset and team-invite links land. Supabase signs the user in from the link,
 * then they choose a password here.
 */
export function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isInvite = params.get('invite') === '1';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // The session from the link can take a moment to be read from the URL
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const linkError = (() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('error_description') || hash.get('error_description');
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('The passwords don’t match.');
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setDone(true);
    setTimeout(() => navigate('/'), 1200);
  };

  if (loading || (!user && !waited && !linkError)) {
    return (
      <AuthLayout>
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">This link has expired</h2>
          <p className="text-sm text-slate-500 mt-2">
            {linkError ? `${linkError}. ` : ''}Reset links work once and expire after a while. Request a new one and use it straight away.
          </p>
          <Link to="/forgot-password" className="btn-primary w-full mt-6">Send a new link</Link>
          <Link to="/login" className="btn-ghost w-full mt-2">Back to sign in</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {done ? (
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 mx-auto mb-4"><Check className="w-6 h-6" /></div>
          <h2 className="text-2xl font-bold text-slate-900">Password saved</h2>
          <p className="text-sm text-slate-500 mt-2">Taking you to your dashboard…</p>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{isInvite ? 'Welcome! Choose a password' : 'Choose a new password'}</h2>
          <p className="text-sm text-slate-500 mt-1.5">
            {isInvite ? 'You’ve been invited to a business on Reputation Engine. Set a password to finish joining.' : `For ${user.email}`}
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-1.5">New password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus className="input-field pl-10" placeholder={`At least ${MIN_PASSWORD} characters`} />
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="input-field pl-10" />
              </div>
            </div>
            {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600" role="alert">{error}</div>}
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save password'}
            </button>
          </form>
        </div>
      )}
    </AuthLayout>
  );
}
