import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle, AlignCenter, AlignLeft, ArrowDown, ArrowLeft, ArrowUp, CalendarClock, CheckCircle2, Copy, Heading, Image, Link2, Loader2, Minus, Save, Send,
  TestTube2, Trash2, Type, XCircle,
} from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { useEmailableContacts } from '@/lib/contacts';
import { renderCampaign, type EmailBlock } from '@/lib/emailRender';
import {
  STATUS_LABEL, STATUS_TONE, audienceCount, cancelCampaign, fetchCampaign, fetchRecipients, newBlock, pct, queueCampaign, saveCampaign,
  sendTestCampaign, useCampaigns, type Campaign, type CampaignRecipient,
} from '@/lib/campaigns';

const BLOCKS: { type: EmailBlock['type']; label: string; icon: typeof Type }[] = [
  { type: 'heading', label: 'Heading', icon: Heading },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'button', label: 'Button', icon: Link2 },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'divider', label: 'Divider', icon: Minus },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** C4: build a campaign (drafts) or see how it did (everything else). */
export function CampaignEditorPage() {
  const { id = '' } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaign(id)
      .then((c) => (c ? setCampaign(c) : setLoadError('Campaign not found.')))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Couldn’t load the campaign'));
  }, [id]);

  // Follow a campaign while it goes out
  const live = campaign?.status === 'scheduled' || campaign?.status === 'sending';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => fetchCampaign(id).then((c) => c && setCampaign(c)).catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [id, live]);

  if (loadError) return <p className="text-sm text-rose-700">{loadError} <Link to="/campaigns" className="text-sky-600 hover:underline">Back to campaigns</Link></p>;
  if (!campaign) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;
  return campaign.status === 'draft'
    ? <Editor key={campaign.id} initial={campaign} onChange={setCampaign} />
    : <Report campaign={campaign} onChange={setCampaign} />;
}

function Preview({ campaign, name = 'Alex Smith' }: { campaign: Campaign; name?: string }) {
  const { location } = useLocationContext();
  const html = useMemo(() => renderCampaign(campaign.content, {
    subject: campaign.subject, preheader: campaign.preheader,
    business: { name: location?.name ?? 'Your business', address: location?.address },
    vars: { name }, unsubscribeUrl: '#',
  }).html, [campaign.content, campaign.subject, campaign.preheader, location, name]);
  const fill = (s: string) => s.replace(/\{first_name\}/g, name.split(' ')[0]).replace(/\{business\}/g, location?.name ?? '');
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-xs">
        <p className="font-semibold text-slate-500 uppercase tracking-wide">Preview</p>
        <p className="text-slate-800 mt-1"><span className="text-slate-500">From:</span> {campaign.from_name.trim() || location?.name}</p>
        <p className="text-slate-800 truncate"><span className="text-slate-500">Subject:</span> <strong>{fill(campaign.subject) || '(no subject)'}</strong>{campaign.preheader && <span className="text-slate-500"> · {fill(campaign.preheader)}</span>}</p>
      </div>
      <iframe title="Email preview" sandbox="" srcDoc={html} className="w-full h-[640px] bg-slate-100 border-0" />
    </section>
  );
}

