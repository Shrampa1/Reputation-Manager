import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { splitCsv } from '@/lib/reviewRequests';

/** Customers saved for this business, mostly synced from a connected app (migration 026). */
export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  source: 'app' | 'api';
}

/** Contacts that can be emailed (have an email and didn't opt out), for "Send to many". */
export function useEmailableContacts(enabled: boolean) {
  const { location } = useLocationContext();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !location) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('contacts')
      .select('id, name, email, phone, tags, source')
      .eq('location_id', location.id)
      .eq('do_not_contact', false)
      .not('email', 'is', null)
      .order('name')
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return;
        setContacts((data as Contact[]) ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, location]);

  return { contacts, loading };
}

/** "Name, email" lines the customer-list parser understands. */
export function contactsToList(contacts: Contact[]) {
  return contacts.map((c) => `${c.name.replace(/[,;\t\r\n]+/g, ' ')}, ${c.email}`).join('\n');
}

// ---------- Contacts page (C4) ----------
export interface ContactRow extends Contact {
  do_not_contact: boolean;
  created_at: string;
}
export interface Suppression {
  email: string;
  reason: 'unsubscribed' | 'bounced' | 'complained' | 'manual';
  created_at: string;
}
export interface ImportRow {
  name: string;
  email: string;
  phone?: string;
  tags?: string[];
}

const CONTACT_COLUMNS = 'id, name, email, phone, tags, source, do_not_contact, created_at';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanTags = (s: string) =>
  [...new Set(s.split(/[,;|]/).map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10);

export function useContacts() {
  const { location } = useLocationContext();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [suppressions, setSuppressions] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const [c, s] = await Promise.all([
      supabase.from('contacts').select(CONTACT_COLUMNS).eq('location_id', location.id).order('name').limit(5000),
      supabase.from('email_suppressions').select('email, reason, created_at').eq('location_id', location.id).limit(5000),
    ]);
    setContacts((c.data as ContactRow[]) ?? []);
    setSuppressions((s.data as Suppression[]) ?? []);
    setError(c.error?.message ?? null);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (c: { id?: string; name: string; email: string | null; phone: string | null; tags: string[]; do_not_contact: boolean }) => {
    if (!location) throw new Error('No business selected');
    const row = { name: c.name.trim(), email: c.email?.trim().toLowerCase() || null, phone: c.phone?.trim() || null, tags: c.tags, do_not_contact: c.do_not_contact };
    const q = c.id
      ? supabase.from('contacts').update(row).eq('id', c.id).select(CONTACT_COLUMNS).single()
      : supabase.from('contacts').insert({ ...row, location_id: location.id }).select(CONTACT_COLUMNS).single();
    const { data, error } = await q;
    if (error) throw new Error(error.code === '23505' ? 'A contact with that email already exists.' : error.message);
    const saved = data as ContactRow;
    setContacts((cs) => (c.id ? cs.map((x) => (x.id === saved.id ? saved : x)) : [...cs, saved].sort((a, b) => a.name.localeCompare(b.name))));
    return saved;
  }, [location]);

  const remove = useCallback(async (ids: string[]) => {
    const { error } = await supabase.from('contacts').delete().in('id', ids);
    if (error) throw new Error(error.message);
    setContacts((cs) => cs.filter((c) => !ids.includes(c.id)));
  }, []);

  /** Adds or updates contacts by email, 2,000 per call. */
  const importRows = useCallback(async (rows: ImportRow[], tags: string[]) => {
    if (!location) throw new Error('No business selected');
    const total = { added: 0, updated: 0, skipped: 0, over_limit: 0 };
    for (let i = 0; i < rows.length; i += 2000) {
      const { data, error } = await supabase.rpc('import_contacts', { p_location: location.id, p_rows: rows.slice(i, i + 2000), p_tags: tags });
      if (error) throw new Error(error.message);
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += Number((data as typeof total)[k] ?? 0);
    }
    await load();
    return total;
  }, [location, load]);

  return { contacts, suppressions, loading, error, save, remove, importRows, reload: load };
}

/** Reads a CSV / spreadsheet paste with name, email, phone and tags columns (header optional). */
export function parseContactsCsv(text: string): ImportRow[] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const delimiter = ['\t', ';', ','].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');
  let rows = splitCsv(clean, delimiter).filter((r) => r.some((c) => c.trim()));
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = !rows[0].some((c) => EMAIL_RE.test(c.trim())) && header.some((h) => /mail|name|phone|tag/.test(h));
  let col = { email: -1, name: -1, first: -1, last: -1, phone: -1, tags: -1 };
  if (hasHeader) {
    col = {
      email: header.findIndex((h) => /e-?mail/.test(h)),
      first: header.findIndex((h) => /first|given/.test(h)),
      last: header.findIndex((h) => /last|surname|family/.test(h)),
      name: header.findIndex((h) => /name|customer|client|contact/.test(h) && !/first|given|last|surname|family|company|business|user|mail/.test(h)),
      phone: header.findIndex((h) => /phone|mobile|cell|tel/.test(h)),
      tags: header.findIndex((h) => /tag|group|label|segment/.test(h)),
    };
    rows = rows.slice(1);
  }
  if (col.email < 0) {
    const width = Math.max(...rows.map((r) => r.length));
    let best = 0;
    for (let c = 0; c < width; c++) {
      const hits = rows.filter((r) => EMAIL_RE.test((r[c] ?? '').trim())).length;
      if (hits > best) { best = hits; col.email = c; }
    }
    // Without a header: "name, email" is the usual order
    if (col.name < 0 && col.email > 0) col.name = 0;
  }
  return rows.map((r) => {
    const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const name = get(col.name) || [get(col.first), get(col.last)].filter(Boolean).join(' ');
    return { name: name.slice(0, 100), email: get(col.email).toLowerCase(), phone: get(col.phone).slice(0, 40) || undefined, tags: col.tags >= 0 ? cleanTags(get(col.tags)) : undefined };
  }).filter((r) => r.email);
}
