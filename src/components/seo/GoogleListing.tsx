import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ExternalLink, Loader2, MapPin, RefreshCw, Search, Star, Unlink, X } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { compareField, connectPlace, disconnectGoogle, isPlacesUnavailable, searchPlaces, syncGoogle, usePlacesStatus, type MatchStatus } from '@/lib/google';
import { relativeTime } from '@/lib/activity';
import { PlacesPausedNote } from '@/components/seo/PlacesPausedNote';
import type { Location, PlaceCandidate } from '@/types';

const FIELDS: { key: 'name' | 'address' | 'phone' | 'website'; label: string }[] = [
  { key: 'name', label: 'Business name' },
  { key: 'address', label: 'Address' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
];

const matchStyle: Record<MatchStatus, { label: string; color: string; icon: typeof Check }> = {
  match: { label: 'Matches', color: 'bg-emerald-50 text-emerald-600', icon: Check },
  mismatch: { label: 'Different', color: 'bg-rose-50 text-rose-600', icon: X },
  missing: { label: 'Missing', color: 'bg-amber-50 text-amber-600', icon: AlertTriangle },
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-4 h-4 ${n <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
      ))}
    </span>
  );
}

/** Edit our own name/address/phone/website (what Google is compared against). */
function BusinessDetailsEditor({ location, onSaved }: { location: Location; onSaved: (msg: string) => void }) {
  const { updateLocation } = useLocationContext();
  const [form, setForm] = useState({ name: '', address: '', phone: '', website: '' });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setForm({ name: location.name, address: location.address ?? '', phone: location.phone ?? '', website: location.website ?? '' });
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!form.name.trim()) return setError('Business name is required.');
    setSaving(true);
    const { error: saveError } = await updateLocation({
      name: form.name.trim(),
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
    });
    setSaving(false);
    if (saveError) return setError(saveError);
    setEditing(false);
    onSaved('Business details saved');
  };

  const useGoogle = () => {
    const g = location.google_listing;
    if (!g) return;
    setForm({ name: g.name ?? form.name, address: g.address ?? form.address, phone: g.phone ?? form.phone, website: g.website ?? form.website });
  };

  if (!editing) {
    return (
      <button onClick={start} className="btn-secondary text-xs">
        Edit your details
      </button>
    );
  }
  return (
    <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === 'address' || f.key === 'website' ? 'sm:col-span-2' : ''}>
            <label htmlFor={`biz-${f.key}`} className="block text-xs font-semibold text-slate-500 mb-1">{f.label}</label>
            <input id={`biz-${f.key}`} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="input-field" />
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </button>
        {location.google_listing && (
          <button onClick={useGoogle} type="button" className="btn-secondary">Copy from Google</button>
        )}
        <button onClick={() => setEditing(false)} type="button" className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

