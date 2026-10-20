import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ReportShell } from '@/components/prospects/ReportShell';
import { fetchSharedAudit, type ReportData } from '@/lib/prospects';

/** /a/:token: the audit report a prospect opens from the agency's link. No sign-in. */
export function SharedAuditPage() {
  const { token } = useParams();
  const [data, setData] = useState<ReportData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchSharedAudit(token ?? '').then((d) => {
      if (cancelled) return;
      setData(d);
      setState(d ? 'ready' : 'missing');
      if (d) document.title = `${d.business_name}: online presence audit`;
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-sm text-slate-600">This report link isn’t available any more. Ask whoever sent it for a new one.</p>
      </div>
    );
  }
  return <ReportShell data={data} />;
}
