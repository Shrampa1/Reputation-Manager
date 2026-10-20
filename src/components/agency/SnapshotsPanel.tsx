import { useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Copy, Loader2, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import {
  SNAPSHOT_PARTS,
  applySnapshot,
  createSnapshot,
  deleteSnapshot,
  describeApply,
  plural,
  useSnapshots,
  type SetupSnapshot,
  type SnapshotPart,
} from '@/lib/templates';

/** Agency page: save a business's setup and copy it to other businesses in one go. */
export function SnapshotsPanel() {
  const { organization, can } = useLocationContext();
  const { snapshots, loading, reload } = useSnapshots();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<SetupSnapshot | null>(null);
  const canSave = can('business.edit') && can('integrations.manage');

  const save = async () => {
    if (!organization) return;
    setSaving(true);
    setError(null);
    const { error: err } = await createSnapshot(organization.id, name.trim() || `${organization.name} setup`);
    setSaving(false);
    if (err) setError(err);
    else {
      setName('');
      reload();
    }
  };

  const remove = async (s: SetupSnapshot) => {
    if (!window.confirm(`Delete the snapshot “${s.name}”? Businesses it was applied to keep their copies.`)) return;
    const { error: err } = await deleteSnapshot(s.id);
    setError(err);
    reload();
  };

  return (
    <section className="card p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2"><Camera className="w-4 h-4 text-violet-500" /> Setup snapshots</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Save how one business is set up (automation rules, reply templates, review request settings, widget style), then copy it to new clients in one click.
        </p>
      </div>

      {canSave && organization && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input-field flex-1" placeholder={`${organization.name} setup`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Snapshot name" />
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Save “{organization.name}” as a snapshot
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : snapshots.length === 0 ? (
        <p className="text-sm text-slate-500">No snapshots yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {snapshots.map((s) => (
            <li key={s.id} className="p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                <p className="text-xs text-slate-500">
                  From {s.source_name ?? 'a business'} · {relativeTime(s.created_at)} · {plural(s.data.automation_rules?.length ?? 0, 'rule')}, {plural(s.data.reply_templates?.length ?? 0, 'template')}
                </p>
              </div>
              <button onClick={() => setApplying(s)} className="btn-secondary text-xs shrink-0"><Copy className="w-3.5 h-3.5" /> Apply to…</button>
              <button onClick={() => remove(s)} aria-label={`Delete ${s.name}`} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {applying && <ApplyModal snapshot={applying} onClose={() => setApplying(null)} />}
    </section>
  );
}

function ApplyModal({ snapshot, onClose }: { snapshot: SetupSnapshot; onClose: () => void }) {
  const { memberships } = useLocationContext();
  const targets = memberships.filter((m) => m.role === 'owner' || m.role === 'admin' || m.role === 'superadmin');
  const [orgs, setOrgs] = useState<string[]>([]);
  const [parts, setParts] = useState<SnapshotPart[]>(['automations', 'templates', 'review_settings', 'widget']);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; text: string }[] | null>(null);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const apply = async () => {
    setRunning(true);
    const out: { name: string; ok: boolean; text: string }[] = [];
    for (const id of orgs) {
      const name = targets.find((t) => t.id === id)?.name ?? 'Business';
      const { result, error } = await applySnapshot(snapshot.id, id, parts);
      out.push(error || !result ? { name, ok: false, text: error ?? 'Failed' } : { name, ok: true, text: describeApply(result) });
    }
    setResults(out);
    setRunning(false);
  };

  return (
    <Modal isOpen onClose={() => !running && onClose()} title={`Apply “${snapshot.name}”`} subtitle="Adds what's missing. Nothing in those businesses is deleted." maxWidth="lg">
      {results ? (
        <div className="space-y-3">
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.name} className="flex items-start gap-2 text-sm">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                <span><span className="font-medium text-slate-900">{r.name}:</span> <span className="text-slate-600">{r.text}</span></span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end"><button onClick={onClose} className="btn-primary">Done</button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-1.5">Copy</legend>
            <div className="space-y-1.5">
              {SNAPSHOT_PARTS.map((p) => (
                <label key={p.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 rounded border-slate-300" checked={parts.includes(p.id)} onChange={() => setParts(toggle(parts, p.id))} />
                  <span><span className="text-slate-900">{p.label}</span> <span className="text-xs text-slate-500">· {p.hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-1.5">To these businesses</legend>
            {targets.length === 0 ? (
              <p className="text-sm text-slate-500">You need to be an owner or admin of another business.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {targets.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="rounded border-slate-300" checked={orgs.includes(t.id)} onChange={() => setOrgs(toggle(orgs, t.id))} />
                    {t.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={apply} disabled={running || orgs.length === 0 || parts.length === 0} className="btn-primary">
              {running && <Loader2 className="w-4 h-4 animate-spin" />} Apply to {orgs.length || ''} business{orgs.length === 1 ? '' : 'es'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