export function GoogleListing({ onToast }: { onToast: (msg: string) => void }) {
  const { location, refresh, can } = useLocationContext();
  // Feature access (role default or Role access override)
  const isAdmin = can('business.edit');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceCandidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const placesOff = usePlacesStatus() === 'unavailable';

  useEffect(() => {
    if (location && !query) {
      const city = location.address?.split(',').slice(-2).join(',').trim() ?? '';
      setQuery([location.name, city].filter(Boolean).join(' '));
    }
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!location) return null;
  const connected = Boolean(location.gbp_place_id);
  const g = location.google_listing;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      // Google being off is shown by the paused note instead of an error
      if (!isPlacesUnavailable(err)) setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 3) return setError('Type your business name and city.');
    run('search', async () => setResults(await searchPlaces(query.trim())));
  };

  const handleConnect = (place: PlaceCandidate) =>
    run(place.id, async () => {
      const { imported } = await connectPlace(place.id);
      await refresh();
      setResults(null);
      onToast(`Connected ${place.name}${imported ? ` and imported ${imported} review${imported === 1 ? '' : 's'}` : ''}`);
    });

  const handleSync = () =>
    run('sync', async () => {
      const { imported } = await syncGoogle();
      await refresh();
      onToast(imported ? `Imported ${imported} new Google review${imported === 1 ? '' : 's'}` : 'Google listing is up to date');
    });

  const handleDisconnect = () =>
    run('disconnect', async () => {
      await disconnectGoogle();
      await refresh();
      onToast('Google listing disconnected');
    });

  if (!connected) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 font-bold text-sm">G</div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Connect your Google listing</h2>
            <p className="text-xs text-slate-400">Shows your Google rating, imports your latest Google reviews and checks your details match</p>
          </div>
        </div>
        {placesOff ? (
          <PlacesPausedNote>
            <p>Connecting a Google listing isn’t available right now. Everything else keeps working.</p>
            <p>
              Review requests don’t need it: add your Google review link in{' '}
              <Link to="/settings#review-requests" className="font-medium text-sky-600 hover:underline">Settings</Link>{' '}
              and customers will be sent straight to Google.
            </p>
          </PlacesPausedNote>
        ) : !isAdmin ? (
          <p className="text-sm text-slate-500">Ask an owner or admin to connect your Google listing.</p>
        ) : (
          <>
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2" noValidate>
              <label htmlFor="place-query" className="sr-only">Business name and city</label>
              <input id="place-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Business name and city" className="input-field flex-1" />
              <button type="submit" disabled={busy !== null} className="btn-primary shrink-0">
                {busy === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Find on Google
              </button>
            </form>
            {results && results.length === 0 && <p className="text-sm text-slate-500 mt-3">No matches. Try your exact business name plus the city.</p>}
            {results && results.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
                {results.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-3">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-xs text-slate-500 truncate">{p.address}</p>
                      {p.rating !== null && (
                        <p className="text-xs text-slate-500 mt-0.5">★ {p.rating.toFixed(1)} · {p.reviewCount} reviews</p>
                      )}
                    </div>
                    <button onClick={() => handleConnect(p)} disabled={busy !== null} className="btn-secondary !py-1.5 text-xs shrink-0">
                      {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'This is me'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {error && <p className="text-sm text-rose-600 mt-3" role="alert">{error}</p>}
      </div>
    );
  }

  const mismatches = FIELDS.filter((f) => compareField(f.key, location[f.key], g?.[f.key]) !== 'match').length;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 text-red-600 font-bold text-lg shrink-0">G</div>
            <div className="min-w-0">
              <p className="text-base font-bold text-slate-900 truncate">{g?.name ?? location.name}</p>
              {location.google_rating != null ? (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="font-bold text-slate-900">{Number(location.google_rating).toFixed(1)}</span>
                  <Stars rating={Number(location.google_rating)} />
                  <span>{location.google_review_count ?? 0} reviews</span>
                </p>
              ) : (
                <p className="text-sm text-slate-500">No rating yet</p>
              )}
              <p className="text-xs text-slate-400 mt-0.5">
                {location.google_synced_at
                  ? `Synced ${relativeTime(location.google_synced_at)}${placesOff ? '' : ' · refreshes daily'}`
                  : 'Not synced yet'}
                {g?.business_status && g.business_status !== 'OPERATIONAL' && (
                  <span className="text-rose-600 font-medium"> · Google shows this business as {g.business_status.toLowerCase().replace(/_/g, ' ')}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {location.google_maps_url && (
              <a href={location.google_maps_url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs">
                View on Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {!placesOff && (
              <button onClick={handleSync} disabled={busy !== null} className="btn-secondary text-xs">
                {busy === 'sync' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync now
              </button>
            )}
            {isAdmin && (
              <button onClick={handleDisconnect} disabled={busy !== null} className="btn-ghost text-xs text-slate-500" title="Disconnect Google listing">
                {busy === 'disconnect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
        {placesOff ? (
          <div className="mt-3">
            <PlacesPausedNote>
              <p>Syncing with Google is paused for now. You’re seeing the details from the last sync.</p>
            </PlacesPausedNote>
          </div>
        ) : location.google_sync_error && (
          <p className="text-sm text-rose-600 mt-3 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />Last sync failed: {location.google_sync_error}</p>
        )}
        {error && <p className="text-sm text-rose-600 mt-3" role="alert">{error}</p>}
        <p className="text-[11px] text-slate-400 mt-3">
          Google shares your 5 most recent reviews through this connection; they appear in your Review Inbox. Replying on Google from here needs Google Business Profile access.
        </p>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Listing consistency (NAP)</h3>
            <p className="text-xs text-slate-400">
              Your details vs. what Google shows. Mismatched name, address or phone hurts local rankings.
            </p>
          </div>
          <span className={`badge shrink-0 ${mismatches ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {mismatches ? `${mismatches} to fix` : 'All consistent'}
          </span>
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="font-medium py-1.5 px-1 w-28"></th>
                <th className="font-medium py-1.5 px-1">Your details</th>
                <th className="font-medium py-1.5 px-1">Google</th>
                <th className="font-medium py-1.5 px-1 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => {
                const status = compareField(f.key, location[f.key], g?.[f.key]);
                const s = matchStyle[status];
                return (
                  <tr key={f.key} className="border-t border-slate-100 align-top">
                    <td className="py-2.5 px-1 text-xs font-semibold text-slate-500">{f.label}</td>
                    <td className="py-2.5 px-1 text-slate-800 break-words">{location[f.key] || <span className="text-slate-300">—</span>}</td>
                    <td className="py-2.5 px-1 text-slate-800 break-words">{g?.[f.key] || <span className="text-slate-300">—</span>}</td>
                    <td className="py-2.5 px-1">
                      <span className={`badge ${s.color}`}><s.icon className="w-3 h-3" />{s.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <BusinessDetailsEditor location={location} onSaved={onToast} />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          If Google is the one that’s wrong, fix it in your Google Business Profile (search your business name on Google while signed in → Edit profile).
          Checks for Apple Maps, Bing, Yelp and Facebook listings need a listings data provider and are coming later.
        </p>
      </div>
    </div>
  );
}
