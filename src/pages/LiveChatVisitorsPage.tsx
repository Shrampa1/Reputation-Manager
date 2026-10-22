import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Loader2, MessageCircle, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import { pagePath, startChatWithVisitor, useInbox, useVisitorsOnline, visitorLabel, type OnlineVisitor } from '@/lib/liveChat';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';
import { Modal } from '@/components/ui/Modal';

const DeviceIcon = ({ device }: { device?: string }) =>
  device === 'mobile' ? <Smartphone className="w-4 h-4" /> : device === 'tablet' ? <Tablet className="w-4 h-4" /> : <Monitor className="w-4 h-4" />;

/** W1: who's on the website right now, and starting a chat with them. */
export function LiveChatVisitorsPage() {
  const { location, can } = useLocationContext();
  const { visitors, loading } = useVisitorsOnline();
  const { conversations } = useInbox();
  const navigate = useNavigate();
  const [inviting, setInviting] = useState<OnlineVisitor | null>(null);

  // Their open chat, if they have one
  const chatOf = (v: OnlineVisitor) => conversations.find((c) => c.visitor_id === v.visitor_id && c.status === 'open')
    ?? conversations.find((c) => c.visitor_id === v.visitor_id);

  return (
    <div className="space-y-4">
      <LiveChatHeader subtitle="People on your website right now (seen in the last 2 minutes). Updates every 15 seconds." />
      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-600" />
          <p className="text-sm font-semibold text-slate-900">{loading ? 'Loading…' : `${visitors.length} visitor${visitors.length === 1 ? '' : 's'} online`}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
        ) : visitors.length === 0 ? (
          <p className="text-sm text-slate-500 p-4">Nobody is on your website right now. Visitors appear here once the chat code is on your site and the chat is switched on.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Visitor</th>
                  <th className="px-4 py-2 font-medium">Current page</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Device</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Visit</th>
                  <th className="px-4 py-2 font-medium sr-only">Chat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitors.map((v) => {
                  const chat = chatOf(v);
                  return (
                    <tr key={v.visitor_id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{chat ? visitorLabel(chat) : `Visitor ${v.visitor_id.slice(-4).toUpperCase()}`}</p>
                        <p className="text-xs text-slate-500">{v.info.timezone ?? v.info.language ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-slate-800 truncate">{v.page_title || pagePath(v.current_page) || '—'}</p>
                        {v.page_title && <p className="text-xs text-slate-400 truncate">{pagePath(v.current_page)}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                        <span className="inline-flex items-center gap-1.5"><DeviceIcon device={v.info.device} /> {[v.info.browser, v.info.os].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-500">
                        {v.pages_viewed} page{v.pages_viewed === 1 ? '' : 's'} · visit {v.visits}<br />first seen {relativeTime(v.first_seen_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {chat ? (
                          <button type="button" onClick={() => navigate(`/chat?c=${chat.id}`)} className="btn-secondary text-sm !py-1.5">Open chat</button>
                        ) : can('chat.reply') ? (
                          <button type="button" onClick={() => setInviting(v)} className="btn-primary text-sm !py-1.5"><MessageCircle className="w-4 h-4" /> Start chat</button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {inviting && location && (
        <StartChatModal
          visitor={inviting}
          onClose={() => setInviting(null)}
          onStart={async (text) => {
            const convo = await startChatWithVisitor(location.id, inviting.visitor_id, text);
            navigate(`/chat?c=${convo.id}`);
          }}
        />
      )}
    </div>
  );
}

function StartChatModal({ visitor, onClose, onStart }: { visitor: OnlineVisitor; onClose: () => void; onStart: (text: string) => Promise<void> }) {
  const [text, setText] = useState('Hi! Can I help you with anything?');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onStart(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t start the chat');
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title="Start a chat">
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-600">
          The chat opens on their screen within about 30 seconds{visitor.page_title ? `, on “${visitor.page_title}”` : ''}. The AI stays quiet while you’re chatting.
        </p>
        <textarea className="input-field text-sm" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-label="First message" required />
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={busy || !text.trim()} className="btn-primary text-sm">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Send</button>
        </div>
      </form>
    </Modal>
  );
}
