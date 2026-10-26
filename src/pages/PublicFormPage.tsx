import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { formsApi } from '@/lib/leadForms';
import { useSite } from '@/lib/site';
import { LeadFormView, type PublicFormData } from '@/components/forms/LeadFormView';

/** C2: a published lead form. /f/:slug is the landing page; ?embed=1 is the form alone (for iframes). */
export function PublicFormPage() {
  const routeParams = useParams();
  // On a connected domain (D3) the domain's route says which form
  const slug = useSite()?.slug ?? routeParams.slug ?? '';
  const [params] = useSearchParams();
  const embed = params.get('embed') === '1';
  const [form, setForm] = useState<PublicFormData | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    // A view counts once per visit
    let counted = false;
    try {
      counted = sessionStorage.getItem(`re-form-view-${slug}`) === '1';
      sessionStorage.setItem(`re-form-view-${slug}`, '1');
    } catch {
      /* storage blocked: count it */
    }
    fetch(`${formsApi()}?slug=${encodeURIComponent(slug)}${counted ? '' : '&view=1'}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((f: PublicFormData & { settings: { title?: string } }) => {
        setForm(f);
        if (!embed) document.title = f.page?.headline || f.settings?.title || f.business?.name || 'Form';
      })
      .catch(() => setMissing(true));
  }, [slug, embed]);

  // Embedded: tell the page around us how tall we are
  useEffect(() => {
    if (!embed || !form) return;
    document.body.style.background = 'transparent';
    const send = () => window.parent?.postMessage({ reFormHeight: document.documentElement.scrollHeight, slug }, '*');
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [embed, form, slug]);

  if (missing) return <p className="p-8 text-center text-slate-600">This form isn’t available.</p>;
  if (!form) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>;

  const submit = async (data: Record<string, string | string[]>, consent: boolean, extra: { elapsed: number; honeypot: string }) => {
    const utm = Object.fromEntries([...params.entries()].filter(([k]) => k.startsWith('utm_')));
    const res = await fetch(formsApi(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        data,
        consent,
        elapsed_ms: extra.elapsed,
        website: extra.honeypot,
        // Embedded: the website page the form is on
        page: embed && document.referrer ? document.referrer : window.location.href,
        referrer: embed ? null : document.referrer || null,
        utm,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
    return { message: body.message, redirect: body.redirect };
  };

  return <LeadFormView form={form} mode={embed ? 'embed' : 'page'} onSubmit={submit} />;
}
