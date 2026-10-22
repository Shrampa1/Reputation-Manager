import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowLeft, ArrowUp, Check, CheckCircle2, Copy, Download, ExternalLink, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import {
  FIELD_TYPES,
  deleteSubmission,
  embedSnippet,
  fetchLeadForm,
  fetchSubmissions,
  newField,
  publicFormUrl,
  saveLeadForm,
  slugify,
  submissionsCsv,
  type FieldType,
  type FormField,
  type FormSubmission,
  type LeadForm,
} from '@/lib/leadForms';
import { downloadText } from '@/lib/liveChat';
import { LeadFormView } from '@/components/forms/LeadFormView';

type Tab = 'fields' | 'form' | 'page' | 'share' | 'submissions';
const TABS: [Tab, string][] = [['fields', 'Fields'], ['form', 'Form'], ['page', 'Landing page'], ['share', 'Share'], ['submissions', 'Submissions']];

/** C2: build a lead form, its landing page, then share it and see what comes in. */
export function LeadFormEditorPage() {
  const { id = '' } = useParams();
  const { location, can } = useLocationContext();
  const canEdit = can('leads.manage');
  const [form, setForm] = useState<LeadForm | null>(null);
  const [saved, setSaved] = useState<LeadForm | null>(null);
  const [tab, setTab] = useState<Tab>('fields');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetchLeadForm(id)
      .then((f) => {
        if (!f) return setLoadError('Form not found.');
        setForm(f);
        setSaved(f);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Couldn’t load the form'));
  }, [id]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  if (loadError) return <p className="text-sm text-rose-700">{loadError} <Link to="/forms" className="text-sky-600 hover:underline">Back to forms</Link></p>;
  if (!form) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  const set = <K extends keyof LeadForm>(k: K, v: LeadForm[K]) => setForm({ ...form, [k]: v });
  const setField = (i: number, patch: Partial<FormField>) => set('fields', form.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...form.fields];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set('fields', next);
  };

  const save = async (patch?: Partial<LeadForm>) => {
    const merged = { ...form, ...patch };
    // Blank option lines are only there while typing
    const next = { ...merged, fields: merged.fields.map((f) => (f.options ? { ...f, options: f.options.map((o) => o.trim()).filter(Boolean) } : f)) };
    if (!next.fields.length) return setMessage({ ok: false, text: 'Add at least one field.' });
    if (next.fields.some((f) => !f.label.trim())) return setMessage({ ok: false, text: 'Every field needs a label.' });
    if (next.settings.redirect_url && !/^https:\/\//i.test(next.settings.redirect_url)) return setMessage({ ok: false, text: 'The thank-you page address must start with https://' });
    if (next.status === 'published' && !next.fields.some((f) => f.type === 'email' || f.type === 'phone')) {
      return setMessage({ ok: false, text: 'Add an email or phone field before publishing, so you can reply to the lead.' });
    }
    setSaving(true);
    setMessage(null);
    try {
      const s = await saveLeadForm(next);
      setForm(s);
      setSaved(s);
      setMessage({ ok: true, text: s.status === 'published' ? 'Saved. The form is live.' : 'Saved as a draft.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t save' });
    } finally {
      setSaving(false);
    }
  };

  const preview = { fields: form.fields, settings: form.settings, page: form.page, business: { name: location?.name, phone: location?.phone, website: location?.website, address: location?.address } };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/forms" className="p-1 text-slate-500 hover:text-slate-800" aria-label="Back to forms"><ArrowLeft className="w-5 h-5" /></Link>
        <input className="text-xl font-bold text-slate-900 bg-transparent border-0 focus:ring-2 focus:ring-sky-300 rounded-lg px-1 min-w-0 flex-1" value={form.name} maxLength={80} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} aria-label="Form name" />
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${form.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{form.status === 'published' ? 'Live' : 'Draft'}</span>
        {canEdit && (
          <div className="flex items-center gap-2">
            {form.status === 'published'
              ? <button type="button" onClick={() => save({ status: 'draft' })} disabled={saving} className="btn-secondary text-sm">Unpublish</button>
              : <button type="button" onClick={() => save({ status: 'published' })} disabled={saving} className="btn-secondary text-sm">Publish</button>}
            <button type="button" onClick={() => save()} disabled={saving || !dirty} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
          </div>
        )}
      </div>
      {message && (
        <p className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
        </p>
      )}

      <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto" aria-label="Form sections">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {label}{t === 'submissions' && form.submissions > 0 && ` ${form.submissions}`}
          </button>
        ))}
      </nav>

      {tab === 'submissions' ? (
        <Submissions form={form} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,560px)] gap-4 items-start">
          <fieldset disabled={!canEdit} className="card p-5 space-y-4">
            {tab === 'fields' && (
              <>
                {form.fields.map((f, i) => (
                  <div key={f.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input className="input-field text-sm flex-1" value={f.label} maxLength={120} onChange={(e) => setField(i, { label: e.target.value })} aria-label="Field label" />
                      <select className="input-field !w-auto text-sm" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType, ...(['select', 'checkbox'].includes(e.target.value) && !f.options?.length ? { options: ['Option 1', 'Option 2'] } : {}) })} aria-label="Field type">
                        {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                      <button type="button" disabled={i === form.fields.length - 1} onClick={() => move(i, 1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                      <button type="button" onClick={() => set('fields', form.fields.filter((_, j) => j !== i))} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove field"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <label className="flex items-center gap-1.5 text-slate-700"><input type="checkbox" className="rounded border-slate-300" checked={Boolean(f.required)} onChange={(e) => setField(i, { required: e.target.checked })} /> Required</label>
                      {!['select', 'checkbox'].includes(f.type) && (
                        <input className="input-field text-sm !w-auto flex-1 min-w-[160px]" placeholder="Placeholder (optional)" value={f.placeholder ?? ''} maxLength={120} onChange={(e) => setField(i, { placeholder: e.target.value })} aria-label="Placeholder" />
                      )}
                      <select className="input-field text-sm !w-auto" value={f.role ?? ''} onChange={(e) => setField(i, { role: (e.target.value || undefined) as FormField['role'] })} aria-label="Use as">
                        <option value="">Not used for the lead</option>
                        <option value="name">Lead’s name</option>
                        <option value="email">Lead’s email</option>
                        <option value="phone">Lead’s phone</option>
                        <option value="message">Lead’s message</option>
                      </select>
                    </div>
                    {['select', 'checkbox'].includes(f.type) && (
                      <textarea className="input-field text-sm" rows={3} placeholder="One option per line" value={(f.options ?? []).join('\n')}
                        onChange={(e) => setField(i, { options: e.target.value.split('\n').map((o) => o.slice(0, 100)).filter((o, k, a) => o.trim() || k === a.length - 1).slice(0, 30) })} aria-label="Options" />
                    )}
                  </div>
                ))}
                {form.fields.length < 30 && (
                  <div className="flex gap-2 flex-wrap">
                    {FIELD_TYPES.map((t) => (
                      <button key={t.type} type="button" onClick={() => set('fields', [...form.fields, newField(t.type)])} className="btn-secondary text-xs !py-1"><Plus className="w-3 h-3" /> {t.label}</button>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === 'form' && (
              <>
                <Text label="Title above the form" value={form.settings.title} onChange={(v) => set('settings', { ...form.settings, title: v })} max={120} />
                <Text label="Short description" value={form.settings.description} onChange={(v) => set('settings', { ...form.settings, description: v })} max={500} area />
                <Text label="Button" value={form.settings.submit_label} placeholder="Send" onChange={(v) => set('settings', { ...form.settings, submit_label: v })} max={40} />
                <Text label="Message after sending" value={form.settings.success_message} placeholder="Thanks! We’ve got your details and will be in touch soon." onChange={(v) => set('settings', { ...form.settings, success_message: v })} max={500} area />
                <Text label="…or send people to your own thank-you page (https://)" value={form.settings.redirect_url} onChange={(v) => set('settings', { ...form.settings, redirect_url: v })} max={500} />
                <Text label="Consent checkbox (optional, required to send when set)" value={form.settings.consent_text} placeholder="I agree to be contacted about my enquiry." onChange={(v) => set('settings', { ...form.settings, consent_text: v })} max={1000} area />
                <div>
                  <p className="block text-sm font-medium text-slate-700 mb-1.5">Colour</p>
                  <input type="color" className="h-[42px] w-20 rounded-lg border border-slate-300 cursor-pointer" value={form.settings.accent || '#0284c7'} onChange={(e) => set('settings', { ...form.settings, accent: e.target.value })} aria-label="Colour" />
                </div>
              </>
            )}

            {tab === 'page' && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <input type="checkbox" className="rounded border-slate-300" checked={form.page.enabled !== false} onChange={(e) => set('page', { ...form.page, enabled: e.target.checked })} /> Show a landing page around the form
                </label>
                {form.page.enabled !== false && (
                  <>
                    <Text label="Headline" value={form.page.headline} onChange={(v) => set('page', { ...form.page, headline: v })} max={120} />
                    <Text label="Text under the headline" value={form.page.subheadline} onChange={(v) => set('page', { ...form.page, subheadline: v })} max={600} area />
                    <Text label="Bullet points (one per line)" value={(form.page.bullets ?? []).join('\n')} onChange={(v) => set('page', { ...form.page, bullets: v.split('\n').slice(0, 8) })} max={800} area />
                    <Text label="Image (https:// address, optional)" value={form.page.image_url} onChange={(v) => set('page', { ...form.page, image_url: v })} max={500} />
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" className="rounded border-slate-300" checked={form.page.show_contact !== false} onChange={(e) => set('page', { ...form.page, show_contact: e.target.checked })} /> Show your phone, website and address
                    </label>
                  </>
                )}
              </>
            )}

            {tab === 'share' && <Share form={form} onSlug={(s) => set('slug', s)} />}
          </fieldset>

          <section className="card overflow-hidden xl:sticky xl:top-4">
            <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Preview</p>
            <div className="max-h-[75vh] overflow-y-auto">
              <LeadFormView form={preview} mode="preview" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Text({ label, value, onChange, max, area, placeholder }: { label: string; value?: string; onChange: (v: string) => void; max: number; area?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {area
        ? <textarea className="input-field text-sm" rows={3} maxLength={max} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        : <input className="input-field text-sm" maxLength={max} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function Share({ form, onSlug }: { form: LeadForm; onSlug: (s: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (what: string, text: string) => navigator.clipboard.writeText(text).then(() => { setCopied(what); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  const url = publicFormUrl(form.slug);
  const snippet = embedSnippet(form.slug);
  return (
    <div className="space-y-4">
      {form.status !== 'published' && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This form is a draft. Publish it (top right) so people can open it.</p>}
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-1.5">Link</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500">{window.location.origin}/f/</span>
          <input className="input-field text-sm !w-auto flex-1 min-w-[160px]" value={form.slug} maxLength={60} onChange={(e) => onSlug(slugify(e.target.value).slice(0, 60))} aria-label="Link ending" />
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={() => copy('link', url)} className="btn-secondary text-sm">{copied === 'link' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} Copy link</button>
          {form.status === 'published' && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm"><ExternalLink className="w-4 h-4" /> Open</a>}
        </div>
        <p className="text-xs text-slate-400 mt-1">Add <code>?utm_source=facebook&amp;utm_campaign=spring</code> to the link to see which ads and posts bring leads.</p>
      </div>
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-1.5">Embed on your website</p>
        <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
        <button type="button" onClick={() => copy('embed', snippet)} className="btn-secondary text-sm mt-2">{copied === 'embed' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} Copy code</button>
        <p className="text-xs text-slate-400 mt-1">Paste it where the form should appear (WordPress: Custom HTML block; Wix: Embed HTML; Shopify: Custom Liquid). The form resizes itself.</p>
      </div>
    </div>
  );
}

function Submissions({ form }: { form: LeadForm }) {
  const { can } = useLocationContext();
  const [rows, setRows] = useState<FormSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchSubmissions(form.id).then(setRows).catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load submissions'));
  }, [form.id]);
  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>;
  const shown = form.fields.slice(0, 4);
  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-200">
        <p className="text-sm font-semibold text-slate-900 flex-1">{rows.length} submission{rows.length === 1 ? '' : 's'}</p>
        {rows.length > 0 && (
          <button type="button" onClick={() => downloadText(`${form.slug}-submissions.csv`, submissionsCsv(form, rows))} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Download CSV</button>
        )}
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-500 p-4">Nothing yet. Share the form to start collecting leads.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                {shown.map((f) => <th key={f.id} className="px-4 py-2 font-medium">{f.label}</th>)}
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-500">{relativeTime(r.created_at)}</td>
                  {shown.map((f) => <td key={f.id} className="px-4 py-2 text-slate-800 max-w-[220px] truncate">{Array.isArray(r.data[f.id]) ? (r.data[f.id] as string[]).join(', ') : r.data[f.id] ?? ''}</td>)}
                  <td className="px-4 py-2 text-xs text-slate-500">{[r.utm.utm_source, r.utm.utm_campaign].filter(Boolean).join(' / ') || (r.page_url ? new URL(r.page_url).hostname : '')}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {r.lead_id && <Link to="/leads" className="text-xs text-sky-600 hover:underline mr-2">Lead</Link>}
                    {can('leads.manage') && (
                      <button type="button" onClick={async () => { await deleteSubmission(r.id); setRows(rows.filter((x) => x.id !== r.id)); }} className="p-1 text-slate-400 hover:text-rose-600" aria-label="Delete submission"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
