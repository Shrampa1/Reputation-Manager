import { useState } from 'react';
import { AlertCircle, FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocationContext } from '@/context/LocationContext';
import { useAgency } from '@/lib/agency';
import {
  KIND_LABELS,
  PLACEHOLDERS,
  deleteTemplate,
  fillTemplate,
  ratingRangeLabel,
  saveTemplate,
  useReplyTemplates,
  type ReplyTemplate,
  type TemplateInput,
  type TemplateKind,
} from '@/lib/templates';

const STARTERS: TemplateInput[] = [
  { kind: 'review_reply', name: 'Thank you (5★)', min_rating: 5, max_rating: 5, body: 'Thank you so much, {first_name}! We’re thrilled you had a great experience with {business}, and we look forward to seeing you again.' },
  { kind: 'review_reply', name: 'Sorry, let’s fix it', min_rating: 1, max_rating: 3, body: 'Hi {first_name}, thank you for the honest feedback, and we’re sorry we fell short. We’d like to make it right: please contact us directly so we can sort this out. — The {business} team' },
  { kind: 'feedback_reply', name: 'Apology + call back', min_rating: 1, max_rating: 3, body: 'Hi {first_name},\n\nThank you for telling us how your experience went. I’m sorry it wasn’t what you expected. Could we call you to put it right? Just reply with a good time.\n\nThe {business} team' },
];

type Scope = { kind: 'business'; organizationId: string } | { kind: 'agency'; agencyId: string };

/** Settings → Reply templates: saved replies for this business, and agency-wide ones. */
export function TemplatesPage() {
  const { organization, location, can } = useLocationContext();
  const { agency } = useAgency();
  const { templates, loading, error, reload } = useReplyTemplates();
  const [editing, setEditing] = useState<{ scope: Scope; id?: string; input: TemplateInput } | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const canEdit = can('business.edit');

  const business = templates.filter((t) => t.organization_id === organization?.id);
  const agencyWide = templates.filter((t) => t.agency_id !== null);
  const ownAgency = agency ? agencyWide.filter((t) => t.agency_id === agency.id) : [];
  const linkedAgency = agencyWide.filter((t) => !agency || t.agency_id !== agency.id);

  const remove = async (t: ReplyTemplate) => {
    if (!window.confirm(`Delete the template “${t.name}”?`)) return;
    const { error: err } = await deleteTemplate(t.id);
    setPageError(err);
    reload();
  };

  const list = (items: ReplyTemplate[], scope: Scope | null, editable: boolean) =>
    items.length === 0 ? (
      <div className="card p-5 text-center text-sm text-slate-500">
        No templates yet.
        {editable && scope && (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {STARTERS.map((s) => (
              <button key={s.name} onClick={() => setEditing({ scope, input: { ...s } })} className="btn-secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    ) : (
      <ul className="card divide-y divide-slate-100 p-0 overflow-hidden">
        {items.map((t) => (
          <li key={t.id} className="p-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{KIND_LABELS[t.kind]} · {ratingRangeLabel(t)}</p>
              <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-line line-clamp-3">{t.body}</p>
            </div>
            {editable && scope && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing({ scope, id: t.id, input: { kind: t.kind, name: t.name, body: t.body, min_rating: t.min_rating, max_rating: t.max_rating } })}
                  aria-label={`Edit ${t.name}`}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(t)} aria-label={`Delete ${t.name}`} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    );

  const businessScope: Scope | null = organization ? { kind: 'business', organizationId: organization.id } : null;
  const agencyScope: Scope | null = agency ? { kind: 'agency', agencyId: agency.id } : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reply templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Saved replies for reviews and private feedback. Pick one in the reply window, then edit it before posting.
        </p>
      </div>

      {(error || pageError) && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {pageError ?? error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{organization?.name ?? 'This business'}</h2>
              {canEdit && businessScope && (
                <button onClick={() => setEditing({ scope: businessScope, input: { kind: 'review_reply', name: '', body: '', min_rating: null, max_rating: null } })} className="btn-secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> New template
                </button>
              )}
            </div>
            {list(business, businessScope, canEdit)}
          </section>

          {agency && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Agency-wide: {agency.name}</h2>
                  <p className="text-xs text-slate-500">Available in every business linked to your client portal.</p>
                </div>
                {agencyScope && (
                  <button onClick={() => setEditing({ scope: agencyScope, input: { kind: 'review_reply', name: '', body: '', min_rating: null, max_rating: null } })} className="btn-secondary text-xs">
                    <Plus className="w-3.5 h-3.5" /> New agency template
                  </button>
                )}
              </div>
              {list(ownAgency, agencyScope, true)}
            </section>
          )}

          {linkedAgency.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">From your agency</h2>
              {list(linkedAgency, null, false)}
            </section>
          )}
        </>
      )}

      {editing && (
        <TemplateEditor
          scope={editing.scope}
          id={editing.id}
          initial={editing.input}
          businessName={location?.name ?? organization?.name ?? 'Your business'}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function TemplateEditor({ scope, id, initial, businessName, onClose, onSaved }: {
  scope: Scope; id?: string; initial: TemplateInput; businessName: string; onClose: () => void; onSaved: () => void;
}) {
  const [input, setInput] = useState<TemplateInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<TemplateInput>) => setInput((i) => ({ ...i, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error: err } = await saveTemplate(scope.kind === 'business' ? { organizationId: scope.organizationId } : { agencyId: scope.agencyId }, input, id);
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  };

  const stars = (value: number | null, onChange: (v: number | null) => void, label: string, idAttr: string) => (
    <div>
      <label htmlFor={idAttr} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <select id={idAttr} className="input-field" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Any</option>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
      </select>
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={id ? 'Edit template' : scope.kind === 'agency' ? 'New agency template' : 'New template'} maxWidth="lg">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="tpl-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
            <input id="tpl-name" className="input-field" value={input.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} required />
          </div>
          <div>
            <label htmlFor="tpl-kind" className="block text-sm font-medium text-slate-700 mb-1.5">Used for</label>
            <select id="tpl-kind" className="input-field" value={input.kind} onChange={(e) => set({ kind: e.target.value as TemplateKind })}>
              {(Object.keys(KIND_LABELS) as TemplateKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stars(input.min_rating, (v) => set({ min_rating: v }), 'Suggest from', 'tpl-min')}
          {stars(input.max_rating, (v) => set({ max_rating: v }), 'Suggest up to', 'tpl-max')}
        </div>
        <div>
          <label htmlFor="tpl-body" className="block text-sm font-medium text-slate-700 mb-1.5">Reply</label>
          <textarea id="tpl-body" className="input-field min-h-[140px]" value={input.body} maxLength={2000} onChange={(e) => set({ body: e.target.value })} required />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PLACEHOLDERS.map((p) => (
              <button key={p.key} type="button" title={p.hint} onClick={() => set({ body: `${input.body}${input.body && !input.body.endsWith(' ') ? ' ' : ''}${p.key}` })} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-mono hover:bg-slate-200">
                {p.key}
              </button>
            ))}
          </div>
        </div>
        {input.body.trim() && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Preview</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{fillTemplate(input.body, { name: 'Sara Khan', business: businessName, rating: input.max_rating ?? input.min_rating ?? 5 })}</p>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || !input.name.trim() || !input.body.trim()} className="btn-primary">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
