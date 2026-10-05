import type { User } from '@supabase/supabase-js';

/** The user's full name if they've set one, otherwise their email address. */
export function displayName(user: User | null): string {
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  return fullName || user?.email || 'User';
}

/** Two-letter initials from the full name, falling back to the email's local part. */
export function getInitials(user: User | null): string {
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const source = fullName || user?.email?.split('@')[0] || 'User';
  const parts = fullName ? source.split(/\s+/) : source.split(/[._-]/);
  return parts.filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
}
