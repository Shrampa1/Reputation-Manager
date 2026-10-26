import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, CheckCircle2, Copy, ExternalLink, Globe, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { useAgency } from '@/lib/agency';
import { useFunnels } from '@/lib/funnels';
import { useLeadForms } from '@/lib/leadForms';
import { useSurveys } from '@/lib/surveys';
import {
  STATUS_LABEL, TARGET_LABEL, dnsRecords, useAppDomain, useDomainConfig, useSiteDomains,
  type CustomDomain, type DomainConfig, type DomainRoute, type RouteTarget,
} from '@/lib/domains';

type Pages = Record<Exclude<RouteTarget, 'help'>, { id: string; name: string }[]>;

/** D3: your pages on your own domain or a free subdomain, and the agency's white-label app address. */
export function DomainsPage() {
  const { can, hasAgencyPlan, isPlatformAdmin } = useLocationContext();
  const canEdit = can('business.edit');
  const config = useDomainConfig();
  const d = useSiteDomains();
  const { funnels } = useFunnels();
  const { forms } = useLeadForms();
  const { surveys } = useSurveys();
  const pages: Pages = {
    funnel: funnels.map((f) => ({ id: f.id, name: `${f.name}${f.status === 'published' ? '' : ' (draft)'}` })),
    form: forms.map((f) => ({ id: f.id, name: `${f.name}${f.status === 'published' ? '' : ' (draft)'}` })),
    survey: surveys.map((s) => ({ id: s.id, name: `${s.name}${s.status === 'active' ? '' : ' (paused)'}` })),
  };
  const [sub, setSub] = useState('');
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const subdomains = d.domains.filter((x) => x.kind === 'subdomain');

  const run = async (what: string, fn: () => Promise<string | void>) => {
    setBusy(what);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ ok: true, text });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Domains</h1>
        <p className="text-sm text-slate-500 mt-1">
          Show your <Link to="/funnels" className="text-sky-600 hover:underline">funnels</Link>, lead forms, surveys and help centre on your own web address.
        </p>
      </div>
      {d.error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load domains: {d.error}</p>}
      {message && (
        <p className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
        </p>
      )}

      {canEdit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Free subdomain</h2>
            {config?.platformDomain ? (
              <>
                <p className="text-sm text-slate-500">Ready straight away, no DNS changes.</p>
                <form className="flex items-center gap-1 flex-wrap" onSubmit={(e) => { e.preventDefault(); run('sub', async () => { const x = await d.add({ subdomain: sub }); setSub(''); return `${x.hostname} is live. Now choose which pages it shows.`; }); }}>
                  <input className="input-field text-sm !w-auto flex-1 min-w-[140px]" maxLength={40} placeholder="yourbusiness" value={sub} onChange={(e) => setSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} aria-label="Subdomain" />
                  <span className="text-sm text-slate-500">.{config.platformDomain}</span>
                  <button type="submit" disabled={!sub || busy === 'sub'} className="btn-primary text-sm ml-1">{busy === 'sub' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add</button>
                </form>
                {subdomains.length > 0 && <p className="text-xs text-slate-500">You have {subdomains.length}: {subdomains.map((x) => x.hostname).join(', ')}</p>}
              </>
            ) : (
              <p className="text-sm text-slate-500">Free subdomains switch on once the platform has its own domain (PLATFORM_DOMAIN). Until then, use your own domain or the <code className="text-xs">/s/</code> links.</p>
            )}
          </section>
          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Your own domain</h2>
            <p className="text-sm text-slate-500">A subdomain like <strong>offers.yourbusiness.com</strong> is easiest. You’ll add two DNS records where you bought the domain.</p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run('host', async () => { const x = await d.add({ hostname: host }); setHost(''); return `${x.hostname} added. Add the DNS records below, then press “Check now”.`; }); }}>
              <input className="input-field text-sm flex-1" maxLength={253} placeholder="offers.yourbusiness.com" value={host} onChange={(e) => setHost(e.target.value)} aria-label="Your domain" />
              <button type="submit" disabled={!host.trim() || busy === 'host'} className="btn-primary text-sm">{busy === 'host' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Connect</button>
            </form>
          </section>
        </div>
      )}

      {d.loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : d.domains.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <Globe className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No domains yet</p>
          <p className="text-sm text-slate-500">Connect one above. Your pages also work at their /s/, /f/ and /help/ links on this app.</p>
        </div>
      ) : (
        d.domains.map((x) => (
          <DomainCard key={x.id} d={x} config={config} canEdit={canEdit} busy={busy} pages={pages}
            routes={d.routes.filter((r) => r.domain_id === x.id)}
            onCheck={() => run(`check-${x.id}`, async () => { const r = await d.verify(x.id); return r.status === 'active' ? `${r.hostname} is live.` : undefined; })}
            onRemove={() => { if (window.confirm(`Disconnect ${x.hostname}? Its pages stop working on that address.`)) run(`rm-${x.id}`, async () => { await d.remove(x.id); return `${x.hostname} disconnected.`; }); }}
            onSaveRoute={(r) => run('route', async () => { await d.saveRoute(r); return 'Saved.'; })}
            onDeleteRoute={(id) => run('route', async () => { await d.deleteRoute(id); })} />
        ))
      )}

      {(hasAgencyPlan || isPlatformAdmin) && <AgencyAppDomain config={config} />}
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }).catch(() => {})} className="p-1 text-slate-400 hover:text-slate-700 shrink-0" aria-label={`Copy ${text}`}>
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function DnsSteps({ d, config }: { d: CustomDomain; config: DomainConfig | null }) {
  const rows = dnsRecords(d, config);
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">Add {rows.length === 1 ? 'this record' : 'these records'} in your domain’s DNS settings (GoDaddy, Namecheap, Cloudflare…):</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Name / host</th><th className="px-3 py-2 font-medium">Value</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.type}>
                <td className="px-3 py-2 font-semibold">{r.type}</td>
                <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-mono break-all">{r.name}<CopyText text={r.name} /></span></td>
                <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-mono break-all">{r.value}<CopyText text={r.value} /></span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Some providers want only the first part as the name (e.g. <code>_rengine-verify.offers</code>). DNS changes can take up to an hour; we keep checking every 10 minutes.
        {config?.provider === 'manual' && ' Once verified, the platform team adds the domain to the hosting (manual mode).'}
      </p>
    </div>
  );
}

