import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Live chat inbox (Phase W1, migration 037): conversations, messages, team actions, visitors online. */
export type Sender = 'visitor' | 'ai' | 'agent' | 'system' | 'note';
export interface LiveMessage {
  id: number;
  conversation_id: string;
  sender: Sender;
  author_id: string | null;
  author_name: string | null;
  body: string;
  meta: { auto?: boolean; ended?: boolean } & Record<string, unknown>;
  created_at: string;
}
export interface VisitorInfo {
  browser?: string;
  os?: string;
  device?: string;
  language?: string;
  timezone?: string;
  referrer?: string;
}
export interface InboxConversation {
  id: string;
  visitor_id: string;
  channel: string;
  status: 'open' | 'resolved';
  mode: 'ai' | 'agent';
  needs_agent: boolean;
  assigned_to: string | null;
  tags: string[];
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_phone: string | null;
  visitor_info: VisitorInfo;
  current_page: string | null;
  page_url: string | null;
  lead_id: string | null;
  rating: number | null;
  rating_comment: string | null;
  visitor_messages: number;
  created_at: string;
  last_message_at: string;
  last_message_preview: string | null;
  last_message_sender: Sender | null;
  last_visitor_at: string | null;
  seen_at: string | null;
  visitor_typing_at: string | null;
}
export interface OnlineVisitor {
  visitor_id: string;
  first_seen_at: string;
  last_seen_at: string;
  current_page: string | null;
  page_title: string | null;
  pages_viewed: number;
  visits: number;
  info: VisitorInfo;
}
export interface CannedResponse { id: string; shortcut: string; body: string }

const INBOX_COLUMNS = 'id, visitor_id, channel, status, mode, needs_agent, assigned_to, tags, visitor_name, visitor_email, visitor_phone, visitor_info, current_page, page_url, lead_id, rating, rating_comment, visitor_messages, created_at, last_message_at, last_message_preview, last_message_sender, last_visitor_at, seen_at, visitor_typing_at';
const MESSAGE_COLUMNS = 'id, conversation_id, sender, author_id, author_name, body, meta, created_at';
export const TYPING_MS = 6000;
export const ONLINE_MS = 2 * 60_000;

/** The visitor wrote something the team hasn't opened yet. */
export const isUnread = (c: Pick<InboxConversation, 'last_visitor_at' | 'seen_at'>) =>
  Boolean(c.last_visitor_at && (!c.seen_at || Date.parse(c.last_visitor_at) > Date.parse(c.seen_at)));
/** Needs someone from the team: asked for a person, or wrote while a team member is chatting. */
export const needsTeam = (c: InboxConversation) => c.status === 'open' && (c.needs_agent || (c.mode === 'agent' && isUnread(c)));
export const visitorLabel = (c: Pick<InboxConversation, 'visitor_name' | 'visitor_id'>) => c.visitor_name || `Visitor ${c.visitor_id.slice(-4).toUpperCase()}`;
export const pagePath = (url: string | null) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};

const byNewest = (a: InboxConversation, b: InboxConversation) => Date.parse(b.last_message_at) - Date.parse(a.last_message_at);

