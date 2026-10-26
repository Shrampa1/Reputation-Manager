import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, Loader2, Star } from 'lucide-react';
import { LeadFormView, type PublicFormData } from '@/components/forms/LeadFormView';
import { FONTS, accentOf, httpsUrl, linkUrl, videoEmbed, type Block, type FunnelSettings, type PublicFunnel } from '@/lib/funnels';

type Answers = Record<string, string | string[]>;
export interface RenderContext {
  settings: FunnelSettings;
  business: PublicFunnel['business'];
  reviews: PublicFunnel['reviews'];
  /** Phone-width layout, for the editor's mobile preview */
  narrow?: boolean;
  /** Moves to the next step (live page); counts a conversion */
  onNext?: () => void;
  /** Counts a conversion without leaving the step (live page) */
  onConvert?: () => void;
  loadForm: (slug: string) => Promise<PublicFormData | null>;
  /** Sends a form (live page). Without it, forms only show their thank-you message (preview). */
  submitForm?: (slug: string, answers: Answers, consent: boolean, extra: { elapsed: number; honeypot: string }) => Promise<{ message: string; redirect?: string | null }>;
  /** Editor: clicking a block selects it */
  onSelect?: (id: string) => void;
  selected?: string | null;
}

/** **bold** and [text](https://…) in plain text, without HTML. */
function rich(text: string, accent: string): ReactNode[] {
  return text.split(/\n{2,}/).map((para, p) => (
    <p key={p} className="mb-3 last:mb-0">
      {para.split('\n').map((line, l) => (
        <Fragment key={l}>
          {l > 0 && <br />}
          {line.split(/(\*\*[^*\n]+\*\*|\[[^\]\n]{1,200}\]\([^)\s]{1,2000}\))/).map((part, i) => {
            const bold = /^\*\*([^*]+)\*\*$/.exec(part);
            if (bold) return <strong key={i}>{bold[1]}</strong>;
            const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
            const href = link ? linkUrl(link[2]) : null;
            if (link && href) return <a key={i} href={href} target={/^https?:/i.test(href) ? '_blank' : undefined} rel="noopener noreferrer" className="underline" style={{ color: accent }}>{link[1]}</a>;
            return <Fragment key={i}>{part}</Fragment>;
          })}
        </Fragment>
      ))}
    </p>
  ));
}

const BG: Record<string, string> = { white: 'bg-white text-slate-800', muted: 'bg-slate-50 text-slate-800', dark: 'bg-slate-900 text-white', accent: 'text-white' };

