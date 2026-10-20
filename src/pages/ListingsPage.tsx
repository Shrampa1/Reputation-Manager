import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, ListChecks, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import { DIRECTORIES, cityOf, removeManualListing, runListingsCheck, saveManualListing, useListings, type Directory, type Listing } from '@/lib/listings';
import { compareListing, type FieldResult, type NapField } from '@/lib/nap';

const FIELD_LABEL: Record<NapField, string> = { name: 'Name', address: 'Address', phone: 'Phone', website: 'Website' };

/** Phase B3: are the business's name, address, phone and website the same everywhere? */
export function ListingsPage() {
  const { location, can } = useLocationContext();
  const { listings, loading, error, reload } = useListings();
  const [checking, setChecking] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Directory | null>(null);
  const canEdit = can('business.edit');
  const canCheck = can('seo.audit');

  const truth = useMemo(() => ({ name: location?.name ?? null, address: location?.address ?? null, phone: location?.phone ?? null, website: location?.website ?? null }), [location]);
  const byDir = useMemo(() => new Map(listings.map((l) => [l.directory, l])), [listings]);
  const rows = DIRECTORIES.map((d) => {
    const l = byDir.get(d.id);
    const cmp = l && l.status === 'listed' ? compareListing(truth, l) : null;
    return { d, l, cmp };
  });
  const checked = rows.filter((r) => r.l && r.l.status === 'listed');
  const consistent = checked.filter((r) => r.cmp?.consistent).length;
  const score = checked.length ? Math.round((consistent / checked.length) * 100) : null;

  const check = async () => {
    setChecking(true);
    setPageError(null);
    try {
      await runListingsCheck();
      await reload();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Listings check</h1>
          <p className="text-sm text-slate-500 mt-1">
            Google trusts businesses whose name, address and phone match everywhere. Differences cost rankings and confuse customers.
          </p>
        </div>
        {canCheck && (
          <button onClick={check} disabled={checking} className="btn-primary text-sm">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check Google, website & Facebook
          </button>
        )}
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
        <div className="text-center sm:pr-4 sm:border-r border-slate-100">
          <p className="text-3xl font-bold text-slate-900">{score === null ? '–' : `${score}%`}</p>
          <p className="text-xs text-slate-500">{checked.length ? `${consistent} of ${checked.length} listings consistent` : 'Not checked yet'}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium text-slate-900">Your details of record</p>
          <p className="text-slate-600">{[truth.name, truth.address, truth.phone, truth.website].filter(Boolean).join(' · ') || 'Add your business details in Settings first.'}</p>
          <Link to="/settings" className="text-xs text-sky-600 hover:underline">Edit in Settings</Link>
        </div>
      </div>

      {(error || pageError) && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {pageError ?? error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : (
        <ul className="card divide-y divide-slate-100 p-0 overflow-hidden">
          {rows.map(({ d, l, cmp }) => (
            <li key={d.id} className="p-4 flex items-start gap-3">
              <StatusIcon listing={l} consistent={cmp?.consistent} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                  {d.auto && <span className="badge bg-slate-100 text-slate-500">checked automatically</span>}
                  {l?.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 hover:underline inline-flex items-center gap-0.5">View <ExternalLink className="w-3 h-3" /></a>}
                </div>
                {!l ? (
                  <p className="text-xs text-slate-500 mt-0.5">{d.auto ? 'Not checked yet.' : 'Not checked yet. Look the business up and record what the listing shows.'}</p>
                ) : l.status === 'not_listed' ? (
                  <p className="text-xs text-amber-700 mt-0.5">Not listed{l.note ? `: ${l.note}` : ''}{d.manage ? '. ' : ''}{d.manage && <a href={d.manage} target="_blank" rel="noopener noreferrer" className="underline">Create the listing</a>}</p>
                ) : l.status === 'error' ? (
                  <p className="text-xs text-rose-600 mt-0.5">{l.note ?? 'Couldn’t be checked.'}</p>
                ) : cmp && (
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                    {(Object.keys(FIELD_LABEL) as NapField[]).map((f) => (
                      <FieldLine key={f} label={FIELD_LABEL[f]} result={cmp.results[f]} value={l[f]} />
                    ))}
                    {l.note && <p className="sm:col-span-2 text-amber-700">{l.note}</p>}
                  </div>
                )}
                {l && <p className="text-[11px] text-slate-400 mt-1">Checked {relativeTime(l.checked_at)}{l.source === 'manual' ? ' by hand' : ''}</p>}
                {cmp && !cmp.consistent && d.manage && (
                  <a href={d.manage} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sky-600 hover:underline">Fix it on {d.name}</a>
                )}
              </div>
              {!d.auto && (
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {d.search && (
                    <a href={d.search(truth.name ?? '', cityOf(truth.address))} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs"><Search className="w-3.5 h-3.5" /> Look up</a>
                  )}
                  {canEdit && <button onClick={() => setEditing(d)} className="btn-secondary text-xs">{l ? 'Update' : 'Record'}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && location && (
        <ManualListingModal
          directory={editing}
          existing={byDir.get(editing.id) ?? null}
          truth={truth}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          locationId={location.id}
        />
      )}
    </div>
  );
}

function StatusIcon({ listing, consistent }: { listing?: Listing; consistent?: boolean }) {
  if (!listing) return <CircleDashed className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />;
  if (listing.status === 'not_listed') return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />;
  if (listing.status === 'error') return <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />;
  return consistent ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />;
}

function FieldLine({ label, result, value }: { label: string; result: FieldResult; value: string | null }) {
  const cls = result === 'match' ? 'text-slate-600' : result === 'mismatch' ? 'text-rose-600 font-medium' : 'text-slate-400';
  return (
    <p className={cls}>
      {label}: {value ?? 'not shown'}{result === 'mismatch' && ' (differs)'}
    </p>
  );
}

function ManualListingModal({ directory, existing, truth, locationId, onClose, onSaved }: {
  directory: Directory; existing: Listing | null; truth: Record<NapField, string | null>; locationId: string; onClose: () => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState<'listed' | 'not_listed'>(existing?.status === 'not_listed' ? 'not_listed' : 'listed');
  const [form, setForm] = useState({
    url: existing?.url ?? '', name: existing?.name ?? truth.name ?? '', address: existing?.address ?? truth.address ?? '',
    phone: existing?.phone ?? truth.phone ?? '', website: existing?.website ?? truth.website ?? '', note: existing?.note ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error: err } = await saveManualListing(locationId, directory.id, status === 'listed'
      ? { status, url: form.url, name: form.name, address: form.address, phone: form.phone, website: form.website, note: form.note || null }
      : { status, url: null, name: null, address: null, phone: null, website: null, note: form.note || null });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  };
  const remove = async () => {
    if (!existing) return;
    const { error: err } = await removeManualListing(existing.id);
    if (err) setError(err);
    else onSaved();
  };

  return (
    <Modal isOpen onClose={onClose} title={directory.name} subtitle="Record what the listing shows. Fields start with your details; change anything that's different there." maxWidth="lg">
      <form onSubmit={save} className="space-y-3">
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" checked={status === 'listed'} onChange={() => setStatus('listed')} /> Listed</label>
          <label className="flex items-center gap-1.5"><input type="radio" checked={status === 'not_listed'} onChange={() => setStatus('not_listed')} /> Not listed</label>
        </div>
        {status === 'listed' && (
          <>
            <input className="input-field" placeholder="Listing link (https://…)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} aria-label="Listing link" />
            {(['name', 'address', 'phone', 'website'] as NapField[]).map((f) => (
              <div key={f}>
                <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor={`ml-${f}`}>{FIELD_LABEL[f]} on {directory.name}</label>
                <input id={`ml-${f}`} className="input-field" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
              </div>
            ))}
          </>
        )}
        <input className="input-field" placeholder="Note (optional)" maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-label="Note" />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-between gap-2">
          {existing ? <button type="button" onClick={remove} className="btn-ghost text-sm text-rose-600">Remove</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1"><ListChecks className="w-3 h-3" /> Tip: use the Look up button, then copy what the listing shows.</p>
      </form>
    </Modal>
  );
}
