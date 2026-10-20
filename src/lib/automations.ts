import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** What Reputation Engine can ask a connected app (e.g. S.Ops) to create. Migration 025. */
export type ActionKind = 'create_task' | 'create_lead' | 'create_client' | 'create_project' | 'create_quote';
export type ActionStatus = 'queued' | 'sent' | 'created' | 'in_progress' | 'done' | 'cancelled' | 'failed';
export type ActionSource = 'review' | 'review_request' | 'lead';
export type RuleTrigger = 'review.created' | 'review_request.rated' | 'feedback.received' | 'lead.created';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export const ACTION_KINDS: { id: ActionKind; label: string; noun: string }[] = [
  { id: 'create_task', label: 'Create a task', noun: 'Task' },
  { id: 'create_lead', label: 'Create a lead', noun: 'Lead' },
  { id: 'create_client', label: 'Create a client', noun: 'Client' },
  { id: 'create_project', label: 'Create a project', noun: 'Project' },
  { id: 'create_quote', label: 'Create a quote draft', noun: 'Quote' },
];
export const actionNoun = (a: ActionKind) => ACTION_KINDS.find((k) => k.id === a)?.noun ?? 'Item';

export const TRIGGERS: { id: RuleTrigger; label: string; hint: string; rated: boolean }[] = [
  { id: 'review_request.rated', label: 'A customer rates you', hint: 'From a review request or your QR code', rated: true },
  { id: 'feedback.received', label: 'A customer leaves private feedback', hint: 'Unhappy customers who wrote to you privately', rated: true },
  { id: 'review.created', label: 'A new public review arrives', hint: 'Google, Facebook and other platforms', rated: true },
  { id: 'lead.created', label: 'A new lead comes in', hint: 'Website chat, forms and messages', rated: false },
];

export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];

export const DUE_OPTIONS: { hours: number | null; label: string }[] = [
  { hours: null, label: 'No due date' },
  { hours: 4, label: 'In 4 hours' },
  { hours: 24, label: 'In 24 hours' },
  { hours: 72, label: 'In 3 days' },
  { hours: 168, label: 'In a week' },
];

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: RuleTrigger;
  min_rating: number | null;
  max_rating: number | null;
  keywords: string[];
  action: ActionKind;
  title: string;
  priority: Priority;
  due_hours: number | null;
  assignee: string;
  fired_count: number;
  last_fired_at: string | null;
  created_at: string;
}
export type RuleInput = Omit<AutomationRule, 'id' | 'fired_count' | 'last_fired_at' | 'created_at'>;

export interface ExternalAction {
  id: string;
  action: ActionKind;
  status: ActionStatus;
  title: string;
  priority: Priority;
  due_at: string | null;
  assignee: string;
  source_type: ActionSource;
  source_id: string;
  rule_name: string | null;
  external_id: string | null;
  external_url: string | null;
  app_note: string | null;
  resolved_by: string | null;
  last_error: string | null;
  completed_at: string | null;
  created_at: string;
}

const ACTION_COLUMNS =
  'id, action, status, title, priority, due_at, assignee, source_type, source_id, rule_name, external_id, external_url, app_note, resolved_by, last_error, completed_at, created_at';
const RULE_COLUMNS =
  'id, name, enabled, trigger, min_rating, max_rating, keywords, action, title, priority, due_hours, assignee, fired_count, last_fired_at, created_at';

/** Ready-made rules for the "New automation" picker. */
export const RULE_TEMPLATES: { key: string; label: string; rule: RuleInput }[] = [
  {
    key: 'unhappy',
    label: 'Unhappy customer → task',
    rule: { name: 'Unhappy customer', enabled: true, trigger: 'review_request.rated', min_rating: null, max_rating: 3, keywords: [],
      action: 'create_task', title: 'Unhappy client: {name} ({rating}★)', priority: 'high', due_hours: 24, assignee: '' },
  },
  {
    key: 'bad-review',
    label: 'Bad public review → reply task',
    rule: { name: 'Reply to bad reviews', enabled: true, trigger: 'review.created', min_rating: null, max_rating: 3, keywords: [],
      action: 'create_task', title: 'Reply to {rating}★ {platform} review from {name}', priority: 'high', due_hours: 24, assignee: '' },
  },
  {
    key: 'lead',
    label: 'New lead → lead in your app',
    rule: { name: 'New leads', enabled: true, trigger: 'lead.created', min_rating: null, max_rating: null, keywords: [],
      action: 'create_lead', title: '', priority: 'normal', due_hours: null, assignee: '' },
  },
  {
    key: 'referral',
    label: 'Happy customer → ask for a referral',
    rule: { name: 'Ask happy customers for referrals', enabled: true, trigger: 'review_request.rated', min_rating: 5, max_rating: null,
      keywords: [], action: 'create_task', title: 'Thank {name} and ask for a referral', priority: 'low', due_hours: 72, assignee: '' },
  },
  {
    key: 'keywords',
    label: 'Complaint keywords → manager task',
    rule: { name: 'Complaints about lateness or price', enabled: true, trigger: 'feedback.received', min_rating: null, max_rating: null,
      keywords: ['late', 'price', 'rude', 'mess'], action: 'create_task', title: 'Complaint from {name}', priority: 'urgent', due_hours: 4, assignee: '' },
  },
];

