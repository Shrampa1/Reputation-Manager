import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, Save } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { DEFAULT_CHAT, MAX_INFO, chatApi, chatSnippet, draftBusinessInfo, useWebsiteChat, type ChatSettings } from '@/lib/websiteChat';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';

const platforms: [string, string][] = [
  ['Shopify', 'Online Store → Themes → Edit code → theme.liquid, paste just before </body>.'],
  ['WordPress', 'Use a header/footer code plugin (e.g. WPCode) and add it to the footer.'],
  ['Wix', 'Settings → Custom code → Add code, place it in Body – end, on all pages.'],
  ['Squarespace', 'Settings → Advanced → Code injection → Footer.'],
  ['Anything else', 'Paste it into every page’s HTML, just before </body>.'],
];

/** Live chat → Settings: the AI assistant, how the chat looks, and the code for the website. */
export function WebsiteChatPage() {
  const { location, can } = useLocationContext();
  const canEdit = can('business.edit');
  const { settings, usage, loading, loadError, save } = useWebsiteChat();
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


  return (
    <div className="space-y-5 max-w-4xl">
      <LiveChatHeader subtitle="An AI assistant answers visitors from what you write below and turns visitors who leave an email or phone number into leads. Your team can take over any chat from the Inbox." />

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
              <p className="text-xs text-slate-500">This is the real assistant: test messages count towards your monthly allowance and show up in the Inbox.</p>
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

      {loadError && (
        <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load the chat settings: {loadError}</p>
      )}
    </div>
  );
}
