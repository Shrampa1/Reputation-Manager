import { useEffect, useState } from 'react';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';

/** Google Business Profile manager (Phase B1, the gbp function). */
export interface GbpStatus {
  connected: boolean;
  location: string | null;
  account_name: string | null;
  error: string | null;
}
export type Totals = { views: number; calls: number; website_clicks: number; directions: number };
export interface Performance {
  days: number;
  end: string;
  totals: Totals;
  previous: Totals;
  daily: (Totals & { date: string })[];
  fetched_at: string;
}
export type DayHours = { day: string; closed: boolean; open: string; close: string };
export interface ProfileInfo {
  title: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  category: string | null;
  address: string | null;
  hours: DayHours[];
  has_hours: boolean;
}
export interface GbpPhoto { name: string; url: string | null; thumbnail: string | null; category: string | null; created_at: string | null }

export const PHOTO_CATEGORIES = [
  { id: 'ADDITIONAL', label: 'Other' }, { id: 'EXTERIOR', label: 'Outside' }, { id: 'INTERIOR', label: 'Inside' },
  { id: 'PRODUCT', label: 'Product' }, { id: 'AT_WORK', label: 'At work' }, { id: 'TEAMS', label: 'Team' },
  { id: 'COVER', label: 'Cover photo' }, { id: 'LOGO', label: 'Logo' },
];

export const call = <T,>(action: string, body: Record<string, unknown> = {}) => callFunction<T>('gbp', { action, ...body });

/** Whether this business has a working Google Business Profile connection. */
export function useGbpStatus() {
  const { organization } = useLocationContext();
  const [status, setStatus] = useState<GbpStatus | null>(null);
  useEffect(() => {
    if (!organization) return;
    let cancelled = false;
    call<GbpStatus>('status')
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus({ connected: false, location: null, account_name: null, error: null }));
    return () => {
      cancelled = true;
    };
  }, [organization]);
  return status;
}

export const syncGoogleReviews = () => call<{ imported: number; updated: number; total: number }>('sync_reviews');
export const postReplyToGoogle = (reviewId: string, text?: string) => call<{ review: { platform_reply_at: string } }>('post_reply', { reviewId, text });
export const loadPerformance = (days: 30 | 90, refresh = false) => call<Performance>('performance', { days, refresh });
export const loadProfile = (refresh = false) => call<{ info: ProfileInfo; fetched_at: string }>('info', { refresh });
export const saveProfile = (patch: Partial<{ phone: string; website: string; description: string; hours: DayHours[] }>) => call<{ info: ProfileInfo }>('update_info', patch);
export const loadPhotos = (refresh = false) => call<{ total: number; photos: GbpPhoto[]; fetched_at: string }>('photos', { refresh });
export const addPhoto = (url: string, category: string) => call<{ photo: GbpPhoto }>('add_photo', { url, category });

/** A review that came from the connected profile can be answered on Google from here. */
export const isProfileReview = (r: { platform: string; external_id?: string | null }) =>
  r.platform === 'google' && Boolean(r.external_id?.startsWith('accounts/'));

/** "+25%" style change vs the previous period. */
export function change(now: number, before: number) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}
