import { Link } from 'react-router-dom';
import { Loader2, Lock } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import type { Permission } from '@/lib/permissions';

/**
 * Shows its children only to people with access: a feature `permission` (role default or
 * Role access override), or owners/admins when no permission is given. The database enforces
 * the same rules; this gives a clear message instead of an empty page.
 */
export function AdminRoute({ children, permission }: { children: React.ReactNode; permission?: Permission }) {
  const { isAdmin, can, loading } = useLocationContext();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (permission ? !can(permission) : !isAdmin) {
    return (
      <div className="card p-8 max-w-md mx-auto mt-8 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto mb-3">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-base font-bold text-slate-900">You don’t have access to this page</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask the owner of your business if you need access.
        </p>
        <Link to="/" className="btn-secondary mt-4">Back to dashboard</Link>
      </div>
    );
  }

  return <>{children}</>;
}
