import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';

export type PlanId = 'free' | 'pro' | 'agency';
export type LimitKey = 'businesses' | 'team_members' | 'website_audits_per_day' | 'review_requests_per_month' | 'competitors';

export interface Plan {
  id: PlanId;
  name: string;
  price_label: string;
  sort: number;
  limits: Record<LimitKey, number>;
  features: string[];
}

export interface PlanUsage {
  plan: PlanId;
  limits: Record<LimitKey, number>;
  usage: Record<LimitKey, number>;
  business_allowance: number;
  subscription: {
    plan_id: PlanId;
    status: string;
    provider: string;
    renews_at: string | null;
    ends_at: string | null;
    trial_ends_at: string | null;
  } | null;
}

export const LIMIT_LABELS: Record<LimitKey, string> = {
  website_audits_per_day: 'Website checks (last 24 h)',
  review_requests_per_month: 'Review requests this month',
  competitors: 'Competitors tracked',
  team_members: 'Team members',
  businesses: 'Businesses you own',
};

/** Plans and the active business's plan, limits and usage. */
export function usePlan() {
  const { organization } = useLocationContext();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    const [p, u] = await Promise.all([
      supabase.from('plans').select('id, name, price_label, sort, limits, features').order('sort'),
      supabase.rpc('get_plan_usage', { p_org: organization.id }),
    ]);
    setPlans((p.data as Plan[]) ?? []);
    setUsage((u.data as PlanUsage | null) ?? null);
    setError(p.error?.message ?? u.error?.message ?? null);
    setLoading(false);
  }, [organization]);

  useEffect(() => {
    load();
  }, [load]);

  return { plans, usage, loading, error, reload: load };
}

export const startCheckout = (plan: PlanId) => callFunction<{ url?: string; changed?: boolean }>('billing', { action: 'checkout', plan });
export const openBillingPortal = () => callFunction<{ url: string }>('billing', { action: 'portal' });
