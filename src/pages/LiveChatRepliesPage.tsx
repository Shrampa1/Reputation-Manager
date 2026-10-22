import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { useCannedResponses, type CannedResponse } from '@/lib/liveChat';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';

const EMPTY = { shortcut: '', body: '' };

/** W1: saved replies. Type /shortcut in the inbox reply box to insert one. */
export function LiveChatRepliesPage() {
  const { can } = useLocationContext();
  const canEdit = can('chat.reply');
  const { items, loading, save, remove } = useCannedResponses();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const shortcut = form.shortcut.trim().replace(/^\/+/, '').toLowerCase();
    if (!/^[a-z0-9_-]{1,30}$/.test(shortcut)) return setError('Shortcuts are one word: letters, numbers, - or _ (up to 30).');
    setBusy(true);
    setError(null);
    const err = await save({ shortcut, body: form.body }, editing ?? undefined);
    setBusy(false);
    if (err) return setError(err);
    setForm(EMPTY);
    setEditing(null);
  };

  const edit = (c: CannedResponse) => {
    setEditing(c.id);
    setForm({ shortcut: c.shortcut, body: c.body });
    setError(null);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <LiveChatHeader subtitle="Answers you send often. In the inbox, type / and the shortcut to insert one." />
      {canEdit && (
        <form onSubmit={submit} className="card p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-900">{editing ? 'Edit saved reply' : 'New saved reply'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
            <div>
              <label htmlFor="cr-short" className="block text-sm font-medium text-slate-700 mb-1.5">Shortcut</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">/</span>
                <input id="cr-short" className="input-field !pl-6 text-sm" placeholder="prices" maxLength={31} value={form.shortcut} onChange={(e) => setForm({ ...form, shortcut: e.target.value })} required />
              </div>
            </div>
            <div>
              <label htmlFor="cr-body" className="block text-sm font-medium text-slate-700 mb-1.5">Reply</label>
              <textarea id="cr-body" className="input-field text-sm" rows={3} maxLength={2000} placeholder="Teeth whitening is $350 and takes about an hour…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
            </div>
          </div>
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary text-sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {editing ? 'Save changes' : 'Add reply'}
            </button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY); }} className="btn-secondary text-sm">Cancel</button>}
          </div>
        </form>
      )}
      <section className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500 p-5 flex items-center gap-2"><Zap className="w-4 h-4 text-slate-400" /> No saved replies yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((c) => (
              <li key={c.id} className="p-4 flex gap-3">
                <span className="text-sm font-semibold text-sky-700 shrink-0 w-32 truncate">/{c.shortcut}</span>
                <p className="text-sm text-slate-700 flex-1 whitespace-pre-wrap">{c.body}</p>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => edit(c)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label={`Edit /${c.shortcut}`}><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => remove(c.id)} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Delete /${c.shortcut}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
