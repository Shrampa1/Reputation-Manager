import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { CreateBusinessPage } from '@/pages/CreateBusinessPage';

/**
 * Sits between sign-in and the app. Shows the app only once the account's business has
 * loaded; otherwise a loading state, a retryable error, or the "Set up your business" screen.
 */
export function BusinessGate({ children }: { children: React.ReactNode }) {
  const { organization, loading, error, refresh } = useLocationContext();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  if (loading && !organization) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading your business…</p>
        </div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-rose-50 text-rose-500 mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-500 mt-1.5">{error}</p>
        <button onClick={() => refresh()} className="btn-primary w-full mt-6">
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        <button
          onClick={async () => {
            await signOut();
            navigate('/login');
          }}
          className="btn-ghost w-full mt-2 text-slate-500"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </AuthLayout>
    );
  }

  if (!organization) return <CreateBusinessPage />;

  return <>{children}</>;
}
