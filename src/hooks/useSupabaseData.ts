import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import type {
  Review,
  Lead,
  SocialPost,
  SmartTask,
  Integration,
  IntegrationProvider,
} from '@/types';

/** The current business location, loaded once by LocationProvider. */
export function useLocation() {
  const { location, loading, error, refresh } = useLocationContext();
  return { location, loading, error, refresh };
}

export function useReviews() {
  const { location, loading: locationLoading } = useLocation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    if (!location) {
      setReviews([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('location_id', location.id)
      .order('review_date', { ascending: false });
    if (error) {
      console.error('Failed to load reviews:', error.message);
    }
    setReviews((data as Review[]) ?? []);
    setLoading(false);
  }, [location, locationLoading]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    if (!location) return;
    const channel = supabase
      .channel(`reviews:${location.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews', filter: `location_id=eq.${location.id}` }, () => fetchReviews())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [location, fetchReviews]);

  return { reviews, loading: loading || locationLoading, refetch: fetchReviews };
}

export function useLeads() {
  const { location, loading: locationLoading } = useLocation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    if (!location) {
      setLeads([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('location_id', location.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load leads:', error.message);
    }
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, [location, locationLoading]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    if (!location) return;
    const channel = supabase
      .channel(`leads:${location.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `location_id=eq.${location.id}` }, () => fetchLeads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [location, fetchLeads]);

  const updateLeadStage = useCallback(async (leadId: string, stage: Lead['stage']) => {
    const { error } = await supabase.from('leads').update({ stage }).eq('id', leadId);
    if (error) console.error('Failed to update lead stage:', error.message);
  }, []);

  return { leads, loading: loading || locationLoading, refetch: fetchLeads, updateLeadStage };
}

export function useSocialPosts() {
  const { location, loading: locationLoading } = useLocation();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!location) {
      setPosts([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('location_id', location.id)
      .order('scheduled_for', { ascending: false });
    if (error) {
      console.error('Failed to load social posts:', error.message);
    }
    setPosts((data as SocialPost[]) ?? []);
    setLoading(false);
  }, [location, locationLoading]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    if (!location) return;
    const channel = supabase
      .channel(`social_posts:${location.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_posts', filter: `location_id=eq.${location.id}` }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [location, fetchPosts]);

  return { posts, loading: loading || locationLoading, refetch: fetchPosts };
}

export function useSmartTasks() {
  const { location, loading: locationLoading } = useLocation();
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!location) {
      setTasks([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('smart_tasks')
      .select('*')
      .eq('location_id', location.id)
      .eq('is_completed', false)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load smart tasks:', error.message);
    }
    setTasks((data as SmartTask[]) ?? []);
    setLoading(false);
  }, [location, locationLoading]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!location) return;
    const channel = supabase
      .channel(`smart_tasks:${location.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'smart_tasks', filter: `location_id=eq.${location.id}` }, () => fetchTasks())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [location, fetchTasks]);

  const completeTask = useCallback(async (taskId: string) => {
    const { error } = await supabase.from('smart_tasks').update({ is_completed: true }).eq('id', taskId);
    if (error) console.error('Failed to complete task:', error.message);
  }, []);

  return { tasks, loading: loading || locationLoading, refetch: fetchTasks, completeTask };
}

export function useLocationUpdate() {
  const { location, updateLocation } = useLocationContext();
  return { location, updateLocation };
}

export function useMemberRole() {
  const { role, isAdmin, loading } = useLocationContext();
  return { role, isAdmin, loading };
}

/**
 * Owners/admins get full integration rows. Members only get provider + status
 * (via get_integration_statuses) — enough for the New Post form.
 */
export function useIntegrations() {
  const { location, loading: locationLoading, isAdmin } = useLocationContext();
  const organizationId = location?.organization_id;
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    if (!organizationId) {
      setIntegrations([]);
      if (!locationLoading) setLoading(false);
      return;
    }
    if (isAdmin) {
      const { data, error } = await supabase
        .from('integrations')
        .select('id, organization_id, provider, status, account_id, account_name, metadata, last_error, connected_at, updated_at')
        .eq('organization_id', organizationId);
      if (error) console.error('Failed to load integrations:', error.message);
      setIntegrations((data as Integration[]) ?? []);
    } else {
      const { data, error } = await supabase.rpc('get_integration_statuses', { p_organization_id: organizationId });
      if (error) console.error('Failed to load integration statuses:', error.message);
      setIntegrations(
        ((data as Pick<Integration, 'provider' | 'status'>[] | null) ?? []).map((row) => ({
          ...row,
          id: row.provider,
          organization_id: organizationId,
          account_id: null,
          account_name: null,
          metadata: {},
          last_error: null,
          connected_at: '',
          updated_at: '',
        }))
      );
    }
    setLoading(false);
  }, [organizationId, isAdmin, locationLoading]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    // Realtime respects RLS, so only owners/admins receive integration changes
    if (!organizationId || !isAdmin) return;
    const channel = supabase
      .channel(`integrations:${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'integrations', filter: `organization_id=eq.${organizationId}` }, () => fetchIntegrations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [organizationId, isAdmin, fetchIntegrations]);

  const byProvider = useCallback(
    (provider: IntegrationProvider) => integrations.find((i) => i.provider === provider) ?? null,
    [integrations]
  );

  return { integrations, loading: loading || locationLoading, refetch: fetchIntegrations, byProvider };
}
