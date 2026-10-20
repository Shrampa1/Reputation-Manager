/**
 * Name / address / phone / website comparison for the listings check (Phase B3).
 * Small formatting differences ("St" vs "Street", "+1 (512)" vs "512-") count as matching.
 */
export type NapField = 'name' | 'address' | 'phone' | 'website';
export type Nap = Partial<Record<NapField, string | null>>;
export type FieldResult = 'match' | 'mismatch' | 'missing';

const ABBREVIATIONS: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr', lane: 'ln', court: 'ct', place: 'pl',
  suite: 'ste', apartment: 'apt', highway: 'hwy', parkway: 'pkwy', square: 'sq', north: 'n', south: 's', east: 'e', west: 'w',
  floor: 'fl', building: 'bldg', number: 'no',
};

export function normalizePhone(p: string) {
  const digits = p.replace(/\D/g, '');
  // Compare the last 10 digits so "+1 512 555 0100" and "(512) 555-0100" match
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeAddress(a: string) {
  return a
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ABBREVIATIONS[w] ?? w)
    // Country names at the end don't matter for matching
    .filter((w, i, all) => !(i === all.length - 1 && /^(usa|us|united|states|pakistan|uk|canada)$/.test(w)))
    .join(' ');
}

export function normalizeName(n: string) {
  return n
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(llc|inc|ltd|co|company|corp|pvt|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeWebsite(w: string) {
  try {
    const u = new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`);
    return u.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return w.toLowerCase().trim();
  }
}

/** Addresses match when one contains the other once tidied (one may include the city/zip, the other not). */
function addressMatches(a: string, b: string) {
  const x = normalizeAddress(a), y = normalizeAddress(b);
  if (!x || !y) return false;
  // Whole words only, so "1 main st" doesn't match inside "21 main st"
  const has = (big: string, small: string) => ` ${big} `.includes(` ${small} `);
  if (x === y || has(x, y) || has(y, x)) return true;
  // Same street line is enough: compare the part before the first comma
  const sx = normalizeAddress(a.split(',')[0]), sy = normalizeAddress(b.split(',')[0]);
  return sx.length > 4 && sx === sy;
}

export function compareField(field: NapField, truth: string | null | undefined, found: string | null | undefined): FieldResult {
  if (!found || !found.trim()) return 'missing';
  if (!truth || !truth.trim()) return 'match';
  switch (field) {
    case 'phone': return normalizePhone(truth) === normalizePhone(found) ? 'match' : 'mismatch';
    case 'website': return normalizeWebsite(truth) === normalizeWebsite(found) ? 'match' : 'mismatch';
    case 'address': return addressMatches(truth, found) ? 'match' : 'mismatch';
    default: {
      const t = normalizeName(truth), f = normalizeName(found);
      const has = (big: string, small: string) => small.length > 2 && ` ${big} `.includes(` ${small} `);
      return t === f || has(t, f) || has(f, t) ? 'match' : 'mismatch';
    }
  }
}

export function compareListing(truth: Nap, found: Nap) {
  const fields: NapField[] = ['name', 'address', 'phone', 'website'];
  const results = Object.fromEntries(fields.map((f) => [f, compareField(f, truth[f], found[f])])) as Record<NapField, FieldResult>;
  const mismatches = fields.filter((f) => results[f] === 'mismatch');
  return { results, mismatches, consistent: mismatches.length === 0 };
}
