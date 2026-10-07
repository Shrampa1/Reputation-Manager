import type { ViewerRole } from '@/types';

/** Feature permissions (see the permission_catalog table, migration 015). */
export type Permission =
  | 'reviews.reply'
  | 'reviews.request'
  | 'reviews.add'
  | 'social.publish'
  | 'leads.manage'
  | 'seo.audit'
  | 'seo.competitors'
  | 'reports.download'
  | 'business.edit'
  | 'integrations.manage'
  | 'team.manage'
  | 'activity.view'
  | 'billing.manage';

export interface PermissionInfo {
  permission: Permission;
  label: string;
  description: string;
  area: string;
  sort: number;
  owner_default: boolean;
  admin_default: boolean;
  member_default: boolean;
}

/**
 * Role defaults, used only if the database's permissions can't be loaded (e.g. before
 * migration 015 runs). The permission_catalog table is the source of truth.
 */
export const FALLBACK_DEFAULTS: Record<Permission, { owner: boolean; admin: boolean; member: boolean }> = {
  'reviews.reply': { owner: true, admin: true, member: true },
  'reviews.request': { owner: true, admin: true, member: true },
  'reviews.add': { owner: true, admin: true, member: true },
  'social.publish': { owner: true, admin: true, member: true },
  'leads.manage': { owner: true, admin: true, member: true },
  'seo.audit': { owner: true, admin: true, member: true },
  'seo.competitors': { owner: true, admin: true, member: false },
  'reports.download': { owner: true, admin: true, member: true },
  'business.edit': { owner: true, admin: true, member: false },
  'integrations.manage': { owner: true, admin: true, member: false },
  'team.manage': { owner: true, admin: true, member: false },
  'activity.view': { owner: true, admin: true, member: false },
  'billing.manage': { owner: true, admin: false, member: false },
};

export function defaultPermissions(role: ViewerRole | null): Record<Permission, boolean> {
  const out = {} as Record<Permission, boolean>;
  for (const [key, d] of Object.entries(FALLBACK_DEFAULTS) as [Permission, { owner: boolean; admin: boolean; member: boolean }][]) {
    out[key] = role === 'superadmin' ? true : role === 'owner' ? d.owner : role === 'admin' ? d.admin : role === 'member' ? d.member : false;
  }
  return out;
}

export const NO_ACCESS_MESSAGE = 'You don’t have access to this. Ask the business owner.';