function Editor({ initial, onChange }: { initial: Campaign; onChange: (c: Campaign) => void }) {
  const { location, can } = useLocationContext();
  const canSend = can('campaigns.send');
  const [c, setC] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [when, setWhen] = useState('');
  const { contacts } = useEmailableContacts(true);
  const tags = useMemo(() => [...new Set(contacts.flatMap((x) => x.tags))].sort(), [contacts]);
  const dirty = JSON.stringify(c) !== JSON.stringify(saved);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    const t = setTimeout(() => audienceCount(location.id, c.audience).then((n) => !cancelled && setCount(n)).catch(() => !cancelled && setCount(null)), 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [location, c.audience]);

  const blocks = c.content.blocks;
  const setBlocks = (b: EmailBlock[]) => setC({ ...c, content: { ...c.content, blocks: b } });
  const setBlock = (i: number, patch: Partial<EmailBlock>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setBlocks(next);
  };

  const problems = () => {
    if (!c.subject.trim()) return 'Add a subject line.';
    if (!blocks.length) return 'Add some content.';
    if (c.reply_to?.trim() && !EMAIL_RE.test(c.reply_to.trim())) return 'The reply-to address isn’t valid.';
    const badButton = blocks.find((b) => b.type === 'button' && !/^(https?:\/\/[^\s]+\.[^\s]+|mailto:|tel:)/i.test(b.url ?? ''));
    if (badButton) return `The “${badButton.label || 'button'}” button needs a full link (https://…).`;
    const badImage = blocks.find((b) => b.type === 'image' && !/^https:\/\/[^\s]+$/i.test(b.src ?? ''));
    if (badImage) return 'Every image needs an https:// address (or remove the empty image).';
    return null;
  };
  const persist = async () => {
    const s = await saveCampaign(c);
    setC(s);
    setSaved(s);
    return s;
  };
  const run = async (what: string, fn: () => Promise<string>) => {
    setBusy(what);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await fn() });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setBusy(null);
    }
  };
  const save = () => run('save', async () => { await persist(); return 'Saved.'; });
  const test = () => run('test', async () => {
    const p = problems();
    if (p) throw new Error(p);
    if (dirty) await persist();
    const r = await sendTestCampaign(c.id);
    return `Test sent to ${r.to}.`;
  });
  const send = (later: boolean) => run(later ? 'schedule' : 'send', async () => {
    const p = problems();
    if (p) throw new Error(p);
    const at = later ? new Date(when) : null;
    if (later && (!when || Number.isNaN(at!.getTime()) || at!.getTime() < Date.now())) throw new Error('Pick a time in the future.');
    if (!window.confirm(later ? `Send to ${count ?? 'your'} contacts on ${at!.toLocaleString()}?` : `Send to ${count ?? 'your'} contacts now?`)) return 'Not sent.';
    if (dirty) await persist();
    const r = await queueCampaign(c.id, at);
    const fresh = await fetchCampaign(c.id);
    if (fresh) onChange(fresh);
    return later ? `Scheduled for ${r.recipients} contacts.` : `Sending to ${r.recipients} contacts.`;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/campaigns" className="p-1 text-slate-500 hover:text-slate-800" aria-label="Back to campaigns"><ArrowLeft className="w-5 h-5" /></Link>
        <input className="text-xl font-bold text-slate-900 bg-transparent border-0 focus:ring-2 focus:ring-sky-300 rounded-lg px-1 min-w-0 flex-1" value={c.name} maxLength={80} onChange={(e) => setC({ ...c, name: e.target.value })} disabled={!canSend} aria-label="Campaign name" />
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
        {canSend && <button type="button" onClick={save} disabled={!!busy || !dirty} className="btn-primary text-sm">{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>}
      </div>
      {message && (
        <p className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
        </p>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,600px)] gap-4 items-start">
        <fieldset disabled={!canSend} className="space-y-4 min-w-0">
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Email</h2>
            <Field label="Subject" value={c.subject} max={150} placeholder="Spring offer for {first_name}" onChange={(v) => setC({ ...c, subject: v })} />
            <Field label="Preview text (shown after the subject in the inbox)" value={c.preheader} max={150} onChange={(v) => setC({ ...c, preheader: v })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="From name" value={c.from_name} max={60} placeholder={location?.name} onChange={(v) => setC({ ...c, from_name: v })} />
              <Field label="Replies go to" value={c.reply_to ?? ''} max={254} placeholder="you@yourbusiness.com" onChange={(v) => setC({ ...c, reply_to: v })} />
            </div>
          </section>

          <section className="card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 flex-1">Content</h2>
              <label className="text-xs text-slate-600 inline-flex items-center gap-1.5">Colour
                <input type="color" className="h-7 w-10 rounded border border-slate-300 cursor-pointer" value={c.content.accent || '#0ea5e9'} onChange={(e) => setC({ ...c, content: { ...c.content, accent: e.target.value } })} />
              </label>
            </div>
            {blocks.map((b, i) => (
              <div key={b.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">{BLOCKS.find((x) => x.type === b.type)?.label}</span>
                  {b.type !== 'divider' && b.type !== 'image' && (
                    <button type="button" onClick={() => setBlock(i, { align: b.align === 'center' ? 'left' : 'center' })} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label={b.align === 'center' ? 'Align left' : 'Centre'}>
                      {b.align === 'center' ? <AlignCenter className="w-4 h-4" /> : <AlignLeft className="w-4 h-4" />}
                    </button>
                  )}
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove block"><Trash2 className="w-4 h-4" /></button>
                </div>
                {b.type === 'heading' && <input className="input-field text-sm font-semibold" maxLength={200} value={b.text ?? ''} onChange={(e) => setBlock(i, { text: e.target.value })} aria-label="Heading" />}
                {b.type === 'text' && <textarea className="input-field text-sm" rows={5} maxLength={5000} value={b.text ?? ''} onChange={(e) => setBlock(i, { text: e.target.value })} aria-label="Text" />}
                {b.type === 'button' && (
                  <div className="grid sm:grid-cols-[1fr_2fr] gap-2">
                    <input className="input-field text-sm" maxLength={60} placeholder="Button text" value={b.label ?? ''} onChange={(e) => setBlock(i, { label: e.target.value })} aria-label="Button text" />
                    <input className="input-field text-sm" maxLength={2000} placeholder="https://yourbusiness.com/book" value={b.url ?? ''} onChange={(e) => setBlock(i, { url: e.target.value.trim() })} aria-label="Button link" />
                  </div>
                )}
                {b.type === 'image' && (
                  <div className="grid gap-2">
                    <input className="input-field text-sm" maxLength={2000} placeholder="Image address (https://…)" value={b.src ?? ''} onChange={(e) => setBlock(i, { src: e.target.value.trim() })} aria-label="Image address" />
                    <div className="grid sm:grid-cols-2 gap-2">
                      <input className="input-field text-sm" maxLength={200} placeholder="Description (for screen readers)" value={b.alt ?? ''} onChange={(e) => setBlock(i, { alt: e.target.value })} aria-label="Image description" />
                      <input className="input-field text-sm" maxLength={2000} placeholder="Link when clicked (optional)" value={b.url ?? ''} onChange={(e) => setBlock(i, { url: e.target.value.trim() })} aria-label="Image link" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {blocks.length < 40 && (
              <div className="flex gap-2 flex-wrap">
                {BLOCKS.map((t) => (
                  <button key={t.type} type="button" onClick={() => setBlocks([...blocks, newBlock(t.type)])} className="btn-secondary text-xs !py-1"><t.icon className="w-3 h-3" /> {t.label}</button>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-500">In text: **bold**, [link text](https://…). Personalise with {'{first_name}'}, {'{name}'} and {'{business}'}. An unsubscribe link and your address are added at the bottom.</p>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Who gets it</h2>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="aud" checked={c.audience.type !== 'tags'} onChange={() => setC({ ...c, audience: { type: 'all' } })} /> Everyone subscribed
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name="aud" checked={c.audience.type === 'tags'} onChange={() => setC({ ...c, audience: { type: 'tags', tags: c.audience.tags ?? [] } })} /> Contacts with any of these tags
            </label>
            {c.audience.type === 'tags' && (
              <div className="flex gap-1.5 flex-wrap pl-6">
                {tags.length === 0 && <span className="text-xs text-slate-500">No tags yet. Add them on the <Link to="/contacts" className="text-sky-600 hover:underline">Contacts</Link> page.</span>}
                {tags.map((t) => {
                  const on = c.audience.tags?.includes(t);
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => setC({ ...c, audience: { type: 'tags', tags: on ? c.audience.tags!.filter((x) => x !== t) : [...(c.audience.tags ?? []), t] } })}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${on ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200 text-slate-600'}`}>{t}</button>
                  );
                })}
              </div>
            )}
            <p className="text-sm text-slate-600"><strong>{count ?? '…'}</strong> contact{count === 1 ? '' : 's'} will get it (people who unsubscribed or bounced are left out).</p>
          </section>

          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Send</h2>
            {message && <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{message.text}</p>}
            {!location?.address && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Add your business address in Settings. Anti-spam laws require a postal address in marketing emails.</p>}
            <div className="flex gap-2 flex-wrap items-center">
              <button type="button" onClick={test} disabled={!!busy} className="btn-secondary text-sm">{busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />} Send me a test</button>
              <button type="button" onClick={() => send(false)} disabled={!!busy || !count} className="btn-primary text-sm">{busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send now</button>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <input type="datetime-local" className="input-field !w-auto text-sm" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Send at" />
              <button type="button" onClick={() => send(true)} disabled={!!busy || !count || !when} className="btn-secondary text-sm">{busy === 'schedule' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />} Schedule</button>
            </div>
          </section>
        </fieldset>
        <div className="xl:sticky xl:top-4"><Preview campaign={c} /></div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      <input className="input-field text-sm" maxLength={max} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

const RECIPIENT_STATUS: Record<CampaignRecipient['status'], string> = {
  queued: 'Waiting', sending: 'Sending', sent: 'Sent', failed: 'Failed', bounced: 'Bounced', complained: 'Marked as spam', cancelled: 'Not sent',
};

function Report({ campaign: c, onChange }: { campaign: Campaign; onChange: (c: Campaign) => void }) {
  const { can, location } = useLocationContext();
  const navigate = useNavigate();
  const { create } = useCampaigns();
  const [rows, setRows] = useState<CampaignRecipient[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'opened' | 'clicked' | 'problems'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchRecipients(c.id).then(setRows).catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load recipients'));
  }, [c.id, c.sent, c.opened, c.clicked]);

  const cancel = async () => {
    if (!window.confirm(c.status === 'scheduled' ? 'Cancel and turn it back into a draft?' : 'Stop sending? Emails already sent stay sent.')) return;
    setBusy(true);
    try {
      await cancelCampaign(c.id);
      const fresh = await fetchCampaign(c.id);
      if (fresh) onChange(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t cancel');
    } finally {
      setBusy(false);
    }
  };
  const duplicate = async () => {
    const copy = await create('blank', `${c.name} (copy)`.slice(0, 80), c);
    navigate(`/campaigns/${copy.id}`);
  };
  const stats: [string, number, string?][] = [
    ['Recipients', c.recipients],
    ['Sent', c.sent],
    ['Delivered', c.delivered, pct(c.delivered, c.sent)],
    ['Opened', c.opened, pct(c.opened, c.sent)],
    ['Clicked', c.clicked, pct(c.clicked, c.sent)],
    ['Unsubscribed', c.unsubscribed, pct(c.unsubscribed, c.sent)],
    ['Bounced', c.bounced],
    ['Marked as spam', c.complained],
    ['Failed', c.failed],
  ];
  const shown = (rows ?? []).filter((r) =>
    filter === 'all' ? true : filter === 'opened' ? r.opened_at : filter === 'clicked' ? r.clicked_at : ['failed', 'bounced', 'complained'].includes(r.status) || r.unsubscribed_at);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/campaigns" className="p-1 text-slate-500 hover:text-slate-800" aria-label="Back to campaigns"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-xl font-bold text-slate-900 flex-1 min-w-0 truncate">{c.name}</h1>
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
        {can('campaigns.send') && (
          <div className="flex gap-2">
            {(c.status === 'scheduled' || c.status === 'sending') && <button type="button" onClick={cancel} disabled={busy} className="btn-secondary text-sm"><XCircle className="w-4 h-4" /> {c.status === 'scheduled' ? 'Cancel' : 'Stop'}</button>}
            <button type="button" onClick={() => duplicate().catch((e) => setError(e.message))} className="btn-secondary text-sm"><Copy className="w-4 h-4" /> Duplicate</button>
          </div>
        )}
      </div>
      <p className="text-sm text-slate-600">
        {c.status === 'scheduled' && c.scheduled_at && `Goes out ${new Date(c.scheduled_at).toLocaleString()} to ${c.recipients} contacts.`}
        {c.status === 'sending' && `Sending: ${c.sent} of ${c.recipients} so far.`}
        {c.status === 'sent' && c.sent_at && `Sent ${new Date(c.sent_at).toLocaleString()}.`}
        {c.status === 'cancelled' && `Stopped${c.sent_at ? ` ${new Date(c.sent_at).toLocaleString()}` : ''} after ${c.sent} emails.`}
        {' '}Subject: <strong>{c.subject.replace(/\{business\}/g, location?.name ?? '')}</strong>
      </p>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.filter(([label, n]) => n > 0 || ['Recipients', 'Sent', 'Opened', 'Clicked', 'Unsubscribed'].includes(label)).map(([label, n, p]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-bold text-slate-900">{p && c.sent ? p : n.toLocaleString()}</p>
            {p && c.sent > 0 && <p className="text-xs text-slate-400">{n.toLocaleString()}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">Opens are approximate: some mail apps load images for privacy (counted as opens) and some block them (not counted). Clicks are exact. Delivered and bounces need the Resend webhook.</p>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,600px)] gap-4 items-start">
        <section className="card overflow-hidden">
          <div className="px-4 py-3 flex gap-1 flex-wrap border-b border-slate-200">
            {([['all', 'Everyone'], ['opened', 'Opened'], ['clicked', 'Clicked'], ['problems', 'Problems & unsubscribes']] as const).map(([f, label]) => (
              <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${filter === f ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>
            ))}
          </div>
          {!rows ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div> : (
            <div className="overflow-x-auto max-h-[640px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50 text-left sticky top-0">
                  <tr><th className="px-4 py-2 font-medium">Contact</th><th className="px-4 py-2 font-medium">Status</th><th className="px-4 py-2 font-medium">Activity</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.slice(0, 1000).map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2"><span className="font-medium text-slate-900">{r.name}</span><span className="block text-xs text-slate-500">{r.email}</span></td>
                      <td className="px-4 py-2 text-xs">
                        <span className={['failed', 'bounced', 'complained'].includes(r.status) ? 'text-rose-700' : 'text-slate-700'}>{RECIPIENT_STATUS[r.status]}</span>
                        {r.error && <span className="block text-slate-400 max-w-[220px] truncate" title={r.error}>{r.error}</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">
                        {[r.opened_at && 'Opened', r.clicked_at && 'Clicked', r.unsubscribed_at && 'Unsubscribed'].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-slate-500">Nobody here yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <Preview campaign={c} />
      </div>
    </div>
  );
}
