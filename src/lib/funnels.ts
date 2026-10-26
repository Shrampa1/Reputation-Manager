import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { slugify } from '@/lib/leadForms';

/** Funnel builder (phase D2, migration 047 + the funnels function). Public pages: /s/<slug>[/<step>]. */
export type Background = 'white' | 'muted' | 'accent' | 'dark';
export type ButtonAction = 'next' | 'url' | 'form';
export interface Block {
  id: string;
  type: 'hero' | 'text' | 'image' | 'video' | 'form' | 'reviews' | 'testimonials' | 'features' | 'faq' | 'countdown' | 'button' | 'divider';
  bg?: Background;
  align?: 'left' | 'center';
  // hero / text / sections
  headline?: string;
  subheadline?: string;
  title?: string;
  text?: string;
  image?: string;
  // buttons (hero + button block)
  button_label?: string;
  button_action?: ButtonAction;
  button_url?: string;
  // image / video
  src?: string;
  alt?: string;
  link?: string;
  url?: string;
  // lead form
  form_slug?: string;
  after?: 'next' | 'message';
  // reviews
  count?: number;
  // lists
  items?: { title?: string; text?: string; name?: string; q?: string; a?: string }[];
  // countdown
  until?: string;
  expired_text?: string;
}
export interface FunnelSettings {
  accent?: string;
  font?: 'sans' | 'serif' | 'rounded';
  seo_title?: string;
  seo_description?: string;
  og_image?: string;
  meta_pixel_id?: string;
  ga_id?: string;
  /** 'none' | 'main' | an extra chat widget's id (046) */
  chat?: string;
  chat_open?: boolean;
}
export interface FunnelStep {
  id: string;
  funnel_id: string;
  name: string;
  slug: string;
  position: number;
  blocks: Block[];
  seo: { title?: string; description?: string };
  views: number;
  conversions: number;
}
export interface Funnel {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published';
  settings: FunnelSettings;
  created_at: string;
  updated_at: string;
}
export interface PublicFunnel {
  funnel: { id: string; slug: string; name: string; settings: FunnelSettings };
  step: { id: string; slug: string; name: string; blocks: Block[]; seo: FunnelStep['seo']; position: number };
  steps: { slug: string; name: string }[];
  business: { name: string; phone: string | null; website: string | null; address: string | null; rating: number | null; reviewCount: number | null; reviewLink: string | null };
  chatKey: string | null;
  reviews: { author: string; rating: number; text: string; platform: string }[];
  showBranding: boolean;
}

export const BLOCK_TYPES: { type: Block['type']; label: string }[] = [
  { type: 'hero', label: 'Hero' },
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'video', label: 'Video' },
  { type: 'form', label: 'Lead form' },
  { type: 'features', label: 'Benefits' },
  { type: 'reviews', label: 'Google reviews' },
  { type: 'testimonials', label: 'Testimonials' },
  { type: 'faq', label: 'FAQ' },
  { type: 'countdown', label: 'Countdown' },
  { type: 'button', label: 'Button' },
  { type: 'divider', label: 'Divider' },
];
export const blockLabel = (t: Block['type']) => BLOCK_TYPES.find((b) => b.type === t)?.label ?? t;

export const FONTS: Record<NonNullable<FunnelSettings['font']>, { label: string; stack: string }> = {
  sans: { label: 'Clean (sans-serif)', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  serif: { label: 'Classic (serif)', stack: 'Georgia, Cambria, "Times New Roman", Times, serif' },
  rounded: { label: 'Friendly (rounded)', stack: 'ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, sans-serif' },
};

const newId = () => Math.random().toString(36).slice(2, 10);
export function newBlock(type: Block['type']): Block {
  const base = { id: newId(), type };
  switch (type) {
    case 'hero': return { ...base, headline: 'A clear promise in one line', subheadline: 'Who it’s for and why it matters, in a sentence or two.', button_label: 'Get started', button_action: 'form', align: 'center', bg: 'muted' };
    case 'text': return { ...base, text: 'Write here. Use **bold** and [links](https://example.com).' };
    case 'image': return { ...base, src: '', alt: '' };
    case 'video': return { ...base, url: '' };
    case 'form': return { ...base, form_slug: '', title: '', after: 'next' };
    case 'features': return { ...base, title: 'Why choose us', items: [{ title: 'Fast', text: 'Booked in days, not weeks.' }, { title: 'Friendly', text: 'A team that listens.' }, { title: 'Fair', text: 'Clear prices up front.' }] };
    case 'reviews': return { ...base, title: 'What our customers say', count: 3, bg: 'muted' };
    case 'testimonials': return { ...base, title: 'Happy customers', items: [{ text: 'They were brilliant from start to finish.', name: 'Sarah K.' }] };
    case 'faq': return { ...base, title: 'Questions', items: [{ q: 'How long does it take?', a: 'Most jobs are done in a day.' }] };
    case 'countdown': return { ...base, title: 'Offer ends in', until: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16), expired_text: 'This offer has ended.', align: 'center' };
    case 'button': return { ...base, button_label: 'Continue', button_action: 'next', align: 'center' };
    default: return base;
  }
}

