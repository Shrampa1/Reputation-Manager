import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ClipboardList, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { PRESETS, publicFormUrl, useLeadForms } from '@/lib/leadForms';
import { Modal } from '@/components/ui/Modal';

/** C2: lead forms and landing pages. Every submission becomes a lead. */
export function LeadFormsPage() {
  const { can } = useLocationContext();
  const canEdit = can('leads.manage');
  const { forms, loading, error, create, remove } = useLeadForms();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lead forms</h1>
          <p className="text-sm text-slate-500 mt-1">
            Forms with their own landing page, or embedded on your website. Every submission becomes a <Link to="/leads" className="text-sky-600 hover:underline">lead</Link> and runs your automations.
          </p>
        </div>
        {canEdit && <button type="button" onClick={() => setCreating(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> New form</button>}
      </div>
      {error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load forms: {error}</p>}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : forms.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No forms yet</p>
          <p className="text-sm text-slate-500">Start from a quote request, call-back or booking form and change anything.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Form</th>
                <th className="px-4 py-2 font-medium">Views</th>
                <th className="px-4 py-2 font-medium">Leads</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Conversion</th>
                <th className="px-4 py-2 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/forms/${f.id}`} className="font-medium text-slate-900 hover:text-sky-700">{f.name}</Link>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <span className={`inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium ${f.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{f.status === 'published' ? 'Live' : 'Draft'}</span>
                      /f/{f.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3">{f.views.toLocaleString()}</td>
                  <td className="px-4 py-3">{f.submissions.toLocaleString()}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{f.views ? `${Math.round((f.submissions / f.views) * 100)}%` : '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {f.status === 'published' && (
                      <a href={publicFormUrl(f.slug)} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-slate-700 inline-flex" aria-label={`Open ${f.name}`}><ExternalLink className="w-4 h-4" /></a>
                    )}
                    {canEdit && (
                      <button type="button" onClick={() => { if (window.confirm(`Delete “${f.name}” and its submissions? Leads it created stay.`)) remove(f.id); }} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Delete ${f.name}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <CreateFormModal onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}

function CreateFormModal({ onClose, onCreate }: { onClose: () => void; onCreate: (preset: string, name: string) => Promise<{ id: string }> }) {
  const navigate = useNavigate();
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [name, setName] = useState(PRESETS[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const f = await onCreate(preset, name);
      navigate(`/forms/${f.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t create the form');
      setBusy(false);
    }
  };
  return (
    <Modal isOpen onClose={onClose} title="New lead form">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setPreset(p.id); setName(p.name); }}
              className={`rounded-xl border p-3 text-left text-sm ${preset === p.id ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
            >
              <span className="font-medium">{p.name}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{p.fields.length} fields</span>
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="nf-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name (only your team sees it)</label>
          <input id="nf-name" className="input-field" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
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
