/**
 * Email campaign content → HTML and plain text (Phase C4).
 * The app uses it for the live preview; supabase/functions/email-campaigns/render.ts is an
 * identical copy the sender uses, so keep this file free of imports.
 *
 * Text blocks understand **bold** and [link text](https://…). Merge tags: {first_name}, {name},
 * {business}. Links are numbered in reading order (campaignLinks) so click tracking can
 * redirect by number and never to an address that isn't in the email.
 */
export type BlockType = 'heading' | 'text' | 'button' | 'image' | 'divider';
export interface EmailBlock {
  id: string;
  type: BlockType;
  text?: string;
  url?: string;
  /** Image address (https). */
  src?: string;
  label?: string;
  alt?: string;
  align?: 'left' | 'center';
}
export interface EmailContent {
  blocks: EmailBlock[];
  accent?: string;
}
export interface RenderContext {
  subject: string;
  preheader?: string;
  business: { name: string; address?: string | null };
  vars?: { first_name?: string; name?: string };
  /** Footer unsubscribe link ('#' in previews). */
  unsubscribeUrl: string;
  openPixelUrl?: string;
  /** Wraps link number `index` for click tracking. */
  trackLink?: (index: number, url: string) => string;
}

const LINK_RE = /\[([^\]\n]{1,200})\]\(([^)\s]{1,2000})\)/g;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Only web, mail and phone links. */
export function safeUrl(u: string | undefined): string | null {
  const s = (u ?? '').trim();
  return /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:[+\d\s()-]+)$/i.test(s) ? s : null;
}
const safeImage = (u: string | undefined) => {
  const s = (u ?? '').trim();
  return /^https:\/\/[^\s<>"]+$/i.test(s) ? s : null;
};
const accentOf = (c: EmailContent) => (/^#[0-9a-f]{6}$/i.test(c.accent ?? '') ? (c.accent as string) : '#0ea5e9');

function fill(s: string, ctx: RenderContext) {
  const first = (ctx.vars?.first_name || ctx.vars?.name?.split(/\s+/)[0] || '').trim();
  return s
    .replace(/\{first_name\}/g, first || 'there')
    .replace(/\{name\}/g, (ctx.vars?.name || '').trim() || first || 'there')
    .replace(/\{business\}/g, ctx.business.name);
}

/** Every link in the email, in the order the tracker numbers them. */
export function campaignLinks(content: EmailContent): string[] {
  const out: string[] = [];
  for (const b of content.blocks ?? []) {
    if (b.type === 'text') {
      for (const m of (b.text ?? '').matchAll(LINK_RE)) {
        const u = safeUrl(m[2]);
        if (u) out.push(u);
      }
    } else if (b.type === 'button' || (b.type === 'image' && safeImage(b.src))) {
      const u = safeUrl(b.url);
      if (u) out.push(u);
    }
  }
  return out;
}

export function renderCampaign(content: EmailContent, ctx: RenderContext): { html: string; text: string } {
  const accent = accentOf(content);
  let n = 0;
  const href = (u: string) => {
    const i = n++;
    return ctx.trackLink && /^https?:/i.test(u) ? ctx.trackLink(i, u) : u;
  };
  // **bold** and [text](url) on already-escaped text; links are counted in order
  const inline = (raw: string) => {
    const parts: string[] = [];
    let last = 0;
    for (const m of raw.matchAll(LINK_RE)) {
      parts.push(esc(raw.slice(last, m.index)));
      const u = safeUrl(m[2]);
      parts.push(u ? `<a href="${esc(href(u))}" style="color:${accent};text-decoration:underline">${esc(m[1])}</a>` : esc(m[0]));
      last = (m.index ?? 0) + m[0].length;
    }
    parts.push(esc(raw.slice(last)));
    return parts.join('').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  };
  const inlineText = (raw: string) =>
    raw.replace(LINK_RE, (all, label: string, url: string) => {
      const u = safeUrl(url);
      return u ? `${label} (${href(u)})` : all;
    }).replace(/\*\*([^*\n]+)\*\*/g, '$1');

  const rows: string[] = [];
  for (const b of content.blocks ?? []) {
    const align = b.align === 'center' ? 'center' : 'left';
    if (b.type === 'heading' && b.text?.trim()) {
      rows.push(`<tr><td style="padding:8px 0 12px;font-size:22px;line-height:1.3;font-weight:700;color:#0f172a;text-align:${align}">${esc(fill(b.text.trim(), ctx))}</td></tr>`);
    } else if (b.type === 'text' && b.text?.trim()) {
      const paras = fill(b.text.trim(), ctx).split(/\n{2,}/);
      for (const p of paras) {
        rows.push(`<tr><td style="padding:0 0 14px;font-size:15px;line-height:1.6;color:#334155;text-align:${align}">${inline(p)}</td></tr>`);
      }
    } else if (b.type === 'button') {
      const u = safeUrl(b.url);
      if (!u) continue;
      const label = esc(fill((b.label ?? '').trim() || 'Learn more', ctx));
      rows.push(`<tr><td style="padding:6px 0 20px;text-align:${align}"><a href="${esc(href(u))}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">${label}</a></td></tr>`);
    } else if (b.type === 'image') {
      const src = safeImage(b.src);
      if (!src) continue;
      const img = `<img src="${esc(src)}" alt="${esc(b.alt ?? '')}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:10px;${align === 'center' ? 'margin:0 auto;' : ''}">`;
      const u = safeUrl(b.url);
      rows.push(`<tr><td style="padding:4px 0 18px">${u ? `<a href="${esc(href(u))}">${img}</a>` : img}</td></tr>`);
    } else if (b.type === 'divider') {
      rows.push('<tr><td style="padding:8px 0 20px"><div style="border-top:1px solid #e2e8f0;height:1px;line-height:1px">&nbsp;</div></td></tr>');
    }
  }

  const business = esc(ctx.business.name);
  const address = ctx.business.address?.trim() ? ` · ${esc(ctx.business.address.trim())}` : '';
  const pre = (ctx.preheader ?? '').trim();
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ctx.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(fill(pre, ctx))}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border-top:4px solid ${accent}">
      <tr><td style="padding:28px 28px 12px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows.join('\n')}
        </table>
      </td></tr>
    </table>
    <p style="max-width:560px;font-size:12px;line-height:1.5;color:#94a3b8;margin:16px auto 0">${business}${address}<br>You're getting this email because you're a customer of ${business}. <a href="${esc(ctx.unsubscribeUrl)}" style="color:#64748b">Unsubscribe</a></p>
  </td></tr>
</table>
${ctx.openPixelUrl ? `<img src="${esc(ctx.openPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">` : ''}
</body></html>`;

  // Plain text: the same links, numbered the same way
  n = 0;
  const lines: string[] = [];
  for (const b of content.blocks ?? []) {
    if (b.type === 'heading' && b.text?.trim()) lines.push(fill(b.text.trim(), ctx), '');
    else if (b.type === 'text' && b.text?.trim()) lines.push(inlineText(fill(b.text.trim(), ctx)), '');
    else if (b.type === 'button') {
      const u = safeUrl(b.url);
      if (u) lines.push(`${fill((b.label ?? '').trim() || 'Learn more', ctx)}: ${href(u)}`, '');
    } else if (b.type === 'image') {
      const u = safeUrl(b.url);
      if (safeImage(b.src) && u) lines.push(`${b.alt?.trim() || 'Image'}: ${href(u)}`, '');
    } else if (b.type === 'divider') lines.push('---', '');
  }
  lines.push('--', `${ctx.business.name}${ctx.business.address?.trim() ? `, ${ctx.business.address.trim()}` : ''}`, `Unsubscribe: ${ctx.unsubscribeUrl}`);
  return { html, text: lines.join('\n') };
}
