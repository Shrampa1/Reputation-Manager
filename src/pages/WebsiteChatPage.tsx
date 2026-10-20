import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bot, Check, CheckCircle2, ChevronDown, Copy, Hand, Headset, Loader2, MessagesSquare, Save, Send, Trash2, UserPlus } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import { DEFAULT_CHAT, MAX_INFO, chatApi, chatSnippet, agentReply, draftBusinessInfo, isUnread, markChatSeen, setChatMode, useWebsiteChat, type ChatConversation, type ChatSettings } from '@/lib/websiteChat';

const platforms: [string, string][] = [
  ['Shopify', 'Online Store → Themes → Edit code → theme.liquid, paste just before </body>.'],
  ['WordPress', 'Use a header/footer code plugin (e.g. WPCode) and add it to the footer.'],
  ['Wix', 'Settings → Custom code → Add code, place it in Body – end, on all pages.'],
  ['Squarespace', 'Settings → Advanced → Code injection → Footer.'],
  ['Anything else', 'Paste it into every page’s HTML, just before </body>.'],
];

/** C1: an AI assistant on the business's own website that answers questions and collects leads. */
export function WebsiteChatPage() {
  const { location, can } = useLocationContext();
  const canEdit = can('business.edit');
  const canReply = can('leads.manage');
  const { settings, conversations, usage, loading, save, remove, update } = useWebsiteChat();
  const [form, setForm] = useState<ChatSettings>(DEFAULT_CHAT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const key = location?.public_key;
  const snippet = key ? chatSnippet(key) : '';
  const set = <K extends keyof ChatSettings>(k: K, v: ChatSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.enabled && form.business_info.trim().length < 30) {
      return setMessage({ ok: false, text: 'Tell the assistant a little about your business first (at least a couple of sentences).' });
    }
    setSaving(true);
    setMessage(null);
    const error = await save(form);
    setSaving(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: form.enabled ? 'Saved. The chat is live on any page with the code below.' : 'Saved. The chat is switched off.' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ ok: false, text: 'Couldn’t copy. Select the code and copy it yourself.' });
    }
  };

  // The saved chat exactly as a website shows it (cache-busted after each save)
  const previewDoc = key && settings?.enabled
    ? `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f1f5f9;font:14px system-ui;color:#64748b;padding:16px}</style></head><body>Your website<script src="${window.location.origin}/chat.js" data-key="${key}" data-api="${chatApi()}?v=${encodeURIComponent(settings.updated_at ?? '')}" data-open="true"></script></body></html>`
    : null;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  const leads = conversations.filter((c) => c.lead_id).length;
  const waiting = conversations.filter((c) => c.needs_agent).length;
  // Visitors asking for a person first, then the newest
  const sorted = [...conversations].sort((a, b) => Number(b.needs_agent) - Number(a.needs_agent));

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Website chat</h1>
        <p className="text-sm text-slate-500 mt-1">
          An AI assistant on your website that answers visitors’ questions from what you tell it below, and turns visitors who leave an email or phone number into <Link to="/leads" className="text-sky-600 hover:underline">leads</Link>.
        </p>
      </div>

      {waiting > 0 && (
        <a href="#conversations" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100">
          <Hand className="w-4 h-4 shrink-0" />
          {waiting === 1 ? 'A visitor wants to talk to a person.' : `${waiting} visitors want to talk to a person.`} Reply below.
        </a>
      )}

      <form onSubmit={submit} className="card p-5 space-y-4">
        <fieldset disabled={!canEdit} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input type="checkbox" className="rounded border-slate-300" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            Chat is on
          </label>

          <div>
            <div className="flex items-end justify-between gap-2 mb-1.5">
              <label htmlFor="wc-info" className="block text-sm font-medium text-slate-700">
                About your business <span className="font-normal text-slate-400">(the assistant only answers from this)</span>
              </label>
              {!form.business_info.trim() && location && (
                <button type="button" className="text-xs font-medium text-sky-600 hover:underline shrink-0" onClick={() => set('business_info', draftBusinessInfo(location.name))}>
                  Start from an outline
                </button>
              )}
            </div>
            <textarea
              id="wc-info"
              className="input-field font-mono text-[13px]"
              rows={10}
              maxLength={MAX_INFO}
              placeholder="What you do, services and prices, opening hours, areas you serve, how to book, policies, common questions…"
              value={form.business_info}
              onChange={(e) => set('business_info', e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">
              {form.business_info.length.toLocaleString()} / {MAX_INFO.toLocaleString()} characters. Your name, address, phone, website and Google rating are added automatically. Anything not written here, the assistant says it isn’t sure about.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
            <div>
              <label htmlFor="wc-greeting" className="block text-sm font-medium text-slate-700 mb-1.5">First message</label>
              <input id="wc-greeting" className="input-field" maxLength={200} value={form.greeting} onChange={(e) => set('greeting', e.target.value)} required />
            </div>
            <div>
              <label htmlFor="wc-accent" className="block text-sm font-medium text-slate-700 mb-1.5">Colour</label>
              <input id="wc-accent" type="color" className="h-[42px] w-16 rounded-lg border border-slate-300 cursor-pointer" value={form.accent} onChange={(e) => set('accent', e.target.value)} />
            </div>
            <div>
              <label htmlFor="wc-pos" className="block text-sm font-medium text-slate-700 mb-1.5">Corner</label>
              <select id="wc-pos" className="input-field" value={form.position} onChange={(e) => set('position', e.target.value as ChatSettings['position'])}>
                <option value="right">Bottom right</option>
                <option value="left">Bottom left</option>
              </select>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="rounded border-slate-300 mt-0.5" checked={form.collect_leads} onChange={(e) => set('collect_leads', e.target.checked)} />
            <span>
              Collect leads: when a visitor wants a quote, booking or callback, the assistant asks for their name and email or phone. They appear in Leads (from “website chat”) and trigger your automations.
            </span>
          </label>
        </fieldset>

        {canEdit ? (
          <div className="flex items-center gap-3 flex-wrap">
            <button type="submit" disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
            {message && (
              <span className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Only members who can edit business settings can change the chat.</p>
        )}
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="card p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Try it</h2>
          {previewDoc ? (
            <>
              <iframe title="Website chat preview" srcDoc={previewDoc} className="w-full h-[600px] rounded-xl border border-slate-200 bg-slate-100" />
              <p className="text-xs text-slate-500">This is the real assistant: test messages count towards your monthly allowance and show up under Conversations.</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Switch the chat on and save to try it here.</p>
          )}
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Add it to your website</h2>
          <p className="text-sm text-slate-500">Paste this once, on every page (usually in the footer or just before <code className="text-xs">&lt;/body&gt;</code>).</p>
          <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
          <button type="button" onClick={copy} disabled={!snippet} className="btn-secondary text-sm">
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy code'}
          </button>
          <dl className="space-y-1.5 text-xs">
            {platforms.map(([name, how]) => (
              <div key={name}><dt className="inline font-semibold text-slate-700">{name}: </dt><dd className="inline text-slate-500">{how}</dd></div>
            ))}
          </dl>
          {usage && (
            <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              This month: {usage.used.toLocaleString()} visitor message{usage.used === 1 ? '' : 's'} answered
              {usage.limit >= 0 && <> of {usage.limit.toLocaleString()} on your plan (all businesses). After that, the chat asks visitors to contact you directly. <Link to="/billing" className="text-sky-600 hover:underline">Plan & billing</Link></>}
            </p>
          )}
        </section>
      </div>

      <section id="conversations" className="card p-5 space-y-3 scroll-mt-20">
        <div className="flex items-center gap-2">
          <MessagesSquare className="w-5 h-5 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900 flex-1">Conversations</h2>
          {conversations.length > 0 && <span className="text-xs text-slate-500">{conversations.length} recent · {leads} became leads</span>}
        </div>
        {canReply && (
          <p className="text-xs text-slate-500">
            Open a conversation to reply yourself. While you’re chatting, the AI stays quiet in that conversation; hand it back when you’re done. Visitors see your replies within a few seconds while the chat is open on their screen.
          </p>
        )}
        {conversations.length === 0 ? (
          <p className="text-sm text-slate-500">No conversations yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {sorted.map((c) => <ConversationRow key={c.id} convo={c} canReply={canReply} canDelete={canEdit} onDelete={remove} onUpdate={update} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConversationRow({ convo, canReply, canDelete, onDelete, onUpdate }: {
  convo: ChatConversation;
  canReply: boolean;
  canDelete: boolean;
  onDelete: (id: string) => Promise<string | null>;
  onUpdate: (row: Partial<ChatConversation> & { id: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const first = convo.messages.find((m) => m.role === 'visitor')?.text ?? '';
  const unread = isUnread(convo);
  let page: string | null = null;
  try {
    page = convo.page_url ? new URL(convo.page_url).pathname : null;
  } catch {
    page = null;
  }

  // Keep the newest message in view, and mark new visitor messages as read while it's open
  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: 'nearest' });
    if (unread) {
      markChatSeen(convo.id);
      onUpdate({ id: convo.id, seen_at: new Date().toISOString() });
    }
  }, [open, convo.messages.length, unread, convo.id, onUpdate]);

  const run = async (action: () => Promise<ChatConversation>) => {
    setBusy(true);
    setError(null);
    try {
      const row = await action();
      onUpdate({ id: row.id, messages: row.messages, mode: row.mode, needs_agent: row.needs_agent, seen_at: row.seen_at, last_message_at: row.last_message_at });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (await run(() => agentReply(convo.id, text))) setText('');
  };

  const deleteButton = canDelete && (
    <button type="button" onClick={() => onDelete(convo.id)} className="text-xs font-medium text-rose-600 hover:underline inline-flex items-center gap-1">
      <Trash2 className="w-3 h-3" /> Delete conversation
    </button>
  );

  return (
    <li className={convo.needs_agent ? 'bg-amber-50/50' : ''}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full text-left p-3 flex items-start gap-3 hover:bg-slate-50">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${unread ? 'bg-sky-500' : 'bg-transparent'}`} aria-label={unread ? 'Unread' : undefined} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm truncate text-slate-900 ${unread ? 'font-semibold' : ''}`}>{first || '(no message)'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {relativeTime(convo.last_message_at)} · {convo.visitor_messages} message{convo.visitor_messages === 1 ? '' : 's'}{page ? ` · ${page}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {convo.needs_agent && (
            <span className="text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><Hand className="w-3 h-3" /> Wants a person</span>
          )}
          {convo.mode === 'agent' && (
            <span className="text-xs font-medium text-violet-700 bg-violet-50 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><Headset className="w-3 h-3" /> Team chatting</span>
          )}
          {convo.lead && (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><UserPlus className="w-3 h-3" /> {convo.lead.customer_name}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {convo.lead && (
            <p className="text-xs text-slate-600">
              Lead: {convo.lead.customer_name}{convo.lead.email ? ` · ${convo.lead.email}` : ''}{convo.lead.phone ? ` · ${convo.lead.phone}` : ''} · <Link to="/leads" className="text-sky-600 hover:underline">Open Leads</Link>
            </p>
          )}
          <div className="rounded-xl bg-slate-50 p-3 space-y-2 max-h-96 overflow-y-auto">
            {convo.messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'visitor' ? 'items-end' : 'items-start'}`}>
                {m.role !== 'visitor' && (
                  <span className="text-[11px] text-slate-400 mb-0.5 px-1">{m.role === 'agent' ? `${m.name ?? 'Team'} (team)` : m.ai ? 'AI assistant' : 'Automatic reply'}</span>
                )}
                <p className={`max-w-[85%] text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap ${m.role === 'visitor' ? 'bg-sky-600 text-white' : m.role === 'agent' ? 'bg-violet-50 border border-violet-200 text-slate-800' : 'bg-white border border-slate-200 text-slate-800'}`}>{m.text}</p>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {canReply ? (
            <form onSubmit={send} className="space-y-2">
              <div className="flex gap-2">
                <textarea
                  className="input-field flex-1 text-sm"
                  rows={2}
                  maxLength={2000}
                  placeholder={convo.mode === 'agent' ? 'Type your reply…' : 'Reply as a team member (the AI will stop answering)…'}
                  aria-label="Your reply"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button type="submit" disabled={busy || !text.trim()} className="btn-primary text-sm self-end">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs">
                {convo.mode === 'agent' ? (
                  <button type="button" disabled={busy} onClick={() => run(() => setChatMode(convo.id, 'ai'))} className="font-medium text-sky-600 hover:underline inline-flex items-center gap-1">
                    <Bot className="w-3 h-3" /> Hand back to the AI
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => run(() => setChatMode(convo.id, 'agent'))} className="font-medium text-violet-700 hover:underline inline-flex items-center gap-1">
                    <Headset className="w-3 h-3" /> Take over (pause the AI)
                  </button>
                )}
                {deleteButton}
                {error && <span className="text-rose-700">{error}</span>}
              </div>
            </form>
          ) : deleteButton}
        </div>
      )}
    </li>
  );
}
