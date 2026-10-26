import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle, AlignCenter, ArrowLeft, AlignLeft, ArrowDown, ArrowUp, Check, CheckCircle2, Copy, CopyPlus, ExternalLink, Loader2, Monitor, Plus, Save, Smartphone, Trash2,
} from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { slugify, useLeadForms } from '@/lib/leadForms';
import { useChatWidgets } from '@/lib/chatWidgets';
import { domainLinksFor } from '@/lib/domains';
import { supabase } from '@/lib/supabase';
import type { PublicFormData } from '@/components/forms/LeadFormView';
import { FunnelRenderer } from '@/components/funnels/FunnelRenderer';
import {
  BLOCK_TYPES, FONTS, addStep, blockLabel, deleteStep, fetchFunnel, newBlock, publicFunnelUrl, saveFunnel, saveStep, validGa, validPixel,
  type Background, type Block, type Funnel, type FunnelStep, type PublicFunnel,
} from '@/lib/funnels';

type Tab = 'build' | 'settings' | 'share';
const TABS: [Tab, string][] = [['build', 'Build'], ['settings', 'Settings'], ['share', 'Share & stats']];
const BACKGROUNDS: [Background, string][] = [['white', 'White'], ['muted', 'Light grey'], ['accent', 'Brand colour'], ['dark', 'Dark']];
const newId = () => Math.random().toString(36).slice(2, 10);

