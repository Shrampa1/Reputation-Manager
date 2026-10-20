import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';

/** Listings check (Phase B3, migration 033 + the listings-check function). */
export interface Listing {
  id: string;
  directory: string;
  source: 'auto' | 'manual';
  status: 'listed' | 'not_listed' | 'error';
  url: string | null;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  note: string | null;
  checked_at: string;
}

export interface Directory {
  id: string;
  name: string;
  auto?: boolean;
  /** Where to look the business up (name + city filled in) */
  search?: (name: string, city: string) => string;
  /** Where to claim or fix the listing */
  manage?: string;
}

const q = encodeURIComponent;
export const DIRECTORIES: Directory[] = [
  { id: 'google', name: 'Google Business Profile', auto: true, manage: 'https://business.google.com' },
  { id: 'website', name: 'Your website', auto: true },
  { id: 'facebook', name: 'Facebook Page', auto: true, manage: 'https://www.facebook.com/pages/?category=your_pages' },
  { id: 'apple', name: 'Apple Maps', search: (n, c) => `https://maps.apple.com/?q=${q(`${n} ${c}`)}`, manage: 'https://businessconnect.apple.com' },
  { id: 'bing', name: 'Bing Places', search: (n, c) => `https://www.bing.com/maps?q=${q(`${n} ${c}`)}`, manage: 'https://www.bingplaces.com' },
  { id: 'yelp', name: 'Yelp', search: (n, c) => `https://www.yelp.com/search?find_desc=${q(n)}&find_loc=${q(c)}`, manage: 'https://biz.yelp.com' },
  { id: 'yellowpages', name: 'Yellow Pages', search: (n, c) => `https://www.yellowpages.com/search?search_terms=${q(n)}&geo_location_terms=${q(c)}` },
  { id: 'bbb', name: 'Better Business Bureau', search: (n, c) => `https://www.bbb.org/search?find_text=${q(n)}&find_loc=${q(c)}` },
  { id: 'nextdoor', name: 'Nextdoor', search: (n, c) => `https://www.google.com/search?q=${q(`site:nextdoor.com ${n} ${c}`)}`, manage: 'https://business.nextdoor.com' },
  { id: 'foursquare', name: 'Foursquare', search: (n, c) => `https://www.google.com/search?q=${q(`site:foursquare.com ${n} ${c}`)}` },
  { id: 'tripadvisor', name: 'Tripadvisor', search: (n, c) => `https://www.tripadvisor.com/Search?q=${q(`${n} ${c}`)}` },
  { id: 'linkedin', name: 'LinkedIn company page', search: (n) => `https://www.linkedin.com/search/results/companies/?keywords=${q(n)}` },
];

export function useListings() {
  const { location } = useLocationContext();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!location) return;
    const { data, error: err } = await supabase.from('business_listings')
      .select('id, directory, source, status, url, name, address, phone, website, note, checked_at').eq('location_id', location.id);
    setListings((data as Listing[]) ?? []);
    setError(err ? `Couldn't load listings: ${err.message}` : null);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);
  return { listings, loading, error, reload: load };
}

export const runListingsCheck = () => callFunction<{ listings: Listing[] }>('listings-check', { action: 'check' });

export async function saveManualListing(locationId: string, directory: string, input: Pick<Listing, 'status' | 'url' | 'name' | 'address' | 'phone' | 'website' | 'note'>) {
  const row = { location_id: locationId, directory, source: 'manual', ...input, url: input.url?.trim() || null };
  if (row.url && !/^https?:\/\//.test(row.url)) row.url = `https://${row.url}`;
  const { error } = await supabase.from('business_listings').upsert(row, { onConflict: 'location_id,directory' });
  return { error: error?.message ?? null };
}

export async function removeManualListing(id: string) {
  const { error } = await supabase.from('business_listings').delete().eq('id', id);
  return { error: error?.message ?? null };
}

/** City for directory searches, from the business address ("12 Main St, Austin, TX" → "Austin, TX"). */
export function cityOf(address: string | null | undefined) {
  if (!address) return '';
  const parts = address.split(',').map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1, 3).join(', ') : parts[0] ?? '';
}
