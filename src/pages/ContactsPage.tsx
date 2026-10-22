import { useMemo, useState } from 'react';
import { AlertCircle, BookUser, Download, Loader2, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { cleanTags, parseContactsCsv, useContacts, type ContactRow, type ImportRow, type Suppression } from '@/lib/contacts';
import { downloadText } from '@/lib/liveChat';
import { Modal } from '@/components/ui/Modal';

type Status = 'subscribed' | 'unsubscribed' | 'bounced' | 'no_email';
const STATUS: Record<Status, { label: string; tone: string }> = {
  subscribed: { label: 'Subscribed', tone: 'bg-emerald-50 text-emerald-700' },
  unsubscribed: { label: 'Unsubscribed', tone: 'bg-slate-100 text-slate-600' },
  bounced: { label: 'Bounced', tone: 'bg-rose-50 text-rose-700' },
  no_email: { label: 'No email', tone: 'bg-slate-100 text-slate-500' },
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function statusOf(c: ContactRow, sup: Map<string, Suppression['reason']>): Status {
  if (!c.email) return 'no_email';
  const reason = c.email ? sup.get(c.email) : undefined;
  if (reason === 'bounced') return 'bounced';
  if (reason || c.do_not_contact) return 'unsubscribed';
  return 'subscribed';
}

/** C4: the people campaigns and surveys go to. Synced from a connected app, added here or imported. */
export function ContactsPage() {
  const { can } = useLocationContext();
  const canEdit = can('reviews.request');
  const { contacts, suppressions, loading, error, save, remove, importRows } = useContacts();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const sup = useMemo(() => new Map(suppressions.map((s) => [s.email, s.reason])), [suppressions]);
  const tags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contacts.filter((c) =>
      (!needle || c.name.toLowerCase().includes(needle) || c.email?.includes(needle) || c.phone?.includes(needle))
      && (!tag || c.tags.includes(tag))
      && (!status || statusOf(c, sup) === status));
  }, [contacts, q, tag, status, sup]);
  const subscribed = contacts.filter((c) => statusOf(c, sup) === 'subscribed').length;

  const exportCsv = () => {
    const cell = (v: string) => {
      const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = shown.map((c) => [c.name, c.email ?? '', c.phone ?? '', c.tags.join('; '), STATUS[statusOf(c, sup)].label].map(cell).join(','));
    downloadText('contacts.csv', ['Name,Email,Phone,Tags,Status', ...lines].join('\n'));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-1">Your customers, for email campaigns, surveys and review requests. {contacts.length > 0 && `${subscribed} of ${contacts.length} can be emailed.`}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setImporting(true)} className="btn-secondary text-sm"><Upload className="w-4 h-4" /> Import</button>
            <button type="button" onClick={() => setEditing('new')} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add contact</button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load contacts: {error}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : contacts.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <BookUser className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No contacts yet</p>
          <p className="text-sm text-slate-500">Import a CSV from your booking system or spreadsheet, add people one by one, or connect an app that syncs them.</p>
        </div>
      ) : (
        <section className="card overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-200 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className="input-field text-sm !pl-9" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
            </div>
            <select className="input-field !w-auto text-sm" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag">
              <option value="">All tags</option>
              {tags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input-field !w-auto text-sm" value={status} onChange={(e) => setStatus(e.target.value as Status | '')} aria-label="Status">
              <option value="">Any status</option>
              {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
            <button type="button" onClick={exportCsv} className="btn-secondary text-sm"><Download className="w-4 h-4" /> CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium hidden md:table-cell">Phone</th>
                  <th className="px-4 py-2 font-medium hidden sm:table-cell">Tags</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.slice(0, 500).map((c) => {
                  const st = statusOf(c, sup);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-900">{c.name}{c.source === 'api' && <span className="ml-1.5 text-[10px] text-slate-400" title="Synced from a connected app">synced</span>}</td>
                      <td className="px-4 py-2 text-slate-700">{c.email ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-700 hidden md:table-cell">{c.phone ?? ''}</td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        <span className="flex gap-1 flex-wrap">{c.tags.map((t) => <span key={t} className="text-[11px] rounded-full bg-sky-50 text-sky-700 px-1.5 py-0.5">{t}</span>)}</span>
                      </td>
                      <td className="px-4 py-2"><span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${STATUS[st].tone}`}>{STATUS[st].label}</span></td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {canEdit && (
                          <>
                            <button type="button" onClick={() => setEditing(c)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label={`Edit ${c.name}`}><Pencil className="w-4 h-4" /></button>
                            <button type="button" onClick={() => { if (window.confirm(`Delete ${c.name}?`)) remove([c.id]).catch((e) => window.alert(e.message)); }} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Delete ${c.name}`}><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
            {shown.length > 500 ? `Showing 500 of ${shown.length}. Search or filter to find someone.` : `${shown.length} contact${shown.length === 1 ? '' : 's'}`}
          </p>
        </section>
      )}
      {editing && <ContactModal contact={editing === 'new' ? null : editing} suppressed={editing !== 'new' && editing.email ? sup.get(editing.email) : undefined} onClose={() => setEditing(null)} onSave={save} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onImport={importRows} />}
    </div>
  );
}

function ContactModal({ contact, suppressed, onClose, onSave }: {
  contact: ContactRow | null;
  suppressed?: Suppression['reason'];
  onClose: () => void;
  onSave: (c: { id?: string; name: string; email: string | null; phone: string | null; tags: string[]; do_not_contact: boolean }) => Promise<unknown>;
}) {
  const [name, setName] = useState(contact?.name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [tags, setTags] = useState(contact?.tags.join(', ') ?? '');
  const [dnc, setDnc] = useState(contact?.do_not_contact ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optedOut = suppressed === 'unsubscribed' || suppressed === 'complained';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && !EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (!email.trim() && !phone.trim()) return setError('Add an email or a phone number.');
    setBusy(true);
    setError(null);
    try {
      await onSave({ id: contact?.id, name, email: email.trim() || null, phone: phone.trim() || null, tags: cleanTags(tags), do_not_contact: optedOut || dnc });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t save');
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title={contact ? 'Edit contact' : 'Add contact'}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1.5">Name</span><input className="input-field" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1.5">Email</span><input className="input-field" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1.5">Phone</span><input className="input-field" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1.5">Tags (comma separated)</span><input className="input-field" placeholder="vip, whitening" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        {optedOut ? (
          <p className="text-xs text-slate-500">This person unsubscribed, so they won’t get campaigns or surveys. Only they can opt back in.</p>
        ) : (
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="rounded border-slate-300" checked={dnc} onChange={(e) => setDnc(e.target.checked)} /> Do not email (campaigns, surveys and “Send to many” skip them)</label>
        )}
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary text-sm">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (rows: ImportRow[], tags: string[]) => Promise<{ added: number; updated: number; skipped: number; over_limit: number }> }) {
  const [text, setText] = useState('');
  const [tags, setTags] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; updated: number; skipped: number; over_limit: number } | null>(null);
  const rows = useMemo(() => parseContactsCsv(text), [text]);
  const readFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5_000_000) return setError('That file is too big (5 MB at most).');
    f.text().then(setText).catch(() => setError('Couldn’t read that file.'));
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await onImport(rows, cleanTags(tags)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t import');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title="Import contacts">
      {result ? (
        <div className="space-y-3 text-sm">
          <p className="text-slate-800"><strong>{result.added}</strong> added, <strong>{result.updated}</strong> updated{result.skipped ? `, ${result.skipped} skipped (bad or repeated email)` : ''}.</p>
          {result.over_limit > 0 && <p className="text-amber-800">{result.over_limit} weren’t added: your plan’s contact limit was reached.</p>}
          <div className="flex justify-end"><button type="button" onClick={onClose} className="btn-primary text-sm">Done</button></div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">A CSV with columns like Name, Email, Phone, Tags (any order), or paste from a spreadsheet. People already in your contacts are updated by email.</p>
          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => readFile(e.target.files?.[0])} className="text-sm" aria-label="CSV file" />
          <textarea className="input-field text-sm font-mono" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Name,Email,Phone,Tags\nMaria Lopez,maria@example.com,512 555 0142,vip'} aria-label="Contacts" />
          <label className="block"><span className="block text-sm font-medium text-slate-700 mb-1.5">Add these tags to everyone (optional)</span><input className="input-field text-sm" value={tags} placeholder="spring-2026" onChange={(e) => setTags(e.target.value)} /></label>
          {rows.length > 0 && (
            <div className="text-xs text-slate-600 rounded-lg bg-slate-50 p-2 space-y-0.5">
              <p className="font-medium">{rows.length} contact{rows.length === 1 ? '' : 's'} found, for example:</p>
              {rows.slice(0, 3).map((r) => <p key={r.email}>{r.name || '(no name)'} · {r.email}{r.phone ? ` · ${r.phone}` : ''}{r.tags?.length ? ` · ${r.tags.join(', ')}` : ''}</p>)}
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="rounded border-slate-300 mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            These are my customers, and they agreed to hear from my business by email.
          </label>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button type="button" onClick={submit} disabled={busy || !rows.length || !consent} className="btn-primary text-sm">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Import {rows.length || ''}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
