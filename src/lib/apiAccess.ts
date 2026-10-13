import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Base URL of the public API (the `api` edge function). */
export const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

export const WEBHOOK_EVENTS = [
  { id: 'review.created', label: 'New review', hint: 'A review arrives in your inbox (Google sync or added by hand)' },
  { id: 'review_request.rated', label: 'Customer rated', hint: 'A customer picked a star rating from your request or QR code' },
  { id: 'feedback.received', label: 'Private feedback', hint: 'An unhappy customer left private feedback' },
  { id: 'review_request.clicked', label: 'Went to review page', hint: 'A customer clicked through to your Google review page' },
  { id: 'review_request.sent', label: 'Request sent', hint: 'A review request email went out' },
  { id: 'lead.created', label: 'New lead', hint: 'A lead was added' },
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]['id'];

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  description: string;
  secret: string;
  active: boolean;
  source: 'app' | 'api';
  failure_count: number;
  last_success_at: string | null;
  last_delivery_at: string | null;
  last_error: string | null;
  disabled_reason: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  response_status: number | null;
  last_error: string | null;
  next_attempt_at: string;
  delivered_at: string | null;
  created_at: string;
  webhook_events: { type: string } | null;
}

const ENDPOINT_COLUMNS =
  'id, url, events, description, secret, active, source, failure_count, last_success_at, last_delivery_at, last_error, disabled_reason, created_at';

/** API keys, webhooks and recent deliveries for the active business (owners/admins with Manage integrations). */
export function useApiAccess() {
  const { organization } = useLocationContext();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [k, e, d] = await Promise.all([
      supabase.from('api_keys').select('id, name, prefix, created_at, last_used_at, revoked_at')
        .eq('organization_id', organization.id).order('created_at', { ascending: false }),
      supabase.from('webhook_endpoints').select(ENDPOINT_COLUMNS)
        .eq('organization_id', organization.id).order('created_at', { ascending: true }),
      supabase.from('webhook_deliveries')
        .select('id, endpoint_id, status, attempts, response_status, last_error, next_attempt_at, delivered_at, created_at, webhook_events(type)')
        .eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(15),
    ]);
    setKeys((k.data as ApiKey[]) ?? []);
    setEndpoints((e.data as WebhookEndpoint[]) ?? []);
    setDeliveries((d.data as unknown as WebhookDelivery[]) ?? []);
    const err = k.error ?? e.error ?? d.error;
    setError(err ? `Couldn't load API settings: ${err.message}` : null);
    setLoading(false);
  }, [organization]);

  useEffect(() => {
    load();
  }, [load]);

  return { keys, endpoints, deliveries, loading, error, reload: load };
}

const message = (error: { message: string } | null) => error?.message ?? null;

export async function createApiKey(organizationId: string, name: string) {
  const { data, error } = await supabase.rpc('create_api_key', { p_org: organizationId, p_name: name });
  return { key: (data as { id: string; key: string; prefix: string } | null) ?? null, error: message(error) };
}

export async function revokeApiKey(id: string) {
  const { error } = await supabase.rpc('revoke_api_key', { p_id: id });
  return { error: message(error) };
}

export async function addWebhook(organizationId: string, input: { url: string; events: WebhookEvent[]; description: string }) {
  const { error } = await supabase.from('webhook_endpoints').insert({ organization_id: organizationId, ...input });
  return { error: error ? friendlyWebhookError(error.message) : null };
}

export async function updateWebhook(id: string, patch: Partial<Pick<WebhookEndpoint, 'url' | 'events' | 'description' | 'active'>>) {
  const { error } = await supabase.from('webhook_endpoints').update(patch).eq('id', id);
  return { error: error ? friendlyWebhookError(error.message) : null };
}

export async function deleteWebhook(id: string) {
  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id);
  return { error: message(error) };
}

export async function sendTestWebhook(id: string) {
  const { error } = await supabase.rpc('send_test_webhook', { p_id: id });
  return { error: message(error) };
}

export async function rotateWebhookSecret(id: string) {
  const { data, error } = await supabase.rpc('rotate_webhook_secret', { p_id: id });
  return { secret: (data as string | null) ?? null, error: message(error) };
}

function friendlyWebhookError(raw: string) {
  if (raw.includes('webhook_endpoints_url_check')) return 'Use a full https:// address (up to 500 characters).';
  if (raw.includes('webhook_endpoints_events_check')) return 'Pick at least one event.';
  return raw;
}

/** Short, readable host for a webhook URL. */
export function urlHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