type TemplateStep = { name: string; slug: string; blocks: Omit<Block, 'id'>[] };
const withIds = (blocks: Omit<Block, 'id'>[]) => blocks.map((b) => ({ ...b, id: newId() })) as Block[];
const thankYou: TemplateStep = {
  name: 'Thank you', slug: 'thank-you',
  blocks: [
    { type: 'hero', headline: 'Thank you! You’re all set.', subheadline: 'We’ve got your details and will be in touch very soon.', align: 'center', bg: 'muted' },
    { type: 'reviews', title: 'You’re in good hands', count: 3 },
  ],
};
export const FUNNEL_TEMPLATES: { id: string; name: string; description: string; steps: TemplateStep[] }[] = [
  {
    id: 'consultation',
    name: 'Free consultation',
    description: 'Landing page with a booking form, then a thank-you page',
    steps: [
      {
        name: 'Landing', slug: 'home',
        blocks: [
          { type: 'hero', headline: 'Book your free consultation', subheadline: 'Talk to an expert, get honest advice and a clear quote. No pressure.', button_label: 'Book my free consultation', button_action: 'form', align: 'center', bg: 'muted' },
          { type: 'features', title: 'What you get', items: [{ title: '30 minutes, free', text: 'A real conversation about what you need.' }, { title: 'A clear quote', text: 'No hidden costs, no surprises.' }, { title: 'No obligation', text: 'Decide in your own time.' }] },
          { type: 'reviews', title: 'Loved by local customers', count: 3, bg: 'muted' },
          { type: 'form', title: 'Pick a time that suits you', after: 'next', form_slug: '' },
          { type: 'faq', title: 'Questions', items: [{ q: 'Is it really free?', a: 'Yes, the consultation costs nothing.' }, { q: 'How soon can I come in?', a: 'Usually within the same week.' }] },
        ],
      },
      thankYou,
    ],
  },
  {
    id: 'lead_magnet',
    name: 'Lead magnet',
    description: 'Offer a guide or checklist for an email, then deliver it',
    steps: [
      {
        name: 'Opt-in', slug: 'home',
        blocks: [
          { type: 'hero', headline: 'Free guide: 7 things to check before you hire', subheadline: 'Avoid the most common (and expensive) mistakes. Sent straight to your inbox.', button_label: 'Send me the guide', button_action: 'form', align: 'center', bg: 'muted' },
          { type: 'form', title: 'Where should we send it?', after: 'next', form_slug: '' },
        ],
      },
      { name: 'Your guide', slug: 'thank-you', blocks: [{ type: 'hero', headline: 'Your guide is on its way', subheadline: 'Check your inbox in the next few minutes. Want help right away? Book a call.', button_label: 'Book a call', button_action: 'url', button_url: 'https://', align: 'center', bg: 'muted' }] },
    ],
  },
  {
    id: 'offer',
    name: 'Limited-time offer',
    description: 'Promotion with a countdown, benefits and a claim form',
    steps: [
      {
        name: 'Offer', slug: 'home',
        blocks: [
          { type: 'hero', headline: '20% off this month only', subheadline: 'Our most popular service at our best price of the year.', button_label: 'Claim my offer', button_action: 'form', align: 'center', bg: 'accent' },
          { type: 'countdown', title: 'Offer ends in', until: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 16), expired_text: 'This offer has ended.', align: 'center' },
          { type: 'features', title: 'Included', items: [{ title: 'Full service', text: 'Everything you’d normally get.' }, { title: 'Same great team', text: 'No shortcuts.' }, { title: 'Book any day', text: 'Flexible times.' }] },
          { type: 'form', title: 'Claim your offer', after: 'next', form_slug: '' },
        ],
      },
      thankYou,
    ],
  },
  { id: 'blank', name: 'Blank', description: 'One empty page', steps: [{ name: 'Landing', slug: 'home', blocks: [{ type: 'hero', headline: 'Your headline', align: 'center', bg: 'muted' }] }] },
];

const COLUMNS = 'id, name, slug, status, settings, created_at, updated_at';
const STEP_COLUMNS = 'id, funnel_id, name, slug, position, blocks, seo, views, conversions';

