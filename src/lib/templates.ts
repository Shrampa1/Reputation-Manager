import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Saved replies (migration 029): for one business, or agency-wide for every linked business. */
export type TemplateKind = 'review_reply' | 'feedback_reply';

export interface ReplyTemplate {
  id: string;
  organization_id: string | null;
  agency_id: string | null;
  kind: TemplateKind;
  name: string;
  body: string;
  min_rating: number | null;
  max_rating: number | null;
  created_at: string;
}
export type TemplateInput = Pick<ReplyTemplate, 'kind' | 'name' | 'body' | 'min_rating' | 'max_rating'>;

export const KIND_LABELS: Record<TemplateKind, string> = {
  review_reply: 'Public review reply',
  feedback_reply: 'Private feedback email',
};

export const PLACEHOLDERS = [
  { key: '{first_name}', hint: 'Customer’s first name' },
  { key: '{name}', hint: 'Customer’s full name' },
  { key: '{business}', hint: 'Your business name' },
  { key: '{rating}', hint: 'Their star rating' },
];

const COLUMNS = 'id, organization_id, agency_id, kind, name, body, min_rating, max_rating, created_at';

/** Fills the placeholders for one customer. */
export function fillTemplate(body: string, v: { name: string; business: string; rating: number | null }) {
  const first = v.name.trim().split(/\s+/)[0] || 'there';
  return body
    .replace(/\{first_name\}/g, first)
    .replace(/\{name\}/g, v.name.trim() || 'there')
    .replace(/\{business\}/g, v.business)
    .replace(/\{rating\}/g, v.rating === null ? '' : String(v.rating));
}

/** Templates for this star rating come first; the rest follow. */
export function matchesRating(t: ReplyTemplate, rating: number | null) {
  if (rating === null) return true;
  return (t.min_rating === null || rating >= t.min_rating) && (t.max_rating === null || rating <= t.max_rating);
}

export function ratingRangeLabel(t: Pick<ReplyTemplate, 'min_rating' | 'max_rating'>) {
  const { min_rating: lo, max_rating: hi } = t;
  if (lo && hi) return lo === hi ? `${lo}★` : `${lo}–${hi}★`;
  if (hi) return `${hi}★ or lower`;
  if (lo) return `${lo}★ or higher`;
  return 'Any rating';
}

/** Every template the user can use in the active business: its own plus its agency's. */
export function useReplyTemplates(enabled = true) {
  const { organization } = useLocationContext();
  const [templates, setTemplates] = useState<ReplyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization || !enabled) return;
    // RLS returns this business's templates and those of an agency the user owns or the business is linked to
    const { data, error: err } = await supabase.from('reply_templates').select(COLUMNS).order('name');
    setTemplates(((data as ReplyTemplate[]) ?? []).filter((t) => t.organization_id === organization.id || t.agency_id !== null));
    setError(err ? `Couldn't load templates: ${err.message}` : null);
    setLoading(false);
  }, [organization, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { templates, loading, error, reload: load };
}

function friendly(raw: string) {
  if (raw.includes('row-level security')) return 'You don’t have access to change these templates.';
  if (raw.includes('reply_templates_check')) return 'The lowest rating can’t be higher than the highest rating.';
  return raw;
}

export async function saveTemplate(owner: { organizationId?: string; agencyId?: string }, input: TemplateInput, id?: string) {
  const row = { ...input, name: input.name.trim(), body: input.body.trim() };
  const { error } = id
    ? await supabase.from('reply_templates').update(row).eq('id', id)
    : await supabase.from('reply_templates').insert({ ...row, organization_id: owner.organizationId ?? null, agency_id: owner.agencyId ?? null });
  return { error: error ? friendly(error.message) : null };
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from('reply_templates').delete().eq('id', id);
  return { error: error ? friendly(error.message) : null };
}

// ================================================================ setup snapshots
export type SnapshotPart = 'automations' | 'templates' | 'review_settings' | 'widget';

export const SNAPSHOT_PARTS: { id: SnapshotPart; label: string; hint: string }[] = [
  { id: 'automations', label: 'Automation rules', hint: 'Added if a rule with the same name isn’t there yet' },
  { id: 'templates', label: 'Reply templates', hint: 'Added if a template with the same name isn’t there yet' },
  { id: 'review_settings', label: 'Review request settings', hint: 'Feedback Shield and reminder emails (replaced)' },
  { id: 'widget', label: 'Reviews widget style', hint: 'Layout, colours and filters (replaced; on/off stays as it is)' },
];

export interface SetupSnapshot {
  id: string;
  name: string;
  source_name: string | null;
  data: {
    automation_rules?: unknown[];
    reply_templates?: unknown[];
    review_settings?: { review_shield_enabled: boolean; review_reminder_days: number | null } | null;
    widget?: Record<string, unknown> | null;
  };
  created_at: string;
}

export type ApplyResult = Partial<Record<SnapshotPart, { added?: number; already_there?: number; failed?: number; error?: string | null; updated?: boolean }>>;

export function useSnapshots() {
  const [snapshots, setSnapshots] = useState<SetupSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await supabase.from('setup_snapshots').select('id, name, source_name, data, created_at').order('created_at', { ascending: false });
    setSnapshots((data as SetupSnapshot[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { snapshots, loading, reload: load };
}

export async function createSnapshot(organizationId: string, name: string) {
  const { error } = await supabase.rpc('create_snapshot', { p_org: organizationId, p_name: name });
  return { error: error?.message ?? null };
}

export async function applySnapshot(snapshotId: string, organizationId: string, parts: SnapshotPart[]) {
  const { data, error } = await supabase.rpc('apply_snapshot', { p_snapshot: snapshotId, p_org: organizationId, p_parts: parts });
  return { result: (data as ApplyResult | null) ?? null, error: error?.message ?? null };
}

export async function deleteSnapshot(id: string) {
  const { error } = await supabase.from('setup_snapshots').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** "2 rules added, 1 already there" style summary of one business's result. */
export function describeApply(r: ApplyResult) {
  const out: string[] = [];
  const counts = (label: string, x?: { added?: number; already_there?: number; failed?: number; error?: string | null }) => {
    if (!x) return;
    const bits = [`${plural(x.added ?? 0, label)} added`];
    if (x.already_there) bits.push(`${x.already_there} already there`);
    if (x.failed) bits.push(`${x.failed} not added${x.error ? ` (${x.error})` : ''}`);
    out.push(bits.join(', '));
  };
  counts('rule', r.automations);
  counts('template', r.templates);
  if (r.review_settings?.updated) out.push('review settings updated');
  if (r.widget?.updated) out.push('widget style updated');
  return out.join(' · ') || 'Nothing to copy';
}
