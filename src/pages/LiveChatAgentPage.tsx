import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Bot, CheckCircle2, Copy, Facebook, Globe, Instagram, Loader2, Phone, Save, Sparkles } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { CHANNELS, DEFAULT_AGENT, MAX_INSTRUCTIONS, connectMetaMessages, fetchMetaStatus, useAiAgent, type AgentChannel, type AgentConfig, type MetaStatus } from '@/lib/aiAgent';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';

const CHANNEL_ICONS: Record<AgentChannel, typeof Globe> = { web_chat: Globe, messenger: Facebook, instagram: Instagram };

/** W5: the Conversation AI. One agent (name, tone, instructions, knowledge) for every channel. */
export function LiveChatAgentPage() {
  const { can } = useLocationContext();
  const canEdit = can('business.edit');
  const { agent, loading, error, save } = useAiAgent();
  const [form, setForm] = useState<AgentConfig>(DEFAULT_AGENT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!loading) setForm(agent);
  }, [agent, loading]);

  useEffect(() => {
    fetchMetaStatus().then(setMeta).catch((e) => setMetaError(e instanceof Error ? e.message : 'Couldn’t check Facebook and Instagram'));
  }, []);

  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setChannel = (c: AgentChannel, on: boolean) => set('channels', { ...form.channels, [c]: on });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const err = await save(form);
    setSaving(false);
    setMessage(err ? { ok: false, text: err } : { ok: true, text: 'Saved. The AI uses these settings from the next message.' });
  };

  const connect = async () => {
    setConnecting(true);
    setMetaError(null);
    try {
      setMeta(await connectMetaMessages());
    } catch (e) {
      setMetaError(e instanceof Error ? e.message : 'Couldn’t switch messages on');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  const metaReady = Boolean(meta?.facebook?.messaging);

  return (
    <div className="space-y-4">
      <LiveChatHeader subtitle="One AI agent for every channel: it answers from your business details and help articles, and hands over to your team when needed." />
      {error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4 items-start">
        <form onSubmit={submit} className="card p-5 space-y-5">
          <fieldset disabled={!canEdit} className="space-y-5">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-violet-500" />
              <h2 className="text-base font-semibold text-slate-900">Personality</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ag-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name <span className="font-normal text-slate-400">(optional)</span></label>
                <input id="ag-name" className="input-field" maxLength={40} placeholder="Ava" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
                <p className="text-xs text-slate-400 mt-1">Shown on its messages in the chat, and used if someone asks who they’re talking to.</p>
              </div>
              <div>
                <label htmlFor="ag-tone" className="block text-sm font-medium text-slate-700 mb-1.5">Tone</label>
                <select id="ag-tone" className="input-field" value={form.tone ?? 'friendly'} onChange={(e) => set('tone', e.target.value as AgentConfig['tone'])}>
                  <option value="friendly">Warm and friendly</option>
                  <option value="professional">Polite and professional</option>
                  <option value="casual">Relaxed and casual</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="ag-ins" className="block text-sm font-medium text-slate-700 mb-1.5">Your instructions <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea id="ag-ins" className="input-field text-sm" rows={6} maxLength={MAX_INSTRUCTIONS}
                placeholder={'Always mention we have free parking.\nIf someone asks about emergencies, give them our phone number straight away.\nNever discuss prices for implants; offer a free consultation instead.'}
                value={form.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">
                {(form.instructions ?? '').length} / {MAX_INSTRUCTIONS}. What it knows comes from <Link to="/chat/settings" className="text-sky-600 hover:underline">About your business</Link> and your <Link to="/chat/knowledge" className="text-sky-600 hover:underline">help articles</Link>; it never makes up prices or promises.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h2 className="text-base font-semibold text-slate-900">Where the AI answers</h2>
              <ul className="space-y-2">
                {CHANNELS.map(({ id, label }) => {
                  const Icon = CHANNEL_ICONS[id];
                  const on = id === 'web_chat' ? form.channels?.web_chat !== false : form.channels?.[id] === true;
                  const unavailable = id !== 'web_chat' && !metaReady;
                  return (
                    <li key={id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                      <Icon className="w-5 h-5 text-slate-500 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        <p className="text-xs text-slate-500">
                          {on ? 'The AI answers first; your team can take over any conversation.' : 'Messages wait for your team in the Inbox.'}
                          {unavailable && ' Switch Messenger & Instagram messages on first (right).'}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 shrink-0">
                        <input type="checkbox" className="rounded border-slate-300" checked={on} onChange={(e) => setChannel(id, e.target.checked)} />
                        AI on
                      </label>
                    </li>
                  );
                })}
                <li className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 p-3 opacity-80">
                  <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">Web calls</p>
                    <p className="text-xs text-slate-500">Calls ring your team. Calls show up in the same conversation as the chat, so the AI and your team see the whole history.</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="rounded border-slate-300 mt-0.5" checked={form.assist !== false} onChange={(e) => set('assist', e.target.checked)} />
                <span>
                  <span className="font-medium text-slate-800 inline-flex items-center gap-1"><Sparkles className="w-4 h-4 text-violet-500" /> AI assistant for your team</span>
                  <span className="block text-xs text-slate-500 mt-0.5">“Summarize” and “Suggest a reply” buttons in every Inbox conversation. Suggestions are drafts your team reviews before sending.</span>
                </span>
              </label>
            </div>
          </fieldset>
          <div className="flex items-center gap-3 flex-wrap">
            {canEdit ? (
              <>
                <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
                {message && (
                  <span className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
                  </span>
                )}
              </>
            ) : <p className="text-xs text-slate-500">Only members who can edit business settings can change the AI agent.</p>}
          </div>
        </form>

        <section className="card p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Messenger & Instagram</h2>
          <p className="text-sm text-slate-500">Messages to your Facebook Page and Instagram account arrive in the Live chat inbox, next to website chats.</p>
          {!meta && !metaError && <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />}
          {meta && (
            <ul className="space-y-2 text-sm">
              <StatusRow ok={Boolean(meta.facebook?.connected)} label={meta.facebook?.connected ? `Facebook Page: ${meta.facebook.name ?? 'connected'}` : 'Facebook Page not connected'} />
              <StatusRow ok={Boolean(meta.instagram?.connected)} label={meta.instagram?.connected ? `Instagram: ${meta.instagram.name ?? 'connected'}` : 'Instagram not linked to the Page'} />
              <StatusRow ok={metaReady} label={metaReady ? 'Messages are on' : 'Messages are off'} />
              <StatusRow ok={meta.secrets.appSecret && meta.secrets.verifyToken} label={meta.secrets.appSecret && meta.secrets.verifyToken ? 'Server secrets set' : 'Server secrets missing (see the setup guide)'} />
            </ul>
          )}
          {meta && !meta.facebook?.connected && (
            <Link to="/integrations" className="btn-secondary text-sm">Connect Facebook in Integrations</Link>
          )}
          {meta?.facebook?.connected && !metaReady && can('integrations.manage') && (
            <div className="space-y-2">
              <button type="button" onClick={connect} disabled={connecting} className="btn-primary text-sm">
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />} Switch messages on
              </button>
              <p className="text-xs text-slate-500">If Facebook asks for new permissions, <Link to="/integrations" className="text-sky-600 hover:underline">reconnect Facebook</Link> first (the messaging permissions were added).</p>
            </div>
          )}
          {metaError && <p className="text-sm text-rose-700">{metaError}</p>}
          {meta && (
            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Meta app webhook (one-time setup)</p>
              <p className="text-xs text-slate-500">Callback URL:</p>
              <CopyLine text={meta.webhookUrl} />
              <p className="text-xs text-slate-500">Verify token: the value of the <code>META_WEBHOOK_VERIFY_TOKEN</code> secret. Subscribe to <b>messages</b> for Page and Instagram.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />}
      <span className={ok ? 'text-slate-700' : 'text-slate-600'}>{label}</span>
    </li>
  );
}

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-[11px] bg-slate-100 rounded-lg px-2 py-1.5 break-all">{text}</code>
      <button type="button" className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="Copy"
        onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {})}>
        {done ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
