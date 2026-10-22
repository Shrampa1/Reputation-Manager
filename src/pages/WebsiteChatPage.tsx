import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import {
  DEFAULT_CHAT,
  MAX_INFO,
  TEXT_DEFAULTS,
  WEEKDAYS,
  chatApi,
  chatSnippet,
  draftBusinessInfo,
  useWebsiteChat,
  type ChatSettings,
  type FieldMode,
  type TextKey,
  type WidgetConfig,
} from '@/lib/websiteChat';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';

const platforms: [string, string][] = [
  ['Shopify', 'Online Store → Themes → Edit code → theme.liquid, paste just before </body>.'],
  ['WordPress', 'Use a header/footer code plugin (e.g. WPCode) and add it to the footer.'],
  ['Wix', 'Settings → Custom code → Add code, place it in Body – end, on all pages.'],
  ['Squarespace', 'Settings → Advanced → Code injection → Footer.'],
  ['Anything else', 'Paste it into every page’s HTML, just before </body>.'],
];

type Section = 'general' | 'appearance' | 'welcome' | 'hours' | 'targeting' | 'texts' | 'calls' | 'install';
const SECTIONS: [Section, string][] = [
  ['general', 'General'], ['appearance', 'Appearance'], ['welcome', 'Welcome & forms'], ['hours', 'Hours'],
  ['targeting', 'Targeting'], ['texts', 'Texts'], ['calls', 'Calls & help'], ['install', 'Install'],
];

const timeZones = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    return [];
  }
})();