/** The blocks of one funnel step. Used by the public page and the editor's live preview. */
export function FunnelRenderer({ blocks, ctx }: { blocks: Block[]; ctx: RenderContext }) {
  const accent = accentOf(ctx.settings);
  const firstForm = blocks.find((b) => b.type === 'form')?.id;
  const font = FONTS[ctx.settings.font ?? 'sans']?.stack ?? FONTS.sans.stack;
  const act = (b: Block) => {
    if (b.button_action === 'form') document.getElementById(`block-${firstForm}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else if (b.button_action === 'next') ctx.onNext?.();
  };
  return (
    <div style={{ fontFamily: font }}>
      {blocks.map((b) => {
        const bg = b.bg ?? 'white';
        const center = b.align === 'center';
        const dark = bg === 'dark' || bg === 'accent';
        const selectable = ctx.onSelect ? 'cursor-pointer outline-offset-[-3px] hover:outline hover:outline-2 hover:outline-sky-300' : '';
        return (
          <section
            key={b.id}
            id={`block-${b.id}`}
            onClick={ctx.onSelect ? (e) => { e.preventDefault(); ctx.onSelect?.(b.id); } : undefined}
            className={`${BG[bg]} ${selectable} ${ctx.selected === b.id ? 'outline outline-2 outline-sky-500 outline-offset-[-3px]' : ''}`}
            style={bg === 'accent' ? { background: accent } : undefined}
          >
            <div className={`mx-auto max-w-4xl px-5 ${b.type === 'divider' ? 'py-2' : b.type === 'hero' ? (ctx.narrow ? 'py-12' : 'py-14 sm:py-20') : 'py-10'} ${center ? 'text-center' : ''}`}>
              <BlockBody b={b} ctx={ctx} accent={accent} dark={dark} act={act} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CtaButton({ b, accent, dark, act, preview }: { b: Block; accent: string; dark: boolean; act: (b: Block) => void; preview: boolean }) {
  if (!b.button_label?.trim()) return null;
  const style = dark ? { background: '#fff', color: accent } : { background: accent, color: '#fff' };
  const cls = 'inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold text-base shadow-sm hover:opacity-95 transition';
  const href = b.button_action === 'url' ? linkUrl(b.button_url) : null;
  if (b.button_action === 'url') {
    return href && !preview
      ? <a href={href} className={cls} style={style} target={/^https?:/i.test(href) ? '_top' : undefined} rel="noopener">{b.button_label}</a>
      : <span className={cls} style={style}>{b.button_label}</span>;
  }
  return <button type="button" className={cls} style={style} onClick={(e) => { e.stopPropagation(); if (!preview) act(b); }}>{b.button_label}</button>;
}

function BlockBody({ b, ctx, accent, dark, act }: { b: Block; ctx: RenderContext; accent: string; dark: boolean; act: (b: Block) => void }) {
  const preview = Boolean(ctx.onSelect);
  const muted = dark ? 'text-white/80' : 'text-slate-600';
  const h2 = `text-2xl ${ctx.narrow ? '' : 'sm:text-3xl'} font-bold mb-6`;
  const cols = ctx.narrow ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  switch (b.type) {
    case 'hero': {
      const img = httpsUrl(b.image);
      return (
        <div className={img && !ctx.narrow ? 'grid md:grid-cols-2 gap-10 items-center text-left' : ''}>
          <div className="space-y-5">
            {b.headline && <h1 className={`text-3xl ${ctx.narrow ? '' : 'sm:text-5xl'} font-extrabold leading-tight tracking-tight`}>{b.headline}</h1>}
            {b.subheadline && <p className={`text-lg ${muted} ${b.align === 'center' && !img ? 'max-w-2xl mx-auto' : ''}`}>{b.subheadline}</p>}
            <CtaButton b={b} accent={accent} dark={dark} act={act} preview={preview} />
          </div>
          {img && <img src={img} alt="" className={`rounded-2xl w-full object-cover shadow-lg ${ctx.narrow ? 'mt-8' : ''}`} />}
        </div>
      );
    }
    case 'text':
      return <div className={`text-base leading-relaxed ${b.align === 'center' ? 'max-w-2xl mx-auto' : 'max-w-3xl'}`}>{b.title && <h2 className={h2}>{b.title}</h2>}{rich(b.text ?? '', dark ? '#fff' : accent)}</div>;
    case 'image': {
      const src = httpsUrl(b.src);
      if (!src) return preview ? <p className="text-sm text-slate-400 text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">Add an image address (https://…)</p> : null;
      const img = <img src={src} alt={b.alt ?? ''} className="rounded-2xl w-full h-auto mx-auto" />;
      const href = linkUrl(b.link);
      return href && !preview ? <a href={href} rel="noopener">{img}</a> : img;
    }
    case 'video': {
      const src = videoEmbed(b.url);
      if (!src) return preview ? <p className="text-sm text-slate-400 text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">Paste a YouTube or Vimeo link</p> : null;
      return (
        <div>
          {b.title && <h2 className={h2}>{b.title}</h2>}
          <div className="relative w-full overflow-hidden rounded-2xl shadow-lg bg-black" style={{ paddingTop: '56.25%' }}>
            <iframe src={src} title={b.title || 'Video'} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          </div>
        </div>
      );
    }
    case 'form':
      return <FormBlock b={b} ctx={ctx} />;
    case 'features':
      return (
        <div>
          {b.title && <h2 className={h2}>{b.title}</h2>}
          <div className={`grid ${cols} gap-5 text-left`}>
            {(b.items ?? []).map((it, i) => (
              <div key={i} className={`rounded-2xl p-5 ${dark ? 'bg-white/10' : 'bg-white border border-slate-200'}`}>
                <CheckCircle2 className="w-6 h-6 mb-2" style={{ color: dark ? '#fff' : accent }} />
                {it.title && <p className="font-semibold">{it.title}</p>}
                {it.text && <p className={`text-sm mt-1 ${muted}`}>{it.text}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    case 'reviews': {
      const list = ctx.reviews.slice(0, Math.min(Math.max(b.count ?? 3, 1), 9));
      return (
        <div>
          {b.title && <h2 className={h2}>{b.title}</h2>}
          {ctx.business.rating ? (
            <p className={`mb-6 ${muted} inline-flex items-center gap-1.5 ${b.align === 'center' ? 'justify-center' : ''}`}>
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" /> <strong className={dark ? 'text-white' : 'text-slate-900'}>{Number(ctx.business.rating).toFixed(1)}</strong>
              {ctx.business.reviewCount ? ` from ${ctx.business.reviewCount} Google reviews` : ''}
            </p>
          ) : null}
          {list.length === 0 ? (
            preview ? <p className="text-sm text-slate-400">Your recent 4–5★ reviews appear here once you have some (Reviews page).</p> : null
          ) : (
            <div className={`grid ${cols} gap-5 text-left`}>
              {list.map((r, i) => (
                <figure key={i} className={`rounded-2xl p-5 ${dark ? 'bg-white/10' : 'bg-white border border-slate-200'}`}>
                  <div className="flex gap-0.5 mb-2" aria-label={`${r.rating} stars`}>{Array.from({ length: 5 }, (_, s) => <Star key={s} className={`w-4 h-4 ${s < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</div>
                  <blockquote className="text-sm leading-relaxed">“{r.text}”</blockquote>
                  <figcaption className={`text-xs mt-3 ${muted}`}>{r.author}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      );
    }
    case 'testimonials':
      return (
        <div>
          {b.title && <h2 className={h2}>{b.title}</h2>}
          <div className={`grid ${cols} gap-5 text-left`}>
            {(b.items ?? []).map((it, i) => (
              <figure key={i} className={`rounded-2xl p-5 ${dark ? 'bg-white/10' : 'bg-white border border-slate-200'}`}>
                <blockquote className="text-base leading-relaxed">“{it.text}”</blockquote>
                {it.name && <figcaption className={`text-sm mt-3 font-medium ${muted}`}>{it.name}</figcaption>}
              </figure>
            ))}
          </div>
        </div>
      );
    case 'faq':
      return (
        <div className="max-w-3xl mx-auto text-left">
          {b.title && <h2 className={`${h2} ${b.align === 'center' ? 'text-center' : ''}`}>{b.title}</h2>}
          <div className={`divide-y ${dark ? 'divide-white/20' : 'divide-slate-200'}`}>
            {(b.items ?? []).map((it, i) => (
              <details key={i} className="group py-4">
                <summary className="flex items-center justify-between gap-3 cursor-pointer font-medium list-none">
                  {it.q}<ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{it.a}</p>
              </details>
            ))}
          </div>
        </div>
      );
    case 'countdown':
      return <Countdown b={b} accent={accent} dark={dark} />;
    case 'button':
      return <CtaButton b={b} accent={accent} dark={dark} act={act} preview={preview} />;
    case 'divider':
      return <hr className={dark ? 'border-white/20' : 'border-slate-200'} />;
    default:
      return null;
  }
}

