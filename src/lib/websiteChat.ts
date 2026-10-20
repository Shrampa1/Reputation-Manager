import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** AI website chat (C1), migration 035 + the website-chat function + public/chat.js. */
export interface ChatSettings {
  enabled: boolean;
  greeting: string;
  accent: string;
  position: 'left' | 'right';
  business_info: string;
  collect_leads: boolean;
  updated_at?: string;
}
export interface ChatMessage { role: 'visitor' | 'assistant' | 'agent'; text: string; at: string; ai?: boolean; name?: string }
export interface ChatConversation {
  id: string;
  messages: ChatMessage[];
  visitor_messages: number;
  page_url: string | null;
  lead_id: string | null;
  lead: { customer_name: string; email: string | null; phone: string | null } | null;
  /** 'agent' while a team member is chatting (the AI stays quiet) */
  mode: 'ai' | 'agent';
  /** The visitor asked to talk to a person */
  needs_agent: boolean;
  seen_at: string | null;
  last_visitor_at: string | null;
  created_at: string;
  last_message_at: string;
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

/** Settings, recent conversations and this month's usage for the active business. */
export function useWebsiteChat() {
  const { location, organization } = useLocationContext();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!location || !organization) return;
    const [s, c, used, limit] = await Promise.all([
      supabase.from('chat_settings').select(COLUMNS).eq('location_id', location.id).maybeSingle(),
      supabase.from('chat_conversations')
        .select('id, messages, visitor_messages, page_url, lead_id, created_at, last_message_at, mode, needs_agent, seen_at, last_visitor_at, lead:leads(customer_name, email, phone)')
        .eq('location_id', location.id).order('last_message_at', { ascending: false }).limit(50),
      supabase.rpc('chat_messages_used', { p_org: organization.id }),
      supabase.rpc('plan_limit', { p_org: organization.id, p_key: 'chat_messages' }),
    ]);
    setSettings((s.data as ChatSettings | null) ?? DEFAULT_CHAT);
    setConversations((c.data as unknown as ChatConversation[]) ?? []);
    setUsage(used.error || limit.error ? null : { used: Number(used.data), limit: Number(limit.data) });
    setLoading(false);
  }, [location, organization]);

  useEffect(() => {
    load();
    // New visitor messages and team replies show up without reloading the page
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 8000);
    return () => clearInterval(timer);
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

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('chat_conversations').delete().eq('id', id);
    if (!error) setConversations((cs) => cs.filter((c) => c.id !== id));
    return error?.message ?? null;
  }, []);

  const update = useCallback((row: Partial<ChatConversation> & { id: string }) => {
    setConversations((cs) => cs.map((c) => (c.id === row.id ? { ...c, ...row, lead: c.lead } : c)));
  }, []);

  return { settings, conversations, usage, loading, save, remove, update, reload: load };
}

export const chatApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/website-chat`;

/** The HTML a business pastes into their website, just before </body>. */
export function chatSnippet(publicKey: string) {
  return `<script src="${window.location.origin}/chat.js" data-key="${publicKey}" data-api="${chatApi()}" async></script>`;
}

/** Starting text for "About your business", from what the app already knows. */
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

/** True when the visitor wrote something the team hasn't looked at yet. */
export const isUnread = (c: ChatConversation) => Boolean(c.last_visitor_at && (!c.seen_at || c.last_visitor_at > c.seen_at));

/** Reply as a team member; the AI stops answering in this conversation until it's handed back. */
export async function agentReply(conversationId: string, text: string) {
  const { data, error } = await supabase.rpc('chat_agent_reply', { p_conversation: conversationId, p_text: text });
  if (error) throw new Error(error.message);
  return data as ChatConversation;
}

/** 'agent': take over without replying yet; 'ai': hand back to the assistant. */
export async function setChatMode(conversationId: string, mode: 'ai' | 'agent') {
  const { data, error } = await supabase.rpc('chat_set_mode', { p_conversation: conversationId, p_mode: mode });
  if (error) throw new Error(error.message);
  return data as ChatConversation;
}

export const markChatSeen = (conversationId: string) => supabase.rpc('chat_mark_seen', { p_conversation: conversationId });
