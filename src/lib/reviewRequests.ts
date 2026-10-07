import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';
import type { ReviewRequest } from '@/types';

export const REVIEW_REQUEST_COLUMNS =
  'id, location_id, lead_id, customer_name, email, channel, status, error, shield, rating, feedback, responded_at, clicked_review_at, sent_by, created_at';

export async function sendReviewRequest(input: {
  name: string;
  email: string;
  note?: string;
  leadId?: string | null;
  allowRepeat?: boolean;
}): Promise<ReviewRequest> {
  const { request } = await callFunction<{ request: ReviewRequest }>('send-review-request', input);
  return request;
}

/** Recent review requests for the current business, kept live with realtime. */
export function useReviewRequests(limit = 100) {
  const { location, loading: locationLoading } = useLocationContext();
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!location) {
      setRequests([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    const { data, error: loadError } = await supabase
      .from('review_requests')
      .select(REVIEW_REQUEST_COLUMNS)
      .eq('location_id', location.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    setError(loadError ? `Couldn't load review requests: ${loadError.message}` : null);
    if (!loadError) setRequests((data as ReviewRequest[]) ?? []);
    setLoading(false);
  }, [location, locationLoading, limit]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!location) return;
    const channel = supabase
      .channel(`review_requests:${location.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'review_requests', filter: `location_id=eq.${location.id}` }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [location, fetchRequests]);

  return { requests, loading: loading || locationLoading, error, refetch: fetchRequests };
}

/** Short human description of where a request stands. */
export function requestOutcome(r: ReviewRequest): { label: string; tone: 'slate' | 'sky' | 'emerald' | 'amber' | 'rose' } {
  if (r.status === 'failed') return { label: 'Failed to send', tone: 'rose' };
  if (r.status === 'sending') return { label: 'Sending…', tone: 'slate' };
  if (r.rating === null) return { label: 'Sent · no response yet', tone: 'sky' };
  if (r.clicked_review_at) return { label: `Rated ${r.rating}★ · opened review page`, tone: 'emerald' };
  if (r.feedback) return { label: `Rated ${r.rating}★ · left private feedback`, tone: 'amber' };
  return { label: `Rated ${r.rating}★`, tone: r.rating >= 4 ? 'emerald' : 'amber' };
}

// ======================== Bulk requests (CSV / pasted list) ========================

export interface CustomerRow {
  name: string;
  email: string;
  /** Why this row can't be sent, if it can't */
  problem: 'invalid' | 'duplicate' | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANGLE_EMAIL_RE = /^(.*?)<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/;

/** Splits CSV text into rows, honouring "quoted, values" and "" escapes. */
function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell.trim() === '') {
      quoted = true;
      cell = '';
    } else if (c === delimiter) {
      row.push(cell.trim()); cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = '';
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/**
 * Reads a customer list exported from a spreadsheet, POS, Shopify, etc. — or just pasted lines
 * like "Jane Doe, jane@example.com" or "Jane Doe <jane@example.com>". Works out which column
 * holds the email and which the name (a header row is optional).
 */
export function parseCustomerList(text: string): CustomerRow[] {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const delimiter = ['\t', ';', ','].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',');
  let rows = splitCsv(clean, delimiter);
  if (rows.length === 0) return [];

  // Header row: no email in it, and words like "name" / "email"
  const header = rows[0].map((h) => h.toLowerCase());
  const hasHeader = !rows[0].some((c) => EMAIL_RE.test(c)) && header.some((h) => /mail|name|customer|first|last/.test(h));
  let emailCol = -1;
  let nameCol = -1;
  let firstCol = -1;
  let lastCol = -1;
  if (hasHeader) {
    emailCol = header.findIndex((h) => /e-?mail/.test(h));
    firstCol = header.findIndex((h) => /first|given|forename/.test(h));
    lastCol = header.findIndex((h) => /last|surname|family/.test(h));
    nameCol = header.findIndex((h, i) => i !== emailCol && /(^|\s|_)(full\s*)?name$|^name|customer|client|contact/.test(h) && !/first|given|forename|last|surname|family|company|business|user/.test(h));
    rows = rows.slice(1);
  }
  // Otherwise (or if the header was unhelpful) the column with the most email addresses wins
  if (emailCol < 0) {
    const width = Math.max(...rows.map((r) => r.length));
    let best = 0;
    for (let c = 0; c < width; c++) {
      const hits = rows.filter((r) => EMAIL_RE.test(r[c] ?? '') || ANGLE_EMAIL_RE.test(r[c] ?? '')).length;
      if (hits > best) { best = hits; emailCol = c; }
    }
  }

  const seen = new Set<string>();
  const out: CustomerRow[] = [];
  for (const r of rows) {
    // A short line (e.g. just an email) may not reach the email column
    const inColumn = emailCol >= 0 ? r[emailCol] ?? '' : '';
    let email = inColumn || (r.find((c) => EMAIL_RE.test(c) || ANGLE_EMAIL_RE.test(c)) ?? '');
    let name = '';
    const angle = ANGLE_EMAIL_RE.exec(email);
    if (angle) {
      name = angle[1].replace(/["']/g, '').trim();
      email = angle[2];
    }
    email = email.replace(/^mailto:/i, '').trim().toLowerCase();
    if (!name) {
      if (nameCol >= 0) name = r[nameCol] ?? '';
      else if (firstCol >= 0 || lastCol >= 0) name = [r[firstCol] ?? '', r[lastCol] ?? ''].join(' ');
      // No header: the first non-email text cell
      else name = r.find((c, i) => i !== emailCol && c && !EMAIL_RE.test(c) && !/^[\d\s+()./-]+$/.test(c)) ?? '';
    }
    name = name.replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!email && !name) continue;
    let problem: CustomerRow['problem'] = null;
    if (!EMAIL_RE.test(email) || email.length > 254) problem = 'invalid';
    else if (seen.has(email)) problem = 'duplicate';
    else seen.add(email);
    out.push({ name, email, problem });
  }
  return out;
}

export type BulkSkipReason = 'invalid' | 'duplicate' | 'recent' | 'limit';
export interface BulkSendResult {
  sent: number;
  failed: number;
  skipped: { name: string; email: string; reason: BulkSkipReason }[];
  error?: string;
}

export const BULK_BATCH_SIZE = 50;

export async function sendBulkReviewRequests(recipients: { name: string; email: string }[], note: string): Promise<BulkSendResult> {
  return callFunction<BulkSendResult>('send-review-request', { recipients, note });
}
