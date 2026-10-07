import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AuthLayout } from '@/components/layout/AuthLayout';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sends a password-reset link; the link opens /reset-password. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError('Enter the email you signed up with.');
    setSending(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    // Same message whether or not the account exists, so emails can't be probed
    if (resetError && !/not found|no user/i.test(resetError.message)) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout>
      {sent ? (
        <div className="text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-50 text-sky-600 mx-auto mb-4">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Check your email</h2>
          <p className="text-sm text-slate-500 mt-2">
            If an account exists for <span className="font-semibold text-slate-700">{email.trim()}</span>, we’ve sent a link to
            choose a new password. It can take a minute to arrive; check spam too.
          </p>
          <Link to="/login" className="btn-secondary w-full mt-6">Back to sign in</Link>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reset your password</h2>
          <p className="text-sm text-slate-500 mt-1.5">Enter your email and we’ll send you a link to choose a new one.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="forgot-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                  autoComplete="email"
                  autoFocus
                  className="input-field pl-10"
                />
              </div>
            </div>
            {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600" role="alert">{error}</div>}
            <button type="submit" disabled={sending} className="btn-primary w-full">
              {sending && <Loader2 className="w-4 h-4 animate-spin" />}
              {sending ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <Link to="/login" className="mt-5 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
