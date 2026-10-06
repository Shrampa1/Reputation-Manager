import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';
import type { PageSpeedResult, WebsiteAudit } from '@/types';

const COLUMNS =
  'id, location_id, url, final_url, status, error, overall_score, scores, results, recommendations, is_ecommerce, platform, created_by, created_at';

export async function runWebsiteAudit(url: string, ecommerce: boolean | null): Promise<WebsiteAudit> {
  const { audit } = await callFunction<{ audit: WebsiteAudit }>('website-audit', {
    action: 'audit',
    url,
    ...(ecommerce === null ? {} : { ecommerce }),
  });
  return audit;
}

export async function getFixPlan(auditId: string): Promise<WebsiteAudit> {
  const { audit } = await callFunction<{ audit: WebsiteAudit }>('website-audit', { action: 'recommend', auditId });
  return audit;
}

/** Recent audits for the current business, newest first. */
export function useWebsiteAudits(limit = 20) {
  const { location, loading: locationLoading } = useLocationContext();
  const [audits, setAudits] = useState<WebsiteAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudits = useCallback(async () => {
    if (!location) {
      setAudits([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from('website_audits')
      .select(COLUMNS)
      .eq('location_id', location.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    setError(loadError ? `Couldn't load past audits: ${loadError.message}` : null);
    if (!loadError) setAudits((data as WebsiteAudit[]) ?? []);
    setLoading(false);
  }, [location, locationLoading, limit]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  /** Put a fresh or updated audit at the top without refetching */
  const upsertLocal = useCallback((audit: WebsiteAudit) => {
    setAudits((prev) => [audit, ...prev.filter((a) => a.id !== audit.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }, []);

  return { audits, loading: loading || locationLoading, error, refetch: fetchAudits, upsertLocal };
}

export function isPageSpeed(r: PageSpeedResult | { error: string } | undefined): r is PageSpeedResult {
  return Boolean(r && !('error' in r));
}

export function scoreTone(score: number | null | undefined): { text: string; ring: string; bg: string; label: string } {
  if (score === null || score === undefined) return { text: 'text-slate-400', ring: 'stroke-slate-200', bg: 'bg-slate-50', label: 'n/a' };
  if (score >= 90) return { text: 'text-emerald-600', ring: 'stroke-emerald-500', bg: 'bg-emerald-50', label: 'Good' };
  if (score >= 50) return { text: 'text-amber-600', ring: 'stroke-amber-500', bg: 'bg-amber-50', label: 'Needs work' };
  return { text: 'text-rose-600', ring: 'stroke-rose-500', bg: 'bg-rose-50', label: 'Poor' };
}