export function useFunnels() {
  const { location } = useLocationContext();
  const [funnels, setFunnels] = useState<(Funnel & { views: number; conversions: number; steps: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!location) return;
    const [f, s] = await Promise.all([
      supabase.from('funnels').select(COLUMNS).eq('location_id', location.id).order('created_at', { ascending: false }),
      supabase.from('funnel_steps').select('funnel_id, position, views, conversions').eq('location_id', location.id),
    ]);
    const steps = (s.data ?? []) as { funnel_id: string; position: number; views: number; conversions: number }[];
    setFunnels(((f.data as Funnel[]) ?? []).map((x) => {
      const mine = steps.filter((st) => st.funnel_id === x.id).sort((a, b) => a.position - b.position);
      // Visitors = first-step views; conversions = people who moved on from the first step
      return { ...x, steps: mine.length, views: mine[0]?.views ?? 0, conversions: mine[0]?.conversions ?? 0 };
    }));
    // Usually means migration 047 hasn't been run yet
    setError(f.error?.message ?? null);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (templateId: string, name: string) => {
    if (!location) throw new Error('No business selected');
    const t = FUNNEL_TEMPLATES.find((x) => x.id === templateId) ?? FUNNEL_TEMPLATES[0];
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase.from('funnels')
      .insert({ location_id: location.id, name: name.trim() || t.name, slug, settings: { font: 'sans', chat: 'none' } }).select(COLUMNS).single();
    if (error) throw new Error(error.message);
    const f = data as Funnel;
    const { error: stepError } = await supabase.from('funnel_steps').insert(t.steps.map((s, i) => ({
      funnel_id: f.id, location_id: location.id, name: s.name, slug: s.slug, position: i, blocks: withIds(s.blocks),
    })));
    if (stepError) throw new Error(stepError.message);
    return f;
  }, [location]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('funnels').delete().eq('id', id);
    if (!error) setFunnels((fs) => fs.filter((f) => f.id !== id));
    return error?.message ?? null;
  }, []);

  return { funnels, loading, error, create, remove, reload: load };
}

export async function fetchFunnel(id: string) {
  const [f, s] = await Promise.all([
    supabase.from('funnels').select(COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('funnel_steps').select(STEP_COLUMNS).eq('funnel_id', id).order('position'),
  ]);
  if (f.error) throw new Error(f.error.message);
  if (!f.data) return null;
  return { funnel: f.data as Funnel, steps: ((s.data as FunnelStep[]) ?? []).sort((a, b) => a.position - b.position) };
}

export async function saveFunnel(f: Funnel) {
  const { data, error } = await supabase.from('funnels').update({ name: f.name, slug: f.slug, status: f.status, settings: f.settings }).eq('id', f.id).select(COLUMNS).single();
  if (error) throw new Error(error.code === '23505' ? 'That link is already taken. Choose another.' : error.message);
  return data as Funnel;
}

export async function saveStep(s: FunnelStep) {
  const { data, error } = await supabase.from('funnel_steps')
    .update({ name: s.name, slug: s.slug, position: s.position, blocks: s.blocks, seo: s.seo }).eq('id', s.id).select(STEP_COLUMNS).single();
  if (error) throw new Error(error.code === '23505' ? `Two steps can’t share the address “${s.slug}”.` : error.message);
  return data as FunnelStep;
}

export async function addStep(funnelId: string, locationId: string, name: string, position: number, existing: string[]) {
  let slug = slugify(name).slice(0, 30) || 'step';
  while (existing.includes(slug)) slug = `${slug.slice(0, 34)}-${Math.random().toString(36).slice(2, 5)}`;
  const { data, error } = await supabase.from('funnel_steps')
    .insert({ funnel_id: funnelId, location_id: locationId, name: name.trim() || 'New step', slug, position, blocks: withIds([{ type: 'hero', headline: name.trim() || 'New step', align: 'center', bg: 'muted' }]) })
    .select(STEP_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as FunnelStep;
}

export const deleteStep = (id: string) => supabase.from('funnel_steps').delete().eq('id', id);

export const funnelsApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/funnels`;
export const publicFunnelUrl = (slug: string, step?: string) => `${window.location.origin}/s/${slug}${step ? `/${step}` : ''}`;

// ---------- safe values for the public page ----------
export const httpsUrl = (u?: string) => (u && /^https:\/\/[^\s<>"]+$/i.test(u.trim()) ? u.trim() : null);
export const linkUrl = (u?: string) => (u && /^(https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:[+\d\s()-]+)$/i.test(u.trim()) ? u.trim() : null);
export const validPixel = (id?: string) => (id && /^\d{5,20}$/.test(id.trim()) ? id.trim() : null);
export const validGa = (id?: string) => (id && /^G-[A-Z0-9]{4,15}$/i.test(id.trim()) ? id.trim().toUpperCase() : null);
export const accentOf = (s: FunnelSettings) => (/^#[0-9a-f]{6}$/i.test(s.accent ?? '') ? (s.accent as string) : '#0284c7');

/** YouTube / Vimeo links → their embed address (other sites aren't embedded). */
export function videoEmbed(url?: string) {
  const u = (url ?? '').trim();
  const yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(u);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = /vimeo\.com\/(?:video\/)?(\d{6,12})/.exec(u);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
