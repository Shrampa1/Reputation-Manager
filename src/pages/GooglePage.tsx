import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Eye, Globe, ImagePlus, Loader2, MapPinned, Phone, RefreshCw, Save, Star } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { uploadPostImage } from '@/lib/media';
import { relativeTime } from '@/lib/activity';
import {
  PHOTO_CATEGORIES,
  addPhoto,
  change,
  loadPerformance,
  loadPhotos,
  loadProfile,
  saveProfile,
  syncGoogleReviews,
  useGbpStatus,
  type DayHours,
  type GbpPhoto,
  type Performance,
  type ProfileInfo,
  type Totals,
} from '@/lib/gbp';

type Tab = 'performance' | 'profile' | 'photos';
const DAY_LABEL: Record<string, string> = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun' };
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** Phase B1: the business's Google Business Profile, managed from here. */
export function GooglePage() {
  const status = useGbpStatus();
  const { can } = useLocationContext();
  const [tab, setTab] = useState<Tab>('performance');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const sync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await syncGoogleReviews();
      setSyncMsg(`${r.total} reviews checked: ${r.imported} new, ${r.updated} updated. Replies can now be posted to Google from Reviews.`);
    } catch (e) {
      setSyncMsg(errText(e));
    } finally {
      setSyncing(false);
    }
  };

  if (!status) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;
  if (!status.connected) {
    return (
      <div className="card p-6 sm:p-8 text-center max-w-xl mx-auto">
        <MapPinned className="w-8 h-8 text-sky-500 mx-auto mb-3" />
        <h1 className="text-base font-bold text-slate-900">Manage your Google Business Profile here</h1>
        <p className="text-sm text-slate-500 mt-1">
          Connect Google Business Profile to see calls, direction requests and website clicks, update your hours and description,
          add photos, and reply to Google reviews without leaving Reputation Engine.
        </p>
        {status.error && <p className="text-sm text-rose-600 mt-2">{status.error}</p>}
        <Link to="/integrations" className="btn-primary mt-4">Connect Google</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Google profile</h1>
          <p className="text-sm text-slate-500 mt-1">{status.account_name ?? 'Your Google Business Profile'}</p>
        </div>
        {can('reviews.reply') && (
          <button onClick={sync} disabled={syncing} className="btn-secondary text-sm">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />} Sync Google reviews
          </button>
        )}
      </div>
      {syncMsg && <p className="text-sm text-slate-600 card p-3">{syncMsg}</p>}

      <div className="flex gap-1.5" role="tablist">
        {(['performance', 'profile', 'photos'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {t === 'performance' ? 'Performance' : t === 'profile' ? 'Profile details' : 'Photos'}
          </button>
        ))}
      </div>

      {tab === 'performance' && <PerformanceTab />}
      {tab === 'profile' && <ProfileTab canEdit={can('business.edit')} />}
      {tab === 'photos' && <PhotosTab canEdit={can('business.edit')} />}
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {text}
    </div>
  );
}

