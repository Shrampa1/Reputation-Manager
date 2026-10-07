import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { setActiveOrganizationId } from '@/lib/functions';
import { useAuth } from '@/context/AuthContext';
import { defaultPermissions, type Permission } from '@/lib/permissions';
import type { Location, MemberRole, Organization, ViewerRole } from '@/types';

type LocationFields = Partial<Pick<Location, 'name' | 'address' | 'phone' | 'website' | 'review_link' | 'review_shield_enabled'>>;

/** A business the signed-in user belongs to */
export interface BusinessMembership {
  id: string;
  name: string;
  role: ViewerRole;
}

interface LocationContextValue {
  location: Location | null;
  organization: Pick<Organization, 'id' | 'name'> | null;
  role: ViewerRole | null;
  /** Owner, admin or super admin */
  isAdmin: boolean;
  /** Owner or super admin (ownership transfer, managing access) */
  isOwnerLike: boolean;
  isSuperAdmin: boolean;
  /** Effective feature access in the active business (role defaults + Role access overrides) */
  can: (permission: Permission) => boolean;
  /** Every business the user belongs to (for the business switcher) */
  memberships: BusinessMembership[];
  /** The app owner: can see every business in Platform admin */
  isPlatformAdmin: boolean;
  loading: boolean;
  error: string | null;
  /** Reloads businesses, role and location from the database */
  refresh: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  /** Creates another business owned by the user (plan permitting) and switches to it */
  createBusiness: (details: { name: string; phone?: string; address?: string; website?: string }) => Promise<{ error: string | null }>;
  updateLocation: (updates: LocationFields) => Promise<{ error: string | null }>;
  updateOrganizationName: (name: string) => Promise<{ error: string | null }>;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

const storageKey = (userId: string) => `activeOrganizationId:${userId}`;
function readStored(userId: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}
function writeStored(userId: string, orgId: string) {
  try {
    localStorage.setItem(storageKey(userId), orgId);
  } catch {
    /* not persisted; the first business is used next time */
  }
}

/**
 * Loads the businesses the signed-in user belongs to, picks the active one (remembered per
 * browser), and loads its role and (first) location for every page and data hook.
 */
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useState<Location | null>(null);
  const [organization, setOrganization] = useState<Pick<Organization, 'id' | 'name'> | null>(null);
  const [role, setRole] = useState<ViewerRole | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [memberships, setMemberships] = useState<BusinessMembership[]>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isCancelled: () => boolean = () => false, preferredOrgId?: string) => {
    if (!user) {
      setLocation(null);
      setOrganization(null);
      setRole(null);
      setPermissions(null);
      setMemberships([]);
      setActiveOrganizationId(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const fetchMemberships = () =>
      supabase
        .from('organization_members')
        .select('organization_id, role, created_at, organizations(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

    let { data: rows, error: memberError } = await fetchMemberships();
    if (isCancelled()) return;

    // First signed-in load after sign-up: create the business the user typed on the sign-up
    // form. This also runs when they already belong to someone else's business (e.g. they
    // were invited before signing up), so they still get their own business as owner.
    // The saved name is cleared afterwards so this only ever happens once.
    let createdOrgId: string | undefined;
    const pendingBusinessName = (user.user_metadata?.business_name as string | undefined)?.trim();
    if (!memberError && pendingBusinessName) {
      const ownsBusiness = (rows ?? []).some((m) => m.role === 'owner');
      if (!ownsBusiness) {
        const { data: newOrgId, error: orgError } = (rows?.length ?? 0) === 0
          ? await supabase.rpc('create_organization_for_current_user', { business_name: pendingBusinessName })
          : await supabase.rpc('create_additional_business', { business_name: pendingBusinessName });
        if (isCancelled()) return;
        if (orgError) {
          memberError = orgError;
        } else {
          createdOrgId = (newOrgId as string | null) ?? undefined;
          ({ data: rows, error: memberError } = await fetchMemberships());
          if (isCancelled()) return;
        }
      }
      if (!memberError) {
        // Done (or not needed because they already own a business): don't do it again
        await supabase.auth.updateUser({ data: { business_name: null } });
        if (isCancelled()) return;
      }
    }

    if (memberError) {
      setError(`Couldn't load your business: ${memberError.message}`);
      setLoading(false);
      return;
    }

    let list: BusinessMembership[] = (rows ?? []).map((m) => {
      const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      return { id: m.organization_id as string, name: (org?.name as string | undefined) ?? '', role: m.role as MemberRole };
    });
    // Includes every business for super admins (falls back to memberships before migration 015)
    const { data: businesses, error: businessesError } = await supabase.rpc('get_my_businesses');
    if (isCancelled()) return;
    if (!businessesError && Array.isArray(businesses)) {
      list = (businesses as { organization_id: string; name: string; role: string }[]).map((b) => ({
        id: b.organization_id,
        name: b.name,
        role: b.role as ViewerRole,
      }));
    }
    setMemberships(list);

    if (list.length === 0) {
      setLocation(null);
      setOrganization(null);
      setRole(null);
      setActiveOrganizationId(null);
      setLoading(false);
      return;
    }

    // A business just created from the sign-up form opens first
    const wanted = createdOrgId ?? preferredOrgId ?? readStored(user.id);
    const active = list.find((m) => m.id === wanted) ?? list[0];
    setActiveOrganizationId(active.id);
    writeStored(user.id, active.id);
    setOrganization({ id: active.id, name: active.name });
    setRole(active.role);

    const { data: perms, error: permsError } = await supabase.rpc('get_my_permissions', { p_org: active.id });
    if (isCancelled()) return;
    setPermissions(!permsError && perms && typeof perms === 'object' ? (perms as Record<string, boolean>) : defaultPermissions(active.role));

    const { data: locData, error: locError } = await supabase
      .from('locations')
      .select('*')
      .eq('organization_id', active.id)
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

  useEffect(() => {
    if (!user) {
      setIsPlatformAdmin(false);
      return;
    }
    supabase.rpc('is_platform_admin').then(({ data, error: rpcError }) => setIsPlatformAdmin(!rpcError && data === true));
  }, [user]);

  const refresh = useCallback(() => load(() => false, organization?.id), [load, organization?.id]);

  const switchOrganization = useCallback((organizationId: string) => load(() => false, organizationId), [load]);

  const createBusiness = useCallback(
    async (details: { name: string; phone?: string; address?: string; website?: string }) => {
      const { data, error: rpcError } = await supabase.rpc('create_additional_business', {
        business_name: details.name,
        p_phone: details.phone || null,
        p_address: details.address || null,
        p_website: details.website || null,
      });
      if (rpcError) return { error: rpcError.message };
      await load(() => false, data as string);
      return { error: null };
    },
    [load]
  );

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
    setMemberships((prev) => prev.map((m) => (m.id === data.id ? { ...m, name: data.name as string } : m)));
    return { error: null };
  }, [organization]);

  const can = useCallback((permission: Permission) => Boolean(permissions?.[permission]), [permissions]);

  const value = useMemo<LocationContextValue>(
    () => ({
      location,
      organization,
      role,
      isAdmin: role === 'owner' || role === 'admin' || role === 'superadmin',
      isOwnerLike: role === 'owner' || role === 'superadmin',
      isSuperAdmin: role === 'superadmin' || isPlatformAdmin,
      can,
      memberships,
      isPlatformAdmin,
      loading,
      error,
      refresh,
      switchOrganization,
      createBusiness,
      updateLocation,
      updateOrganizationName,
    }),
    [location, organization, role, can, memberships, isPlatformAdmin, loading, error, refresh, switchOrganization, createBusiness, updateLocation, updateOrganizationName]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationContext must be used within LocationProvider');
  return ctx;
}
