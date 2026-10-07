import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import type { User } from '@supabase/supabase-js';

/**
 * Downloads everything the user can see in the businesses they belong to, as JSON
 * (privacy "export my data"). Runs in the browser under the user's own access rules.
 */
export async function exportMyData(user: User) {
  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, created_at, organizations(id, name, created_at)')
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);

  const take = async (table: string, columns: string, column: string, value: string) => {
    const { data } = await supabase.from(table).select(columns).eq(column, value).limit(5000);
    return data ?? [];
  };

  const businesses = [];
  for (const m of memberships ?? []) {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    const locations = (await take('locations', '*', 'organization_id', m.organization_id)) as unknown as { id: string }[];
    const perLocation = [];
    for (const loc of locations) {
      perLocation.push({
        location: loc,
        reviews: await take('reviews', '*', 'location_id', loc.id),
        leads: await take('leads', '*', 'location_id', loc.id),
        social_posts: await take('social_posts', '*', 'location_id', loc.id),
        review_requests: await take(
          'review_requests',
          'id, customer_name, email, channel, status, rating, feedback, responded_at, clicked_review_at, created_at',
          'location_id',
          loc.id
        ),
        competitors: await take('competitors', 'id, name, website, google_rating, google_review_count, created_at', 'location_id', loc.id),
        website_audits: await take('website_audits', 'id, url, final_url, status, overall_score, scores, created_at', 'location_id', loc.id),
      });
    }
    businesses.push({ business: org, your_role: m.role, joined_at: m.created_at, locations: perLocation });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    businesses,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reputation-engine-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface DeletionPreview {
  blockers: string[];
  deleteBusinesses: { id: string; name: string }[];
  leaveBusinesses: { id: string; name: string }[];
}

export const previewAccountDeletion = () => callFunction<DeletionPreview>('delete-account', { action: 'preview' });
export const deleteMyAccount = (confirmEmail: string) => callFunction<{ deleted: boolean }>('delete-account', { action: 'delete', confirmEmail });
