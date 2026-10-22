import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';

/** Conversation AI hub (Live chat W5, migration 042): one AI agent for every channel. */
export type AgentChannel = 'web_chat' | 'messenger' | 'instagram';
export interface AgentConfig {
  name?: string;
  tone?: 'friendly' | 'professional' | 'casual';
  instructions?: string;
  /** Where the AI answers. Website chat is on unless switched off; Messenger and Instagram are opt-in. */
  channels?: Partial<Record<AgentChannel, boolean>>;
  /** "Summarize" and "Suggest a reply" for the team in the Inbox */
  assist?: boolean;
}
export const DEFAULT_AGENT: AgentConfig = { name: '', tone: 'friendly', instructions: '', channels: { web_chat: true, messenger: false, instagram: false }, assist: true };
export const MAX_INSTRUCTIONS = 2000;

export const CHANNELS: { id: AgentChannel; label: string }[] = [
  { id: 'web_chat', label: 'Website chat' },
  { id: 'messenger', label: 'Facebook Messenger' },
  { id: 'instagram', label: 'Instagram Direct' },
];
export const channelLabel = (c: string) => CHANNELS.find((x) => x.id === c)?.label ?? (c === 'web_call' ? 'Web call' : c);

export function useAiAgent() {
  const { location } = useLocationContext();
  const [agent, setAgent] = useState<AgentConfig>(DEFAULT_AGENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const { data, error } = await supabase.from('chat_settings').select('agent').eq('location_id', location.id).maybeSingle();
    const saved = ((data as { agent?: AgentConfig } | null)?.agent ?? {}) as AgentConfig;
    setAgent({ ...DEFAULT_AGENT, ...saved, channels: { ...DEFAULT_AGENT.channels, ...saved.channels } });
    // Usually means migration 042 hasn't been run yet
    setError(error?.message ?? null);
    setLoading(false);
  }, [location]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (values: AgentConfig) => {
    if (!location) return 'No business selected';
    const clean: AgentConfig = {
      ...values,
      name: values.name?.trim().slice(0, 40) ?? '',
      instructions: values.instructions?.trim().slice(0, MAX_INSTRUCTIONS) ?? '',
    };
    // Creates the chat settings row with its defaults if the chat was never set up
    const { data: existing } = await supabase.from('chat_settings').select('location_id').eq('location_id', location.id).maybeSingle();
    const { error } = existing
      ? await supabase.from('chat_settings').update({ agent: clean }).eq('location_id', location.id)
      : await supabase.from('chat_settings').insert({ location_id: location.id, agent: clean });
    if (error) return error.message;
    setAgent(clean);
    return null;
  }, [location]);

  return { agent, loading, error, save };
}

// ---------- Messenger / Instagram (meta-inbox function) ----------
export interface MetaStatus {
  facebook: { connected: boolean; name: string | null; messaging: boolean } | null;
  instagram: { connected: boolean; name: string | null } | null;
  webhookUrl: string;
  secrets: { appSecret: boolean; verifyToken: boolean };
}
export const fetchMetaStatus = () => callFunction<MetaStatus>('meta-inbox', { action: 'status' });
export const connectMetaMessages = () => callFunction<MetaStatus>('meta-inbox', { action: 'connect' });
/** Sends queued team replies to Messenger/Instagram right away (a timer also does it every minute). */
export const flushChannelOutbox = () => callFunction<{ sent: number; failed: number }>('meta-inbox', { action: 'flush' }).catch(() => null);

// ---------- the team's AI assistant ----------
export const assistConversation = (conversationId: string, kind: 'summary' | 'reply') =>
  callFunction<{ text: string }>('website-chat', { action: 'agent_assist', conversation: conversationId, kind });
