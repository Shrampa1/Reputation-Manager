import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface Agency {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  support_email: string | null;
}

export interface AgencyClientRow {
  organization_id: string;
  name: string;
  linked: boolean;
  role: 'owner' | 'admin';
  plan: string;
  google_rating: number | null;
  google_review_count: number | null;
  reviews_30d: number;
  avg_rating_30d: number | null;
  requests_30d: number;
  responses_30d: number;
  clients: number;
  last_review_at: string | null;
}

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const portalUrl = (slug: string) => `${window.location.origin}/p/${slug}`;

/** The signed-in user's agency (null if they haven't set one up) and their businesses' numbers. */
export function useAgency() {
  const { user } = useAuth();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [rows, setRows] = useState<AgencyClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [a, o] = await Promise.all([
      supabase.from('agencies').select('id, name, slug, logo_url, brand_color, support_email').eq('owner_id', user.id).maybeSingle(),
      supabase.rpc('get_agency_overview'),
    ]);
    setAgency((a.data as Agency | null) ?? null);
    setRows(
      ((o.data ?? []) as AgencyClientRow[]).map((r) => ({
        ...r,
        google_rating: r.google_rating === null ? null : Number(r.google_rating),
        avg_rating_30d: r.avg_rating_30d === null ? null : Number(r.avg_rating_30d),
      })),
    );
    setError(a.error?.message ?? o.error?.message ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { agency, rows, loading, error, reload: load };
}

export async function saveAgency(input: Omit<Agency, 'id'>): Promise<Agency> {
  const { data, error } = await supabase.rpc('save_agency', {
    p_name: input.name,
    p_slug: input.slug,
    p_logo_url: input.logo_url ?? '',
    p_brand_color: input.brand_color,
    p_support_email: input.support_email ?? '',
  });
  if (error) throw new Error(error.message.includes('agencies_slug_check')
    ? 'The portal address can use lowercase letters, numbers and dashes (3–40 characters).'
    : error.message);
  return data as Agency;
}

export async function setBusinessInPortal(organizationId: string, linked: boolean) {
  const { error } = await supabase.rpc('set_business_agency', { p_org: organizationId, p_linked: linked });
  if (error) throw new Error(error.message);
}

const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Uploads the agency logo as-is (PNG transparency kept) to the public post-media bucket. */
export async function uploadAgencyLogo(organizationId: string, file: File): Promise<string> {
  const ext = LOGO_TYPES[file.type];
  if (!ext) throw new Error('Use a PNG, JPEG or WebP image.');
  if (file.size > 2 * 1024 * 1024) throw new Error('The logo is too large (max 2 MB).');
  const path = `${organizationId}/agency-logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('post-media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Logo upload failed: ${error.message}`);
  return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
}
