import { Facebook, Instagram, MessageSquare, MapPin, Search, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import type { IntegrationProvider, PostPlatform } from '@/types';

export interface ProviderInfo {
  provider: IntegrationProvider;
  name: string;
  description: string;
  usedFor: string[];
  icon: LucideIcon;
  iconClass: string;
  connectMethod: 'oauth' | 'twilio';
  connectLabel: string;
  setupNote?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    provider: 'google_business',
    name: 'Google Business Profile',
    description: 'Publish updates to your Google listing and manage reviews.',
    usedFor: ['Social posts', 'Reviews'],
    icon: MapPin,
    iconClass: 'bg-red-50 text-red-600',
    connectMethod: 'oauth',
    connectLabel: 'Connect with Google',
    setupNote: 'Requires Google Business Profile API access for your Google Cloud project.',
  },
  {
    provider: 'facebook',
    name: 'Facebook Page',
    description: 'Publish posts and photos to your Facebook Page.',
    usedFor: ['Social posts'],
    icon: Facebook,
    iconClass: 'bg-blue-50 text-blue-600',
    connectMethod: 'oauth',
    connectLabel: 'Connect with Facebook',
  },
  {
    provider: 'instagram',
    name: 'Instagram Business',
    description: 'Publish image posts to the Instagram account linked to your Facebook Page.',
    usedFor: ['Social posts'],
    icon: Instagram,
    iconClass: 'bg-pink-50 text-pink-600',
    connectMethod: 'oauth',
    connectLabel: 'Connect with Facebook',
    setupNote: 'Needs an Instagram Business or Creator account linked to your Facebook Page.',
  },
  {
    provider: 'search_console',
    name: 'Google Search Console',
    description: 'See which pages Google has indexed, the searches you appear for, clicks and rankings.',
    usedFor: ['SEO & Website'],
    icon: Search,
    iconClass: 'bg-sky-50 text-sky-600',
    connectMethod: 'oauth',
    connectLabel: 'Connect with Google',
    setupNote: 'Your site must be verified in Search Console under the Google account you connect.',
  },
  {
    provider: 'twilio',
    name: 'Twilio SMS',
    description: 'Send review requests and reply to leads by text message.',
    usedFor: ['Review requests', 'Lead inbox'],
    icon: MessageSquare,
    iconClass: 'bg-rose-50 text-rose-600',
    connectMethod: 'twilio',
    connectLabel: 'Connect Twilio',
  },
];

export const PLATFORM_PROVIDER: Record<PostPlatform, IntegrationProvider> = {
  facebook: 'facebook',
  instagram: 'instagram',
  google: 'google_business',
};

export function providerName(provider: IntegrationProvider): string {
  return PROVIDERS.find((p) => p.provider === provider)?.name ?? provider;
}

/** Starts the OAuth flow by sending the browser to the provider's consent screen. */
export async function startOAuth(provider: IntegrationProvider) {
  const { url } = await callFunction<{ url: string }>('integrations-oauth-start', {
    provider,
    appUrl: window.location.origin,
  });
  window.location.assign(url);
}

export async function connectTwilio(input: { accountSid: string; authToken: string; phoneNumber: string }) {
  await callFunction('integrations-twilio-connect', input);
}

/** Removes the integration; its stored credentials are deleted with it (FK cascade). */
export async function disconnectIntegration(integrationId: string) {
  const { error } = await supabase.from('integrations').delete().eq('id', integrationId);
  if (error) throw new Error(error.message);
}
