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
