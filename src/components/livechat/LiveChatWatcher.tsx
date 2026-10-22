import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { isUnread, playChime, setChatBadge, usePresence, type LiveMessage } from '@/lib/liveChat';

/**
 * Runs on every page for team members who answer chats: keeps them "online" for the website
 * widget, counts chats needing the team (sidebar badge), and alerts on new visitor messages
 * (chime + desktop notification) unless that chat is already open on screen.
 */
export function LiveChatWatcher() {
  const { location, organization, can } = useLocationContext();
  const presence = usePresence();
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const enabled = Boolean(location && organization && can('chat.reply'));

  // Online / away heartbeat (the widget treats anyone seen in the last 2 minutes as online)
  useEffect(() => {
    if (!enabled || !organization) return;
    const beat = () => supabase.rpc('chat_set_presence', { p_org: organization.id, p_status: presence });
    beat();
    const timer = setInterval(beat, 60_000);
    return () => clearInterval(timer);
  }, [enabled, organization, presence]);

  const recount = useCallback(async () => {
    if (!location) return;
    const { data } = await supabase.from('chat_conversations').select('needs_agent, mode, last_visitor_at, seen_at')
      .eq('location_id', location.id).eq('status', 'open').not('last_visitor_at', 'is', null)
      .order('last_message_at', { ascending: false }).limit(300);
    const rows = (data as { needs_agent: boolean; mode: string; last_visitor_at: string | null; seen_at: string | null }[]) ?? [];
    setChatBadge(rows.filter((c) => c.needs_agent || (c.mode === 'agent' && isUnread(c))).length);
  }, [location]);

  // Which chat (if any) is on screen right now, read when a message arrives
  const openChat = routerLocation.pathname === '/chat' ? new URLSearchParams(routerLocation.search).get('c') : null;

  useEffect(() => {
    if (!enabled || !location) {
      setChatBadge(0);
      return;
    }
    recount();
    const channel = supabase
      .channel(`chat_alerts:${location.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `location_id=eq.${location.id}` }, (p) => {
        const m = p.new as LiveMessage;
        if (m.sender !== 'visitor') return;
        const looking = document.visibilityState === 'visible' && openChat === m.conversation_id;
        if (looking) return;
        playChime();
        if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
          const n = new Notification('New website chat message', { body: m.body.slice(0, 140), tag: m.conversation_id });
          n.onclick = () => {
            window.focus();
            navigate(`/chat?c=${m.conversation_id}`);
            n.close();
          };
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations', filter: `location_id=eq.${location.id}` }, () => recount())
      .subscribe();
    // Safety net if the live connection drops
    const timer = setInterval(() => { if (document.visibilityState === 'visible') recount(); }, 30_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [enabled, location, openChat, navigate, recount]);

  return null;
}
