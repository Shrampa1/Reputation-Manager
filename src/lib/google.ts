import { callFunction } from '@/lib/functions';
import type { Location, PlaceCandidate } from '@/types';

/** Find Google listings by name and city. */
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const { places } = await callFunction<{ places: PlaceCandidate[] }>('google-places', { action: 'search', query });
  return places;
}

/** Owners/admins: link a Google listing to the business and import its rating and latest reviews. */
export async function connectPlace(placeId: string) {
  return callFunction<{ location: Location; imported: number }>('google-places', { action: 'connect', placeId });
}

export async function syncGoogle() {
  return callFunction<{ location: Location; imported: number }>('google-places', { action: 'sync' });
}

export async function disconnectGoogle() {
  return callFunction<{ location: Location }>('google-places', { action: 'disconnect' });
}

/** Loose comparison so "(512) 555-0100" matches "+1 512-555-0100" and "St" matches "Street". */
export function normalizeForCompare(kind: 'name' | 'address' | 'phone' | 'website', value: string | null | undefined): string {
  const v = (value ?? '').toLowerCase().trim();
  if (!v) return '';
  if (kind === 'phone') return v.replace(/\D/g, '').slice(-10);
  if (kind === 'website') return v.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  const abbreviations: Record<string, string> = {
    street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr', suite: 'ste', lane: 'ln',
    north: 'n', south: 's', east: 'e', west: 'w', highway: 'hwy', parkway: 'pkwy', place: 'pl', court: 'ct',
  };
  return v
    .replace(/[.,#&'’-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => abbreviations[w] ?? w)
    .join(' ');
}

export type MatchStatus = 'match' | 'mismatch' | 'missing';

export function compareField(kind: 'name' | 'address' | 'phone' | 'website', ours: string | null | undefined, google: string | null | undefined): MatchStatus {
  const a = normalizeForCompare(kind, ours);
  const b = normalizeForCompare(kind, google);
  if (!a || !b) return 'missing';
  if (a === b) return 'match';
  // Google addresses include city/state/country; ours may only have the street part
  if (kind === 'address' && (b.startsWith(a) || a.startsWith(b))) return 'match';
  if (kind === 'name' && (b.includes(a) || a.includes(b))) return 'match';
  return 'mismatch';
}
