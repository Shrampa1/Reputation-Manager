import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Location, MemberRole, Organization } from '@/types';

type LocationFields = Partial<Pick<Location, 'name' | 'address' | 'phone' | 'website'>>;

interface LocationContextValue {
  location: Location | null;
  organization: Pick<Organization, 'id' | 'name'> | null;
  role: MemberRole | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  /** Reloads org, role and location from the database */
  refresh: () => Promise<void>;
  updateLocation: (updates: LocationFields) => Promise<{ error: string | null }>;
  updateOrganizationName: (name: string) => Promise<{ error: string | null }>;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

/**
 * Loads the signed-in user's organization, role and (first) location once and shares
 * them with every page and data hook, instead of each hook querying them separately.
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [organization, setOrganization] = useState<Pick<Organization, 'id' | 'name'> | null>(null);
  const [role, setRole] = useState<MemberRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    if (!user) {
      setLocation(null);
      setOrganization(null);
      setRole(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchMembership = () =>
      supabase
        .from('organization_members')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    let { data: membership, error: memberError } = await fetchMembership();
    if (isCancelled()) return;

    // First sign-in after email confirmation: the org wasn't created at sign-up
    // because there was no session yet, so create it now from the saved name.
    const pendingBusinessName = user.user_metadata?.business_name as string | undefined;
    if (!memberError && !membership && pendingBusinessName) {
      const { error: orgError } = await supabase.rpc('create_organization_for_current_user', {
        business_name: pendingBusinessName,
      });
      if (isCancelled()) return;
      if (orgError) {
        memberError = orgError;
      } else {
        ({ data: membership, error: memberError } = await fetchMembership());
        if (isCancelled()) return;
      }
    }

    if (memberError) {
      setError(`Couldn't load your business: ${memberError.message}`);
      setLoading(false);
      return;
    }
    if (!membership) {
      setLocation(null);
      setOrganization(null);
      setRole(null);
      setLoading(false);
      return;
    }

    const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
    setOrganization(org ? { id: org.id as string, name: org.name as string } : { id: membership.organization_id, name: '' });
    setRole(membership.role as MemberRole);

    const { data: locData, error: locError } = await supabase
      .from('locations')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (isCancelled()) return;

    if (locError) setError(`Couldn't load your business location: ${locError.message}`);
    setLocation((locData as Location | null) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  const updateLocation = useCallback(async (updates: LocationFields) => {
    if (!location) return { error: 'No location loaded' };
    const { data, error: updateError } = await supabase
      .from('locations')
      .update(updates)
      .eq('id', location.id)
      .select('*')
      .single();
    if (updateError) return { error: updateError.message };
    setLocation(data as Location);
    return { error: null };
  }, [location]);

  const updateOrganizationName = useCallback(async (name: string) => {
    if (!organization) return { error: 'No organization loaded' };
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Business name is required' };
    const { data, error: updateError } = await supabase
      .from('organizations')
      .update({ name: trimmed })
      .eq('id', organization.id)
      .select('id, name')
      .maybeSingle();
    if (updateError) return { error: updateError.message };
    // RLS returns no row when the user isn't an owner/admin
    if (!data) return { error: 'Only owners and admins can rename the business' };
    setOrganization({ id: data.id as string, name: data.name as string });
    return { error: null };
  }, [organization]);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      organization,
      role,
      isAdmin: role === 'owner' || role === 'admin',
      loading,
      error,
      refresh,
      updateLocation,
      updateOrganizationName,
    }),
    [location, organization, role, loading, error, refresh, updateLocation, updateOrganizationName]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used within LocationProvider');
  return ctx;
}
