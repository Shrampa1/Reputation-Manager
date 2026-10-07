import { callFunction } from '@/lib/functions';
import type { GscCoverage, GscInspection, GscOverview } from '@/types';

export interface GscStatus {
  connected: boolean;
  status: 'connected' | 'error' | 'disconnected' | null;
  lastError: string | null;
  site: string | null;
  sites: string[];
}

export interface Snapshot<T> {
  data: T;
  created_at: string;
}

export const gscStatus = () => callFunction<GscStatus>('search-console', { action: 'status' });

export const gscSelectSite = (siteUrl: string) =>
  callFunction<{ site: string; sites: string[] }>('search-console', { action: 'select', siteUrl });

export const gscOverview = (days: number, refresh = false) =>
  callFunction<{ snapshot: Snapshot<GscOverview>; site: string }>('search-console', { action: 'overview', days, refresh });

/** `cachedOnly` returns the last saved check (or null) without running a new one. */
export const gscCoverage = (opts: { refresh?: boolean; cachedOnly?: boolean } = {}) =>
  callFunction<{ snapshot: Snapshot<GscCoverage> | null; site: string }>('search-console', { action: 'coverage', ...opts });

export const gscInspect = (url: string) => callFunction<{ result: GscInspection }>('search-console', { action: 'inspect', url });

/** "sc-domain:example.com" → "example.com", "https://www.example.com/" → "www.example.com" */
export function siteLabel(siteUrl: string | null | undefined): string {
  return (siteUrl ?? '').replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return ((current - previous) / previous) * 100;
}

export const formatNumber = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k` : Math.round(n).toLocaleString('en-US'));
