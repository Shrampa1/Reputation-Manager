import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Copy, ExternalLink, Globe, Loader2, Search, Star, Target, Trash2 } from 'lucide-react';
import { relativeTime } from '@/lib/activity';
import {
  deleteAudit,
  gradeColor,
  searchProspects,
  setAuditSharing,
  shareUrl,
  startAudit,
  useProspectAudits,
  type PlaceMatch,
  type ProspectAudit,
} from '@/lib/prospects';

/** Agency suite A1: audit any business to pitch it. */
export function ProspectsPage() {
  const { audits, loading, error, reload } = useProspectAudits();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null);
  const [website, setWebsite] = useState('');
  const [saveLead, setSaveLead] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setPageError(null);
    try {
      setMatches((await searchProspects(query.trim())).places);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Search failed');
      setMatches(null);
    } finally {
      setSearching(false);
    }
  };

  const run = async (input: { placeId?: string; website?: string; name?: string }, key: string) => {
    setStarting(key);
    setPageError(null);
    try {
      await startAudit({ ...input, saveLead });
      setMatches(null);
      setQuery('');
      setWebsite('');
      await reload();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Couldn’t start the audit');
    } finally {
      setStarting(null);
    }
  };

  const copy = async (a: ProspectAudit) => {
    try {
      await navigator.clipboard.writeText(shareUrl(a.share_token));
      setCopied(a.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setPageError('Couldn’t copy. Open the report and copy the address from your browser.');
    }
  };

  const toggleShare = async (a: ProspectAudit) => {
    const { error: err } = await setAuditSharing(a.id, !a.share_enabled);
    setPageError(err);
    reload();
  };

  const remove = async (a: ProspectAudit) => {
    if (!window.confirm(`Delete the audit for ${a.business_name}? Its share link stops working.`)) return;
    const { error: err } = await deleteAudit(a.id);
    setPageError(err);
    reload();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Prospect audits</h1>
        <p className="text-sm text-slate-500 mt-1">
          Audit any business in about a minute, then send the report in your branding to win it as a client.
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <form onSubmit={search} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input-field !pl-9"
              placeholder="Business name and city, e.g. Joe's Plumbing Austin"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Business to audit"
            />
          </div>
          <button type="submit" disabled={searching || query.trim().length < 3} className="btn-primary">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Find
          </button>
        </form>

        {matches && (
          matches.length === 0 ? (
            <p className="text-sm text-slate-500">No Google listing found. Try another spelling, or audit the website only below.</p>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {matches.map((m) => (
                <li key={m.id} className="p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.name}</p>
                    <p className="text-xs text-slate-500 truncate">{m.address}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> {m.rating?.toFixed(1) ?? 'No rating'} · {m.reviewCount} reviews
                      {m.website && <span className="truncate"> · {m.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>}
                    </p>
                  </div>
                  <button onClick={() => run({ placeId: m.id, name: m.name }, m.id)} disabled={starting !== null} className="btn-primary text-xs shrink-0">
                    {starting === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />} Audit
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600">No Google listing? Audit a website only</summary>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input-field !pl-9" placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} aria-label="Website to audit" />
            </div>
            <button onClick={() => run({ website: website.trim() }, 'site')} disabled={starting !== null || !website.trim()} className="btn-secondary">
              {starting === 'site' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />} Audit
            </button>
          </div>
        </details>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={saveLead} onChange={(e) => setSaveLead(e.target.checked)} className="rounded border-slate-300" />
          Also add the business to Leads
        </label>
      </div>

      {(error || pageError) && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {pageError ?? error}
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Your audits</h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
        ) : audits.length === 0 ? (
          <div className="card p-8 text-center">
            <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No audits yet. Find a business above to run your first one.</p>
          </div>
        ) : (
          <ul className="card divide-y divide-slate-100 p-0 overflow-hidden">
            {audits.map((a) => (
              <li key={a.id} className="p-4 flex items-start gap-3">
                <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center shrink-0 text-sm font-bold ${a.status === 'ready' ? gradeColor(a.grade) : 'border-slate-200 text-slate-400'}`}>
                  {a.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : a.status === 'ready' ? a.score : '!'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{a.business_name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {a.status === 'running' ? 'Auditing… usually under a minute' : a.status === 'failed' ? a.error ?? 'Failed' : `Grade ${a.grade} · ${relativeTime(a.finished_at ?? a.created_at)}`}
                    {a.lead_id && ' · added to Leads'}
                  </p>
                  {a.status === 'ready' && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                      <Link to={`/prospects/${a.id}`} className="font-medium text-sky-600 hover:underline">Open report</Link>
                      {a.share_enabled && (
                        <>
                          <button onClick={() => copy(a)} className="font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                            {copied === a.id ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy share link</>}
                          </button>
                          <a href={shareUrl(a.share_token)} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Preview
                          </a>
                        </>
                      )}
                      <button onClick={() => toggleShare(a)} className="text-slate-500 hover:text-slate-900">
                        {a.share_enabled ? 'Turn off sharing' : 'Turn on sharing'}
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => remove(a)} aria-label={`Delete the audit for ${a.business_name}`} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
