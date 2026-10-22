import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Loader2, Monitor, Star, Tag, UserPlus, X } from 'lucide-react';
import { relativeTime } from '@/lib/activity';
import { pagePath, setChatTags, updateChatVisitor, visitorLabel, type InboxConversation } from '@/lib/liveChat';

function hostOf(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface Props {
  convo: InboxConversation;
  history: InboxConversation[];
  canEdit: boolean;
  onPatch: (row: Partial<InboxConversation> & { id: string }) => void;
  onOpen: (id: string) => void;
}

/** The right panel: who the visitor is, where they are on the site, tags and past chats. */
export function VisitorPanel({ convo, history, canEdit, onPatch, onOpen }: Props) {
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm({ name: convo.visitor_name ?? '', email: convo.visitor_email ?? '', phone: convo.visitor_phone ?? '' });
    setMsg(null);
  }, [convo.id, convo.visitor_name, convo.visitor_email, convo.visitor_phone]);

  const dirty = form.name !== (convo.visitor_name ?? '') || form.email !== (convo.visitor_email ?? '') || form.phone !== (convo.visitor_phone ?? '');

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      onPatch(await updateChatVisitor(convo.id, form));
      setMsg('Saved.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Couldn’t save');
    } finally {
      setBusy(false);
    }
  };

  const saveTags = async (tags: string[]) => {
    try {
      onPatch(await setChatTags(convo.id, tags));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Couldn’t save tags');
    }
  };

  const info = convo.visitor_info ?? {};
  const rows: [string, string | null | undefined][] = [
    ['On page', pagePath(convo.current_page)],
    ['Started on', pagePath(convo.page_url)],
    ['Came from', hostOf(info.referrer)],
    ['Device', [info.device, info.browser, info.os].filter(Boolean).join(' · ') || null],
    ['Language', info.language],
    ['Time zone', info.timezone],
    ['First message', relativeTime(convo.created_at)],
  ];
  const others = history.filter((c) => c.id !== convo.id);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 text-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-semibold shrink-0">
          {visitorLabel(convo).slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{visitorLabel(convo)}</p>
          {convo.lead_id && (
            <Link to="/leads" className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1"><UserPlus className="w-3 h-3" /> Saved as a lead</Link>
          )}
        </div>
      </div>

      <form onSubmit={saveDetails} className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</p>
        <fieldset disabled={!canEdit} className="space-y-2">
          <input className="input-field text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="Visitor name" />
          <input className="input-field text-sm" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Visitor email" />
          <input className="input-field text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="Visitor phone" />
        </fieldset>
        {canEdit && dirty && (
          <button type="submit" disabled={busy} className="btn-secondary text-sm !py-1.5">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save details</button>
        )}
        {msg && <p className="text-xs text-slate-500">{msg}</p>}
      </form>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1"><Tag className="w-3 h-3" /> Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {convo.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 rounded-full pl-2 pr-1 py-0.5">
              {t}
              {canEdit && (
                <button type="button" onClick={() => saveTags(convo.tags.filter((x) => x !== t))} className="text-slate-400 hover:text-slate-700" aria-label={`Remove tag ${t}`}>
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {!convo.tags.length && <span className="text-xs text-slate-400">No tags</span>}
        </div>
        {canEdit && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tag.trim()) saveTags([...convo.tags, tag]);
              setTag('');
            }}
          >
            <input className="input-field text-sm" placeholder="Add a tag and press Enter" value={tag} maxLength={30} onChange={(e) => setTag(e.target.value)} aria-label="New tag" />
          </form>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1"><Monitor className="w-3 h-3" /> Visit</p>
        <dl className="space-y-1">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-slate-500 w-24 shrink-0">{k}</dt>
              <dd className="text-slate-800 break-all">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {convo.rating && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rating</p>
          <p className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`w-4 h-4 ${n <= convo.rating! ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />)}
          </p>
          {convo.rating_comment && <p className="text-slate-600 italic">“{convo.rating_comment}”</p>}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1"><Globe className="w-3 h-3" /> Past chats ({others.length})</p>
        {others.length === 0 ? (
          <p className="text-xs text-slate-400">First chat with this visitor.</p>
        ) : (
          <ul className="space-y-1">
            {others.slice(0, 10).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onOpen(c.id)} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <p className="text-slate-800 truncate">{c.last_message_preview ?? '(no messages)'}</p>
                  <p className="text-xs text-slate-400">{relativeTime(c.last_message_at)} · {c.status}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
