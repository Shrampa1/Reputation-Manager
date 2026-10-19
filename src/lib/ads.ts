import { useCallback, useEffect, useState } from 'react';
import { callFunction } from '@/lib/functions';

export type AdsRange = '7d' | '30d' | '90d';

export interface AdMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number | null;
  results: number | null;
  result_label: string | null;
}

export interface AdCampaign extends AdMetrics {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | string;
  effective_status: string;
  objective: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_editable: boolean;
  start_time: string | null;
  stop_time: string | null;
  created_time: string;
  boosted_from_app: boolean;
  boosted_post: string | null;
}

export interface AdAccountOption {
  id: string;
  name: string;
  currency: string;
  timezone: string | null;
  status: number;
  business: string | null;
}

export interface AdsOverview {
  platform: 'meta';
  plan_locked: boolean;
  can_manage: boolean;
  connected: boolean;
  status: 'connected' | 'error' | 'disconnected' | null;
  last_error: string | null;
  needs_reconnect?: boolean;
  account?: {
    id: string;
    name: string;
    status: number;
    disable_reason: number | null;
    currency: string;
    timezone: string | null;
    ads_manager_url: string;
  };
  accounts?: AdAccountOption[];
  pages?: { id: string; name: string }[];
  page_id?: string | null;
  token_expires_at?: string | null;
  range?: AdsRange;
  totals?: AdMetrics;
  daily?: { date: string; spend: number; clicks: number; impressions: number }[];
  campaigns?: AdCampaign[];
}

export interface BoostablePost {
  id: string;
  message: string;
  created_time: string;
  picture: string | null;
  url: string | null;
  eligible: boolean;
}

export interface BoostInput {
  post_id: string;
  goal: 'reach' | 'engagement';
  daily_budget: number;
  days: number;
  audience:
    | { mode: 'countries'; countries: string[]; age_min: number; age_max: number }
    | { mode: 'nearby'; radius_km: number; age_min: number; age_max: number };
}

/** Meta ad account status codes → what to tell the person (1 = active). */
export const ACCOUNT_STATUS: Record<number, { label: string; hint: string }> = {
  2: { label: 'Disabled', hint: 'Meta disabled this ad account. Open Ads Manager to see why and request a review.' },
  3: { label: 'Payment due', hint: 'There is an unpaid balance. Settle it in Ads Manager → Billing to keep ads running.' },
  7: { label: 'Under review', hint: 'Meta is reviewing this account. Ads may not deliver until the review is done.' },
  8: { label: 'Payment pending', hint: 'A payment is being processed. Ads resume once it clears.' },
  9: { label: 'Grace period', hint: 'Payment failed. Update your payment method in Ads Manager soon.' },
  100: { label: 'Closing', hint: 'This account is being closed.' },
  101: { label: 'Closed', hint: 'This ad account is closed. Pick another account.' },
};

/** Plain-language campaign state from Meta's effective_status. */
export function campaignState(c: Pick<AdCampaign, 'effective_status' | 'status'>): { label: string; tone: 'good' | 'paused' | 'warn' | 'bad' } {
  switch (c.effective_status) {
    case 'ACTIVE':
      return { label: 'Running', tone: 'good' };
    case 'PAUSED':
    case 'CAMPAIGN_PAUSED':
    case 'ADSET_PAUSED':
      return { label: 'Paused', tone: 'paused' };
    case 'IN_PROCESS':
    case 'PENDING_REVIEW':
    case 'PREAPPROVED':
      return { label: 'In review', tone: 'warn' };
    case 'WITH_ISSUES':
      return { label: 'Has issues', tone: 'bad' };
    case 'DISAPPROVED':
      return { label: 'Rejected', tone: 'bad' };
    case 'PENDING_BILLING_INFO':
      return { label: 'Needs payment method', tone: 'bad' };
    default:
      return c.status === 'PAUSED' ? { label: 'Paused', tone: 'paused' } : { label: 'Completed', tone: 'paused' };
  }
}

export const OBJECTIVE_LABEL: Record<string, string> = {
  OUTCOME_AWARENESS: 'Awareness',
  OUTCOME_ENGAGEMENT: 'Engagement',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Sales',
  OUTCOME_APP_PROMOTION: 'App promotion',
};

export function money(value: number | null | undefined, currency: string, digits?: number) {
  if (value === null || value === undefined) return '–';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: digits ?? (value >= 1000 ? 0 : 2),
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function compact(value: number | null | undefined) {
  if (value === null || value === undefined) return '–';
  return new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}

export function useAdsOverview(range: AdsRange) {
  const [data, setData] = useState<AdsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await callFunction<AdsOverview>('ads', { action: 'overview', range }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your ads');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export const setCampaignStatus = (campaignId: string, status: 'ACTIVE' | 'PAUSED') =>
  callFunction('ads', { action: 'set_status', campaign_id: campaignId, status });

export const setCampaignBudget = (campaignId: string, dailyBudget: number) =>
  callFunction('ads', { action: 'set_budget', campaign_id: campaignId, daily_budget: dailyBudget });

export const selectAdAccount = (accountId: string) => callFunction('ads', { action: 'select_account', account_id: accountId });

export const selectBoostPage = (pageId: string) => callFunction('ads', { action: 'select_page', page_id: pageId });

export const listBoostablePosts = () =>
  callFunction<{ posts: BoostablePost[] }>('ads', { action: 'posts' }).then((r) => r.posts);

export const boostPost = (input: BoostInput) =>
  callFunction<{ campaign_id: string; starts_at: string; ends_at: string; max_spend: number }>('ads', {
    action: 'boost',
    ...input,
  });
