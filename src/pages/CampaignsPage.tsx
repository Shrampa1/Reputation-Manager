import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Copy, Loader2, Mail, Plus, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { STATUS_LABEL, STATUS_TONE, TEMPLATES, campaignUsage, pct, useCampaigns, type Campaign } from '@/lib/campaigns';
import { Modal } from '@/components/ui/Modal';

/** C4: email newsletters and offers to your contacts. */
export function CampaignsPage() {
  const { can, organization } = useLocationContext();
  const canSend = can('campaigns.send');
  const { campaigns, loading, error, create, remove } = useCampaigns();
  const [creating, setCreating] = useState<Campaign | 'new' | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  useEffect(() => {
    if (organization) campaignUsage(organization.id).then(setUsed).catch(() => undefined);
  }, [organization]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Email campaigns</h1>
          <p className="text-sm text-slate-500 mt-1">
            Send offers, news and reminders to your <Link to="/contacts" className="text-sky-600 hover:underline">contacts</Link>. Opens, clicks and unsubscribes are tracked.
            {used !== null && ` ${used.toLocaleString()} campaign email${used === 1 ? '' : 's'} sent this month.`}
          </p>
        </div>
        {canSend && <button type="button" onClick={() => setCreating('new')} className="btn-primary text-sm"><Plus className="w-4 h-4" /> New campaign</button>}
      </div>
      {error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load campaigns: {error}</p>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : campaigns.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <Mail className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No campaigns yet</p>
          <p className="text-sm text-slate-500">Start from an offer, a newsletter or a seasonal reminder and make it yours.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Campaign</th>
                <th className="px-4 py-2 font-medium">Recipients</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Opened</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Clicked</th>
                <th className="px-4 py-2 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/campaigns/${c.id}`} className="font-medium text-slate-900 hover:text-sky-700">{c.name}</Link>
                    <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
                      {c.status === 'scheduled' && c.scheduled_at && <span>{new Date(c.scheduled_at).toLocaleString()}</span>}
                      {c.sent_at && <span>{new Date(c.sent_at).toLocaleDateString()}</span>}
                      {c.status === 'draft' && c.subject && <span className="truncate max-w-[260px]">{c.subject}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3">{c.status === 'draft' ? '—' : c.recipients.toLocaleString()}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{c.status === 'draft' ? '—' : pct(c.opened, c.sent)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{c.status === 'draft' ? '—' : pct(c.clicked, c.sent)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canSend && (
                      <>
                        <button type="button" onClick={() => setCreating(c)} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label={`Duplicate ${c.name}`} title="Duplicate"><Copy className="w-4 h-4" /></button>
                        {!['scheduled', 'sending'].includes(c.status) && (
                          <button type="button" onClick={() => { if (window.confirm(`Delete “${c.name}”${c.status === 'sent' ? ' and its report' : ''}?`)) remove(c.id); }} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Delete ${c.name}`}><Trash2 className="w-4 h-4" /></button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateCampaignModal copyOf={creating === 'new' ? undefined : creating} onClose={() => setCreating(null)} onCreate={create} />}
    </div>
  );
}

function CreateCampaignModal({ copyOf, onClose, onCreate }: { copyOf?: Campaign; onClose: () => void; onCreate: (template: string, name: string, copyOf?: Campaign) => Promise<{ id: string }> }) {
  const navigate = useNavigate();
  const [template, setTemplate] = useState(TEMPLATES[0].id);
  const [name, setName] = useState(copyOf ? `${copyOf.name} (copy)`.slice(0, 80) : TEMPLATES[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await onCreate(template, name, copyOf);
      navigate(`/campaigns/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t create the campaign');
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title={copyOf ? 'Duplicate campaign' : 'New campaign'}>
      <form onSubmit={submit} className="space-y-3">
        {!copyOf && (
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => { setTemplate(t.id); setName(t.name); }}
                className={`rounded-xl border p-3 text-left text-sm ${template === t.id ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                <span className="font-medium">{t.name}</span>
              </button>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="nc-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name (only your team sees it)</label>
          <input id="nc-name" className="input-field" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary text-sm">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Create</button>
        </div>
      </form>
    </Modal>
  );
}
