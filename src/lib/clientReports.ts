import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';

/** Scheduled client reports (A2) and agency alerts + health (A5), migration 034. */
export type ReportSection = 'reviews' | 'requests' | 'google' | 'social' | 'rankings' | 'issues';
export const REPORT_SECTIONS: { id: ReportSection; label: string }[] = [
  { id: 'reviews', label: 'Reviews (new, average, best quotes)' },
  { id: 'google', label: 'Google rating' },
  { id: 'requests', label: 'Review requests' },
  { id: 'social', label: 'Social posts published' },
  { id: 'rankings', label: 'Local rankings' },
  { id: 'issues', label: 'Customer issues followed up' },
];

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'weekly' | 'monthly';
  recipients: string[];
  sections: ReportSection[];
  note: string | null;
  last_sent_at?: string | null;
  last_error?: string | null;
}
export interface ReportDelivery { id: string; frequency: string; period_start: string; period_end: string; recipients: string[]; status: 'sent' | 'failed' | 'test'; error: string | null; created_at: string }

export const DEFAULT_SCHEDULE: ReportSchedule = { enabled: true, frequency: 'monthly', recipients: [], sections: ['reviews', 'google', 'requests', 'social', 'rankings', 'issues'], note: null };

export function useReportSchedule() {
  const { organization } = useLocationContext();
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [deliveries, setDeliveries] = useState<ReportDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!organization) return;
    const [s, d] = await Promise.all([
      supabase.from('report_schedules').select('enabled, frequency, recipients, sections, note, last_sent_at, last_error').eq('organization_id', organization.id).maybeSingle(),
      supabase.from('report_deliveries').select('id, frequency, period_start, period_end, recipients, status, error, created_at').eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(12),
    ]);
    setSchedule((s.data as ReportSchedule | null) ?? null);
    setDeliveries((d.data as ReportDelivery[]) ?? []);
    setLoading(false);
  }, [organization]);
  useEffect(() => {
    load();
  }, [load]);
  return { schedule, deliveries, loading, reload: load };
}

export async function saveReportSchedule(organizationId: string, s: ReportSchedule) {
  const { error } = await supabase.from('report_schedules').upsert({
    organization_id: organizationId, enabled: s.enabled, frequency: s.frequency, recipients: s.recipients, sections: s.sections, note: s.note?.trim() || null,
  }, { onConflict: 'organization_id' });
  return { error: error?.message ?? null };
}

export const previewReport = (s: Pick<ReportSchedule, 'frequency' | 'sections' | 'note'>) =>
  callFunction<{ subject: string; html: string }>('client-reports', { action: 'preview', schedule: s });
export const sendTestReport = () => callFunction<{ sent_to: string }>('client-reports', { action: 'send_test' });

/** "a@x.com, b@y.com" → tidy list; returns the first invalid entry too. */
export function parseEmails(raw: string) {
  const list = [...new Set(raw.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const bad = list.find((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) ?? null;
  return { list, bad };
}

// ================================================================ A5
export interface BusinessHealth {
  organization_id: string;
  name: string;
  role: string;
  plan: string | null;
  linked: boolean;
  google_rating: number | null;
  avg_rating_30d: number | null;
  avg_rating_prev_30d: number | null;
  reviews_30d: number;
  negative_7d: number;
  unreplied: number;
  pending_approvals: number;
  open_issues: number;
  broken_connections: number;
  requests_30d: number;
  responses_30d: number;
  last_review_at: string | null;
  needs_attention: boolean;
  reasons: string[];
}

export function useAgencyHealth() {
  const [rows, setRows] = useState<BusinessHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_agency_health');
    setRows(((data ?? []) as BusinessHealth[]).map((r) => ({
      ...r,
      google_rating: r.google_rating === null ? null : Number(r.google_rating),
      avg_rating_30d: r.avg_rating_30d === null ? null : Number(r.avg_rating_30d),
      avg_rating_prev_30d: r.avg_rating_prev_30d === null ? null : Number(r.avg_rating_prev_30d),
    })));
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { rows, loading, reload: load };
}

export interface AlertSettings { email: string; negative_reviews: boolean; max_rating: number; daily_digest: boolean }

export function useAlertSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('agency_alert_settings').select('email, negative_reviews, max_rating, daily_digest').eq('user_id', user.id).maybeSingle();
    setSettings((data as AlertSettings | null) ?? null);
    setLoaded(true);
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);
  return { settings, loaded, reload: load };
}

export async function saveAlertSettings(userId: string, s: AlertSettings | null) {
  const { error } = s
    ? await supabase.from('agency_alert_settings').upsert({ user_id: userId, ...s }, { onConflict: 'user_id' })
    : await supabase.from('agency_alert_settings').delete().eq('user_id', userId);
  return { error: error ? (error.message.includes('check') ? 'Enter a valid email address.' : error.message) : null };
}
