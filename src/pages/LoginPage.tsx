import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Mail, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/layout/AuthLayout';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      setError(signInError);
    } else {
      navigate('/');
    }
  };

  return (
    <AuthLayout>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="text-sm text-slate-500 mt-1.5">Sign in to your Reputation Engine account.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-sky-600 hover:text-sky-700">Forgot password?</Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-field pl-10"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 animate-fade-in">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-sm text-slate-500 text-center mt-5">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-sky-600 hover:text-sky-700">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
