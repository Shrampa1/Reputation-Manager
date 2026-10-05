import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Location, Review, Lead, SocialPost, SmartTask } from '@/types';

export function useLocation() {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLocation(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      // Get the user's org, then the first location
      const { data: memberData } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled || !memberData) {
        setLoading(false);
        return;
      }

      const { data: locData } = await supabase
        .from('locations')
        .select('*')
        .eq('organization_id', memberData.organization_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setLocation(locData as Location | null);
        setLoading(false);
      }
    })();
  }, [user]);

  return { location, loading };
}

export function useReviews() {
  const { location } = useLocation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    if (!location) {
      setReviews([]);
      setLoading(false);
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
  }, [location]);

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

  return { reviews, loading, refetch: fetchReviews };
}

export function useLeads() {
  const { location } = useLocation();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    if (!location) {
      setLeads([]);
      setLoading(false);
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
  }, [location]);

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

  return { leads, loading, refetch: fetchLeads, updateLeadStage };
}

export function useSocialPosts() {
  const { location } = useLocation();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!location) {
      setPosts([]);
      setLoading(false);
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
  }, [location]);

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

  return { posts, loading, refetch: fetchPosts };
}

export function useSmartTasks() {
  const { location } = useLocation();
  const [tasks, setTasks] = useState<SmartTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!location) {
      setTasks([]);
      setLoading(false);
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
  }, [location]);

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

  return { tasks, loading, refetch: fetchTasks, completeTask };
}

export function useLocationUpdate() {
  const { location } = useLocation();
  const updateLocation = useCallback(async (updates: Partial<Pick<Location, 'name' | 'address' | 'phone' | 'website'>>) => {
    if (!location) return { error: 'No location loaded' };
    const { error } = await supabase.from('locations').update(updates).eq('id', location.id);
    if (error) return { error: error.message };
    return { error: null };
  }, [location]);

  return { location, updateLocation };
}