const message = (error: { message: string } | null) => error?.message ?? null;

/** Name of the connected app that receives actions ("S.Ops"), or null when none is set up. */
export function useActionApp() {
  const { organization } = useLocationContext();
  const [name, setName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!organization) return;
    let cancelled = false;
    supabase.rpc('get_action_app', { p_org: organization.id }).then(({ data }) => {
      if (cancelled) return;
      setName((data as string | null) ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [organization]);
  return { appName: name, loaded };
}

/** Actions already sent for these reviews / requests / leads, grouped by source id. */
export function useSourceActions(sourceIds: string[]) {
  const [byId, setById] = useState<Record<string, ExternalAction[]>>({});
  const key = [...sourceIds].sort().join(',');
  const load = useCallback(async () => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setById({});
      return;
    }
    // Chunked to keep the URL short
    const rows: ExternalAction[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from('external_actions').select(ACTION_COLUMNS)
        .in('source_id', ids.slice(i, i + 100)).order('created_at', { ascending: true });
      rows.push(...((data as ExternalAction[]) ?? []));
    }
    const grouped: Record<string, ExternalAction[]> = {};
    for (const r of rows) (grouped[r.source_id] ??= []).push(r);
    setById(grouped);
  }, [key]);
  useEffect(() => {
    load();
  }, [load]);
  return { actionsBySource: byId, reload: load };
}

export function useAutomations() {
  const { organization } = useLocationContext();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [actions, setActions] = useState<ExternalAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    const [r, a] = await Promise.all([
      supabase.from('automation_rules').select(RULE_COLUMNS).eq('organization_id', organization.id).order('created_at'),
      supabase.from('external_actions').select(ACTION_COLUMNS).eq('organization_id', organization.id)
        .order('created_at', { ascending: false }).limit(30),
    ]);
    setRules((r.data as AutomationRule[]) ?? []);
    setActions((a.data as ExternalAction[]) ?? []);
    const err = r.error ?? a.error;
    setError(err ? `Couldn't load automations: ${err.message}` : null);
    setLoading(false);
  }, [organization]);

  useEffect(() => {
    load();
  }, [load]);

  return { rules, actions, loading, error, reload: load };
}

function friendlyRuleError(raw: string) {
  if (raw.includes('automation_rules_check')) return 'The lowest rating can’t be higher than the highest rating.';
  if (raw.includes('name')) return 'Give the automation a name (up to 80 characters).';
  return raw;
}

export async function saveRule(organizationId: string, input: RuleInput, id?: string) {
  const row = { ...input, keywords: input.keywords.map((k) => k.trim()).filter(Boolean) };
  const { error } = id
    ? await supabase.from('automation_rules').update(row).eq('id', id)
    : await supabase.from('automation_rules').insert({ organization_id: organizationId, ...row });
  return { error: error ? friendlyRuleError(error.message) : null };
}

export async function setRuleEnabled(id: string, enabled: boolean) {
  const { error } = await supabase.from('automation_rules').update({ enabled }).eq('id', id);
  return { error: message(error) };
}

export async function deleteRule(id: string) {
  const { error } = await supabase.from('automation_rules').delete().eq('id', id);
  return { error: message(error) };
}

export async function sendAction(input: {
  sourceType: ActionSource;
  sourceId: string;
  action: ActionKind;
  title: string;
  details: string;
  priority: Priority;
  dueHours: number | null;
  assignee: string;
}) {
  const { error } = await supabase.rpc('send_external_action', {
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_action: input.action,
    p_title: input.title.trim() || null,
    p_details: input.details.trim() || null,
    p_priority: input.priority,
    p_due_hours: input.dueHours,
    p_assignee: input.assignee.trim() || null,
  });
  return { error: message(error) };
}

/** Badge text and colour for an action's status. */
export function actionStatusInfo(a: ExternalAction, appName: string | null): { label: string; tone: 'slate' | 'sky' | 'emerald' | 'amber' | 'rose' } {
  const app = appName ?? 'the app';
  switch (a.status) {
    case 'queued':
      return { label: `Sending to ${app}…`, tone: 'slate' };
    case 'sent':
      return { label: `Sent to ${app}`, tone: 'sky' };
    case 'created':
      return { label: `${actionNoun(a.action)} created in ${app}`, tone: 'sky' };
    case 'in_progress':
      return { label: `In progress in ${app}`, tone: 'amber' };
    case 'done':
      return { label: a.resolved_by ? `Resolved by ${a.resolved_by}` : `Resolved in ${app}`, tone: 'emerald' };
    case 'cancelled':
      return { label: `Cancelled in ${app}`, tone: 'slate' };
    default:
      return { label: `Couldn’t reach ${app}`, tone: 'rose' };
  }
}

/** Fills the {name}/{rating}/{platform} placeholders for a preview. */
export function previewTitle(template: string) {
  return template.replace(/\{name\}/g, 'Sara Khan').replace(/\{rating\}/g, '2').replace(/\{platform\}/g, 'Google');
}
