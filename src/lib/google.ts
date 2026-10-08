import { useEffect, useState } from 'react';
import { callFunction, FunctionCallError } from '@/lib/functions';
import type { Location, PlaceCandidate } from '@/types';

// ---- Is Google Places (listing lookups, ratings) working for this app?
// Checked once per browser session with a free call; any call that comes back
// "places_unavailable" flips it off too. Features hide instead of showing errors.
export type PlacesStatus = 'checking' | 'available' | 'unavailable';

const STATUS_KEY = 'places-status';
let placesStatus: PlacesStatus = 'checking';
let statusRequest: Promise<void> | null = null;
const listeners = new Set<(s: PlacesStatus) => void>();

function setPlacesStatus(next: PlacesStatus) {
  placesStatus = next;
  try {
    sessionStorage.setItem(STATUS_KEY, next);
  } catch {
    // storage blocked: the in-memory value is enough
  }
  listeners.forEach((fn) => fn(next));
}

function loadPlacesStatus() {
  if (statusRequest) return;
  try {
    const saved = sessionStorage.getItem(STATUS_KEY);
    if (saved === 'available' || saved === 'unavailable') {
      placesStatus = saved;
      statusRequest = Promise.resolve();
      return;
    }
  } catch {
    // ignore
  }
  statusRequest = callFunction<{ available: boolean }>('google-places', { action: 'status' })
    // An older function without "status" or a network blip: assume on, real calls will tell
    .then((r) => setPlacesStatus(r.available === false ? 'unavailable' : 'available'))
    .catch(() => setPlacesStatus('available'));
}

export function usePlacesStatus(): PlacesStatus {
  const [status, setStatus] = useState<PlacesStatus>(placesStatus);
  useEffect(() => {
    listeners.add(setStatus);
    loadPlacesStatus();
    setStatus(placesStatus);
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  return status;
}

export function isPlacesUnavailable(err: unknown) {
  return err instanceof FunctionCallError && err.payload?.code === 'places_unavailable';
}

/** Runs a Places call; if Google turns out to be off, switches the features off for the session. */
async function withPlaces<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const result = await fn();
    if (placesStatus !== 'available') setPlacesStatus('available');
    return result;
  } catch (err) {
    if (isPlacesUnavailable(err)) setPlacesStatus('unavailable');
    throw err;
  }
}

/** Find Google listings by name and city. */
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const { places } = await withPlaces(() => callFunction<{ places: PlaceCandidate[] }>('google-places', { action: 'search', query }));
  return places;
}

/** Owners/admins: link a Google listing to the business and import its rating and latest reviews. */
export async function connectPlace(placeId: string) {
  return withPlaces(() => callFunction<{ location: Location; imported: number }>('google-places', { action: 'connect', placeId }));
}

export async function syncGoogle() {
  return withPlaces(() => callFunction<{ location: Location; imported: number }>('google-places', { action: 'sync' }));
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