/** D2: build a funnel's pages from blocks, set it up, publish and share it. */
export function FunnelEditorPage() {
  const { id = '' } = useParams();
  const { location, can } = useLocationContext();
  const canEdit = can('leads.manage');
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [savedFunnel, setSavedFunnel] = useState<Funnel | null>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [savedSteps, setSavedSteps] = useState<Record<string, string>>({});
  const [stepId, setStepId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('build');
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const { forms } = useLeadForms();
  const [reviews, setReviews] = useState<PublicFunnel['reviews']>([]);

  useEffect(() => {
    fetchFunnel(id)
      .then((r) => {
        if (!r) return setLoadError('Funnel not found.');
        setFunnel(r.funnel);
        setSavedFunnel(r.funnel);
        setSteps(r.steps);
        setSavedSteps(Object.fromEntries(r.steps.map((s) => [s.id, JSON.stringify(s)])));
        setStepId(r.steps[0]?.id ?? null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Couldn’t load the funnel'));
  }, [id]);

  // The same reviews the public page shows, for the preview
  useEffect(() => {
    if (!location) return;
    supabase.from('reviews').select('author_name, rating, content, platform').eq('location_id', location.id).gte('rating', 4)
      .order('review_date', { ascending: false }).limit(30)
      .then(({ data }) => setReviews((data ?? []).filter((r) => (r.content ?? '').trim().length >= 20).slice(0, 9)
        .map((r) => ({ author: r.author_name, rating: r.rating, text: String(r.content).slice(0, 400), platform: r.platform }))));
  }, [location]);

  const loadForm = useCallback(async (formSlug: string): Promise<PublicFormData | null> => {
    const f = forms.find((x) => x.slug === formSlug);
    return f ? { fields: f.fields, settings: f.settings, page: f.page, business: { name: location?.name } } : null;
  }, [forms, location]);

  const dirtySteps = steps.filter((s) => savedSteps[s.id] !== JSON.stringify(s));
  const dirty = JSON.stringify(funnel) !== JSON.stringify(savedFunnel) || dirtySteps.length > 0;
  const step = steps.find((s) => s.id === stepId) ?? steps[0] ?? null;

  if (loadError) return <p className="text-sm text-rose-700">{loadError} <Link to="/funnels" className="text-sky-600 hover:underline">Back to funnels</Link></p>;
  if (!funnel || !location) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  const setStep = (patch: Partial<FunnelStep>) => step && setSteps((ss) => ss.map((s) => (s.id === step.id ? { ...s, ...patch } : s)));
  const setBlocks = (blocks: Block[]) => setStep({ blocks });
  const setSettings = (patch: Partial<Funnel['settings']>) => setFunnel({ ...funnel, settings: { ...funnel.settings, ...patch } });

  const save = async (status?: Funnel['status']) => {
    const next = { ...funnel, ...(status ? { status } : {}) };
    if (next.settings.meta_pixel_id && !validPixel(next.settings.meta_pixel_id)) return setMessage({ ok: false, text: 'The Meta Pixel ID is the number from Events Manager (digits only).' });
    if (next.settings.ga_id && !validGa(next.settings.ga_id)) return setMessage({ ok: false, text: 'The Google Analytics ID looks like G-XXXXXXX.' });
    if (next.status === 'published' && steps.some((s) => !s.blocks.length)) return setMessage({ ok: false, text: 'Every step needs at least one block before publishing.' });
    setSaving(true);
    setMessage(null);
    try {
      const savedRows = await Promise.all(dirtySteps.map(saveStep));
      setSavedSteps((m) => ({ ...m, ...Object.fromEntries(savedRows.map((s) => [s.id, JSON.stringify(s)])) }));
      setSteps((ss) => ss.map((s) => savedRows.find((r) => r.id === s.id) ?? s));
      const f = await saveFunnel(next);
      setFunnel(f);
      setSavedFunnel(f);
      setMessage({ ok: true, text: f.status === 'published' ? 'Saved. The funnel is live.' : 'Saved as a draft.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t save' });
    } finally {
      setSaving(false);
    }
  };

  const newStep = async () => {
    const name = window.prompt('Name of the new step (e.g. Booking, Thank you, Upsell)');
    if (!name?.trim()) return;
    try {
      const s = await addStep(funnel.id, location.id, name, (steps[steps.length - 1]?.position ?? -1) + 1, steps.map((x) => x.slug));
      setSteps((ss) => [...ss, s]);
      setSavedSteps((m) => ({ ...m, [s.id]: JSON.stringify(s) }));
      setStepId(s.id);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t add the step' });
    }
  };
  const moveStep = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSteps(next.map((s, k) => ({ ...s, position: k })));
  };
  const removeStep = async (s: FunnelStep) => {
    if (steps.length === 1) return setMessage({ ok: false, text: 'A funnel needs at least one step.' });
    if (!window.confirm(`Delete the step “${s.name}”?`)) return;
    const { error } = await deleteStep(s.id);
    if (error) return setMessage({ ok: false, text: error.message });
    const rest = steps.filter((x) => x.id !== s.id);
    setSteps(rest);
    setStepId(rest[0]?.id ?? null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/funnels" className="p-1 text-slate-500 hover:text-slate-800" aria-label="Back to funnels"><ArrowLeft className="w-5 h-5" /></Link>
        <input className="text-xl font-bold text-slate-900 bg-transparent border-0 focus:ring-2 focus:ring-sky-300 rounded-lg px-1 min-w-0 flex-1" value={funnel.name} maxLength={80} onChange={(e) => setFunnel({ ...funnel, name: e.target.value })} disabled={!canEdit} aria-label="Funnel name" />
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${funnel.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{funnel.status === 'published' ? 'Live' : 'Draft'}</span>
        {funnel.status === 'published' && <a href={publicFunnelUrl(funnel.slug)} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm"><ExternalLink className="w-4 h-4" /> Open</a>}
        {canEdit && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => save(funnel.status === 'published' ? 'draft' : 'published')} disabled={saving} className="btn-secondary text-sm">{funnel.status === 'published' ? 'Unpublish' : 'Publish'}</button>
            <button type="button" onClick={() => save()} disabled={saving || !dirty} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
          </div>
        )}
      </div>
      {message && (
        <p className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
        </p>
      )}
      <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto" aria-label="Funnel sections">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </nav>

      {tab === 'build' && step && (
        <div className="grid grid-cols-1 xl:grid-cols-[190px_minmax(0,1fr)_minmax(0,1.15fr)] gap-4 items-start">
          {/* Steps */}
          <section className="card p-2 space-y-1" aria-label="Steps">
            <p className="px-2 pt-1 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Steps</p>
            {steps.map((s, i) => (
              <div key={s.id} className={`group rounded-lg flex items-center ${s.id === step.id ? 'bg-sky-50 text-sky-800' : 'hover:bg-slate-50 text-slate-700'}`}>
                <button type="button" onClick={() => { setStepId(s.id); setBlockId(null); }} className="flex-1 text-left px-2 py-2 text-sm min-w-0">
                  <span className="text-xs text-slate-400 mr-1">{i + 1}.</span><span className="font-medium truncate">{s.name}</span>
                </button>
                {canEdit && (
                  <span className="hidden group-hover:flex pr-1">
                    <button type="button" disabled={i === 0} onClick={() => moveStep(i, -1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${s.name} up`}><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label={`Move ${s.name} down`}><ArrowDown className="w-3.5 h-3.5" /></button>
                  </span>
                )}
              </div>
            ))}
            {canEdit && steps.length < 10 && <button type="button" onClick={newStep} className="w-full btn-secondary text-xs !py-1.5 mt-2"><Plus className="w-3.5 h-3.5" /> Add step</button>}
          </section>

          {/* Blocks */}
          <fieldset disabled={!canEdit} className="space-y-3 min-w-0">
            <section className="card p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Step name"><input className="input-field text-sm" maxLength={60} value={step.name} onChange={(e) => setStep({ name: e.target.value })} /></Field>
                <Field label="Address">
                  <div className="flex items-center gap-1 text-sm text-slate-500">/s/{funnel.slug}/
                    <input className="input-field text-sm !w-auto flex-1 min-w-[80px]" maxLength={40} value={step.slug} onChange={(e) => setStep({ slug: slugify(e.target.value).slice(0, 40) || 'step' })} aria-label="Step address" />
                  </div>
                </Field>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-600">Search & sharing for this step</summary>
                <div className="grid gap-3 mt-3">
                  <Field label="Page title" hint="the funnel’s title if empty"><input className="input-field text-sm" maxLength={70} value={step.seo.title ?? ''} onChange={(e) => setStep({ seo: { ...step.seo, title: e.target.value } })} /></Field>
                  <Field label="Description" hint="shown in Google and when shared"><textarea className="input-field text-sm" rows={2} maxLength={160} value={step.seo.description ?? ''} onChange={(e) => setStep({ seo: { ...step.seo, description: e.target.value } })} /></Field>
                </div>
              </details>
              {canEdit && steps.length > 1 && <button type="button" onClick={() => removeStep(step)} className="text-xs text-rose-600 hover:underline">Delete this step</button>}
            </section>

            {step.blocks.map((b, i) => (
              <BlockCard key={b.id} b={b} open={blockId === b.id} onOpen={() => setBlockId(blockId === b.id ? null : b.id)} forms={forms}
                first={i === 0} last={i === step.blocks.length - 1}
                onChange={(patch) => setBlocks(step.blocks.map((x) => (x.id === b.id ? { ...x, ...patch } : x)))}
                onMove={(d) => { const next = [...step.blocks]; [next[i], next[i + d]] = [next[i + d], next[i]]; setBlocks(next); }}
                onCopy={() => { const copy = { ...structuredClone(b), id: newId() }; const next = [...step.blocks]; next.splice(i + 1, 0, copy); setBlocks(next); setBlockId(copy.id); }}
                onDelete={() => setBlocks(step.blocks.filter((x) => x.id !== b.id))} />
            ))}
            {step.blocks.length < 40 && (
              <section className="card p-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Add a block{blockId ? ' (after the selected one)' : ''}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {BLOCK_TYPES.map((t) => (
                    <button key={t.type} type="button" className="btn-secondary text-xs !py-1"
                      onClick={() => {
                        const nb = newBlock(t.type);
                        const at = blockId ? step.blocks.findIndex((x) => x.id === blockId) + 1 : step.blocks.length;
                        const next = [...step.blocks];
                        next.splice(at, 0, nb);
                        setBlocks(next);
                        setBlockId(nb.id);
                      }}><Plus className="w-3 h-3" /> {t.label}</button>
                  ))}
                </div>
              </section>
            )}
          </fieldset>

          {/* Preview */}
          <section className="card overflow-hidden xl:sticky xl:top-4">
            <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-200 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">Preview · click a block to edit it</p>
              <button type="button" onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'} className={`p-1.5 rounded ${device === 'desktop' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-400'}`} aria-label="Desktop"><Monitor className="w-4 h-4" /></button>
              <button type="button" onClick={() => setDevice('phone')} aria-pressed={device === 'phone'} className={`p-1.5 rounded ${device === 'phone' ? 'bg-white shadow-sm text-sky-700' : 'text-slate-400'}`} aria-label="Phone"><Smartphone className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto bg-slate-100">
              <div className={device === 'phone' ? 'w-[390px] max-w-full mx-auto my-4 rounded-2xl overflow-hidden shadow-lg bg-white' : 'bg-white'}>
                <FunnelRenderer blocks={step.blocks} ctx={{
                  settings: funnel.settings,
                  business: { name: location.name, phone: location.phone ?? null, website: location.website ?? null, address: location.address ?? null, rating: null, reviewCount: null, reviewLink: null },
                  reviews, narrow: device === 'phone', loadForm, selected: blockId, onSelect: (bid) => setBlockId(bid),
                }} />
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'settings' && <SettingsTab funnel={funnel} set={setSettings} disabled={!canEdit} />}
      {tab === 'share' && <ShareTab funnel={funnel} steps={steps} onSlug={(slug) => setFunnel({ ...funnel, slug })} disabled={!canEdit} />}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label} {hint && <span className="font-normal text-slate-400">({hint})</span>}</span>
      {children}
    </label>
  );
}

type ItemKey = 'title' | 'text' | 'name' | 'q' | 'a';
const ITEM_FIELDS: Partial<Record<Block['type'], [ItemKey, string, boolean][]>> = {
  features: [['title', 'Benefit', false], ['text', 'Short explanation', false]],
  testimonials: [['text', 'What they said', true], ['name', 'Name', false]],
  faq: [['q', 'Question', false], ['a', 'Answer', true]],
};

function BlockCard({ b, open, onOpen, onChange, onMove, onCopy, onDelete, first, last, forms }: {
  b: Block; open: boolean; onOpen: () => void; onChange: (p: Partial<Block>) => void; onMove: (d: -1 | 1) => void; onCopy: () => void; onDelete: () => void;
  first: boolean; last: boolean; forms: ReturnType<typeof useLeadForms>['forms'];
}) {
  const summary = b.headline || b.title || b.text?.slice(0, 60) || b.button_label || b.url || b.src || '';
  const input = (key: keyof Block, label: string, max = 200, area = false, placeholder?: string) => (
    <Field label={label}>
      {area
        ? <textarea className="input-field text-sm" rows={3} maxLength={max} placeholder={placeholder} value={String(b[key] ?? '')} onChange={(e) => onChange({ [key]: e.target.value })} />
        : <input className="input-field text-sm" maxLength={max} placeholder={placeholder} value={String(b[key] ?? '')} onChange={(e) => onChange({ [key]: e.target.value })} />}
    </Field>
  );
  const button = (
    <div className="grid sm:grid-cols-3 gap-2">
      {input('button_label', 'Button text', 60)}
      <Field label="When clicked">
        <select className="input-field text-sm" value={b.button_action ?? 'next'} onChange={(e) => onChange({ button_action: e.target.value as Block['button_action'] })}>
          <option value="next">Go to the next step</option>
          <option value="form">Scroll to the form</option>
          <option value="url">Open a link</option>
        </select>
      </Field>
      {b.button_action === 'url' && input('button_url', 'Link', 2000, false, 'https://')}
    </div>
  );
  const itemFields = ITEM_FIELDS[b.type];
  const form = forms.find((f) => f.slug === b.form_slug);
  return (
    <section className={`card overflow-hidden ${open ? 'ring-2 ring-sky-400' : ''}`}>
      <div className="flex items-center gap-1 px-3 py-2">
        <button type="button" onClick={onOpen} className="flex-1 text-left min-w-0" aria-expanded={open}>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-2">{blockLabel(b.type)}</span>
          <span className="text-sm text-slate-700 truncate">{summary}</span>
        </button>
        <button type="button" disabled={first} onClick={() => onMove(-1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
        <button type="button" disabled={last} onClick={() => onMove(1)} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
        <button type="button" onClick={onCopy} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label="Duplicate block"><CopyPlus className="w-4 h-4" /></button>
        <button type="button" onClick={onDelete} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Delete block"><Trash2 className="w-4 h-4" /></button>
      </div>
      {open && (
        <div className="px-3 pb-4 pt-1 space-y-3 border-t border-slate-100">
          {b.type !== 'divider' && (
            <div className="flex gap-2 items-center flex-wrap">
              <select className="input-field !w-auto text-sm" value={b.bg ?? 'white'} onChange={(e) => onChange({ bg: e.target.value as Background })} aria-label="Background">
                {BACKGROUNDS.map(([v, l]) => <option key={v} value={v}>{l} background</option>)}
              </select>
              <button type="button" onClick={() => onChange({ align: b.align === 'center' ? 'left' : 'center' })} className="btn-secondary text-xs !py-1.5">
                {b.align === 'center' ? <><AlignCenter className="w-3.5 h-3.5" /> Centred</> : <><AlignLeft className="w-3.5 h-3.5" /> Left</>}
              </button>
            </div>
          )}
          {b.type === 'hero' && (<>{input('headline', 'Headline', 140)}{input('subheadline', 'Text under the headline', 400, true)}{input('image', 'Image (https://, optional)', 2000)}{button}</>)}
          {b.type === 'text' && (<>{input('title', 'Heading (optional)', 120)}{input('text', 'Text: **bold**, [link](https://…)', 5000, true)}</>)}
          {b.type === 'image' && (<>{input('src', 'Image address (https://)', 2000)}{input('alt', 'Description (for screen readers)', 200)}{input('link', 'Link when clicked (optional)', 2000)}</>)}
          {b.type === 'video' && (<>{input('title', 'Heading (optional)', 120)}{input('url', 'YouTube or Vimeo link', 500, false, 'https://www.youtube.com/watch?v=…')}</>)}
          {b.type === 'form' && (
            <>
              <Field label="Lead form">
                <select className="input-field text-sm" value={b.form_slug ?? ''} onChange={(e) => onChange({ form_slug: e.target.value })}>
                  <option value="">Choose a form…</option>
                  {forms.map((f) => <option key={f.id} value={f.slug}>{f.name}{f.status !== 'published' ? ' (draft)' : ''}</option>)}
                </select>
              </Field>
              {forms.length === 0 && <p className="text-xs text-slate-500">No forms yet. <Link to="/forms" className="text-sky-600 hover:underline">Create a lead form</Link> first.</p>}
              {form && form.status !== 'published' && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">This form is a draft: publish it in Lead forms, or visitors won’t see it.</p>}
              {input('title', 'Heading above the form (optional)', 120)}
              <Field label="After sending">
                <select className="input-field text-sm" value={b.after ?? 'next'} onChange={(e) => onChange({ after: e.target.value as Block['after'] })}>
                  <option value="next">Go to the next step (e.g. thank-you page)</option>
                  <option value="message">Show the form’s thank-you message</option>
                </select>
              </Field>
            </>
          )}
          {b.type === 'reviews' && (
            <>
              {input('title', 'Heading', 120)}
              <Field label="How many">
                <select className="input-field text-sm !w-auto" value={b.count ?? 3} onChange={(e) => onChange({ count: Number(e.target.value) })}>
                  {[3, 6, 9].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <p className="text-xs text-slate-500">Your most recent 4–5★ reviews with text, plus your Google rating.</p>
            </>
          )}
          {b.type === 'countdown' && (
            <>
              {input('title', 'Heading', 120)}
              <Field label="Ends at"><input type="datetime-local" className="input-field text-sm !w-auto" value={b.until ?? ''} onChange={(e) => onChange({ until: e.target.value })} /></Field>
              {input('expired_text', 'Text after it ends', 200)}
            </>
          )}
          {b.type === 'button' && button}
          {itemFields && (
            <>
              {input('title', 'Heading', 120)}
              <div className="space-y-2">
                {(b.items ?? []).map((it, k) => (
                  <div key={k} className="rounded-lg border border-slate-200 p-2 space-y-2">
                    {itemFields.map(([key, label, area]) => (
                      area
                        ? <textarea key={key} className="input-field text-sm" rows={2} maxLength={600} placeholder={label} aria-label={label} value={it[key] ?? ''} onChange={(e) => onChange({ items: (b.items ?? []).map((x, j) => (j === k ? { ...x, [key]: e.target.value } : x)) })} />
                        : <input key={key} className="input-field text-sm" maxLength={140} placeholder={label} aria-label={label} value={it[key] ?? ''} onChange={(e) => onChange({ items: (b.items ?? []).map((x, j) => (j === k ? { ...x, [key]: e.target.value } : x)) })} />
                    ))}
                    <button type="button" onClick={() => onChange({ items: (b.items ?? []).filter((_, j) => j !== k) })} className="text-xs text-rose-600 hover:underline">Remove</button>
                  </div>
                ))}
                {(b.items ?? []).length < 12 && <button type="button" onClick={() => onChange({ items: [...(b.items ?? []), {}] })} className="btn-secondary text-xs !py-1"><Plus className="w-3 h-3" /> Add</button>}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SettingsTab({ funnel, set, disabled }: { funnel: Funnel; set: (p: Partial<Funnel['settings']>) => void; disabled: boolean }) {
  const s = funnel.settings;
  const { widgets } = useChatWidgets();
  return (
    <fieldset disabled={disabled} className="card p-5 space-y-5 max-w-3xl">
      <h2 className="text-sm font-semibold text-slate-900">Look</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Brand colour"><input type="color" className="h-[42px] w-20 rounded-lg border border-slate-300 cursor-pointer" value={s.accent || '#0284c7'} onChange={(e) => set({ accent: e.target.value })} /></Field>
        <Field label="Font">
          <select className="input-field text-sm" value={s.font ?? 'sans'} onChange={(e) => set({ font: e.target.value as Funnel['settings']['font'] })}>
            {Object.entries(FONTS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
          </select>
        </Field>
      </div>
      <h2 className="text-sm font-semibold text-slate-900 pt-2">Search & sharing</h2>
      <Field label="Page title" hint="Google and browser tab"><input className="input-field text-sm" maxLength={70} value={s.seo_title ?? ''} onChange={(e) => set({ seo_title: e.target.value })} /></Field>
      <Field label="Description" hint="up to 160 characters"><textarea className="input-field text-sm" rows={2} maxLength={160} value={s.seo_description ?? ''} onChange={(e) => set({ seo_description: e.target.value })} /></Field>
      <Field label="Share image" hint="https://, 1200×630 works best"><input className="input-field text-sm" maxLength={2000} value={s.og_image ?? ''} onChange={(e) => set({ og_image: e.target.value })} /></Field>
      <h2 className="text-sm font-semibold text-slate-900 pt-2">Tracking</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Meta (Facebook) Pixel ID"><input className="input-field text-sm" maxLength={20} placeholder="123456789012345" value={s.meta_pixel_id ?? ''} onChange={(e) => set({ meta_pixel_id: e.target.value.trim() })} /></Field>
        <Field label="Google Analytics 4 ID"><input className="input-field text-sm" maxLength={20} placeholder="G-XXXXXXXXXX" value={s.ga_id ?? ''} onChange={(e) => set({ ga_id: e.target.value.trim() })} /></Field>
      </div>
      <p className="text-xs text-slate-500 -mt-2">Page views are sent on every step; a “Lead” event when someone sends a form or moves to the next step.</p>
      <h2 className="text-sm font-semibold text-slate-900 pt-2">Live chat</h2>
      <Field label="Chat widget on these pages">
        <select className="input-field text-sm" value={s.chat ?? 'none'} onChange={(e) => set({ chat: e.target.value })}>
          <option value="none">No chat</option>
          <option value="main">Main widget</option>
          {widgets.map((w) => <option key={w.id} value={w.id}>{w.name}{w.enabled ? '' : ' (off)'}</option>)}
        </select>
      </Field>
      {s.chat && s.chat !== 'none' && (
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="rounded border-slate-300" checked={Boolean(s.chat_open)} onChange={(e) => set({ chat_open: e.target.checked })} /> Open the chat automatically</label>
      )}
      <p className="text-xs text-slate-500">Tip: create a widget just for this funnel in <Link to="/chat/settings" className="text-sky-600 hover:underline">Live chat → Settings</Link> and tell its AI what the offer is.</p>
      <p className="text-xs text-slate-500">Remember to Save (top right).</p>
    </fieldset>
  );
}

function ShareTab({ funnel, steps, onSlug, disabled }: { funnel: Funnel; steps: FunnelStep[]; onSlug: (s: string) => void; disabled: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [onDomains, setOnDomains] = useState<{ url: string; live: boolean }[]>([]);
  useEffect(() => {
    domainLinksFor('funnel', funnel.id).then(setOnDomains).catch(() => setOnDomains([]));
  }, [funnel.id]);
  const copy = (k: string, text: string) => navigator.clipboard.writeText(text).then(() => { setCopied(k); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  const first = steps[0]?.views ?? 0;
  const last = steps[steps.length - 1]?.views ?? 0;
  const rows = useMemo(() => steps.map((s, i) => ({ s, rate: s.views ? Math.round((s.conversions / s.views) * 100) : null, i })), [steps]);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <section className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Links</h2>
        {funnel.status !== 'published' && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This funnel is a draft. Publish it (top right) so people can open it.</p>}
        <fieldset disabled={disabled}>
          <Field label="Funnel address">
            <div className="flex items-center gap-1 text-sm text-slate-500">{window.location.origin}/s/
              <input className="input-field text-sm !w-auto flex-1 min-w-[120px]" maxLength={60} value={funnel.slug} onChange={(e) => onSlug(slugify(e.target.value).slice(0, 60))} aria-label="Funnel address" />
            </div>
          </Field>
        </fieldset>
        <ul className="space-y-2">
          {steps.map((s, i) => {
            const url = publicFunnelUrl(funnel.slug, i === 0 ? undefined : s.slug);
            return (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="w-28 shrink-0 text-slate-600 truncate">{i + 1}. {s.name}</span>
                <code className="flex-1 min-w-0 truncate text-xs bg-slate-100 rounded px-2 py-1">{url}</code>
                <button type="button" onClick={() => copy(s.id, url)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label={`Copy link to ${s.name}`}>{copied === s.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}</button>
              </li>
            );
          })}
        </ul>
        {onDomains.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700">On your domains</p>
            {onDomains.map((x) => (
              <p key={x.url} className="text-sm flex items-center gap-2"><a href={x.url} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline break-all">{x.url}</a>{!x.live && <span className="text-xs text-amber-700">(not live yet)</span>}</p>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">Add <code>?utm_source=facebook&amp;utm_campaign=spring</code> to see which ads bring leads (shown on each lead). Show this funnel on your own web address in <Link to="/domains" className="text-sky-600 hover:underline">Domains</Link>.</p>
      </section>
      <section className="card overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-slate-900 flex-1">Steps</h2>
          {first > 0 && steps.length > 1 && <p className="text-xs text-slate-500">{Math.round((last / first) * 100)}% of visitors reach the last step</p>}
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 bg-slate-50 text-left">
            <tr><th className="px-5 py-2 font-medium">Step</th><th className="px-5 py-2 font-medium">Views</th><th className="px-5 py-2 font-medium">Moved on</th><th className="px-5 py-2 font-medium">Rate</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ s, rate, i }) => (
              <tr key={s.id}>
                <td className="px-5 py-2">{i + 1}. {s.name}</td>
                <td className="px-5 py-2">{s.views.toLocaleString()}</td>
                <td className="px-5 py-2">{i === steps.length - 1 && !s.conversions ? '—' : s.conversions.toLocaleString()}</td>
                <td className="px-5 py-2">{rate === null || (i === steps.length - 1 && !s.conversions) ? '—' : `${rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-5 py-3 text-xs text-slate-400">Views count once per visitor per visit. “Moved on” = sent a form or clicked through to the next step.</p>
      </section>
    </div>
  );
}