function DomainCard({ d, config, canEdit, busy, pages, routes, onCheck, onRemove, onSaveRoute, onDeleteRoute }: {
  d: CustomDomain; config: DomainConfig | null; canEdit: boolean; busy: string | null; pages: Pages; routes: DomainRoute[];
  onCheck: () => void; onRemove: () => void; onSaveRoute: (r: Omit<DomainRoute, 'id'> & { id?: string }) => void; onDeleteRoute: (id: string) => void;
}) {
  const st = STATUS_LABEL[d.status];
  const [path, setPath] = useState(routes.length ? '' : '/');
  const [type, setType] = useState<RouteTarget>('funnel');
  const [target, setTarget] = useState('');
  const url = (p: string) => `https://${d.hostname}${p === '/' ? '' : p}`;
  const nameOf = (r: DomainRoute) => (r.target_type === 'help' ? '' : pages[r.target_type].find((p) => p.id === r.target_id)?.name ?? 'Deleted page');
  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-3 flex-wrap border-b border-slate-100">
        <Globe className="w-5 h-5 text-slate-400" />
        <a href={`https://${d.hostname}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-900 hover:text-sky-700 break-all">{d.hostname}</a>
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${st.tone}`}>{st.label}</span>
        <span className="text-xs text-slate-400">{d.kind === 'subdomain' ? 'Free subdomain' : 'Your domain'}</span>
        <div className="ml-auto flex gap-2">
          {canEdit && d.kind === 'custom' && <button type="button" onClick={onCheck} disabled={busy === `check-${d.id}`} className="btn-secondary text-sm">{busy === `check-${d.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check now</button>}
          {canEdit && <button type="button" onClick={onRemove} className="p-2 text-slate-400 hover:text-rose-600" aria-label={`Disconnect ${d.hostname}`}><Trash2 className="w-4 h-4" /></button>}
        </div>
      </div>
      <div className="p-5 space-y-4">
        {d.last_error && d.status !== 'active' && <p className={`text-sm ${d.status === 'error' ? 'text-rose-700' : 'text-slate-600'}`}>{d.last_error}</p>}
        {d.kind === 'custom' && d.status !== 'active' && <DnsSteps d={d} config={config} />}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Pages on this domain</h3>
          {routes.length === 0 && <p className="text-sm text-slate-500">Nothing yet. Choose what the home page (/) shows, and add more addresses if you like.</p>}
          {routes.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm flex-wrap">
              <code className="text-xs bg-slate-100 rounded px-2 py-1 min-w-[80px]">{r.path}</code>
              <span className="text-slate-500">→</span>
              <span className="text-slate-800">{r.target_type === 'help' ? 'Help centre' : `${TARGET_LABEL[r.target_type]}: ${nameOf(r)}`}</span>
              {d.status === 'active' && <a href={url(r.path)} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-slate-700" aria-label={`Open ${url(r.path)}`}><ExternalLink className="w-3.5 h-3.5" /></a>}
              {canEdit && <button type="button" onClick={() => onDeleteRoute(r.id)} className="p-1 text-slate-400 hover:text-rose-600 ml-auto" aria-label={`Remove ${r.path}`}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          ))}
          {canEdit && (
            <form className="flex items-center gap-2 flex-wrap pt-2" onSubmit={(e) => {
              e.preventDefault();
              const p = path.trim().toLowerCase();
              onSaveRoute({ domain_id: d.id, path: p === '' || p === '/' ? '/' : `/${p.replace(/^\/+/, '')}`, target_type: type, target_id: type === 'help' ? null : target });
              setPath('');
              setTarget('');
            }}>
              <span className="inline-flex items-center text-sm text-slate-500">/
                <input className="input-field text-sm !w-32 ml-1" maxLength={40} placeholder="(home)" value={path === '/' ? '' : path.replace(/^\//, '')} onChange={(e) => setPath(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} aria-label="Address" />
              </span>
              <select className="input-field text-sm !w-auto" value={type} onChange={(e) => { setType(e.target.value as RouteTarget); setTarget(''); }} aria-label="Shows">
                {(Object.keys(TARGET_LABEL) as RouteTarget[]).map((t) => <option key={t} value={t}>{TARGET_LABEL[t]}</option>)}
              </select>
              {type !== 'help' && (
                <select className="input-field text-sm !w-auto min-w-[160px]" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Which one" required>
                  <option value="">Choose…</option>
                  {pages[type].map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <button type="submit" disabled={busy === 'route' || (type !== 'help' && !target)} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Add page</button>
            </form>
          )}
          <p className="text-xs text-slate-400">A funnel’s later steps follow its address: home (/) → /thank-you, or /offer → /offer/thank-you.</p>
        </div>
      </div>
    </section>
  );
}

function AgencyAppDomain({ config }: { config: DomainConfig | null }) {
  const { agency, loading: agencyLoading } = useAgency();
  const app = useAppDomain(agency?.id ?? null);
  const [host, setHost] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };
  if (agencyLoading) return null;
  return (
    <section className="card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">White-label app address (agency)</h2>
      {!agency ? (
        <p className="text-sm text-slate-500">Set up your agency on the <Link to="/agency" className="text-sky-600 hover:underline">Agency page</Link> first.</p>
      ) : app.loading ? null : !app.domain ? (
        <>
          <p className="text-sm text-slate-500">Your clients sign in at your own address (e.g. <strong>app.{agency.slug}.com</strong>) and see your logo and colour, not ours.</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await app.add(host); setHost(''); }); }}>
            <input className="input-field text-sm flex-1" placeholder="app.youragency.com" value={host} onChange={(e) => setHost(e.target.value)} aria-label="App address" />
            <button type="submit" disabled={busy || !host.trim()} className="btn-primary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Connect</button>
          </form>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{app.domain.hostname}</span>
            <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_LABEL[app.domain.status].tone}`}>{STATUS_LABEL[app.domain.status].label}</span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => run(app.verify)} disabled={busy} className="btn-secondary text-sm">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check now</button>
              <button type="button" onClick={() => { if (window.confirm(`Disconnect ${app.domain!.hostname}?`)) run(app.remove); }} className="p-2 text-slate-400 hover:text-rose-600" aria-label="Disconnect"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          {app.domain.last_error && app.domain.status !== 'active' && <p className="text-sm text-slate-600">{app.domain.last_error}</p>}
          {app.domain.status !== 'active' && <DnsSteps d={app.domain} config={config} />}
          <p className="text-xs text-slate-500">Also add <code>https://{app.domain.hostname}</code> to Supabase → Authentication → URL configuration (redirect URLs) so password and sign-in emails work there.</p>
        </div>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </section>
  );
}
