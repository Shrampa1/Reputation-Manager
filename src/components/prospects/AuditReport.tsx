import { AlertTriangle, CheckCircle2, ExternalLink, Globe, Mail, MapPin, Star, XCircle } from 'lucide-react';
import { SECTION_LABELS, SECTION_MAX, SOCIAL_LABELS, gradeColor, type ReportData, type SocialKey } from '@/lib/prospects';

const impactStyle = {
  high: 'bg-rose-50 text-rose-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
      <span className={ok ? 'text-slate-700' : 'text-slate-900 font-medium'}>{label}</span>
    </li>
  );
}

/** A prospect audit report, in the agency's branding. Print-friendly ("Save as PDF"). */
export function AuditReport({ data }: { data: ReportData }) {
  const { result: r, branding } = data;
  const accent = branding?.brand_color || '#0ea5e9';
  const g = r.google.available ? r.google : null;
  const date = data.created_at ? new Date(data.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const rows = [
    ...(g ? [{ name: data.business_name, rating: g.rating, reviews: g.review_count, you: true, url: g.maps_url }] : []),
    ...r.competitors.map((c) => ({ name: c.name, rating: c.rating, reviews: c.review_count, you: false, url: c.maps_url })),
  ];
  const maxReviews = Math.max(1, ...rows.map((x) => x.reviews));

  return (
    <article className="max-w-3xl mx-auto bg-white print:max-w-none">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-6 sm:px-8 py-5 border-b-4" style={{ borderColor: accent }}>
        <div className="flex items-center gap-3 min-w-0">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="" className="h-10 w-auto max-w-[160px] object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ background: accent }}>
              {(branding?.name ?? 'R').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{branding?.name ?? 'Online presence audit'}</p>
            <p className="text-xs text-slate-500">Online presence audit{date ? ` · ${date}` : ''}</p>
          </div>
        </div>
      </header>

      <div className="px-6 sm:px-8 py-6 space-y-8">
        {/* Score */}
        <section className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className={`shrink-0 w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center ${gradeColor(data.grade)}`}>
            <span className="text-3xl font-bold leading-none">{data.score ?? '–'}</span>
            <span className="text-xs mt-1">out of 100</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">{data.business_name}</h1>
            {data.address && <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{data.address}</p>}
            <p className="mt-2 inline-flex items-center gap-2">
              <span className={`badge border ${gradeColor(data.grade)}`}>Grade {data.grade ?? '–'}</span>
            </p>
            <p className="text-sm text-slate-700 leading-relaxed mt-3">{r.summary}</p>
          </div>
        </section>

        {/* Section scores */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(SECTION_LABELS) as (keyof typeof SECTION_LABELS)[]).map((k) => {
            const v = r.sections[k];
            return (
              <div key={k} className="p-3 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-700">{SECTION_LABELS[k]}</span>
                  <span className="text-slate-500">{v === null ? 'Not checked' : `${v} / ${SECTION_MAX[k]}`}</span>
                </div>
                <Bar value={v ?? 0} max={SECTION_MAX[k]} color={accent} />
              </div>
            );
          })}
        </section>

        {/* Opportunities */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Biggest opportunities</h2>
          <ol className="space-y-2.5">
            {r.opportunities.map((o, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-xl border border-slate-200 break-inside-avoid">
                <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0" style={{ background: accent }}>{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                    {o.title}
                    <span className={`badge ${impactStyle[o.impact]}`}>{o.impact} impact</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-0.5">{o.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Google vs competitors */}
        <section className="break-inside-avoid">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Google reviews vs nearby competitors</h2>
          {!g ? (
            <p className="text-sm text-slate-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />{r.google.available ? '' : r.google.reason}</p>
          ) : rows.length < 2 ? (
            <p className="text-sm text-slate-500">No comparable businesses were found nearby.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-3">
                The most-reviewed {g.category ? g.category.toLowerCase() + ' businesses' : 'similar businesses'} within about 5 km.
              </p>
              <div className="space-y-2.5">
                {rows.map((x, i) => (
                  <div key={i} className={`p-3 rounded-xl ${x.you ? 'border-2' : 'border border-slate-200'}`} style={x.you ? { borderColor: accent } : undefined}>
                    <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                      <span className="font-medium text-slate-900 truncate">{x.name}{x.you && ' (you)'}</span>
                      <span className="shrink-0 text-slate-600 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        {x.rating?.toFixed(1) ?? '–'} · {x.reviews} reviews
                      </span>
                    </div>
                    <Bar value={x.reviews} max={maxReviews} color={x.you ? accent : '#cbd5e1'} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Listing */}
        {g && (
          <section className="break-inside-avoid">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Google Business Profile</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Check ok={Boolean(g.website)} label="Website linked" />
              <Check ok={Boolean(g.phone)} label="Phone number" />
              <Check ok={g.has_hours} label="Opening hours" />
              <Check ok={g.photo_count >= 10} label={`Photos (${g.photo_count}${g.photo_count >= 10 ? '+' : ' of 10+'})`} />
              <Check ok={g.has_description} label="Business description" />
              <Check ok={(g.rating ?? 0) >= 4.3} label={`Rating 4.3★ or higher (${g.rating?.toFixed(1) ?? 'none'})`} />
            </ul>
            {g.maps_url && (
              <a href={g.maps_url} target="_blank" rel="noopener noreferrer" className="print:hidden inline-flex items-center gap-1 mt-3 text-sm font-medium hover:underline" style={{ color: accent }}>
                View on Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </section>
        )}

        {/* Website */}
        <section className="break-inside-avoid">
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2"><Globe className="w-5 h-5 text-slate-400" /> Website</h2>
          {!r.website ? (
            <p className="text-sm text-slate-600">No website was found.</p>
          ) : r.website.error ? (
            <p className="text-sm text-rose-600">{r.website.error}</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-3 break-all">{r.website.url}</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-3 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Website health</p>
                  <p className="text-xl font-bold text-slate-900">{r.website.score ?? '–'}<span className="text-sm font-normal text-slate-400"> / 100</span></p>
                </div>
                <div className="p-3 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500">Mobile speed</p>
                  <p className="text-xl font-bold text-slate-900">{r.website.mobile_performance ?? '–'}<span className="text-sm font-normal text-slate-400"> / 100</span></p>
                </div>
              </div>
              {r.website.issues.length > 0 && (
                <ul className="space-y-1.5">
                  {r.website.issues.map((i, n) => (
                    <li key={n} className="text-sm flex gap-2">
                      {i.status === 'fail' ? <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                      <span><span className="font-medium text-slate-900">{i.title}.</span> <span className="text-slate-600">{i.detail}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Social */}
        <section className="break-inside-avoid">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Social media</h2>
          {!r.social ? (
            <p className="text-sm text-slate-600">Couldn't check: no website to look for social links on.</p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SOCIAL_LABELS) as SocialKey[]).map((k) => (
                <Check key={k} ok={Boolean(r.social![k])} label={SOCIAL_LABELS[k]} />
              ))}
            </ul>
          )}
        </section>

        {/* Call to action */}
        <section className="p-5 rounded-2xl text-white break-inside-avoid" style={{ background: accent }}>
          <p className="text-lg font-bold">Want help fixing these?</p>
          <p className="text-sm opacity-90 mt-1">
            {branding?.name ?? 'We'} can take care of every item on this list, from getting more 5-star reviews to fixing your Google profile and website.
          </p>
          {branding?.support_email && (
            <a href={`mailto:${branding.support_email}?subject=${encodeURIComponent(`Audit for ${data.business_name}`)}`} className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-sm font-semibold" style={{ color: accent }}>
              <Mail className="w-4 h-4" /> {branding.support_email}
            </a>
          )}
        </section>
      </div>
    </article>
  );
}
