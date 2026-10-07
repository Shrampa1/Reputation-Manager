import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';
import type { AuditCheckStatus, WebsiteAudit } from '@/types';

export interface WebsiteSummary {
  final_url: string;
  overall_score: number | null;
  scores: Partial<Record<string, number | null>>;
  platform: string | null;
  is_ecommerce: boolean;
  checks: Record<string, AuditCheckStatus>;
  word_count: number | null;
  response_ms: number | null;
  internal_links: number | null;
  broken_links: number | null;
  cwv: string | null;
}

export interface Competitor {
  id: string;
  location_id: string;
  name: string;
  website: string | null;
  place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_maps_url: string | null;
  address: string | null;
  website_summary: WebsiteSummary | null;
  website_error: string | null;
  refreshed_at: string | null;
  created_at: string;
}

const COLUMNS =
  'id, location_id, name, website, place_id, google_rating, google_review_count, google_maps_url, address, website_summary, website_error, refreshed_at, created_at';

export function useCompetitors() {
  const { location, loading: locationLoading } = useLocationContext();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!location) {
      setCompetitors([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    const { data } = await supabase.from('competitors').select(COLUMNS).eq('location_id', location.id).order('created_at');
    setCompetitors((data as Competitor[]) ?? []);
    setLoading(false);
  }, [location, locationLoading]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const upsertLocal = useCallback((c: Competitor) => {
    setCompetitors((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
  }, []);

  const removeLocal = useCallback((id: string) => setCompetitors((prev) => prev.filter((x) => x.id !== id)), []);

  return { competitors, loading: loading || locationLoading, refetch: fetchAll, upsertLocal, removeLocal };
}

export const addCompetitor = (input: { name?: string; website?: string; placeId?: string }) =>
  callFunction<{ competitor: Competitor; warning?: string }>('competitors', { action: 'add', ...input });

export const refreshCompetitor = (id: string) => callFunction<{ competitor: Competitor }>('competitors', { action: 'refresh', id });

export async function removeCompetitor(id: string) {
  const { error } = await supabase.from('competitors').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Same shape as a competitor's summary, built from the business's own latest audit. */
export function summarizeOwnAudit(audit: WebsiteAudit | null): WebsiteSummary | null {
  if (!audit || audit.status !== 'complete') return null;
  const mobile = audit.results.pagespeed?.mobile;
  return {
    final_url: audit.final_url ?? audit.url,
    overall_score: audit.overall_score,
    scores: audit.scores,
    platform: audit.platform,
    is_ecommerce: audit.is_ecommerce,
    checks: Object.fromEntries((audit.results.checks ?? []).map((c) => [c.id, c.status])),
    word_count: audit.results.page?.wordCount ?? null,
    response_ms: audit.results.page?.responseMs ?? null,
    internal_links: audit.results.links?.internal ?? null,
    broken_links: audit.results.links?.broken.length ?? null,
    cwv: mobile && !('error' in mobile) ? mobile.field.overall : null,
  };
}
