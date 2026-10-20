import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ReportShell } from '@/components/prospects/ReportShell';
import { useLocationContext } from '@/context/LocationContext';
import { useAgency } from '@/lib/agency';
import { fetchSharedAudit, loadAudit, shareUrl, type ProspectAudit, type ReportBranding } from '@/lib/prospects';

/** /prospects/:id: the report as the agency sees it (same look as the share link). */
export function ProspectReportPage() {
  const { id } = useParams();
  const { organization, branding: businessBranding } = useLocationContext();
  const { agency } = useAgency();
  const [audit, setAudit] = useState<ProspectAudit | null>(null);
  const [sharedBranding, setSharedBranding] = useState<ReportBranding | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadAudit(id).then(async ({ audit: a }) => {
      if (cancelled) return;
      if (!a || a.status !== 'ready' || !a.result) {
        setState('missing');
        return;
      }
      setAudit(a);
      // Exactly what the prospect will see, when sharing is on
      if (a.share_enabled) {
        const shared = await fetchSharedAudit(a.share_token);
        if (!cancelled && shared?.branding) setSharedBranding(shared.branding);
      }
      if (!cancelled) setState('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;
  if (state === 'missing' || !audit?.result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-slate-600">This audit isn’t ready, or it was deleted.</p>
        <Link to="/prospects" className="btn-secondary text-sm"><ArrowLeft className="w-4 h-4" /> Prospects</Link>
      </div>
    );
  }

  const branding: ReportBranding = sharedBranding
    ?? (agency ? { name: agency.name, slug: agency.slug, logo_url: agency.logo_url, brand_color: agency.brand_color, support_email: agency.support_email } : null)
    ?? (businessBranding ? { name: businessBranding.name, slug: businessBranding.slug, logo_url: businessBranding.logo_url, brand_color: businessBranding.brand_color, support_email: businessBranding.support_email ?? null } : null)
    ?? { name: organization?.name ?? 'Online presence audit', slug: null, logo_url: null, brand_color: null, support_email: null };

  return (
    <ReportShell
      back
      shareLink={audit.share_enabled ? shareUrl(audit.share_token) : null}
      data={{ business_name: audit.business_name, address: audit.address, score: audit.score, grade: audit.grade, result: audit.result, created_at: audit.finished_at, branding }}
    />
  );
}
