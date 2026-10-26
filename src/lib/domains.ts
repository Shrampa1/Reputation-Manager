import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { callFunction } from '@/lib/functions';

/** Custom domains, subdomains and white-label app domains (phase D3, migration 048 + the domains function). */
export interface CustomDomain {
  id: string;
  location_id: string | null;
  agency_id: string | null;
  hostname: string;
  purpose: 'site' | 'app';
  kind: 'custom' | 'subdomain';
  status: 'pending' | 'verified' | 'active' | 'error';
  verify_token: string;
  dns_ok: boolean;
  ssl_status: 'pending' | 'active' | 'error' | 'unknown';
  last_error: string | null;
  last_checked_at: string | null;
  verified_at: string | null;
  created_at: string;
}
export type RouteTarget = 'funnel' | 'form' | 'survey' | 'help';
export interface DomainRoute {
  id: string;
  domain_id: string;
  path: string;
  target_type: RouteTarget;
  target_id: string | null;
}
export interface DomainConfig {
  platformDomain: string | null;
  provider: 'manual' | 'vercel' | 'cloudflare';
  cnameTarget: string | null;
  aRecord: string | null;
  appHosts: string[];
}

export const TARGET_LABEL: Record<RouteTarget, string> = { funnel: 'Funnel', form: 'Lead form', survey: 'Survey', help: 'Help centre' };
export const STATUS_LABEL: Record<CustomDomain['status'], { label: string; tone: string }> = {
  pending: { label: 'Waiting for DNS', tone: 'bg-amber-50 text-amber-700' },
  verified: { label: 'Verified, connecting…', tone: 'bg-sky-50 text-sky-700' },
  active: { label: 'Live', tone: 'bg-emerald-50 text-emerald-700' },
  error: { label: 'Needs attention', tone: 'bg-rose-50 text-rose-700' },
};

const COLUMNS = 'id, location_id, agency_id, hostname, purpose, kind, status, verify_token, dns_ok, ssl_status, last_error, last_checked_at, verified_at, created_at';

/** Root domains (example.com, example.co.uk) need an A record instead of a CNAME (same rule as the function). */
export function isApex(hostname: string) {
  const labels = hostname.split('.');
  if (labels.length <= 2) return true;
  return labels.length === 3 && /^(co|com|org|net|gov|ac|edu)$/.test(labels[1]) && labels[2].length === 2;
}

/** The DNS records the customer adds at their domain registrar. */
export function dnsRecords(d: CustomDomain, cfg: DomainConfig | null) {
  const rows: { type: string; name: string; value: string; why: string }[] = [
    { type: 'TXT', name: `_rengine-verify.${d.hostname}`, value: `rengine-verify=${d.verify_token}`, why: 'Proves the domain is yours' },
  ];
  if (isApex(d.hostname)) {
    if (cfg?.aRecord) rows.push({ type: 'A', name: d.hostname, value: cfg.aRecord, why: 'Points the domain at your pages' });
  } else if (cfg?.cnameTarget) {
    rows.push({ type: 'CNAME', name: d.hostname, value: cfg.cnameTarget, why: 'Points the domain at your pages' });
  }
  return rows;
}

export const domainCall = <T,>(body: Record<string, unknown>) => callFunction<T>('domains', body);

export function useDomainConfig() {
  const [config, setConfig] = useState<DomainConfig | null>(null);
  useEffect(() => {
    domainCall<DomainConfig>({ action: 'config' }).then(setConfig).catch(() => setConfig(null));
  }, []);
  return config;
}

