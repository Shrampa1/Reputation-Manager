import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Hand, Headset, Loader2, MessagesSquare, Search, Star } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import { fetchTeam } from '@/lib/team';
import { isUnread, needsTeam, useCannedResponses, useInbox, visitorLabel, type InboxConversation } from '@/lib/liveChat';
import { useWebsiteChat } from '@/lib/websiteChat';
import { useChatWidgets } from '@/lib/chatWidgets';
import { supabase } from '@/lib/supabase';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';
import { ChannelIcon } from '@/components/livechat/ChannelIcon';
import { CHANNELS } from '@/lib/aiAgent';
import { ConversationView } from '@/components/livechat/ConversationView';
import { VisitorPanel } from '@/components/livechat/VisitorPanel';
import type { TeamMember } from '@/types';

type Filter = 'waiting' | 'open' | 'mine' | 'resolved' | 'all';

/** W1: the team inbox. Conversations on the left, the chat in the middle, the visitor on the right. */
export function LiveChatInboxPage() {
  const { user } = useAuth();
  const { organization, can } = useLocationContext();
  const canReply = can('chat.reply');
  const { conversations, loading, error, patch } = useInbox();
  const { items: canned } = useCannedResponses();
  const { settings: chatSettings, callsAvailable } = useWebsiteChat();
  const callsOn = callsAvailable && Boolean(chatSettings?.widget.calls?.enabled);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState<string>('all');
  const [widgetFilter, setWidgetFilter] = useState<string>('all');
  const { widgets } = useChatWidgets();
  // Which extra widget each chat came from (046); loaded on its own so the inbox works without the migration
  const [widgetOf, setWidgetOf] = useState<Record<string, string>>({});
  const widgetCount = widgets.length;
  const convoCount = conversations.length;
  useEffect(() => {
    if (!widgetCount) return;
    supabase.from('chat_conversations').select('id, widget_id').not('widget_id', 'is', null).order('last_message_at', { ascending: false }).limit(1000)
      .then(({ data }) => setWidgetOf(Object.fromEntries((data ?? []).map((r) => [r.id as string, r.widget_id as string]))));
  }, [widgetCount, convoCount]);
  const widgetName = (id: string) => widgets.find((w) => w.id === widgetOf[id])?.name;
  const selectedId = params.get('c');

  useEffect(() => {
    if (!organization) return;
    fetchTeam(organization.id).then((m) => setTeam(m.filter((x) => !x.is_client))).catch(() => setTeam([]));
  }, [organization]);

  const counts = useMemo(() => ({
    waiting: conversations.filter(needsTeam).length,
    open: conversations.filter((c) => c.status === 'open').length,
    mine: conversations.filter((c) => c.status === 'open' && c.assigned_to === user?.id).length,
    resolved: conversations.filter((c) => c.status === 'resolved').length,
    all: conversations.length,
  }), [conversations, user]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => {
        if (filter === 'waiting') return needsTeam(c);
        if (filter === 'open') return c.status === 'open';
        if (filter === 'mine') return c.status === 'open' && c.assigned_to === user?.id;
        if (filter === 'resolved') return c.status === 'resolved';
        return true;
      })
      .filter((c) => channel === 'all' || c.channel === channel)
      .filter((c) => widgetFilter === 'all' || (widgetFilter === 'main' ? c.channel === 'web_chat' && !widgetOf[c.id] : widgetOf[c.id] === widgetFilter))
      .filter((c) => !q || [c.visitor_name, c.visitor_email, c.visitor_phone, c.last_message_preview, ...c.tags].some((v) => v?.toLowerCase().includes(q)))
      // Chats waiting for the team first
      .sort((a, b) => Number(needsTeam(b)) - Number(needsTeam(a)));
  }, [conversations, filter, query, user, channel, widgetFilter, widgetOf]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const open = useCallback((id: string | null) => setParams(id ? { c: id } : {}, { replace: true }), [setParams]);
  const history = selected ? conversations.filter((c) => c.visitor_id === selected.visitor_id) : [];

  const filters: [Filter, string][] = [['waiting', 'Waiting'], ['open', 'Open'], ['mine', 'Mine'], ['resolved', 'Resolved'], ['all', 'All']];

  return (
    <div className="space-y-4">
      <LiveChatHeader />
      {error && (
        <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load chats: {error}</p>
      )}
      <div className="card overflow-hidden grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_280px] h-[calc(100vh-220px)] min-h-[520px]">
        {/* Conversations */}
        <aside className={`border-r border-slate-200 flex flex-col min-h-0 ${selected ? 'hidden lg:flex' : 'flex'}`}>
          <div className="p-3 space-y-2 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input-field !pl-9 text-sm" placeholder="Search name, email, message, tag" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search chats" />
            </div>
            {new Set(conversations.map((c) => c.channel)).size > 1 && (
              <select className="input-field !py-1 text-sm" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
                <option value="all">All channels</option>
                {CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
            {widgets.length > 0 && (
              <select className="input-field !py-1 text-sm" value={widgetFilter} onChange={(e) => setWidgetFilter(e.target.value)} aria-label="Chat widget">
                <option value="all">All widgets</option>
                <option value="main">Main widget</option>
                {widgets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
            <div className="flex gap-1 flex-wrap">
              {filters.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`text-xs font-medium rounded-full px-2.5 py-1 ${filter === key ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {label}{counts[key] > 0 && ` ${counts[key]}`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
            ) : shown.length === 0 ? (
              <p className="text-sm text-slate-500 p-4">{filter === 'waiting' ? 'Nobody is waiting for the team.' : 'No chats here.'}</p>
            ) : (
              <ul>
                {shown.map((c) => <ConversationItem key={c.id} c={c} widget={widgetName(c.id)} active={c.id === selectedId} team={team} me={user?.id} onClick={() => open(c.id)} />)}
              </ul>
            )}
          </div>
        </aside>

        {/* Chat */}
        <section className={`min-h-0 ${selected ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
          {selected ? (
            <ConversationView key={selected.id} orgId={organization?.id ?? ''} businessName={organization?.name ?? ''} callsOn={callsOn} convo={selected} team={team} canned={canned} canReply={canReply} me={user?.id} onPatch={patch} onBack={() => open(null)} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <MessagesSquare className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-700">Choose a chat</p>
              <p className="text-sm mt-1 max-w-xs">
                New chats appear here as visitors write. You’ll hear a chime for new messages; turn on desktop alerts to get them in other tabs too.
              </p>
              {!loading && conversations.length === 0 && (
                <p className="text-sm mt-3">No chats yet. <Link to="/chat/settings" className="text-sky-600 hover:underline">Set up the chat on your website</Link>.</p>
              )}
            </div>
          )}
        </section>

        {/* Visitor */}
        {selected && (
          <aside className="hidden xl:block border-l border-slate-200 min-h-0">
            <VisitorPanel convo={selected} history={history} canEdit={canReply} onPatch={patch} onOpen={open} />
          </aside>
        )}
      </div>
    </div>
  );
}

function ConversationItem({ c, widget, active, team, me, onClick }: { c: InboxConversation; widget?: string; active: boolean; team: TeamMember[]; me?: string; onClick: () => void }) {
  const unread = isUnread(c);
  const assignee = c.assigned_to ? team.find((m) => m.user_id === c.assigned_to) : null;
  const assigneeName = c.assigned_to === me ? 'Me' : assignee?.full_name?.split(' ')[0] || assignee?.email.split('@')[0];
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left px-3 py-3 border-b border-slate-100 flex gap-3 ${active ? 'bg-sky-50' : c.needs_agent && c.status === 'open' ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50'}`}
      >
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold">
            {visitorLabel(c).slice(0, 1).toUpperCase()}
          </div>
          {unread && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sky-500 border-2 border-white" aria-label="Unread" />}
          {c.channel !== 'web_chat' && <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5"><ChannelIcon channel={c.channel} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={`text-sm truncate flex-1 ${unread ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{visitorLabel(c)}</p>
            <span className="text-[11px] text-slate-400 shrink-0">{relativeTime(c.last_message_at)}</span>
          </div>
          <p className={`text-xs truncate ${unread ? 'text-slate-700' : 'text-slate-500'}`}>
            {c.last_message_sender && c.last_message_sender !== 'visitor' && <span className="text-slate-400">{c.last_message_sender === 'ai' ? 'AI: ' : c.last_message_sender === 'agent' ? 'Team: ' : ''}</span>}
            {c.last_message_preview ?? '…'}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {c.needs_agent && c.status === 'open' && <span className="text-[11px] font-medium text-amber-800 bg-amber-100 rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5"><Hand className="w-3 h-3" /> Wants a person</span>}
            {c.mode === 'agent' && c.status === 'open' && <span className="text-[11px] font-medium text-violet-700 bg-violet-50 rounded-full px-1.5 py-0.5 inline-flex items-center gap-0.5"><Headset className="w-3 h-3" /> Team</span>}
            {c.status === 'resolved' && <span className="text-[11px] text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">Resolved</span>}
            {c.rating && <span className="text-[11px] text-amber-700 inline-flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{c.rating}</span>}
            {widget && <span className="text-[11px] text-sky-700 bg-sky-50 rounded-full px-1.5 py-0.5">{widget}</span>}
            {assigneeName && <span className="text-[11px] text-slate-500">→ {assigneeName}</span>}
            {c.tags.slice(0, 2).map((t) => <span key={t} className="text-[11px] text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">{t}</span>)}
          </div>
        </div>
      </button>
    </li>
  );
}
