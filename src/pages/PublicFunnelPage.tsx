import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { FunnelRenderer } from '@/components/funnels/FunnelRenderer';
import type { PublicFormData } from '@/components/forms/LeadFormView';
import { formsApi } from '@/lib/leadForms';
import { chatApi } from '@/lib/websiteChat';
import { funnelsApi, httpsUrl, validGa, validPixel, type PublicFunnel } from '@/lib/funnels';
import { sitePath, useSite } from '@/lib/site';

type Tracker = { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; dataLayer?: unknown[] };
const w = window as unknown as Window & Tracker;

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) return el?.remove();
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Meta Pixel and Google Analytics 4, loaded once (ids are validated: digits / G-XXXX only). */
function loadTrackers(pixel: string | null, ga: string | null) {
  if (pixel && !w.fbq) {
    const s = document.createElement('script');
    s.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');`;
    document.head.appendChild(s);
  }
  if (ga && !w.gtag) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${ga}`;
    document.head.appendChild(s);
    w.dataLayer = w.dataLayer || [];
    // gtag must push the arguments object itself
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    w.gtag('js', new Date());
    w.gtag('config', ga, { send_page_view: false });
  }
}

/** Public: a published funnel step at /s/:slug/:step (the first step at /s/:slug). */
export function PublicFunnelPage() {
  const params = useParams();
  // On a connected domain (D3) the domain's route says which funnel and step
  const site = useSite();
  const slug = site?.slug ?? params.slug ?? '';
  const step = site ? site.sub ?? '' : params.step ?? '';
  const navigate = useNavigate();
  const { search } = useLocation();
  const [data, setData] = useState<PublicFunnel | null>(null);
  const [missing, setMissing] = useState(false);
  const chatAdded = useRef(false);

  useEffect(() => {
    let off = false;
    const seenKey = `re-funnel-view-${slug}-${step || '_'}`;
    let counted = false;
    try {
      counted = sessionStorage.getItem(seenKey) === '1';
      sessionStorage.setItem(seenKey, '1');
    } catch {
      /* storage blocked: count it */
    }
    fetch(`${funnelsApi()}?slug=${encodeURIComponent(slug)}${step ? `&step=${encodeURIComponent(step)}` : ''}${counted ? '' : '&view=1'}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PublicFunnel) => {
        if (off) return;
        setData(d);
        window.scrollTo(0, 0);
      })
      .catch(() => !off && setMissing(true));
    return () => { off = true; };
  }, [slug, step]);

  // Title, description, share image, trackers and the chat widget
  useEffect(() => {
    if (!data) return;
    const s = data.funnel.settings;
    document.title = data.step.seo?.title || s.seo_title || `${data.step.name} · ${data.business.name}`;
    const description = data.step.seo?.description || s.seo_description || null;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', document.title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', httpsUrl(s.og_image));
    loadTrackers(validPixel(s.meta_pixel_id), validGa(s.ga_id));
    w.fbq?.('track', 'PageView');
    w.gtag?.('event', 'page_view', { page_location: window.location.href, page_title: document.title });
    if (data.chatKey && !chatAdded.current) {
      chatAdded.current = true;
      const c = document.createElement('script');
      c.src = `${window.location.origin}/chat.js`;
      c.async = true;
      c.dataset.key = data.chatKey;
      c.dataset.api = chatApi();
      if (s.chat_open) c.dataset.open = 'true';
      document.body.appendChild(c);
    }
  }, [data]);

  const convert = useCallback(() => {
    if (!data) return;
    fetch(funnelsApi(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'convert', slug, step: data.step.slug }), keepalive: true }).catch(() => undefined);
    w.fbq?.('track', 'Lead');
    w.gtag?.('event', 'generate_lead', { funnel: slug, step: data.step.slug });
  }, [data, slug]);

  const next = useCallback(() => {
    if (!data) return;
    convert();
    const i = data.steps.findIndex((s) => s.slug === data.step.slug);
    const following = data.steps[i + 1];
    // UTM tags travel with the visitor through the funnel
    if (following) navigate(`${site ? sitePath(site, following.slug) : `/s/${slug}/${following.slug}`}${search}`);
  }, [data, convert, navigate, slug, search, site]);

  const loadForm = useCallback(async (formSlug: string) => {
    const r = await fetch(`${formsApi()}?slug=${encodeURIComponent(formSlug)}`);
    return r.ok ? ((await r.json()) as PublicFormData) : null;
  }, []);

  const submitForm = useCallback(async (formSlug: string, answers: Record<string, string | string[]>, consent: boolean, extra: { elapsed: number; honeypot: string }) => {
    const params = new URLSearchParams(search);
    const utm = Object.fromEntries([...params.entries()].filter(([k]) => k.startsWith('utm_')));
    const res = await fetch(formsApi(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: formSlug, data: answers, consent, elapsed_ms: extra.elapsed, website: extra.honeypot, page: window.location.href, referrer: document.referrer || null, utm }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
    return { message: body.message as string, redirect: null };
  }, [search]);

  if (missing) return <p className="p-8 text-center text-slate-600">This page isn’t available.</p>;
  if (!data) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>;

  const b = data.business;
  return (
    <div className="min-h-screen bg-white">
      <FunnelRenderer
        key={data.step.id}
        blocks={data.step.blocks}
        ctx={{ settings: data.funnel.settings, business: b, reviews: data.reviews, onNext: next, onConvert: convert, loadForm, submitForm }}
      />
      <footer className="border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-5 py-6 flex flex-wrap gap-x-4 gap-y-1 justify-center text-center">
          <span className="font-medium text-slate-700">{b.name}</span>
          {b.phone && <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} className="hover:underline">{b.phone}</a>}
          {b.address && <span>{b.address}</span>}
          {data.showBranding && <span className="w-full text-slate-400">Made with Reputation Engine</span>}
        </div>
      </footer>
    </div>
  );
}
