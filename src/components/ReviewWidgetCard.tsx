import { useEffect, useState } from 'react';
import { Check, Code2, Copy, LayoutGrid, Loader2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { DEFAULT_WIDGET, useReviewWidget, widgetSnippet } from '@/lib/reviewWidget';
import type { ReviewWidgetLayout, ReviewWidgetSettings } from '@/types';

type Values = Omit<ReviewWidgetSettings, 'location_id' | 'updated_at'>;

const layouts: { key: ReviewWidgetLayout; label: string; hint: string }[] = [
  { key: 'carousel', label: 'Carousel', hint: 'Swipeable row — great for home pages' },
  { key: 'grid', label: 'Grid', hint: 'Cards in columns — a reviews page' },
  { key: 'list', label: 'List', hint: 'One under another — narrow spaces' },
  { key: 'badge', label: 'Badge', hint: 'Small “4.8 ★ 120 reviews” — headers, footers, product pages' },
];

const platforms: [string, string][] = [
  ['Shopify', 'Online Store → Themes → Customize → Add section → Custom Liquid, then paste.'],
  ['WordPress', 'Edit the page → add a “Custom HTML” block, then paste.'],
  ['Wix', 'Add → Embed code → Embed HTML, then paste.'],
  ['Squarespace', 'Edit the page → add a “Code” block, then paste.'],
  ['Anything else', 'Paste it into the page’s HTML where the reviews should appear.'],
];

/** Settings → Website reviews widget: show your best reviews on your own website or store. */
export function ReviewWidgetCard() {
  const { location, can } = useLocationContext();
  const isAdmin = can('business.edit');
  const { settings, loading, save } = useReviewWidget();
  const [values, setValues] = useState<Values>(DEFAULT_WIDGET);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setValues((Object.keys(DEFAULT_WIDGET) as (keyof Values)[]).reduce(
      (acc, k) => ({ ...acc, [k]: settings[k] }),
      { ...DEFAULT_WIDGET }
    ));
  }, [settings]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const dirty = settings ? (Object.keys(values) as (keyof Values)[]).some((k) => values[k] !== settings[k]) : false;
  const key = location?.public_key;
  const snippet = key ? widgetSnippet(key) : '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    const error = await save(values);
    setSaving(false);
    setStatus(error ? { kind: 'error', text: error } : { kind: 'success', text: values.enabled ? 'Saved — your widget is live' : 'Saved' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus({ kind: 'error', text: 'Couldn’t copy. Select the code and copy it yourself.' });
    }
  };

  // Preview the saved widget exactly as a website shows it (cache-busted after each save)
  const previewDoc = key && settings?.enabled
    ? `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:16px;background:${settings.theme === 'dark' ? '#0f172a' : '#f8fafc'}}</style></head><body>${widgetSnippet(key).replace(
        '/functions/v1/reviews-widget"',
        `/functions/v1/reviews-widget?v=${encodeURIComponent(settings.updated_at ?? '')}"`
      )}</body></html>`
    : null;

  return (
    <form id="widget" onSubmit={handleSave} className="card p-5 scroll-mt-20">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
          <LayoutGrid className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900">Website reviews widget</h2>
          <p className="text-sm text-slate-500">Show your best reviews on your own website or online store</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={values.enabled}
          aria-label="Widget on"
          disabled={!isAdmin || loading}
          onClick={() => set('enabled', !values.enabled)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${values.enabled ? 'bg-sky-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${values.enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 text-sky-500 animate-spin mx-auto my-6" />
      ) : !key ? (
        <p className="text-sm text-slate-500">Apply the latest database update (migration 016) to use the widget.</p>
      ) : (
        <fieldset disabled={!isAdmin} className="space-y-4">
          <div>
            <p className="block text-sm font-medium text-slate-700 mb-1.5">Layout</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Layout">
              {layouts.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  role="radio"
                  aria-checked={values.layout === l.key}
                  onClick={() => set('layout', l.key)}
                  title={l.hint}
                  className={`p-2.5 rounded-xl border text-left transition-colors ${values.layout === l.key ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
                >
                  <span className="block text-sm font-semibold text-slate-900">{l.label}</span>
                  <span className="block text-[11px] text-slate-500 leading-snug mt-0.5">{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="widget-theme" className="block text-sm font-medium text-slate-700 mb-1.5">Theme</label>
              <select id="widget-theme" value={values.theme} onChange={(e) => set('theme', e.target.value as Values['theme'])} className="input-field">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label htmlFor="widget-accent" className="block text-sm font-medium text-slate-700 mb-1.5">Button colour</label>
              <input id="widget-accent" type="color" value={values.accent} onChange={(e) => set('accent', e.target.value)} className="h-[42px] w-full rounded-xl border border-slate-200 p-1 cursor-pointer" />
            </div>
            <div>
              <label htmlFor="widget-min" className="block text-sm font-medium text-slate-700 mb-1.5">Show reviews</label>
              <select id="widget-min" value={values.min_rating} onChange={(e) => set('min_rating', Number(e.target.value))} className="input-field">
                <option value={5}>5 stars only</option>
                <option value={4}>4 stars and up</option>
                <option value={3}>3 stars and up</option>
                <option value={1}>All reviews</option>
              </select>
            </div>
            <div>
              <label htmlFor="widget-max" className="block text-sm font-medium text-slate-700 mb-1.5">How many</label>
              <select id="widget-max" value={values.max_reviews} onChange={(e) => set('max_reviews', Number(e.target.value))} className="input-field">
                {[3, 6, 9, 12, 20, 30].map((n) => <option key={n} value={n}>{n} newest</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-x-6 gap-y-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={values.require_text} onChange={(e) => set('require_text', e.target.checked)} className="rounded border-slate-300" />
              Only reviews with written comments
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={values.show_summary} onChange={(e) => set('show_summary', e.target.checked)} className="rounded border-slate-300" />
              Show overall rating
            </label>
          </div>
          <p className="text-xs text-slate-400">The overall rating always counts every review, including ones the widget doesn’t show.</p>

          {isAdmin && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button type="submit" disabled={saving || !dirty} className="btn-primary sm:w-auto">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
              {status && (
                <p role={status.kind === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1.5 text-sm ${status.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {status.kind === 'success' && <Check className="w-4 h-4 shrink-0" />}
                  {status.text}
                </p>
              )}
            </div>
          )}
        </fieldset>
      )}

      {key && !loading && (
        <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Code2 className="w-4 h-4" /> Code for your website</p>
            <button type="button" onClick={copy} className="btn-secondary !py-1.5 text-xs">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy code'}
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer text-sky-600 hover:underline w-fit">Where do I paste it?</summary>
            <ul className="mt-2 space-y-1">
              {platforms.map(([name, how]) => (
                <li key={name}><span className="font-semibold text-slate-700">{name}:</span> {how}</li>
              ))}
            </ul>
            <p className="mt-2">Paste it once — the widget updates by itself as new reviews come in.</p>
          </details>

          <div>
            <p className="text-sm font-semibold text-slate-900 mb-2">Preview</p>
            {previewDoc ? (
              <iframe
                key={settings?.updated_at}
                title="Widget preview"
                srcDoc={previewDoc}
                className="w-full h-[380px] rounded-xl border border-slate-200 bg-slate-50"
              />
            ) : (
              <p className="text-sm text-slate-500 p-4 rounded-xl bg-slate-50 border border-slate-200">
                Turn the widget on and save to see a preview. It shows nothing on your website while it’s off.
              </p>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