function PerformanceTab() {
  const [days, setDays] = useState<30 | 90>(30);
  const [data, setData] = useState<Performance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadPerformance(days, refresh));
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [days]);
  useEffect(() => {
    load();
  }, [load]);

  const tiles: { key: keyof Totals; label: string; icon: typeof Eye }[] = [
    { key: 'views', label: 'Profile views', icon: Eye },
    { key: 'calls', label: 'Calls', icon: Phone },
    { key: 'website_clicks', label: 'Website clicks', icon: Globe },
    { key: 'directions', label: 'Direction requests', icon: MapPinned },
  ];
  const maxViews = Math.max(1, ...(data?.daily ?? []).map((d) => d.views));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select className="input-field !w-auto !py-1.5 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value) as 30 | 90)} aria-label="Period">
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
        <button onClick={() => load(true)} disabled={loading} className="btn-ghost text-sm"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        {data && <span className="text-xs text-slate-400">Google's numbers lag about 3 days · updated {relativeTime(data.fetched_at)}</span>}
      </div>
      {error && <ErrorBox text={error} />}
      {loading && !data ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {tiles.map((t) => {
              const c = change(data.totals[t.key], data.previous[t.key]);
              return (
                <div key={t.key} className="card p-3">
                  <p className="text-xs text-slate-500 flex items-center gap-1"><t.icon className="w-3.5 h-3.5" /> {t.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{data.totals[t.key].toLocaleString()}</p>
                  {c && <p className={`text-xs mt-0.5 ${c.startsWith('-') ? 'text-rose-600' : 'text-emerald-600'}`}>{c} vs previous {days} days</p>}
                </div>
              );
            })}
          </div>
          {data.daily.length > 0 && (
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-900 mb-3">Profile views per day</p>
              <div className="flex items-end gap-[2px] h-32" role="img" aria-label="Profile views per day">
                {data.daily.map((d) => (
                  <div key={d.date} title={`${d.date}: ${d.views} views, ${d.calls} calls`} className="flex-1 bg-sky-400 rounded-t" style={{ height: `${Math.max(2, (d.views / maxViews) * 100)}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>{data.daily[0].date}</span><span>{data.daily[data.daily.length - 1].date}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileTab({ canEdit }: { canEdit: boolean }) {
  const [info, setInfo] = useState<ProfileInfo | null>(null);
  const [form, setForm] = useState<{ phone: string; website: string; description: string; hours: DayHours[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const { info: i } = await loadProfile(refresh);
      setInfo(i);
      setForm({ phone: i.phone ?? '', website: i.website ?? '', description: i.description ?? '', hours: i.hours });
    } catch (e) {
      setError(errText(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !info) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const patch: Record<string, unknown> = {};
    if (form.phone !== (info.phone ?? '')) patch.phone = form.phone;
    if (form.website !== (info.website ?? '')) patch.website = form.website;
    if (form.description !== (info.description ?? '')) patch.description = form.description;
    if (JSON.stringify(form.hours) !== JSON.stringify(info.hours)) patch.hours = form.hours;
    try {
      if (Object.keys(patch).length) {
        const { info: i } = await saveProfile(patch);
        setInfo(i);
        setForm({ phone: i.phone ?? '', website: i.website ?? '', description: i.description ?? '', hours: i.hours });
      }
      setSaved(true);
    } catch (err) {
      setError(errText(err));
    } finally {
      setSaving(false);
    }
  };

  if (error && !info) return <ErrorBox text={error} />;
  if (!info || !form) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;
  const setDay = (i: number, patch: Partial<DayHours>) => setForm({ ...form, hours: form.hours.map((d, n) => (n === i ? { ...d, ...patch } : d)) });

  return (
    <form onSubmit={save} className="card p-5 space-y-4">
      <div>
        <p className="text-base font-semibold text-slate-900">{info.title}</p>
        <p className="text-sm text-slate-500">{[info.category, info.address].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="gbp-phone" className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
          <input id="gbp-phone" className="input-field" value={form.phone} disabled={!canEdit} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label htmlFor="gbp-site" className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
          <input id="gbp-site" className="input-field" value={form.website} disabled={!canEdit} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="gbp-desc" className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="font-normal text-slate-400">({form.description.length}/750)</span></label>
        <textarea id="gbp-desc" className="input-field min-h-[100px]" maxLength={750} value={form.description} disabled={!canEdit} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <fieldset>
        <legend className="text-sm font-medium text-slate-700 mb-1.5">Opening hours</legend>
        <div className="space-y-1.5">
          {form.hours.map((d, i) => (
            <div key={d.day} className="flex items-center gap-2 text-sm flex-wrap">
              <span className="w-10 text-slate-600">{DAY_LABEL[d.day]}</span>
              <label className="flex items-center gap-1.5 text-slate-600">
                <input type="checkbox" className="rounded border-slate-300" checked={!d.closed} disabled={!canEdit} onChange={(e) => setDay(i, { closed: !e.target.checked })} /> Open
              </label>
              {!d.closed && (
                <>
                  <input type="time" className="input-field !w-auto !py-1" value={d.open} disabled={!canEdit} onChange={(e) => setDay(i, { open: e.target.value })} aria-label={`${DAY_LABEL[d.day]} opens`} />
                  <span className="text-slate-400">to</span>
                  <input type="time" className="input-field !w-auto !py-1" value={d.close} disabled={!canEdit} onChange={(e) => setDay(i, { close: e.target.value })} aria-label={`${DAY_LABEL[d.day]} closes`} />
                </>
              )}
            </div>
          ))}
        </div>
        {!info.has_hours && <p className="text-xs text-amber-700 mt-1.5">Your profile has no opening hours yet. Customers filter by "open now", so add them.</p>}
      </fieldset>
      {error && <ErrorBox text={error} />}
      {canEdit && (
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save to Google</button>
          {saved && <span className="text-sm text-emerald-600">Saved. Google may take a little while to show changes.</span>}
        </div>
      )}
    </form>
  );
}

function PhotosTab({ canEdit }: { canEdit: boolean }) {
  const { organization } = useLocationContext();
  const [photos, setPhotos] = useState<GbpPhoto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('ADDITIONAL');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async (refresh = false) => {
    setError(null);
    try {
      const r = await loadPhotos(refresh);
      setPhotos(r.photos);
      setTotal(r.total);
    } catch (e) {
      setError(errText(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const upload = async (file: File) => {
    if (!organization) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadPostImage(organization.id, file);
      await addPhoto(url, category);
      await load(true);
    } catch (e) {
      setError(errText(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="card p-4 flex flex-wrap items-center gap-2">
          <select className="input-field !w-auto !py-1.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Photo type">
            {PHOTO_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button onClick={() => input.current?.click()} disabled={uploading} className="btn-primary text-sm">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />} Add a photo to Google
          </button>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          <span className="text-xs text-slate-500">Profiles with 10+ recent photos get more clicks.</span>
        </div>
      )}
      {error && <ErrorBox text={error} />}
      {!photos ? (
        !error && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : photos.length === 0 ? (
        <p className="text-sm text-slate-500 card p-6 text-center">No photos on the profile yet.</p>
      ) : (
        <>
          <p className="text-sm text-slate-500">{total} photo{total === 1 ? '' : 's'} on Google</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {photos.map((p) => (
              <div key={p.name} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                {p.thumbnail && <img src={p.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />}
                {p.category && <span className="absolute bottom-1 left-1 badge bg-white/90 text-slate-600">{PHOTO_CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category.toLowerCase()}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
