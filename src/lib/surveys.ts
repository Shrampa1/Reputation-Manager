import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { callFunction } from '@/lib/functions';

/** Customer surveys / NPS (Phase C3, migration 044 + the surveys function). */
export interface SurveySettings {
  subject?: string;
  intro?: string;
  question?: string;
  comment_question?: string;
  thanks_promoter?: string;
  thanks_passive?: string;
  thanks_detractor?: string;
  ask_review?: boolean;
  alert_emails?: string[];
  auto_lead_completed?: boolean;
  auto_delay_days?: number;
  accent?: string;
}
export interface Survey {
  id: string;
  name: string;
  status: 'active' | 'paused';
  public_key: string;
  settings: SurveySettings;
  created_at: string;
}
export type Category = 'promoter' | 'passive' | 'detractor';
export type FollowUp = 'open' | 'contacted' | 'resolved';
export interface SurveyResponse {
  id: string;
  survey_id: string;
  lead_id: string | null;
  name: string;
  email: string | null;
  channel: 'email' | 'auto' | 'link';
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';
  send_after: string | null;
  error: string | null;
  score: number | null;
  comment: string | null;
  category: Category | null;
  answered_at: string | null;
  review_clicked_at: string | null;
  follow_up: FollowUp | null;
  follow_up_note: string | null;
  follow_up_at: string | null;
  created_at: string;
}
export interface NpsNumbers {
  emailed: number;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number | null;
  response_rate: number | null;
}
export interface NpsStats {
  overall: NpsNumbers;
  surveys: Record<string, NpsNumbers>;
  months: { month: string; responses: number; nps: number }[];
  open_follow_ups: number;
}

/** The texts customers see when a survey doesn't set its own (same as the surveys function). */
export const SURVEY_DEFAULTS = {
  subject: 'Quick question about {business}',
  intro: 'Thanks for choosing {business}. Could you answer one quick question? It takes a few seconds.',
  question: 'How likely are you to recommend {business} to a friend or colleague?',
  comment_question: 'What’s the main reason for your score?',
  thanks_promoter: 'Thank you! We’re so glad you had a great experience.',
  thanks_passive: 'Thank you for your feedback. We’ll use it to do even better.',
  thanks_detractor: 'Thank you for being honest. We’re sorry we let you down, and someone from our team will be in touch.',
};

export const categoryOf = (score: number): Category => (score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor');
export const CATEGORY_LABEL: Record<Category, string> = { promoter: 'Promoter', passive: 'Passive', detractor: 'Detractor' };
export const CATEGORY_TONE: Record<Category, string> = {
  promoter: 'bg-emerald-50 text-emerald-700',
  passive: 'bg-amber-50 text-amber-700',
  detractor: 'bg-rose-50 text-rose-700',
};
/** NPS runs from -100 to 100; above 0 is good, above 50 excellent. */
export const npsTone = (n: number | null) => (n === null ? 'text-slate-400' : n >= 50 ? 'text-emerald-600' : n >= 0 ? 'text-amber-600' : 'text-rose-600');

const COLUMNS = 'id, name, status, public_key, settings, created_at';
const RESPONSE_COLUMNS =
  'id, survey_id, lead_id, name, email, channel, status, send_after, error, score, comment, category, answered_at, review_clicked_at, follow_up, follow_up_note, follow_up_at, created_at';

export function useSurveys() {
  const { location } = useLocationContext();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<NpsStats | null>(null);
  const [days, setDays] = useState<number | null>(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!location) return;
    const [list, st] = await Promise.all([
      supabase.from('surveys').select(COLUMNS).eq('location_id', location.id).order('created_at', { ascending: true }),
      supabase.rpc('nps_stats', { p_location: location.id, p_days: days }),
    ]);
    setSurveys((list.data as Survey[]) ?? []);
    setStats((st.data as NpsStats) ?? null);
    // Usually means migration 044 hasn't been run yet
    setError(list.error?.message ?? st.error?.message ?? null);
    setLoading(false);
  }, [location, days]);
  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (name: string) => {
    if (!location) throw new Error('No business selected');
    const { data, error } = await supabase.from('surveys')
      .insert({ location_id: location.id, name: name.trim() || 'Customer survey', settings: { ask_review: true } })
      .select(COLUMNS).single();
    if (error) throw new Error(error.message);
    return data as Survey;
  }, [location]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('surveys').delete().eq('id', id);
    if (!error) setSurveys((s) => s.filter((x) => x.id !== id));
    return error?.message ?? null;
  }, []);

  return { surveys, stats, days, setDays, loading, error, create, remove, reload: load };
}