/** The business's site domains and their pages. */
export function useSiteDomains() {
  const { location } = useLocationContext();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [routes, setRoutes] = useState<DomainRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const [d, r] = await Promise.all([
      supabase.from('custom_domains').select(COLUMNS).eq('location_id', location.id).order('created_at'),
      supabase.from('domain_routes').select('id, domain_id, path, target_type, target_id').eq('location_id', location.id).order('path'),
    ]);
    setDomains((d.data as CustomDomain[]) ?? []);
    setRoutes((r.data as DomainRoute[]) ?? []);
    // Usually means migration 048 hasn't been run yet
    setError(d.error?.message ?? null);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(async (input: { hostname?: string; subdomain?: string }) => {
    const r = await domainCall<{ domain: CustomDomain }>({ action: 'add', purpose: 'site', ...input });
    setDomains((ds) => [...ds, r.domain]);
    return r.domain;
  }, []);
  const verify = useCallback(async (id: string) => {
    const r = await domainCall<{ domain: CustomDomain }>({ action: 'verify', id });
    setDomains((ds) => ds.map((d) => (d.id === id ? r.domain : d)));
    return r.domain;
  }, []);
  const remove = useCallback(async (id: string) => {
    await domainCall({ action: 'remove', id });
    setDomains((ds) => ds.filter((d) => d.id !== id));
    setRoutes((rs) => rs.filter((r) => r.domain_id !== id));
  }, []);

  const saveRoute = useCallback(async (route: Omit<DomainRoute, 'id'> & { id?: string }) => {
    if (!location) throw new Error('No business selected');
    const row = { domain_id: route.domain_id, location_id: location.id, path: route.path, target_type: route.target_type, target_id: route.target_type === 'help' ? null : route.target_id };
    const q = route.id
      ? supabase.from('domain_routes').update(row).eq('id', route.id).select('id, domain_id, path, target_type, target_id').single()
      : supabase.from('domain_routes').insert(row).select('id, domain_id, path, target_type, target_id').single();
    const { data, error } = await q;
    if (error) throw new Error(error.code === '23505' ? `“${route.path}” is already used on this domain.` : error.message);
    const saved = data as DomainRoute;
    setRoutes((rs) => (route.id ? rs.map((r) => (r.id === saved.id ? saved : r)) : [...rs, saved]));
    return saved;
  }, [location]);
  const deleteRoute = useCallback(async (id: string) => {
    const { error } = await supabase.from('domain_routes').delete().eq('id', id);
    if (error) throw new Error(error.message);
    setRoutes((rs) => rs.filter((r) => r.id !== id));
  }, []);

  return { domains, routes, loading, error, add, verify, remove, saveRoute, deleteRoute, reload: load };
}

/** The signed-in agency owner's white-label app domain. */
export function useAppDomain(agencyId: string | null) {
  const [domain, setDomain] = useState<CustomDomain | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!agencyId) return;
    supabase.from('custom_domains').select(COLUMNS).eq('agency_id', agencyId).maybeSingle()
      .then(({ data }) => { setDomain((data as CustomDomain) ?? null); setLoading(false); });
  }, [agencyId]);
  const add = async (hostname: string) => {
    const r = await domainCall<{ domain: CustomDomain }>({ action: 'add', purpose: 'app', hostname });
    setDomain(r.domain);
  };
  const verify = async () => {
    if (!domain) return;
    const r = await domainCall<{ domain: CustomDomain }>({ action: 'verify', id: domain.id });
    setDomain(r.domain);
  };
  const remove = async () => {
    if (!domain) return;
    await domainCall({ action: 'remove', id: domain.id });
    setDomain(null);
  };
  return { domain, loading: Boolean(agencyId) && loading, add, verify, remove };
}

/** Pages on connected domains that show this funnel / form / survey (for "Share" tabs). */
export async function domainLinksFor(targetType: RouteTarget, targetId: string) {
  const { data } = await supabase.from('domain_routes').select('path, domain_id').eq('target_type', targetType).eq('target_id', targetId);
  if (!data?.length) return [];
  const { data: ds } = await supabase.from('custom_domains').select('id, hostname, status').in('id', data.map((r) => r.domain_id));
  return data.map((r) => {
    const d = (ds ?? []).find((x) => x.id === r.domain_id);
    return d ? { url: `https://${d.hostname}${r.path === '/' ? '' : r.path}`, live: d.status === 'active' } : null;
  }).filter((x): x is { url: string; live: boolean } => Boolean(x));
}
