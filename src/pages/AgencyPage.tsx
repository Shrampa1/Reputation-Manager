import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Check, Copy, ExternalLink, ImagePlus, Loader2, Lock, Palette, Star, UserPlus, X } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { Logo } from '@/components/Logo';
import { relativeTime } from '@/lib/activity';
import { SLUG_RE, portalUrl, saveAgency, setBusinessInPortal, slugify, uploadAgencyLogo, useAgency, type Agency, type AgencyClientRow } from '@/lib/agency';

type Banner = { kind: 'success' | 'error'; text: string } | null;

/** Agency plan: the white-label client portal and an overview of every client business. */
export function AgencyPage() {
  const { hasAgencyPlan, isPlatformAdmin, refresh } = useLocationContext();
  const { agency, rows, loading, error, reload } = useAgency();
  const [banner, setBanner] = useState<Banner>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!agency && !hasAgencyPlan && !isPlatformAdmin) {
    return (
      <div className="card p-6 sm:p-8 text-center max-w-xl mx-auto">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-violet-50 text-violet-600 mx-auto mb-3">
          <Lock className="w-5 h-5" />
        </div>
        <h1 className="text-base font-bold text-slate-900">Your own branded client portal</h1>
        <p className="text-sm text-slate-500 mt-1">
          On the Agency plan your clients sign in at your own portal address, with your logo and colours, to see their reviews and
          reports. Manage up to 10 businesses and see them all on one page.
        </p>
        <Link to="/billing" className="btn-primary mt-4">See the Agency plan</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Agency</h1>
        <p className="text-sm text-slate-500 mt-1">Your branded client portal, and how every client business is doing.</p>
      </div>

      {banner && (
        <div
          role="status"
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
            banner.kind === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
          }`}
        >
          <p className="flex-1 break-words">{banner.text}</p>
          <button onClick={() => setBanner(null)} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <PortalSettings
        agency={agency}
        onSaved={async (text) => {
          setBanner({ kind: 'success', text });
          await reload();
          await refresh();
        }}
        onError={(text) => setBanner({ kind: 'error', text })}
      />

      <ClientBusinesses
        rows={rows}
        hasAgency={Boolean(agency)}
        onChanged={async (text) => {
          setBanner({ kind: 'success', text });
          await reload();
          await refresh();
        }}
        onError={(text) => setBanner({ kind: 'error', text })}
      />
    </div>
  );
}

// ---------------------------------------------------------------- Portal settings
function PortalSettings({
  agency,
  onSaved,
  onError,
}: {
  agency: Agency | null;
  onSaved: (text: string) => Promise<void>;
  onError: (text: string) => void;
}) {
  const { organization } = useLocationContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(agency?.name ?? '');
  const [slug, setSlug] = useState(agency?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(Boolean(agency));
  const [logo, setLogo] = useState<string | null>(agency?.logo_url ?? null);
  const [color, setColor] = useState(agency?.brand_color ?? '#0ea5e9');
  const [supportEmail, setSupportEmail] = useState(agency?.support_email ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const slugError = slug && !SLUG_RE.test(slug) ? 'Use 3–40 lowercase letters, numbers and dashes.' : null;
  const preview = { name: name.trim() || 'Your agency', slug, logo_url: logo, brand_color: color, support_email: supportEmail || null };

  const upload = async (file: File | undefined) => {
    if (!file || !organization) return;
    setUploading(true);
    try {
      setLogo(await uploadAgencyLogo(organization.id, file));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return onError('Enter your agency name.');
    if (!slug || slugError) return onError(slugError ?? 'Choose a portal address.');
    setSaving(true);
    try {
      await saveAgency({ name: name.trim(), slug, logo_url: logo, brand_color: color, support_email: supportEmail.trim() || null });
      await onSaved(agency ? 'Portal settings saved.' : 'Your client portal is ready. Add businesses below, then invite your clients.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save the portal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-violet-50 text-violet-600 shrink-0">
          <Palette className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Client portal</h2>
          <p className="text-sm text-slate-500">Clients see your name, logo and colour, never Reputation Engine.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5">
        <div className="space-y-4">
          <div>
            <label htmlFor="agency-name" className="block text-sm font-medium text-slate-700 mb-1.5">Agency name</label>
            <input id="agency-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="input-field" placeholder="Bright Media" />
          </div>
          <div>
            <label htmlFor="agency-slug" className="block text-sm font-medium text-slate-700 mb-1.5">Portal address</label>
            <div className="flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-slate-200">
              <span className="px-3 py-2.5 text-sm text-slate-400 bg-slate-50 border-r border-slate-200 whitespace-nowrap hidden sm:block">
                {window.location.host}/p/
              </span>
              <input
                id="agency-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                }}
                maxLength={40}
                className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none"
                placeholder="bright-media"
                aria-invalid={Boolean(slugError)}
              />
            </div>
            {slugError && <p className="text-xs text-rose-600 mt-1">{slugError}</p>}
            {agency && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <code className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded-lg break-all">{portalUrl(agency.slug)}</code>
                <button
                  type="button"
                  className="btn-ghost !py-1 text-xs"
                  onClick={async () => {
                    await navigator.clipboard.writeText(portalUrl(agency.slug)).catch(() => undefined);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
                </button>
                <a href={portalUrl(agency.slug)} target="_blank" rel="noreferrer" className="btn-ghost !py-1 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </a>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1.5">Logo</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  {logo ? 'Change' : 'Upload'}
                </button>
                {logo && (
                  <button type="button" onClick={() => setLogo(null)} className="btn-ghost text-sm">Remove</button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">Square PNG works best (transparent background is kept). Max 2 MB.</p>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            <div>
              <label htmlFor="agency-color" className="block text-sm font-medium text-slate-700 mb-1.5">Brand colour</label>
              <div className="flex items-center gap-2">
                <input id="agency-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 bg-white p-1 cursor-pointer" />
                <input
                  value={color}
                  onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && setColor(e.target.value)}
                  className="input-field font-mono !w-28"
                  aria-label="Brand colour hex code"
                />
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="agency-support" className="block text-sm font-medium text-slate-700 mb-1.5">Support email <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="agency-support" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="input-field" placeholder="help@brightmedia.com" />
            <p className="text-xs text-slate-400 mt-1">Shown on the portal sign-in page and used as the reply-to on client invites.</p>
          </div>
          <button type="submit" disabled={saving || uploading} className="btn-primary">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {agency ? 'Save portal' : 'Create portal'}
          </button>
        </div>

        {/* Live preview of what clients see */}
        <div aria-hidden className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 self-start">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-3 pt-3">Preview</p>
          <div className="m-3 rounded-xl bg-white border border-slate-200 p-3">
            <Logo branding={preview} markClassName="w-8 h-8" className="text-sm" />
            <div className="mt-3 space-y-1">
              <div className="px-2.5 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: `${color}1a`, color }}>Dashboard</div>
              <div className="px-2.5 py-2 rounded-lg text-xs font-medium text-slate-500">Reviews</div>
            </div>
            <div className="mt-3 px-3 py-2 rounded-lg text-xs font-medium text-white text-center" style={{ backgroundColor: color }}>
              Send review request
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Client businesses
function ClientBusinesses({
  rows,
  hasAgency,
  onChanged,
  onError,
}: {
  rows: AgencyClientRow[];
  hasAgency: boolean;
  onChanged: (text: string) => Promise<void>;
  onError: (text: string) => void;
}) {
  const { switchOrganization } = useLocationContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (r: AgencyClientRow) => {
    setBusy(r.organization_id);
    try {
      await setBusinessInPortal(r.organization_id, !r.linked);
      await onChanged(r.linked ? `${r.name} was removed from your portal and shows Reputation Engine branding again.` : `${r.name} now uses your portal branding.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not update the business');
    } finally {
      setBusy(null);
    }
  };

  const open = async (r: AgencyClientRow, path: string) => {
    await switchOrganization(r.organization_id);
    navigate(path);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Client businesses</h2>
          <p className="text-xs text-slate-500">Last 30 days. Add businesses from the business switcher in the menu.</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">No businesses yet.</div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const responseRate = r.requests_30d > 0 ? Math.round((r.responses_30d / r.requests_30d) * 100) : null;
            return (
              <li key={r.organization_id} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-500 shrink-0">
                      <Building2 className="w-[18px] h-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 break-words">{r.name}</p>
                        <span className="badge bg-slate-100 text-slate-600 capitalize">{r.plan}</span>
                        {r.clients > 0 && <span className="badge bg-violet-50 text-violet-700">{r.clients} client login{r.clients === 1 ? '' : 's'}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {r.google_rating !== null ? (
                          <span className="inline-flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {r.google_rating.toFixed(1)} on Google ({r.google_review_count ?? 0})</span>
                        ) : 'No Google listing linked'}
                        {r.last_review_at && ` · last review ${relativeTime(r.last_review_at)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className={`flex items-center gap-2 text-sm ${hasAgency ? 'text-slate-700' : 'text-slate-400'}`}>
                      <input
                        type="checkbox"
                        checked={r.linked}
                        disabled={!hasAgency || busy !== null}
                        onChange={() => toggle(r)}
                        className="rounded border-slate-300"
                      />
                      In portal
                      {busy === r.organization_id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    </label>
                    <button onClick={() => open(r, '/team?invite=client')} className="btn-secondary text-sm" title="Give your client a view-only login">
                      <UserPlus className="w-4 h-4" /> Invite client
                    </button>
                    <button onClick={() => open(r, '/')} className="btn-ghost text-sm">Open</button>
                  </div>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3 pt-3 border-t border-slate-100">
                  <Metric label="New reviews" value={String(r.reviews_30d)} />
                  <Metric label="Average rating" value={r.avg_rating_30d !== null ? `${r.avg_rating_30d.toFixed(1)} ★` : '–'} />
                  <Metric label="Requests sent" value={String(r.requests_30d)} />
                  <Metric label="Response rate" value={responseRate !== null ? `${responseRate}%` : '–'} />
                </dl>
              </li>
            );
          })}
        </ul>
      )}
      {!hasAgency && rows.length > 0 && <p className="text-xs text-slate-500">Create your portal above to add businesses to it.</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800 tabular-nums">{value}</dd>
    </div>
  );
}
