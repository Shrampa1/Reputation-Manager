import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { AUTH_PATHS, applyBranding, readPortalBranding, subscribePortalBranding, type Branding } from '@/lib/branding';

/**
 * The white-label branding to show, if any: signed in, the active business's agency;
 * signed out, the agency portal the person came through (sign-in and password pages only).
 */
export function useBranding(): Branding | null {
  const { user } = useAuth();
  const { branding } = useLocationContext();
  const { pathname } = useLocation();
  const portal = useSyncExternalStore(subscribePortalBranding, readPortalBranding);
  if (user) return branding;
  return AUTH_PATHS.some((p) => pathname.startsWith(p)) ? portal : null;
}

/** Keeps the page colours, title and favicon in step with the branding. Render once. */
export function BrandingEffect() {
  const b = useBranding();
  useEffect(() => {
    applyBranding(b);
  }, [b?.slug, b?.name, b?.brand_color, b?.logo_url]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