/** Live chat → Settings: the AI assistant, how the chat looks and behaves, and the code for the website. */
export function WebsiteChatPage() {
  const { location, can } = useLocationContext();
  const canEdit = can('business.edit');
  const { settings, usage, callsAvailable, loading, loadError, save } = useWebsiteChat();
  const [form, setForm] = useState<ChatSettings>(DEFAULT_CHAT);
  const [section, setSection] = useState<Section>('general');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const key = location?.public_key;
  const snippet = key ? chatSnippet(key) : '';
  const set = <K extends keyof ChatSettings>(k: K, v: ChatSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const w = form.widget;
  const setW = <K extends keyof WidgetConfig>(k: K, v: WidgetConfig[K]) => setForm((f) => ({ ...f, widget: { ...f.widget, [k]: v } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.enabled && form.business_info.trim().length < 30) {
      setSection('general');
      return setMessage({ ok: false, text: 'Tell the assistant a little about your business first (at least a couple of sentences).' });
    }
    if (w.appearance?.logo_url && !/^https:\/\//i.test(w.appearance.logo_url)) {
      setSection('appearance');
      return setMessage({ ok: false, text: 'The logo address must start with https://' });
    }
    setSaving(true);
    setMessage(null);
    const error = await save(form);
    setSaving(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: form.enabled ? 'Saved. The chat on your website updates within 5 minutes.' : 'Saved. The chat is switched off.' });
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
    ? `<!doctype html><html><head><meta charset="utf-8"><title>Your website</title><style>body{margin:0;background:#f1f5f9;font:14px system-ui;color:#64748b;padding:16px}</style></head><body>Your website<script src="${window.location.origin}/chat.js" data-key="${key}" data-api="${chatApi()}?v=${encodeURIComponent(settings.updated_at ?? '')}" data-open="true"></script></body></html>`
    : null;

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <LiveChatHeader subtitle="How the chat looks and behaves on your website, what the AI knows, and the code to add it." />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        <form onSubmit={submit} className="card overflow-hidden">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3" role="tablist" aria-label="Settings sections">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={section === id}
                onClick={() => setSection(id)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${section === id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <fieldset disabled={!canEdit} className="p-5 space-y-5">
            {section === 'general' && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <input type="checkbox" className="rounded border-slate-300" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
                  Chat is on
                </label>
                <div>
                  <div className="flex items-end justify-between gap-2 mb-1.5">
                    <label htmlFor="wc-info" className="block text-sm font-medium text-slate-700">
                      About your business <span className="font-normal text-slate-400">(the AI answers from this and your <Link to="/chat/knowledge" className="text-sky-600 hover:underline">help articles</Link>)</span>
                    </label>
                    {!form.business_info.trim() && location && (
                      <button type="button" className="text-xs font-medium text-sky-600 hover:underline shrink-0" onClick={() => set('business_info', draftBusinessInfo(location.name))}>
                        Start from an outline
                      </button>
                    )}
                  </div>
                  <textarea id="wc-info" className="input-field font-mono text-[13px]" rows={10} maxLength={MAX_INFO}
                    placeholder="What you do, services and prices, opening hours, areas you serve, how to book, policies, common questions…"
                    value={form.business_info} onChange={(e) => set('business_info', e.target.value)} />
                  <p className="text-xs text-slate-400 mt-1">
                    {form.business_info.length.toLocaleString()} / {MAX_INFO.toLocaleString()} characters. Your name, address, phone, website and Google rating are added automatically.
                  </p>
                </div>
                <div>
                  <label htmlFor="wc-greeting" className="block text-sm font-medium text-slate-700 mb-1.5">First message</label>
                  <input id="wc-greeting" className="input-field" maxLength={200} value={form.greeting} onChange={(e) => set('greeting', e.target.value)} required />
                </div>
                <Toggle checked={form.collect_leads} onChange={(v) => set('collect_leads', v)}
                  label="Collect leads"
                  hint="When a visitor wants a quote, booking or callback, the AI asks for their name and email or phone. They appear in Leads and trigger your automations." />
                <Toggle checked={w.suggestions !== false} onChange={(v) => setW('suggestions', v)}
                  label="Suggest follow-up questions"
                  hint="Under each AI answer, 2–3 questions the visitor might ask next, one tap to send." />
              </>
            )}

            {section === 'appearance' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Colour">
                    <input type="color" className="h-[42px] w-20 rounded-lg border border-slate-300 cursor-pointer" value={form.accent} onChange={(e) => set('accent', e.target.value)} aria-label="Colour" />
                  </Field>
                  <Field label="Corner">
                    <select className="input-field" value={form.position} onChange={(e) => set('position', e.target.value as ChatSettings['position'])} aria-label="Corner">
                      <option value="right">Bottom right</option>
                      <option value="left">Bottom left</option>
                    </select>
                  </Field>
                  <Field label="Launcher">
                    <select className="input-field" value={w.appearance?.launcher ?? 'bubble'} onChange={(e) => setW('appearance', { ...w.appearance, launcher: e.target.value as 'bubble' | 'bubble_text' })} aria-label="Launcher">
                      <option value="bubble">Round bubble</option>
                      <option value="bubble_text">Bubble with text</option>
                    </select>
                  </Field>
                  {w.appearance?.launcher === 'bubble_text' && (
                    <Field label="Launcher text">
                      <input className="input-field" maxLength={30} placeholder="Chat with us" value={w.appearance?.launcher_text ?? ''} onChange={(e) => setW('appearance', { ...w.appearance, launcher_text: e.target.value })} aria-label="Launcher text" />
                    </Field>
                  )}
                  <Field label="Header title" hint="your business name if empty">
                    <input className="input-field" maxLength={60} value={w.appearance?.title ?? ''} onChange={(e) => setW('appearance', { ...w.appearance, title: e.target.value })} aria-label="Header title" />
                  </Field>
                  <Field label="Header subtitle" hint="online / away status if empty">
                    <input className="input-field" maxLength={80} value={w.appearance?.subtitle ?? ''} onChange={(e) => setW('appearance', { ...w.appearance, subtitle: e.target.value })} aria-label="Header subtitle" />
                  </Field>
                  <Field label="Logo (image address)" hint="square image, https://">
                    <input className="input-field" type="url" placeholder="https://…/logo.png" value={w.appearance?.logo_url ?? ''} onChange={(e) => setW('appearance', { ...w.appearance, logo_url: e.target.value })} aria-label="Logo address" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Side offset (px)">
                      <input className="input-field" type="number" min={0} max={200} value={w.appearance?.offset_x ?? 20} onChange={(e) => setW('appearance', { ...w.appearance, offset_x: Number(e.target.value) })} aria-label="Side offset" />
                    </Field>
                    <Field label="Bottom offset (px)">
                      <input className="input-field" type="number" min={0} max={200} value={w.appearance?.offset_y ?? 20} onChange={(e) => setW('appearance', { ...w.appearance, offset_y: Number(e.target.value) })} aria-label="Bottom offset" />
                    </Field>
                  </div>
                </div>
                <Toggle checked={Boolean(w.appearance?.hide_on_mobile)} onChange={(v) => setW('appearance', { ...w.appearance, hide_on_mobile: v })} label="Hide on phones" />
                <Toggle checked={w.appearance?.sound !== false} onChange={(v) => setW('appearance', { ...w.appearance, sound: v })} label="Play a sound for new replies" />
              </>
            )}

            {section === 'welcome' && (
              <>
                <ListEditor
                  title="Quick questions"
                  hint="Buttons on the welcome screen. One tap sends the question. Up to 6."
                  items={w.quick_questions ?? []}
                  max={6}
                  placeholder="How much does whitening cost?"
                  onChange={(v) => setW('quick_questions', v)}
                />
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Toggle checked={Boolean(w.prechat?.enabled)} onChange={(v) => setW('prechat', { ...w.prechat, enabled: v })}
                    label="Pre-chat form" hint="Ask for details before the first message. Visitors who leave an email or phone become leads." />
                  {w.prechat?.enabled && (
                    <div className="pl-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(['name', 'email', 'phone'] as const).map((f) => (
                        <Field key={f} label={f === 'name' ? 'Name' : f === 'email' ? 'Email' : 'Phone'}>
                          <select className="input-field" value={w.prechat?.[f] ?? 'off'} onChange={(e) => setW('prechat', { ...w.prechat, [f]: e.target.value as FieldMode })} aria-label={`${f} field`}>
                            <option value="off">Don’t ask</option>
                            <option value="optional">Optional</option>
                            <option value="required">Required</option>
                          </select>
                        </Field>
                      ))}
                      <div className="sm:col-span-2">
                        <Field label="Your own question (optional)">
                          <input className="input-field" maxLength={120} placeholder="What can we help you with?" value={w.prechat?.question ?? ''} onChange={(e) => setW('prechat', { ...w.prechat, question: e.target.value })} aria-label="Custom question" />
                        </Field>
                      </div>
                      <label className="flex items-end gap-2 text-sm text-slate-700 pb-2">
                        <input type="checkbox" className="rounded border-slate-300" checked={Boolean(w.prechat?.question_required)} onChange={(e) => setW('prechat', { ...w.prechat, question_required: e.target.checked })} /> Required
                      </label>
                      <Field label="Form title">
                        <input className="input-field" maxLength={80} placeholder={TEXT_DEFAULTS.prechatTitle} value={w.prechat?.title ?? ''} onChange={(e) => setW('prechat', { ...w.prechat, title: e.target.value })} aria-label="Form title" />
                      </Field>
                      <Field label="Button">
                        <input className="input-field" maxLength={40} placeholder={TEXT_DEFAULTS.prechatStart} value={w.prechat?.button ?? ''} onChange={(e) => setW('prechat', { ...w.prechat, button: e.target.value })} aria-label="Form button" />
                      </Field>
                    </div>
                  )}
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <Toggle checked={Boolean(w.attention?.enabled)} onChange={(v) => setW('attention', { ...w.attention, enabled: v })}
                    label="Attention grabber" hint="A small message next to the chat bubble after a few seconds, once per visit." />
                  {w.attention?.enabled && (
                    <div className="pl-6 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
                      <Field label="Message">
                        <input className="input-field" maxLength={140} value={w.attention?.text ?? ''} onChange={(e) => setW('attention', { ...w.attention, text: e.target.value })} aria-label="Attention message" />
                      </Field>
                      <Field label="After (seconds)">
                        <input className="input-field" type="number" min={1} max={300} value={w.attention?.delay ?? 8} onChange={(e) => setW('attention', { ...w.attention, delay: Number(e.target.value) })} aria-label="Attention delay" />
                      </Field>
                    </div>
                  )}
                </div>
              </>
            )}

            {section === 'hours' && (
              <>
                <Toggle checked={Boolean(w.hours?.enabled)} onChange={(v) => setW('hours', { ...w.hours, enabled: v })}
                  label="Use business hours" hint="Outside these hours the chat says you’re away." />
                {w.hours?.enabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Time zone">
                        <select className="input-field" value={w.hours?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={(e) => setW('hours', { ...w.hours, timezone: e.target.value })} aria-label="Time zone">
                          {(timeZones.length ? timeZones : [Intl.DateTimeFormat().resolvedOptions().timeZone]).map((z) => <option key={z} value={z}>{z}</option>)}
                        </select>
                      </Field>
                      <Field label="Outside hours">
                        <select className="input-field" value={w.hours?.outside ?? 'ai'} onChange={(e) => setW('hours', { ...w.hours, outside: e.target.value as 'ai' | 'form' })} aria-label="Outside hours">
                          <option value="ai">The AI keeps answering</option>
                          <option value="form">Show a “leave a message” form</option>
                        </select>
                      </Field>
                    </div>
                    <div className="space-y-2">
                      {WEEKDAYS.map(([day, label]) => {
                        const range = w.hours?.days?.[day]?.[0];
                        const setDay = (r: { from: string; to: string } | null) => setW('hours', { ...w.hours, days: { ...w.hours?.days, [day]: r ? [r] : [] } });
                        return (
                          <div key={day} className="flex items-center gap-3 flex-wrap text-sm">
                            <label className="flex items-center gap-2 w-32 text-slate-700">
                              <input type="checkbox" className="rounded border-slate-300" checked={Boolean(range)} onChange={(e) => setDay(e.target.checked ? { from: '09:00', to: '17:00' } : null)} /> {label}
                            </label>
                            {range ? (
                              <>
                                <input type="time" className="input-field !w-auto !py-1" value={range.from} onChange={(e) => setDay({ ...range, from: e.target.value })} aria-label={`${label} opens`} />
                                <span className="text-slate-400">to</span>
                                <input type="time" className="input-field !w-auto !py-1" value={range.to} onChange={(e) => setDay({ ...range, to: e.target.value })} aria-label={`${label} closes`} />
                              </>
                            ) : <span className="text-slate-400">Closed</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {section === 'targeting' && (
              <>
                <div className="space-y-3">
                  <Field label="Show the chat on">
                    <select className="input-field" value={w.pages?.mode ?? 'all'} onChange={(e) => setW('pages', { ...w.pages, mode: e.target.value as 'all' | 'only' | 'except' })} aria-label="Show the chat on">
                      <option value="all">Every page</option>
                      <option value="only">Only pages whose address contains…</option>
                      <option value="except">Every page except those containing…</option>
                    </select>
                  </Field>
                  {w.pages?.mode && w.pages.mode !== 'all' && (
                    <ListEditor title="Page addresses containing" hint="For example /pricing or /blog" items={w.pages?.patterns ?? []} max={20} placeholder="/pricing" onChange={(v) => setW('pages', { ...w.pages, patterns: v })} />
                  )}
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <p className="text-sm font-medium text-slate-800">Proactive messages</p>
                  <p className="text-xs text-slate-500 -mt-2">Start the conversation: “on pages containing X, after N seconds, say Y”. Once per visit, only for visitors who haven’t chatted yet.</p>
                  {(w.proactive ?? []).map((rule, i) => {
                    const update = (patch: Partial<typeof rule>) => setW('proactive', (w.proactive ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)));
                    return (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-[150px_100px_1fr_auto] gap-2 items-start">
                        <input className="input-field text-sm" placeholder="Page contains (any)" value={rule.contains ?? ''} onChange={(e) => update({ contains: e.target.value })} aria-label="Page contains" />
                        <input className="input-field text-sm" type="number" min={1} max={600} value={rule.delay ?? 10} onChange={(e) => update({ delay: Number(e.target.value) })} aria-label="After seconds" />
                        <input className="input-field text-sm" maxLength={300} placeholder="Looking at prices? Ask me anything." value={rule.message ?? ''} onChange={(e) => update({ message: e.target.value })} aria-label="Message" />
                        <button type="button" onClick={() => setW('proactive', (w.proactive ?? []).filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-600" aria-label="Remove rule"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                  {(w.proactive ?? []).length < 5 && (
                    <button type="button" onClick={() => setW('proactive', [...(w.proactive ?? []), { contains: '', delay: 15, message: '' }])} className="btn-secondary text-sm">
                      <Plus className="w-4 h-4" /> Add a rule
                    </button>
                  )}
                </div>
              </>
            )}

            {section === 'texts' && (
              <>
                <p className="text-sm text-slate-500">Change any label visitors see, for example to translate the chat. Empty uses the default.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(TEXT_DEFAULTS) as TextKey[]).map((k) => (
                    <Field key={k} label={TEXT_DEFAULTS[k]}>
                      <input className="input-field text-sm" maxLength={120} placeholder={TEXT_DEFAULTS[k]} value={w.texts?.[k] ?? ''} onChange={(e) => setW('texts', { ...w.texts, [k]: e.target.value })} aria-label={TEXT_DEFAULTS[k]} />
                    </Field>
                  ))}
                </div>
              </>
            )}

            {section === 'calls' && (
              <>
                <div className="space-y-2">
                  <Toggle checked={Boolean(w.calls?.enabled)} onChange={(v) => setW('calls', { ...w.calls, enabled: v })} disabled={!callsAvailable}
                    label="Web calls (add-on)" hint="Visitors can call you from the chat, and your team can call visitors who are on the website. Voice, straight in the browser, no phone numbers." />
                  {!callsAvailable && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 ml-6">
                      Web calls are a paid add-on, included in the Agency plan. <Link to="/billing" className="underline">Plan & billing</Link>
                    </p>
                  )}
                  <p className="text-xs text-slate-500 ml-6">The call button shows only while someone on your team is online in Live chat.</p>
                </div>
                <Toggle checked={w.help?.enabled !== false} onChange={(v) => setW('help', { ...w.help, enabled: v })}
                  label="Help tab" hint={<>A Help tab in the chat with your <Link to="/chat/knowledge" className="text-sky-600 hover:underline">help articles</Link> (shown once you have at least one).</>} />
              </>
            )}

            {section === 'install' && (
              <div className="space-y-3">
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
                {key && (
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                    Public help centre: <a href={`/help/${key}`} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">{window.location.origin}/help/{key}</a>
                  </p>
                )}
                {usage && (
                  <p className="text-xs text-slate-500">
                    This month: {usage.used.toLocaleString()} AI answer{usage.used === 1 ? '' : 's'}
                    {usage.limit >= 0 && <> of {usage.limit.toLocaleString()} on your plan (all businesses). After that, the chat asks visitors to contact you directly.</>}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <div className="px-5 pb-5 flex items-center gap-3 flex-wrap">
            {canEdit ? (
              <>
                <button type="submit" disabled={saving} className="btn-primary text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                </button>
                {message && (
                  <span className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
                  </span>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Only members who can edit business settings can change the chat.</p>
            )}
          </div>
        </form>

        <section className="card p-5 space-y-3 xl:sticky xl:top-4">
          <h2 className="text-base font-semibold text-slate-900">Try it</h2>
          {previewDoc ? (
            <>
              <iframe title="Website chat preview" srcDoc={previewDoc} className="w-full h-[640px] rounded-xl border border-slate-200 bg-slate-100" allow="microphone" />
              <p className="text-xs text-slate-500">The real chat with your saved settings. Test messages count towards your monthly allowance and show up in the Inbox.</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">Switch the chat on and save to try it here.</p>
          )}
        </section>
      </div>

      {loadError && (
        <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load the chat settings: {loadError}</p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="block text-sm font-medium text-slate-700 mb-1.5">{label} {hint && <span className="font-normal text-slate-400">({hint})</span>}</p>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-60' : ''}`}>
      <input type="checkbox" className="rounded border-slate-300 mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

function ListEditor({ title, hint, items, max, placeholder, onChange }: { title: string; hint: string; items: string[]; max: number; placeholder: string; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="text-xs text-slate-500 -mt-1">{hint}</p>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input className="input-field text-sm" maxLength={120} placeholder={placeholder} value={item} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`${title} ${i + 1}`} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-600" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => onChange([...items, ''])} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Add</button>
      )}
    </div>
  );
}