/** Recent conversations for the active business, kept live. */
export function useInbox() {
  const { location } = useLocationContext();
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const { data, error } = await supabase.from('chat_conversations').select(INBOX_COLUMNS)
      .eq('location_id', location.id).order('last_message_at', { ascending: false }).limit(300);
    setConversations((data as InboxConversation[]) ?? []);
    // Usually means migration 037 hasn't been run yet
    setError(error?.message ?? null);
    setLoading(false);
  }, [location]);

  useEffect(() => {
    load();
    if (!location) return;
    const channel = supabase
      .channel(`chat_conversations:${location.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations', filter: `location_id=eq.${location.id}` }, (p) => {
        if (p.eventType === 'DELETE') {
          setConversations((cs) => cs.filter((c) => c.id !== (p.old as { id: string }).id));
          return;
        }
        const row = p.new as InboxConversation;
        setConversations((cs) => [row, ...cs.filter((c) => c.id !== row.id)].sort(byNewest));
      })
      .subscribe();
    // Safety net if the live connection drops
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [load, location]);

  const patch = useCallback((row: Partial<InboxConversation> & { id: string }) => {
    setConversations((cs) => cs.map((c) => (c.id === row.id ? { ...c, ...row } : c)));
  }, []);
  const removeLocal = useCallback((id: string) => setConversations((cs) => cs.filter((c) => c.id !== id)), []);

  return { conversations, loading, error, patch, removeLocal, reload: load };
}

const mergeMessage = (ms: LiveMessage[], m: LiveMessage) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m].sort((a, b) => a.id - b.id));

/** One conversation's messages, kept live (internal notes included). */
export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessages([]);
    if (!conversationId) return;
    let cancelled = false;
    setLoading(true);
    supabase.from('chat_messages').select(MESSAGE_COLUMNS).eq('conversation_id', conversationId).order('id').limit(1000)
      .then(({ data }) => {
        if (cancelled) return;
        setMessages((data as LiveMessage[]) ?? []);
        setLoading(false);
      });
    const channel = supabase
      .channel(`chat_messages:${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${conversationId}` }, (p) => {
        setMessages((ms) => mergeMessage(ms, p.new as LiveMessage));
      })
      .subscribe();
    // Safety net if the live connection drops: fetch anything newer every 10 s
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setMessages((ms) => {
        const after = ms.length ? ms[ms.length - 1].id : 0;
        supabase.from('chat_messages').select(MESSAGE_COLUMNS).eq('conversation_id', conversationId).gt('id', after).order('id').limit(200)
          .then(({ data }) => {
            if (!cancelled && data?.length) setMessages((cur) => (data as LiveMessage[]).reduce(mergeMessage, cur));
          });
        return ms;
      });
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const add = useCallback((m: LiveMessage) => setMessages((ms) => mergeMessage(ms, m)), []);
  return { messages, loading, add };
}

// ---------- team actions ----------
async function rpc<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export const replyToChat = (id: string, text: string) => rpc<LiveMessage>('chat_agent_reply', { p_conversation: id, p_text: text });
export const addChatNote = (id: string, text: string) => rpc<LiveMessage>('chat_add_note', { p_conversation: id, p_text: text });
export const setChatMode = (id: string, mode: 'ai' | 'agent') => rpc<InboxConversation>('chat_set_mode', { p_conversation: id, p_mode: mode });
export const setChatStatus = (id: string, status: 'open' | 'resolved') => rpc<InboxConversation>('chat_set_status', { p_conversation: id, p_status: status });
export const assignChat = (id: string, userId: string | null) => rpc<InboxConversation>('chat_assign', { p_conversation: id, p_user: userId });
export const setChatTags = (id: string, tags: string[]) => rpc<InboxConversation>('chat_set_tags', { p_conversation: id, p_tags: tags });
export const updateChatVisitor = (id: string, v: { name: string; email: string; phone: string }) =>
  rpc<InboxConversation>('chat_update_visitor', { p_conversation: id, p_name: v.name, p_email: v.email, p_phone: v.phone });
export const markChatSeen = (id: string) => supabase.rpc('chat_mark_seen', { p_conversation: id });
export const sendAgentTyping = (id: string) => supabase.rpc('chat_agent_typing', { p_conversation: id });
export const startChatWithVisitor = (locationId: string, visitorId: string, text: string) =>
  rpc<InboxConversation>('chat_start_with_visitor', { p_location: locationId, p_visitor: visitorId, p_text: text });

// ---------- saved replies ----------
export function useCannedResponses() {
  const { location } = useLocationContext();
  const [items, setItems] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!location) return;
    const { data } = await supabase.from('chat_canned_responses').select('id, shortcut, body').eq('location_id', location.id).order('shortcut');
    setItems((data as CannedResponse[]) ?? []);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (values: { shortcut: string; body: string }, id?: string) => {
    if (!location) return 'No business selected';
    const { error } = id
      ? await supabase.from('chat_canned_responses').update(values).eq('id', id)
      : await supabase.from('chat_canned_responses').insert({ location_id: location.id, ...values });
    if (error) return error.code === '23505' ? `/${values.shortcut.replace(/^\//, '')} is already used.` : error.message;
    await load();
    return null;
  }, [location, load]);
  const remove = useCallback(async (id: string) => {
    await supabase.from('chat_canned_responses').delete().eq('id', id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);
  return { items, loading, save, remove };
}

// ---------- visitors online ----------
export function useVisitorsOnline() {
  const { location } = useLocationContext();
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!location) return;
    const { data } = await supabase.from('chat_visitors')
      .select('visitor_id, first_seen_at, last_seen_at, current_page, page_title, pages_viewed, visits, info')
      .eq('location_id', location.id).gte('last_seen_at', new Date(Date.now() - ONLINE_MS).toISOString())
      .order('last_seen_at', { ascending: false }).limit(200);
    setVisitors((data as OnlineVisitor[]) ?? []);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 15_000);
    return () => clearInterval(timer);
  }, [load]);
  return { visitors, loading, reload: load };
}

// ---------- online / away (stored per browser) ----------
export type Presence = 'online' | 'away';
const PRESENCE_KEY = 're-chat-presence';
const presenceListeners = new Set<() => void>();
function readPresence(): Presence {
  try {
    return localStorage.getItem(PRESENCE_KEY) === 'away' ? 'away' : 'online';
  } catch {
    return 'online';
  }
}
export function setPresence(p: Presence) {
  try {
    localStorage.setItem(PRESENCE_KEY, p);
  } catch {
    /* this browser only */
  }
  presenceListeners.forEach((l) => l());
}
export const usePresence = () => useSyncExternalStore((l) => { presenceListeners.add(l); return () => { presenceListeners.delete(l); }; }, readPresence);

// ---------- sidebar badge (chats needing the team) ----------
let waiting = 0;
const badgeListeners = new Set<() => void>();
export function setChatBadge(n: number) {
  if (n === waiting) return;
  waiting = n;
  badgeListeners.forEach((l) => l());
}
export const useChatBadge = () => useSyncExternalStore((l) => { badgeListeners.add(l); return () => { badgeListeners.delete(l); }; }, () => waiting);

// ---------- alerts ----------
const SOUND_KEY = 're-chat-sound';
export function soundOn() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}
/** A short two-tone chime, made in the browser (no sound file needed). */
export function playChime() {
  if (!soundOn()) return;
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.15;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.25);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* audio blocked until the user interacts with the page */
  }
}
