import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { storePortalBranding, type Branding } from '@/lib/branding';

/**
 * Pages on a connected domain (phase D3). The same app is served on every domain; on a customer's
 * domain (or a platform subdomain) the domains function says which page an address shows, and the
 * public pages read it from SiteContext instead of their /s/, /f/, /nps/l/, /help/ routes.
 */
export interface SiteRoute {
  kind: 'site';
  type: 'funnel' | 'form' | 'survey' | 'help' | null;
  slug?: string;
  key?: string;
  /** The route's path on the domain: '/' or '/offer' */
  base?: string;
  /** What follows it: a funnel step or a help article */
  sub?: string | null;
  business?: string;
}
type Resolved = SiteRoute | { kind: 'app'; agency: Branding } | { kind: 'pending' };

export const SiteContext = createContext<SiteRoute | null>(null);
export const useSite = () => useContext(SiteContext);

/** Address of a sub-page (funnel step, help article) on the connected domain. */
export function sitePath(site: SiteRoute, sub?: string | null) {
  const base = !site.base || site.base === '/' ? '' : site.base;
  return sub ? `${base}/${sub}` : base || '/';
}

const SIM_KEY = 're-sim-host';

/**
 * The host to look up, or null for the app's own addresses (localhost, *.vercel.app and
 * VITE_APP_HOSTS). On localhost, ?re_host=<domain> pretends to be that domain (for testing).
 */
export function connectedHost(): string | null {
  const h = window.location.hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') {
    try {
      const sim = new URLSearchParams(window.location.search).get('re_host');
      if (sim !== null) {
        if (sim) sessionStorage.setItem(SIM_KEY, sim.toLowerCase());
        else sessionStorage.removeItem(SIM_KEY);
      }
      return sessionStorage.getItem(SIM_KEY);
    } catch {
      return null;
    }
  }
  if (h.endsWith('.vercel.app')) return null;
  const own = String(import.meta.env.VITE_APP_HOSTS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return own.includes(h) ? null : h;
}

const domainsApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/domains`;

/**
 * What to show on this host. 'app' (the normal app) for the app's own addresses, unknown hosts
 * and white-label app domains (whose agency branding is stored for the sign-in pages).
 */
export function useHostSite(): { state: 'app' } | { state: 'loading' } | { state: 'pending' } | { state: 'site'; site: SiteRoute } {
  const host = connectedHost();
  const { pathname } = useLocation();
  const [result, setResult] = useState<{ path: string; value: Resolved | null } | null>(null);
  // The app itself (white-label or unknown host): no need to look up every page
  const isApp = result !== null && (!result.value || result.value.kind === 'app');

  useEffect(() => {
    if (!host || isApp) return;
    let off = false;
    fetch(`${domainsApi()}?host=${encodeURIComponent(host)}&path=${encodeURIComponent(pathname)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v: Resolved | null) => {
        if (off) return;
        if (v?.kind === 'app') storePortalBranding(v.agency);
        setResult({ path: pathname, value: v });
      })
      .catch(() => !off && setResult({ path: pathname, value: null }));
    return () => { off = true; };
  }, [host, pathname, isApp]);

  if (!host) return { state: 'app' };
  // Keep showing the last page while the next address is looked up
  if (!result) return { state: 'loading' };
  const v = result.value;
  if (!v || v.kind === 'app') return { state: 'app' };
  if (v.kind === 'pending') return { state: 'pending' };
  return { state: 'site', site: v };
}
