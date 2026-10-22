import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { callFunction } from '@/lib/functions';
import type { EmailBlock, EmailContent } from '@/lib/emailRender';

/** Email campaigns (Phase C4, migration 045 + the email-campaigns function). */
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
export interface Audience {
  type: 'all' | 'tags';
  tags?: string[];
}
export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  subject: string;
  preheader: string;
  from_name: string;
  reply_to: string | null;
  content: EmailContent;
  audience: Audience;
  scheduled_at: string | null;
  started_at: string | null;
  sent_at: string | null;
  recipients: number;
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  created_at: string;
}
export interface CampaignRecipient {
  id: string;
  email: string;
  name: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'bounced' | 'complained' | 'cancelled';
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  unsubscribed_at: string | null;
}

export const STATUS_LABEL: Record<CampaignStatus, string> = { draft: 'Draft', scheduled: 'Scheduled', sending: 'Sending', sent: 'Sent', cancelled: 'Stopped' };
export const STATUS_TONE: Record<CampaignStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-sky-50 text-sky-700',
  sending: 'bg-amber-50 text-amber-700',
  sent: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
};
export const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');

const newId = () => Math.random().toString(36).slice(2, 10);
export const newBlock = (type: EmailBlock['type']): EmailBlock => ({
  id: newId(),
  type,
  ...(type === 'heading' ? { text: 'A short headline' } : {}),
  ...(type === 'text' ? { text: 'Hi {first_name},\n\nWrite your message here. Use **bold** and [links](https://example.com).' } : {}),
  ...(type === 'button' ? { label: 'Book now', url: 'https://' } : {}),
  ...(type === 'image' ? { src: '', alt: '' } : {}),
});

/** Ready-made starting points. */
export const TEMPLATES: { id: string; name: string; subject: string; blocks: Omit<EmailBlock, 'id'>[] }[] = [
  {
    id: 'offer',
    name: 'Special offer',
    subject: 'A little thank-you from {business}',
    blocks: [
      { type: 'heading', text: '20% off your next visit', align: 'center' },
      { type: 'text', text: 'Hi {first_name},\n\nThanks for being a customer of {business}. As a thank-you, here’s **20% off** your next booking this month.', align: 'center' },
      { type: 'button', label: 'Book now', url: 'https://', align: 'center' },
      { type: 'text', text: 'Offer ends on the last day of the month.', align: 'center' },
    ],
  },
  {
    id: 'news',
    name: 'Newsletter',
    subject: 'What’s new at {business}',
    blocks: [
      { type: 'heading', text: 'What’s new this month' },
      { type: 'text', text: 'Hi {first_name},\n\nHere’s a quick update from the team at {business}.' },
      { type: 'divider' },
      { type: 'heading', text: 'Our news' },
      { type: 'text', text: 'Tell your customers about a new service, a team member or a project you’re proud of.' },
      { type: 'button', label: 'Read more', url: 'https://' },
    ],
  },
  {
    id: 'reminder',
    name: 'Seasonal reminder',
    subject: 'Time for your next check-up, {first_name}?',
    blocks: [
      { type: 'heading', text: 'It’s that time of year again' },
      { type: 'text', text: 'Hi {first_name},\n\nIt’s a good time to book your next appointment with {business}. Spaces fill up fast this season.' },
      { type: 'button', label: 'Pick a time', url: 'https://' },
    ],
  },
  { id: 'blank', name: 'Blank', subject: '', blocks: [{ type: 'text', text: 'Hi {first_name},\n\n' }] },
];

const COLUMNS =
  'id, name, status, subject, preheader, from_name, reply_to, content, audience, scheduled_at, started_at, sent_at, recipients, sent, failed, delivered, opened, clicked, bounced, complained, unsubscribed, created_at';

export function useCampaigns() {
  const { location } = useLocationContext();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!location) return;
    const { data, error } = await supabase.from('email_campaigns').select(COLUMNS).eq('location_id', location.id).order('created_at', { ascending: false });
    setCampaigns((data as Campaign[]) ?? []);
    // Usually means migration 045 hasn't been run yet
    setError(error?.message ?? null);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (templateId: string, name: string, copyOf?: Campaign) => {
    if (!location) throw new Error('No business selected');
    const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
    const row = copyOf
      ? { name, subject: copyOf.subject, preheader: copyOf.preheader, from_name: copyOf.from_name, reply_to: copyOf.reply_to, content: copyOf.content, audience: copyOf.audience }
      : { name, subject: t.subject, content: { blocks: t.blocks.map((b) => ({ ...b, id: newId() })) } };
    const { data, error } = await supabase.from('email_campaigns').insert({ location_id: location.id, ...row }).select(COLUMNS).single();
    if (error) throw new Error(error.message);
    return data as Campaign;
  }, [location]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('email_campaigns').delete().eq('id', id);
    if (!error) setCampaigns((cs) => cs.filter((c) => c.id !== id));
    return error?.message ?? null;
  }, []);

  return { campaigns, loading, error, create, remove, reload: load };
}

export async function fetchCampaign(id: string) {
  const { data, error } = await supabase.from('email_campaigns').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Campaign | null;
}

export async function saveCampaign(c: Campaign) {
  const { name, subject, preheader, from_name, reply_to, content, audience } = c;
  const { data, error } = await supabase.from('email_campaigns')
    .update({ name, subject, preheader, from_name, reply_to: reply_to?.trim() || null, content, audience })
    .eq('id', c.id).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as Campaign;
}

export async function audienceCount(locationId: string, audience: Audience) {
  const { data, error } = await supabase.rpc('campaign_audience_count', { p_location: locationId, p_audience: audience });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Queues the campaign (sendAt null = now) and, when it's due now, starts sending straight away. */
export async function queueCampaign(id: string, sendAt: Date | null) {
  const { data, error } = await supabase.rpc('queue_campaign', { p_id: id, p_send_at: sendAt?.toISOString() ?? null });
  if (error) throw new Error(error.message);
  if (!sendAt) await callFunction('email-campaigns', { action: 'kick', campaignId: id }).catch(() => undefined);
  return data as { recipients: number; scheduled_at: string };
}

export async function cancelCampaign(id: string) {
  const { data, error } = await supabase.rpc('cancel_campaign', { p_id: id });
  if (error) throw new Error(error.message);
  return data as 'draft' | 'cancelled';
}

export const sendTestCampaign = (id: string) => callFunction<{ ok: boolean; to: string }>('email-campaigns', { action: 'send_test', campaignId: id });

export async function fetchRecipients(campaignId: string) {
  const { data, error } = await supabase.from('campaign_recipients')
    .select('id, email, name, status, error, sent_at, delivered_at, opened_at, clicked_at, unsubscribed_at')
    .eq('campaign_id', campaignId).order('created_at', { ascending: true }).limit(2000);
  if (error) throw new Error(error.message);
  return (data as CampaignRecipient[]) ?? [];
}

export async function campaignUsage(organizationId: string) {
  const { data } = await supabase.rpc('campaign_emails_this_month', { p_org: organizationId });
  return Number(data ?? 0);
}

export const campaignApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-campaigns`;
