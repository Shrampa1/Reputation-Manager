import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Lead forms and landing pages (Phase C2, migration 043 + the lead-forms function). */
export type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'number' | 'date';
export type FieldRole = 'name' | 'email' | 'phone' | 'message';
export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  role?: FieldRole;
}
export interface FormSettings {
  title?: string;
  description?: string;
  submit_label?: string;
  success_message?: string;
  redirect_url?: string;
  consent_text?: string;
  accent?: string;
}
export interface FormPage {
  enabled?: boolean;
  headline?: string;
  subheadline?: string;
  image_url?: string;
  bullets?: string[];
  show_contact?: boolean;
}
export interface LeadForm {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  fields: FormField[];
  settings: FormSettings;
  page: FormPage;
  views: number;
  submissions: number;
  created_at: string;
  updated_at: string;
}
export interface FormSubmission {
  id: string;
  data: Record<string, string | string[]>;
  lead_id: string | null;
  page_url: string | null;
  referrer: string | null;
  utm: Record<string, string>;
  created_at: string;
}

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'text', label: 'Short text' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'textarea', label: 'Long text' },
  { type: 'select', label: 'Dropdown' },
  { type: 'checkbox', label: 'Checkboxes' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
];

const newId = () => Math.random().toString(36).slice(2, 10);
export const newField = (type: FieldType): FormField => ({
  id: newId(),
  type,
  label: FIELD_TYPES.find((t) => t.type === type)?.label ?? 'Question',
  required: false,
  ...(type === 'select' || type === 'checkbox' ? { options: ['Option 1', 'Option 2'] } : {}),
  ...(type === 'email' ? { role: 'email' as const } : type === 'phone' ? { role: 'phone' as const } : {}),
});

/** Ready-made starting points. */
export const PRESETS: { id: string; name: string; fields: FormField[]; settings: FormSettings; page: FormPage }[] = [
  {
    id: 'quote',
    name: 'Request a quote',
    fields: [
      { id: 'name', type: 'text', label: 'Your name', required: true, role: 'name' },
      { id: 'email', type: 'email', label: 'Email', required: true, role: 'email' },
      { id: 'phone', type: 'phone', label: 'Phone', role: 'phone' },
      { id: 'details', type: 'textarea', label: 'What do you need?', required: true, role: 'message' },
    ],
    settings: { title: 'Get a free quote', submit_label: 'Get my quote', success_message: 'Thanks! We’ll get back to you with a quote within one working day.' },
    page: { enabled: true, headline: 'Get a free, no-obligation quote', subheadline: 'Tell us what you need and we’ll get back to you within one working day.', bullets: ['Free and no obligation', 'Reply within one working day', 'Trusted by local customers'], show_contact: true },
  },
  {
    id: 'callback',
    name: 'Call me back',
    fields: [
      { id: 'name', type: 'text', label: 'Your name', required: true, role: 'name' },
      { id: 'phone', type: 'phone', label: 'Phone', required: true, role: 'phone' },
      { id: 'when', type: 'checkbox', label: 'Best time to call', options: ['Morning', 'Afternoon', 'Evening'] },
    ],
    settings: { title: 'Request a call back', submit_label: 'Call me back', success_message: 'Thanks! We’ll call you back soon.' },
    page: { enabled: true, headline: 'We’ll call you back', subheadline: 'Leave your number and the best time to reach you.', bullets: [], show_contact: true },
  },
  {
    id: 'booking',
    name: 'Booking request',
    fields: [
      { id: 'name', type: 'text', label: 'Your name', required: true, role: 'name' },
      { id: 'email', type: 'email', label: 'Email', required: true, role: 'email' },
      { id: 'phone', type: 'phone', label: 'Phone', role: 'phone' },
      { id: 'service', type: 'select', label: 'Service', required: true, options: ['Consultation', 'Appointment'] },
      { id: 'date', type: 'date', label: 'Preferred date' },
    ],
    settings: { title: 'Book an appointment', submit_label: 'Request booking', success_message: 'Thanks! We’ll confirm your booking shortly.' },
    page: { enabled: true, headline: 'Book your appointment', subheadline: 'Choose a service and a date that suits you. We’ll confirm by email or phone.', bullets: [], show_contact: true },
  },
  { id: 'blank', name: 'Blank form', fields: [{ id: 'name', type: 'text', label: 'Your name', required: true, role: 'name' }, { id: 'email', type: 'email', label: 'Email', required: true, role: 'email' }], settings: {}, page: { enabled: true } },
];

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'form';