export async function fetchSurvey(id: string) {
  const { data, error } = await supabase.from('surveys').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Survey | null;
}

export async function saveSurvey(s: Survey) {
  const { data, error } = await supabase.from('surveys').update({ name: s.name, status: s.status, settings: s.settings }).eq('id', s.id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as Survey;
}

export async function fetchResponses(surveyId: string) {
  const { data, error } = await supabase.from('survey_responses').select(RESPONSE_COLUMNS)
    .eq('survey_id', surveyId).order('created_at', { ascending: false }).limit(2000);
  if (error) throw new Error(error.message);
  return (data as SurveyResponse[]) ?? [];
}

export async function setFollowUp(id: string, status: FollowUp | null, note?: string) {
  const { data, error } = await supabase.rpc('survey_follow_up', { p_id: id, p_status: status, p_note: note ?? null });
  if (error) throw new Error(error.message);
  return data as Pick<SurveyResponse, 'id' | 'follow_up' | 'follow_up_note' | 'follow_up_at'>;
}

export const deleteResponse = (id: string) => supabase.from('survey_responses').delete().eq('id', id);

export type SurveySkipReason = 'invalid' | 'duplicate' | 'recent' | 'unsubscribed' | 'limit';
export interface SurveySendResult {
  sent: number;
  failed: number;
  skipped: { name: string; email: string; reason: SurveySkipReason }[];
  error?: string;
}
export const SKIP_LABEL: Record<SurveySkipReason, string> = {
  invalid: 'not a valid email',
  duplicate: 'listed twice',
  recent: 'asked in the last 30 days',
  unsubscribed: 'unsubscribed',
  limit: 'over your limit',
};

/** Sends in batches of 50 (the function's maximum). */
export async function sendSurvey(surveyId: string, recipients: { name: string; email: string; leadId?: string }[], onProgress?: (done: number) => void) {
  const total: SurveySendResult = { sent: 0, failed: 0, skipped: [] };
  for (let i = 0; i < recipients.length; i += 50) {
    const r = await callFunction<SurveySendResult>('surveys', { action: 'send', surveyId, recipients: recipients.slice(i, i + 50) });
    total.sent += r.sent;
    total.failed += r.failed;
    total.skipped.push(...r.skipped);
    if (r.error) total.error = r.error;
    onProgress?.(Math.min(i + 50, recipients.length));
  }
  return total;
}

export const surveyApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/surveys`;
export const publicSurveyUrl = (key: string) => `${window.location.origin}/nps/l/${key}`;

/** Calls the surveys function without signing in (customer pages). */
export async function surveyPublic<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(surveyApi(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.');
  return data as T;
}

/** CSV of responses (spreadsheet formulas neutralised). */
export function responsesCsv(rows: SurveyResponse[]) {
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ['Sent', 'Name', 'Email', 'Score', 'Category', 'Comment', 'Answered', 'Follow-up', 'Note'];
  const lines = rows.map((r) => [
    r.created_at.slice(0, 10), r.name, r.email ?? '', r.score ?? '', r.category ?? '', r.comment ?? '',
    r.answered_at?.slice(0, 10) ?? '', r.follow_up ?? '', r.follow_up_note ?? '',
  ].map(cell).join(','));
  return [head.join(','), ...lines].join('\n');
}
