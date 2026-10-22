import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Live chat settings (migration 035) + the website-chat function + public/chat.js. Inbox: lib/liveChat.ts. */
export interface ChatSettings {
  enabled: boolean;
  greeting: string;
  accent: string;
  position: 'left' | 'right';
  business_info: string;
  collect_leads: boolean;
  updated_at?: string;
}

export const DEFAULT_CHAT: ChatSettings = {
  enabled: false,
  greeting: 'Hi! Ask me anything about us.',
  accent: '#0284c7',
  position: 'right',
  business_info: '',
  collect_leads: true,
};
export const MAX_INFO = 8000;

const COLUMNS = 'enabled, greeting, accent, position, business_info, collect_leads, updated_at';

/** Settings and this month's AI usage for the active business. */
export function useWebsiteChat() {
  const { location, organization } = useLocationContext();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location || !organization) return;
    const [s, used, limit] = await Promise.all([
      supabase.from('chat_settings').select(COLUMNS).eq('location_id', location.id).maybeSingle(),
      supabase.rpc('chat_messages_used', { p_org: organization.id }),
      supabase.rpc('plan_limit', { p_org: organization.id, p_key: 'chat_messages' }),
    ]);
    setSettings((s.data as ChatSettings | null) ?? DEFAULT_CHAT);
    setUsage(used.error || limit.error ? null : { used: Number(used.data), limit: Number(limit.data) });
    // Usually means migration 035 hasn't been run yet
    setLoadError(s.error?.message ?? null);
    setLoading(false);
  }, [location, organization]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (values: ChatSettings) => {
    if (!location) return 'No business selected';
    const { enabled, greeting, accent, position, business_info, collect_leads } = values;
    const { data, error } = await supabase.from('chat_settings')
      .upsert({ location_id: location.id, enabled, greeting, accent, position, business_info, collect_leads })
      .select(COLUMNS).single();
    if (error) return error.message;
    setSettings(data as ChatSettings);
    return null;
  }, [location]);

  return { settings, usage, loading, loadError, save, reload: load };
}

export const chatApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/website-chat`;

/** The HTML a business pastes into their website, just before </body>. */
export function chatSnippet(publicKey: string) {
  return `<script src="${window.location.origin}/chat.js" data-key="${publicKey}" data-api="${chatApi()}" async></script>`;
}

/** Starting text for "About your business". */
export function draftBusinessInfo(name: string) {
  return [
    `${name} is …(what you do, in one sentence).`,
    '',
    'Services and prices:',
    '- …',
    '',
    'Opening hours:',
    '- Mon–Fri …',
    '',
    'Areas we serve: …',
    '',
    'How to book: …',
    '',
    'Common questions:',
    '- Q: … A: …',
  ].join('\n');
}