const COLUMNS = 'id, name, slug, status, fields, settings, page, views, submissions, created_at, updated_at';

export function useLeadForms() {
  const { location } = useLocationContext();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!location) return;
    const { data, error } = await supabase.from('lead_forms').select(COLUMNS).eq('location_id', location.id).order('created_at', { ascending: false });
    setForms((data as LeadForm[]) ?? []);
    // Usually means migration 043 hasn't been run yet
    setError(error?.message ?? null);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);

  /** Creates a form from a preset with a unique link (a random ending avoids clashes with other businesses). */
  const create = useCallback(async (presetId: string, name: string) => {
    if (!location) throw new Error('No business selected');
    const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from('lead_forms')
      .insert({ location_id: location.id, name: name.trim() || preset.name, slug, fields: preset.fields, settings: preset.settings, page: preset.page })
      .select(COLUMNS).single();
    if (error) throw new Error(error.message);
    return data as LeadForm;
  }, [location]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('lead_forms').delete().eq('id', id);
    if (!error) setForms((fs) => fs.filter((f) => f.id !== id));
    return error?.message ?? null;
  }, []);

  return { forms, loading, error, create, remove, reload: load };
}

export async function fetchLeadForm(id: string) {
  const { data, error } = await supabase.from('lead_forms').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LeadForm | null;
}

export async function saveLeadForm(form: LeadForm) {
  const { name, slug, status, fields, settings, page } = form;
  const { data, error } = await supabase.from('lead_forms').update({ name, slug, status, fields, settings, page }).eq('id', form.id).select(COLUMNS).single();
  if (error) throw new Error(error.code === '23505' ? 'That link is already taken. Choose another.' : error.message);
  return data as LeadForm;
}

export async function fetchSubmissions(formId: string) {
  const { data, error } = await supabase.from('form_submissions').select('id, data, lead_id, page_url, referrer, utm, created_at')
    .eq('form_id', formId).order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data as FormSubmission[]) ?? [];
}

export const deleteSubmission = (id: string) => supabase.from('form_submissions').delete().eq('id', id);

/** CSV of submissions (one column per field, plus date, page and source). */
export function submissionsCsv(form: LeadForm, rows: FormSubmission[]) {
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
    // Spreadsheet formula injection: values starting with = + - @ are prefixed
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ['Date', ...form.fields.map((f) => f.label), 'Page', 'Source'];
  const lines = rows.map((r) => [
    new Date(r.created_at).toISOString(),
    ...form.fields.map((f) => r.data[f.id]),
    r.page_url ?? '',
    [r.utm.utm_source, r.utm.utm_medium, r.utm.utm_campaign].filter(Boolean).join(' / '),
  ].map(cell).join(','));
  return [head.map(cell).join(','), ...lines].join('\n');
}

export const formsApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-forms`;
export const publicFormUrl = (slug: string) => `${window.location.origin}/f/${slug}`;

/** The HTML a business pastes to embed the form (the frame resizes itself). */
export function embedSnippet(slug: string) {
  const src = `${publicFormUrl(slug)}?embed=1`;
  const id = `re-form-${slug}`;
  return `<iframe id="${id}" src="${src}" title="Form" style="width:100%;border:0;min-height:480px"></iframe>
<script>window.addEventListener("message",function(e){if(e.origin==="${window.location.origin}"&&e.data&&e.data.reFormHeight&&e.data.slug==="${slug}"){document.getElementById("${id}").style.height=e.data.reFormHeight+"px"}});</script>`;
}
