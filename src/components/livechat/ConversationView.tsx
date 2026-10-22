import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, CheckCircle2, Hand, Headset, Loader2, RotateCcw, Send, StickyNote } from 'lucide-react';
import {
  addChatNote,
  assignChat,
  isUnread,
  markChatSeen,
  replyToChat,
  sendAgentTyping,
  setChatMode,
  setChatStatus,
  TYPING_MS,
  useMessages,
  visitorLabel,
  type CannedResponse,
  type InboxConversation,
  type LiveMessage,
} from '@/lib/liveChat';
import type { TeamMember } from '@/types';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const day = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

interface Props {
  convo: InboxConversation;
  team: TeamMember[];
  canned: CannedResponse[];
  canReply: boolean;
  me: string | undefined;
  onPatch: (row: Partial<InboxConversation> & { id: string }) => void;
  onBack: () => void;
}

/** The middle panel: one conversation, live, with the reply box and the chat's actions. */
export function ConversationView({ convo, team, canned, canReply, me, onPatch, onBack }: Props) {
  const { messages, loading, add } = useMessages(convo.id);
  const [text, setText] = useState('');
  const [asNote, setAsNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);
  const unread = isUnread(convo);

  // Re-render every 2 s so "is typing…" disappears on time
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, convo.id]);

  // Opening a chat (or a new message arriving while it's on screen) marks it read
  useEffect(() => {
    if (!unread || document.visibilityState !== 'visible') return;
    markChatSeen(convo.id);
    onPatch({ id: convo.id, seen_at: new Date().toISOString() });
  }, [unread, convo.id, onPatch, messages.length]);

  const visitorTyping = Boolean(convo.visitor_typing_at && Date.now() - Date.parse(convo.visitor_typing_at) < TYPING_MS);
  const slash = !asNote && text.startsWith('/') && !text.includes(' ') ? text.slice(1).toLowerCase() : null;
  const suggestions = useMemo(() => (slash === null ? [] : canned.filter((c) => c.shortcut.startsWith(slash)).slice(0, 6)), [slash, canned]);

  const run = async (action: () => Promise<Partial<InboxConversation> & { id: string }>) => {
    setBusy(true);
    setError(null);
    try {
      onPatch(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    if (suggestions.length) return pick(suggestions[0]);
    setBusy(true);
    setError(null);
    try {
      const msg: LiveMessage = asNote ? await addChatNote(convo.id, body) : await replyToChat(convo.id, body);
      add(msg);
      setText('');
      if (!asNote) {
        onPatch({
          id: convo.id, mode: 'agent', needs_agent: false, status: 'open', assigned_to: convo.assigned_to ?? me ?? null, seen_at: msg.created_at,
          last_message_at: msg.created_at, last_message_preview: msg.body.slice(0, 140), last_message_sender: 'agent',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t send');
    } finally {
      setBusy(false);
    }
  };

  const pick = (c: CannedResponse) => setText(c.body);

  const onInput = (value: string) => {
    setText(value);
    if (!asNote && value && Date.now() - lastTyping.current > 3000) {
      lastTyping.current = Date.now();
      sendAgentTyping(convo.id);
    }
  };

  let lastDay = '';
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 flex-wrap">
        <button type="button" onClick={onBack} className="lg:hidden p-1 -ml-1 text-slate-500" aria-label="Back to conversations">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{visitorLabel(convo)}</p>
          <p className="text-xs text-slate-500">
            {convo.status === 'resolved' ? 'Resolved' : convo.mode === 'agent' ? 'Team is chatting (AI paused)' : 'AI is answering'}
            {convo.needs_agent && ' · wants a person'}
          </p>
        </div>
        {canReply && (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="input-field !w-auto !py-1 text-sm"
              value={convo.assigned_to ?? ''}
              onChange={(e) => run(() => assignChat(convo.id, e.target.value || null))}
              disabled={busy}
              aria-label="Assigned to"
            >
              <option value="">Unassigned</option>
              {team.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === me ? 'Me' : m.full_name || m.email}</option>)}
            </select>
            {convo.status === 'open' && (convo.mode === 'agent' ? (
              <button type="button" disabled={busy} onClick={() => run(() => setChatMode(convo.id, 'ai'))} className="btn-secondary text-sm !py-1.5">
                <Bot className="w-4 h-4" /> Hand back to AI
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => run(() => setChatMode(convo.id, 'agent'))} className="btn-secondary text-sm !py-1.5">
                <Headset className="w-4 h-4" /> Take over
              </button>
            ))}
            {convo.status === 'open' ? (
              <button type="button" disabled={busy} onClick={() => run(() => setChatStatus(convo.id, 'resolved'))} className="btn-primary text-sm !py-1.5">
                <CheckCircle2 className="w-4 h-4" /> Resolve
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => run(() => setChatStatus(convo.id, 'open'))} className="btn-secondary text-sm !py-1.5">
                <RotateCcw className="w-4 h-4" /> Reopen
              </button>
            )}
          </div>
        )}
      </div>

      {convo.needs_agent && convo.status === 'open' && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-center gap-2">
          <Hand className="w-4 h-4 shrink-0" /> This visitor asked to talk to a person. Reply to take over from the AI.
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
        {loading && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>}
        {messages.map((m) => {
          const d = day(m.created_at);
          const sep = d !== lastDay;
          lastDay = d;
          return (
            <div key={m.id}>
              {sep && <p className="text-center text-[11px] font-medium text-slate-400 my-2">{d}</p>}
              <MessageBubble m={m} />
            </div>
          );
        })}
        {visitorTyping && <p className="text-xs text-slate-500 italic">Visitor is typing…</p>}
        <div ref={endRef} />
      </div>

      {canReply ? (
        <form onSubmit={send} className="border-t border-slate-200 p-3 space-y-2 bg-white relative">
          {suggestions.length > 0 && (
            <ul className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10" role="listbox" aria-label="Saved replies">
              {suggestions.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => pick(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                    <span className="font-semibold text-sky-700">/{c.shortcut}</span> <span className="text-slate-600">{c.body.slice(0, 90)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-1 text-xs">
            <button type="button" onClick={() => setAsNote(false)} className={`px-2.5 py-1 rounded-full font-medium ${!asNote ? 'bg-sky-50 text-sky-700' : 'text-slate-500 hover:text-slate-700'}`}>
              Reply
            </button>
            <button type="button" onClick={() => setAsNote(true)} className={`px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 ${asNote ? 'bg-amber-50 text-amber-800' : 'text-slate-500 hover:text-slate-700'}`}>
              <StickyNote className="w-3 h-3" /> Internal note
            </button>
            <span className="ml-auto text-slate-400 hidden sm:inline">{asNote ? 'Only your team sees notes' : 'Type / for saved replies'}</span>
          </div>
          <div className="flex gap-2">
            <textarea
              className={`input-field flex-1 text-sm ${asNote ? '!bg-amber-50/60' : ''}`}
              rows={2}
              maxLength={2000}
              placeholder={asNote ? 'Write a note for your team…' : convo.mode === 'agent' ? 'Type your reply…' : 'Reply to take over from the AI…'}
              aria-label={asNote ? 'Internal note' : 'Your reply'}
              value={text}
              onChange={(e) => onInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="submit" disabled={busy || !text.trim()} className="btn-primary text-sm self-end">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {asNote ? 'Add note' : 'Send'}
            </button>
          </div>
          {error && <p className="text-xs text-rose-700">{error}</p>}
        </form>
      ) : (
        <p className="border-t border-slate-200 p-3 text-xs text-slate-500">You can read chats but not reply (Answer website chats is off for you).</p>
      )}
    </div>
  );
}

function MessageBubble({ m }: { m: LiveMessage }) {
  if (m.sender === 'system') {
    return <p className="text-center text-xs text-slate-500 py-1">{m.meta?.ended ? '— Chat resolved —' : m.body} <span className="text-slate-400">{time(m.created_at)}</span></p>;
  }
  if (m.sender === 'note') {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-950">
        <p className="text-[11px] font-semibold text-amber-800 mb-0.5 flex items-center gap-1"><StickyNote className="w-3 h-3" /> Note · {m.author_name ?? 'Team'} · {time(m.created_at)}</p>
        <p className="whitespace-pre-wrap">{m.body}</p>
      </div>
    );
  }
  const visitor = m.sender === 'visitor';
  return (
    <div className={`flex flex-col ${visitor ? 'items-start' : 'items-end'}`}>
      <span className="text-[11px] text-slate-400 mb-0.5 px-1">
        {visitor ? 'Visitor' : m.sender === 'ai' ? 'AI assistant' : m.author_name ?? 'Team'} · {time(m.created_at)}
      </span>
      <p className={`max-w-[80%] text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap ${
        visitor ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
          : m.sender === 'ai' ? 'bg-sky-50 border border-sky-100 text-slate-800 rounded-br-md'
          : 'bg-sky-600 text-white rounded-br-md'
      }`}>{m.body}</p>
    </div>
  );
}
