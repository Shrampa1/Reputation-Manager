import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';

/** Prospect audits (agency suite A1, migration 028 + the prospect-audit function). */
export interface GoogleFacts {
  available: true;
  name: string;
  address: string | null;
  rating: number | null;
  review_count: number;
  maps_url: string | null;
  category: string | null;
  phone: string | null;
  has_hours: boolean;
  photo_count: number;
  has_description: boolean;
  website: string | null;
}
export type SocialKey = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x';

export interface AuditResult {
  google: GoogleFacts | { available: false; reason: string };
  competitors: { name: string; rating: number | null; review_count: number; maps_url: string | null }[];
  competitor_avg_rating: number | null;
  competitor_median_reviews: number | null;
  website: {
    url: string;
    score: number | null;
    mobile_performance: number | null;
    issues: { title: string; detail: string; status: string }[];
    error: string | null;
  } | null;
  social: Record<SocialKey, string | null> | null;
  sections: Record<'reputation' | 'listing' | 'website' | 'social', number | null>;
  opportunities: { area: string; impact: 'high' | 'medium' | 'low'; title: string; detail: string }[];
  summary: string;
  summary_by_ai: boolean;
}

export interface ProspectAudit {
  id: string;
  business_name: string;
  place_id: string | null;
  website: string | null;
  address: string | null;
  status: 'running' | 'ready' | 'failed';
  score: number | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  result: AuditResult | null;
  error: string | null;
  share_token: string;
  share_enabled: boolean;
  lead_id: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface ReportBranding {
  name: string;
  slug: string | null;
  logo_url: string | null;
  brand_color: string | null;
  support_email: string | null;
}

/** What the report component needs, from the app or the public share link. */
export interface ReportData {
  business_name: string;
  address: string | null;
  score: number | null;
  grade: string | null;
  result: AuditResult;
  created_at: string | null;
  branding: ReportBranding | null;
}

export interface PlaceMatch {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number;
  website: string | null;
}

export const SECTION_LABELS = { reputation: 'Reviews & rating', listing: 'Google listing', website: 'Website', social: 'Social media' } as const;
export const SECTION_MAX = { reputation: 35, listing: 20, website: 30, social: 15 } as const;
export const SOCIAL_LABELS: Record<SocialKey, string> = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn', x: 'X (Twitter)',
};

const COLUMNS =
  'id, business_name, place_id, website, address, status, score, grade, result, error, share_token, share_enabled, lead_id, created_at, finished_at';

export const shareUrl = (token: string) => `${window.location.origin}/a/${token}`;

export function gradeColor(grade: string | null) {
  switch (grade) {
    case 'A': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'B': return 'text-lime-700 bg-lime-50 border-lime-200';
    case 'C': return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'D': return 'text-orange-700 bg-orange-50 border-orange-200';
    default: return 'text-rose-700 bg-rose-50 border-rose-200';
  }
}

/** The business's audits, newest first. Polls every 5 s while any audit is still running. */
export function useProspectAudits() {
  const { organization } = useLocationContext();
  const [audits, setAudits] = useState<ProspectAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const { data, error: err } = await supabase.from('prospect_audits').select(COLUMNS)
      .eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(100);
    setAudits((data as ProspectAudit[]) ?? []);
    setError(err ? `Couldn't load audits: ${err.message}` : null);
    setLoading(false);
  }, [organization]);

  useEffect(() => {
    load();
  }, [load]);

  const running = audits.some((a) => a.status === 'running');
  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(load, 5000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [running, load]);

  return { audits, loading, error, reload: load };
}

export async function loadAudit(id: string) {
  const { data, error } = await supabase.from('prospect_audits').select(COLUMNS).eq('id', id).maybeSingle();
  return { audit: (data as ProspectAudit | null) ?? null, error: error?.message ?? null };
}

export const searchProspects = (query: string) =>
  callFunction<{ places: PlaceMatch[] }>('prospect-audit', { action: 'search', query });

export const startAudit = (input: { placeId?: string; website?: string; name?: string; saveLead: boolean }) =>
  callFunction<{ audit: ProspectAudit }>('prospect-audit', { action: 'run', ...input });

export async function setAuditSharing(id: string, enabled: boolean) {
  const { error } = await supabase.from('prospect_audits').update({ share_enabled: enabled }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteAudit(id: string) {
  const { error } = await supabase.from('prospect_audits').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchSharedAudit(token: string): Promise<ReportData | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { data, error } = await supabase.rpc('get_shared_audit', { p_token: token });
  if (error || !data) return null;
  return data as ReportData;
}
