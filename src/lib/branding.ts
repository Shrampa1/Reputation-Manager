import { supabase } from '@/lib/supabase';

/** An agency's public branding (migration 022). */
export interface Branding {
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  support_email: string | null;
}

const DEFAULT = { title: document.title, favicon: '/favicon.svg', theme: '#0ea5e9' };
const PORTAL_KEY = 'portalBranding';
/** Pages someone sees before signing in: they keep the portal's look. */
export const AUTH_PATHS = ['/p/', '/login', '/forgot-password', '/reset-password'];

function isBranding(v: unknown): v is Branding {
  const b = v as Branding | null;
  return Boolean(b && typeof b.name === 'string' && typeof b.slug === 'string' && /^#[0-9a-fA-F]{6}$/.test(b.brand_color ?? ''));
}

// The remembered portal is a tiny external store, so every component using it re-renders when
// the portal page (or an invite link) saves it.
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: Branding | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(PORTAL_KEY);
  } catch {
    return null;
  }
}

export function readPortalBranding(): Branding | null {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed = JSON.parse(raw ?? 'null');
    cachedValue = isBranding(parsed) ? parsed : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export function subscribePortalBranding(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function storePortalBranding(b: Branding | null) {
  try {
    if (b) localStorage.setItem(PORTAL_KEY, JSON.stringify(b));
    else localStorage.removeItem(PORTAL_KEY);
  } catch {
    /* branding just isn't remembered */
  }
  listeners.forEach((l) => l());
}

export async function fetchPortalBranding(slug: string): Promise<Branding | null> {
  const { data, error } = await supabase.rpc('get_portal_branding', { p_slug: slug });
  if (error) return null;
  return isBranding(data) ? data : null;
}

export async function fetchBusinessBranding(orgId: string): Promise<Branding | null> {
  const { data, error } = await supabase.rpc('get_business_branding', { p_org: orgId });
  if (error) return null; // before migration 022, or not in a portal
  return isBranding(data) ? data : null;
}

// ---------------------------------------------------------------- Colours
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix([r, g, b]: [number, number, number], [r2, g2, b2]: [number, number, number], t: number): [number, number, number] {
  return [Math.round(r + (r2 - r) * t), Math.round(g + (g2 - g) * t), Math.round(b + (b2 - b) * t)];
}

const triplet = (c: [number, number, number]) => c.join(' ');

/** Primary button / active nav / focus colours (see index.css --brand-*). */
function brandScale(hex: string) {
  const base = hexToRgb(hex);
  return {
    '--brand-50': triplet(mix(base, [255, 255, 255], 0.92)),
    '--brand-100': triplet(mix(base, [255, 255, 255], 0.82)),
    '--brand-500': triplet(base),
    '--brand-600': triplet(mix(base, [0, 0, 0], 0.15)),
    '--brand-700': triplet(mix(base, [0, 0, 0], 0.3)),
  };
}

function setFavicon(href: string) {
  for (const rel of ['icon', 'apple-touch-icon']) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
  }
}

/** Applies (or removes, for null) a white-label look to the whole app. */
export function applyBranding(b: Branding | null) {
  const root = document.documentElement;
  const vars = brandScale(b?.brand_color ?? DEFAULT.theme);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  document.title = b ? b.name : DEFAULT.title;
  setFavicon(b?.logo_url ?? DEFAULT.favicon);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', b?.brand_color ?? DEFAULT.theme);
}
