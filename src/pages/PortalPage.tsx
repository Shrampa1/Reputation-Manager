import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchPortalBranding, storePortalBranding } from '@/lib/branding';
import { LoginPage } from '@/pages/LoginPage';

/**
 * An agency's client portal: /p/<slug>. Shows the sign-in page in the agency's branding and
 * remembers the portal so the password pages (and the next visit to /login) keep it.
 */
export function PortalPage() {
  const { slug = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetchPortalBranding(slug).then((b) => {
      if (cancelled) return;
      storePortalBranding(b);
      setState(b ? 'ready' : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!authLoading && user) return <Navigate to="/" replace />;

  if (state === 'loading' || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-label="Loading">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="card p-8 max-w-sm text-center">
          <h1 className="text-base font-bold text-slate-900">This portal doesn’t exist</h1>
          <p className="text-sm text-slate-500 mt-1">Check the link you were sent, or ask the agency for a new one.</p>
          <Link to="/login" className="btn-secondary mt-4">Go to sign in</Link>
        </div>
      </div>
    );
  }

  return <LoginPage />;
}
