import { useRef, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, Phone, Globe } from 'lucide-react';
import type { FormField, FormPage, FormSettings } from '@/lib/leadForms';

export interface PublicFormData {
  fields: FormField[];
  settings: FormSettings;
  page: FormPage;
  business: { name?: string; phone?: string | null; website?: string | null; address?: string | null };
  showBranding?: boolean;
}
type Answers = Record<string, string | string[]>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const safeHttp = (u?: string) => (u && /^https:\/\//i.test(u) ? u : undefined);

/**
 * A lead form (and, in "page" mode, its landing page). Used by the public /f/:slug page, embeds
 * (mode "embed": the form only) and the live preview in the form builder.
 */
export function LeadFormView({ form, mode, onSubmit }: {
  form: PublicFormData;
  mode: 'page' | 'embed' | 'preview';
  onSubmit?: (answers: Answers, consent: boolean, extra: { elapsed: number; honeypot: string }) => Promise<{ message: string; redirect?: string | null }>;
}) {
  const { fields, settings, page, business } = form;
  const accent = /^#[0-9a-f]{6}$/i.test(settings.accent ?? '') ? settings.accent! : '#0284c7';
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const started = useRef(Date.now());

  const set = (id: string, v: string | string[]) => setAnswers((a) => ({ ...a, [id]: v }));
  const toggle = (id: string, opt: string) => {
    const cur = Array.isArray(answers[id]) ? (answers[id] as string[]) : [];
    set(id, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    for (const f of fields) {
      const v = answers[f.id];
      const empty = Array.isArray(v) ? !v.length : !String(v ?? '').trim();
      if (f.required && empty) return setError(`${f.label} is required.`);
      if (!empty && f.type === 'email' && !EMAIL_RE.test(String(v).trim())) return setError(`${f.label}: that email address doesn’t look right.`);
    }
    if (settings.consent_text && !consent) return setError('Please tick the box to agree before sending.');
    if (!onSubmit) return setDone(settings.success_message || 'Thanks! We’ve got your details and will be in touch soon.');
    setBusy(true);
    try {
      const r = await onSubmit(answers, consent, { elapsed: Date.now() - started.current, honeypot });
      if (r.redirect) {
        // From an embed, open the thank-you page in the whole window when the site allows it
        try {
          if (window.top && window.top !== window) window.top.location.href = r.redirect;
          else window.location.href = r.redirect;
        } catch {
          window.location.href = r.redirect;
        }
        return;
      }
      setDone(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const formCard = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
      {done ? (
        <div className="text-center py-8 space-y-3" role="status">
          <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: accent }} />
          <p className="text-base font-medium text-slate-800 whitespace-pre-wrap">{done}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {(settings.title || settings.description) && (
            <div>
              {settings.title && <h2 className="text-lg font-bold text-slate-900">{settings.title}</h2>}
              {settings.description && <p className="text-sm text-slate-500 mt-1 whitespace-pre-wrap">{settings.description}</p>}
            </div>
          )}
          {fields.map((f) => {
            const id = `ff-${f.id}`;
            const label = <>{f.label}{f.required && <span className="text-rose-500"> *</span>}</>;
            if (f.type === 'checkbox') {
              return (
                <fieldset key={f.id}>
                  <legend className="block text-sm font-medium text-slate-700 mb-1.5">{label}</legend>
                  <div className="space-y-1.5">
                    {(f.options ?? []).map((o) => (
                      <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" className="rounded border-slate-300" checked={Array.isArray(answers[f.id]) && (answers[f.id] as string[]).includes(o)} onChange={() => toggle(f.id, o)} /> {o}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            }
            return (
              <div key={f.id}>
                <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                {f.type === 'textarea' ? (
                  <textarea id={id} className="input-field" rows={4} maxLength={5000} placeholder={f.placeholder} value={String(answers[f.id] ?? '')} onChange={(e) => set(f.id, e.target.value)} />
                ) : f.type === 'select' ? (
                  <select id={id} className="input-field" value={String(answers[f.id] ?? '')} onChange={(e) => set(f.id, e.target.value)}>
                    <option value="">Choose…</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    id={id}
                    className="input-field"
                    type={f.type === 'phone' ? 'tel' : f.type === 'text' ? 'text' : f.type}
                    autoComplete={f.role === 'name' ? 'name' : f.role === 'email' ? 'email' : f.role === 'phone' ? 'tel' : undefined}
                    maxLength={f.type === 'email' ? 200 : 300}
                    placeholder={f.placeholder}
                    value={String(answers[f.id] ?? '')}
                    onChange={(e) => set(f.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
          {/* Bots fill in this hidden field; people never see it */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} /></label>
          </div>
          {settings.consent_text && (
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" className="rounded border-slate-300 mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="whitespace-pre-wrap">{settings.consent_text}</span>
            </label>
          )}
          {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-xl py-3 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: accent }}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {settings.submit_label || 'Send'}
          </button>
          {form.showBranding && mode !== 'preview' && <p className="text-center text-[11px] text-slate-400">Form by Reputation Engine</p>}
        </form>
      )}
    </div>
  );

  if (mode === 'embed' || page.enabled === false) return <div className={mode === 'embed' ? 'p-1' : 'max-w-lg mx-auto'}>{formCard}</div>;

  const bullets = (page.bullets ?? []).filter((b) => b.trim());
  const image = safeHttp(page.image_url);
  return (
    <div className="bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-5">
          {business.name && <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: accent }}>{business.name}</p>}
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">{page.headline || settings.title || 'Get in touch'}</h1>
          {page.subheadline && <p className="text-lg text-slate-600 whitespace-pre-wrap">{page.subheadline}</p>}
          {bullets.length > 0 && (
            <ul className="space-y-2">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-slate-700"><CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accent }} /> {b}</li>
              ))}
            </ul>
          )}
          {image && <img src={image} alt="" className="rounded-2xl w-full max-h-72 object-cover" />}
          {page.show_contact !== false && (business.phone || business.website || business.address) && (
            <div className="text-sm text-slate-600 space-y-1 pt-2">
              {business.phone && <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" /> <a href={`tel:${business.phone}`} className="hover:underline">{business.phone}</a></p>}
              {business.website && <p className="flex items-center gap-2"><Globe className="w-4 h-4 text-slate-400" /> {business.website}</p>}
              {business.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400" /> {business.address}</p>}
            </div>
          )}
        </div>
        {formCard}
      </div>
    </div>
  );
}
