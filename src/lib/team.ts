import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import type { MemberRole, TeamMember } from '@/types';

export const ROLE_INFO: Record<MemberRole, { label: string; color: string; description: string }> = {
  owner: {
    label: 'Owner',
    color: 'bg-violet-50 text-violet-600',
    description: 'Full control: team and roles, integrations and business details. One per business.',
  },
  admin: {
    label: 'Admin',
    color: 'bg-sky-50 text-sky-600',
    description: 'Manages integrations and business details, invites and removes members.',
  },
  member: {
    label: 'Member',
    color: 'bg-slate-100 text-slate-600',
    description: 'Works with reviews, leads and posts. Can’t change settings or the team.',
  },
};

/** What the signed-in user (with role `myRole`) may do to `target`. Mirrors the database rules. */
export function permissionsFor(myRole: MemberRole | null, myUserId: string | undefined, target: TeamMember) {
  const isSelf = target.user_id === myUserId;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  return {
    changeRole: isOwner && !isSelf && target.role !== 'owner',
    remove: !isSelf && target.role !== 'owner' && (isOwner || (isAdmin && target.role === 'member')),
    // Only to someone who has accepted their invite, so the business always has an active owner
    makeOwner: isOwner && !isSelf && Boolean(target.last_sign_in_at),
    leave: isSelf && target.role !== 'owner',
  };
}

export async function fetchTeam(organizationId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('get_org_members', { p_organization_id: organizationId });
  if (error) throw new Error(error.message);
  return (data as TeamMember[]) ?? [];
}

export async function inviteMember(email: string, role: Exclude<MemberRole, 'owner'>) {
  return callFunction<{ success: boolean; emailSent: boolean }>('team-invite', {
    email,
    role,
    appUrl: window.location.origin,
  });
}

export async function changeRole(organizationId: string, userId: string, role: Exclude<MemberRole, 'owner'>) {
  const { data, error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('You don’t have permission to change this role.');
}

export async function removeMember(organizationId: string, userId: string) {
  const { data, error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('You don’t have permission to remove this person.');
}

export async function transferOwnership(organizationId: string, newOwnerId: string) {
  const { error } = await supabase.rpc('transfer_ownership', {
    p_organization_id: organizationId,
    p_new_owner: newOwnerId,
  });
  if (error) throw new Error(error.message);
}