function FormBlock({ b, ctx }: { b: Block; ctx: RenderContext }) {
  const [form, setForm] = useState<PublicFormData | null | 'missing'>(null);
  const slug = b.form_slug ?? '';
  const { loadForm } = ctx;
  useEffect(() => {
    let off = false;
    if (!slug) return;
    loadForm(slug).then((f) => !off && setForm(f ?? 'missing')).catch(() => !off && setForm('missing'));
    return () => { off = true; };
  }, [slug, loadForm]);
  const title = b.title ? <h2 className="text-2xl font-bold mb-5 text-center">{b.title}</h2> : null;
  if (!slug || form === 'missing') {
    return ctx.onSelect
      ? <div className="max-w-xl mx-auto">{title}<p className="text-sm text-slate-400 text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">{slug ? 'This form isn’t published.' : 'Choose a lead form for this block.'}</p></div>
      : null;
  }
  if (!form) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>;
  const submit = ctx.submitForm;
  return (
    <div className="max-w-xl mx-auto text-left">
      {title}
      <LeadFormView
        form={{ ...form, settings: { ...form.settings, accent: form.settings.accent || accentOf(ctx.settings) } }}
        mode={ctx.onSelect ? 'preview' : 'embed'}
        onSubmit={submit ? async (answers, consent, extra) => {
          const r = await submit(slug, answers, consent, extra);
          // In a funnel the next step is the thank-you page (the form's own redirect is ignored)
          if (b.after !== 'message') ctx.onNext?.();
          else ctx.onConvert?.();
          return { message: r.message, redirect: null };
        } : undefined}
      />
    </div>
  );
}

function Countdown({ b, accent, dark }: { b: Block; accent: string; dark: boolean }) {
  const end = b.until ? new Date(b.until).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (Number.isNaN(end)) return null;
  const left = Math.max(end - now, 0);
  if (left === 0) return <p className="text-lg font-semibold">{b.expired_text || 'This offer has ended.'}</p>;
  const parts: [number, string][] = [[Math.floor(left / 86_400_000), 'days'], [Math.floor(left / 3_600_000) % 24, 'hours'], [Math.floor(left / 60_000) % 60, 'minutes'], [Math.floor(left / 1000) % 60, 'seconds']];
  return (
    <div>
      {b.title && <p className="text-lg font-semibold mb-4">{b.title}</p>}
      <div className={`flex gap-3 ${b.align === 'center' ? 'justify-center' : ''}`} role="timer">
        {parts.map(([n, label]) => (
          <div key={label} className={`rounded-xl px-4 py-3 min-w-[72px] text-center ${dark ? 'bg-white/15' : 'bg-white border border-slate-200'}`}>
            <p className="text-3xl font-bold tabular-nums" style={{ color: dark ? '#fff' : accent }}>{String(n).padStart(2, '0')}</p>
            <p className={`text-xs ${dark ? 'text-white/80' : 'text-slate-500'}`}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
