import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Client approvals (migration 030). */
export type ApprovalStatus = 'pending' | 'approved' | 'changes_requested';

export interface ApprovalSettings {
  posts: boolean;
  replies: boolean;
}

export interface PostApproval {
  id: string;
  platform: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  scheduled_for: string | null;
  status: string;
  approval_status: ApprovalStatus;
  approval_note: string | null;
  approval_by: string | null;
  updated_at: string;
}

export interface ReplyApproval {
  id: string;
  platform: string;
  author_name: string;
  rating: number;
  content: string;
  ai_reply_draft: string | null;
  reply_approval_status: ApprovalStatus;
  reply_approval_note: string | null;
  reply_proposed_by: string | null;
  reply_proposed_at: string | null;
}

const message = (e: { message: string } | null) => e?.message ?? null;

/** Whether this business wants client approval for posts / replies. */
export function useApprovalSettings() {
  const { organization } = useLocationContext();
  const [settings, setSettings] = useState<ApprovalSettings>({ posts: false, replies: false });
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase.from('approval_settings').select('posts, replies').eq('organization_id', organization.id).maybeSingle();
    setSettings((data as ApprovalSettings | null) ?? { posts: false, replies: false });
    setLoaded(true);
  }, [organization]);
  useEffect(() => {
    load();
  }, [load]);
  return { settings, loaded, reload: load };
}

export async function saveApprovalSettings(organizationId: string, s: ApprovalSettings) {
  const { error } = await supabase.rpc('set_approval_settings', { p_org: organizationId, p_posts: s.posts, p_replies: s.replies });
  return { error: message(error) };
}

/** Everything waiting for the client, or sent back with changes requested. */
export function useApprovalQueue() {
  const { location } = useLocationContext();
  const [posts, setPosts] = useState<PostApproval[]>([]);
  const [replies, setReplies] = useState<ReplyApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const [p, r] = await Promise.all([
      supabase.from('social_posts')
        .select('id, platform, content, media_url, media_type, scheduled_for, status, approval_status, approval_note, approval_by, updated_at')
        .eq('location_id', location.id).in('approval_status', ['pending', 'changes_requested']).order('updated_at', { ascending: false }),
      supabase.from('reviews')
        .select('id, platform, author_name, rating, content, ai_reply_draft, reply_approval_status, reply_approval_note, reply_proposed_by, reply_proposed_at')
        .eq('location_id', location.id).in('reply_approval_status', ['pending', 'changes_requested']).order('reply_proposed_at', { ascending: false }),
    ]);
    setPosts((p.data as PostApproval[]) ?? []);
    setReplies((r.data as ReplyApproval[]) ?? []);
    const err = p.error ?? r.error;
    setError(err ? `Couldn't load approvals: ${err.message}` : null);
    setLoading(false);
  }, [location]);

  useEffect(() => {
    load();
  }, [load]);

  return { posts, replies, loading, error, reload: load };
}

export async function respondToApproval(kind: 'post' | 'reply', id: string, decision: 'approve' | 'request_changes', note?: string, text?: string) {
  const { error } = await supabase.rpc('respond_to_approval', {
    p_kind: kind, p_id: id, p_decision: decision, p_note: note?.trim() || null, p_text: text?.trim() || null,
  });
  return { error: message(error) };
}

export async function requestReplyApproval(reviewId: string, text: string) {
  const { error } = await supabase.rpc('request_reply_approval', { p_review: reviewId, p_text: text });
  return { error: message(error) };
}

export const APPROVAL_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: 'Waiting for client approval', className: 'bg-violet-50 text-violet-700' },
  approved: { label: 'Approved by client', className: 'bg-emerald-50 text-emerald-700' },
  changes_requested: { label: 'Changes requested', className: 'bg-amber-50 text-amber-700' },
};
