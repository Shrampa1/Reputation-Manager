import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Pencil, Plus, Trash2, Workflow, Zap } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import {
  ACTION_KINDS,
  DUE_OPTIONS,
  PRIORITIES,
  RULE_TEMPLATES,
  TRIGGERS,
  actionNoun,
  actionStatusInfo,
  deleteRule,
  previewTitle,
  saveRule,
  setRuleEnabled,
  useActionApp,
  useAutomations,
  type AutomationRule,
  type RuleInput,
} from '@/lib/automations';

const toneClass = {
  slate: 'bg-slate-100 text-slate-500',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-600',
};

function ratingText(r: Pick<AutomationRule, 'min_rating' | 'max_rating'>) {
  if (r.min_rating && r.max_rating) return r.min_rating === r.max_rating ? `${r.min_rating}★` : `${r.min_rating}–${r.max_rating}★`;
  if (r.max_rating) return `${r.max_rating}★ or lower`;
  if (r.min_rating) return r.min_rating === 5 ? '5★' : `${r.min_rating}★ or higher`;
  return null;
}

function ruleSummary(r: AutomationRule | RuleInput, appName: string) {
  const trigger = TRIGGERS.find((t) => t.id === r.trigger)?.label ?? r.trigger;
  const rating = TRIGGERS.find((t) => t.id === r.trigger)?.rated ? ratingText(r) : null;
  const words = r.keywords.length ? ` mentioning “${r.keywords.join('”, “')}”` : '';
  const what = ACTION_KINDS.find((k) => k.id === r.action)?.label.toLowerCase() ?? r.action;
  return `When ${trigger.toLowerCase()}${rating ? ` (${rating})` : ''}${words} → ${what} in ${appName}`;
}

const EMPTY_RULE: RuleInput = RULE_TEMPLATES[0].rule;

const toInput = (r: AutomationRule): RuleInput => ({
  name: r.name, enabled: r.enabled, trigger: r.trigger, min_rating: r.min_rating, max_rating: r.max_rating, keywords: r.keywords,
  action: r.action, title: r.title, priority: r.priority, due_hours: r.due_hours, assignee: r.assignee,
});

export function AutomationsPage() {
  const { organization } = useLocationContext();
  const { appName, loaded } = useActionApp();
  const { rules, actions, loading, error, reload } = useAutomations();
  const [editing, setEditing] = useState<{ id?: string; rule: RuleInput } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const app = appName ?? 'your app';

  const toggle = async (r: AutomationRule) => {
    setBusy(r.id);
    const { error: err } = await setRuleEnabled(r.id, !r.enabled);
    setPageError(err);
    setBusy(null);
    reload();
  };

  const remove = async (r: AutomationRule) => {
    if (!window.confirm(`Delete the automation “${r.name}”? Tasks it already created stay in ${app}.`)) return;
    setBusy(r.id);
    const { error: err } = await deleteRule(r.id);
    setPageError(err);
    setBusy(null);
    reload();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Automations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Turn reviews, feedback and leads into tasks, leads and projects in {app}. Progress reported by {app} shows next to each item.
          </p>
        </div>
        <button onClick={() => setEditing({ rule: { ...EMPTY_RULE } })} className="btn-primary">
          <Plus className="w-4 h-4" /> New automation
        </button>
      </div>

      {loaded && (
        appName ? (
          <div className="card p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-slate-900">Connected to {appName}</p>
              <p className="text-slate-500 mt-0.5">
                {appName} receives actions through its webhook. You can also send any review, private feedback or lead by hand with the “Send to {appName}” button.
              </p>
            </div>
          </div>
        ) : (
          <div className="card p-4 flex items-start gap-3 border-amber-200 bg-amber-50/50">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900">No app receives actions yet</p>
              <p className="mt-0.5">
                In S.Ops, open the Reputation tab and click <strong>Register again</strong> once S.Ops supports actions. For another app, add a webhook
                with the <strong>Action requested</strong> event in <Link to="/integrations" className="text-sky-600 hover:underline">Integrations → API &amp; webhooks</Link>.
                Rules you create now start working as soon as an app is connected.
              </p>
            </div>
          </div>
        )
      )}

      {(error || pageError) && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {pageError ?? error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Rules</h2>
            {rules.length === 0 ? (
              <div className="card p-6 text-center">
                <Workflow className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">No automations yet. Start from one of these:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {RULE_TEMPLATES.map((t) => (
                    <button key={t.key} onClick={() => setEditing({ rule: { ...t.rule } })} className="btn-secondary text-xs">
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="card divide-y divide-slate-100 p-0 overflow-hidden">
                {rules.map((r) => (
                  <li key={r.id} className="p-4 flex items-start gap-3">
                    <button
                      role="switch"
                      aria-checked={r.enabled}
                      aria-label={`${r.enabled ? 'Turn off' : 'Turn on'} ${r.name}`}
                      onClick={() => toggle(r)}
                      disabled={busy === r.id}
                      className={`relative mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors ${r.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${r.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold ${r.enabled ? 'text-slate-900' : 'text-slate-400'}`}>{r.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{ruleSummary(r, app)}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {r.fired_count ? `Ran ${r.fired_count} time${r.fired_count === 1 ? '' : 's'}, last ${relativeTime(r.last_fired_at!)}` : 'Hasn’t run yet'}
                        {r.assignee && ` · assigned to ${r.assignee}`}
                        {r.priority !== 'normal' && ` · ${r.priority} priority`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditing({ id: r.id, rule: toInput(r) })}
                        aria-label={`Edit ${r.name}`}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(r)}
                        disabled={busy === r.id}
                        aria-label={`Delete ${r.name}`}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Recently sent to {app}</h2>
            {actions.length === 0 ? (
              <div className="card p-6 text-center text-sm text-slate-500">Nothing sent yet.</div>
            ) : (
              <ul className="card divide-y divide-slate-100 p-0 overflow-hidden">
                {actions.map((a) => {
                  const info = actionStatusInfo(a, appName);
                  return (
                    <li key={a.id} className="p-4 flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-50 text-violet-600 shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">{a.title}</p>
                          <span className={`badge ${toneClass[info.tone]}`}>{info.label}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {actionNoun(a.action)} · {a.rule_name ? `automation “${a.rule_name}”` : 'sent by hand'} · {relativeTime(a.created_at)}
                          {a.external_id && ` · #${a.external_id}`}
                        </p>
                        {a.app_note && <p className="text-xs text-slate-600 mt-1">{a.app_note}</p>}
                        {a.status === 'failed' && a.last_error && <p className="text-xs text-rose-600 mt-1">{a.last_error}</p>}
                      </div>
                      {a.external_url && (
                        <a href={a.external_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sky-600 hover:underline inline-flex items-center gap-1 shrink-0">
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {editing && organization && (
        <RuleEditor
          organizationId={organization.id}
          appName={app}
          initial={editing.rule}
          id={editing.id}
          showTemplates={!editing.id}
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

function RuleEditor({
  organizationId,
  appName,
  initial,
  id,
  showTemplates,
  onClose,
  onSaved,
}: {
  organizationId: string;
  appName: string;
  initial: RuleInput;
  id?: string;
  showTemplates: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rule, setRule] = useState<RuleInput>(initial);
  const [keywords, setKeywords] = useState(initial.keywords.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = TRIGGERS.find((t) => t.id === rule.trigger)!;
  const set = (patch: Partial<RuleInput>) => setRule((r) => ({ ...r, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error: err } = await saveRule(organizationId, { ...rule, keywords: keywords.split(',') }, id);
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  };

  const ratingSelect = (value: number | null, onChange: (v: number | null) => void, label: string, idAttr: string) => (
    <div>
      <label htmlFor={idAttr} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <select id={idAttr} className="input-field" value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Any</option>
        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
      </select>
    </div>
  );

  return (
    <Modal isOpen onClose={onClose} title={id ? 'Edit automation' : 'New automation'} maxWidth="lg">
      <form onSubmit={save} className="space-y-4">
        {showTemplates && (
          <div className="flex flex-wrap gap-1.5">
            {RULE_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setRule({ ...t.rule });
                  setKeywords(t.rule.keywords.join(', '));
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="rule-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
          <input id="rule-name" className="input-field" value={rule.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="rule-trigger" className="block text-sm font-medium text-slate-700 mb-1.5">When</label>
          <select id="rule-trigger" className="input-field" value={rule.trigger} onChange={(e) => set({ trigger: e.target.value as RuleInput['trigger'] })}>
            {TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <p className="text-xs text-slate-400 mt-1">{trigger.hint}</p>
        </div>
        {trigger.rated && (
          <div className="grid grid-cols-2 gap-3">
            {ratingSelect(rule.min_rating, (v) => set({ min_rating: v }), 'Lowest rating', 'rule-min')}
            {ratingSelect(rule.max_rating, (v) => set({ max_rating: v }), 'Highest rating', 'rule-max')}
          </div>
        )}
        <div>
          <label htmlFor="rule-keywords" className="block text-sm font-medium text-slate-700 mb-1.5">
            Only if the text mentions <span className="font-normal text-slate-400">(optional, comma-separated)</span>
          </label>
          <input id="rule-keywords" className="input-field" placeholder="late, price, rude" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="rule-action" className="block text-sm font-medium text-slate-700 mb-1.5">Then, in {appName}</label>
            <select id="rule-action" className="input-field" value={rule.action} onChange={(e) => set({ action: e.target.value as RuleInput['action'] })}>
              {ACTION_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rule-assignee" className="block text-sm font-medium text-slate-700 mb-1.5">Assign to</label>
            <input id="rule-assignee" className="input-field" placeholder="Optional, e.g. Ali" value={rule.assignee} maxLength={80} onChange={(e) => set({ assignee: e.target.value })} />
          </div>
        </div>
        <div>
          <label htmlFor="rule-title" className="block text-sm font-medium text-slate-700 mb-1.5">
            Title <span className="font-normal text-slate-400">(optional; use {'{name}'}, {'{rating}'}, {'{platform}'})</span>
          </label>
          <input id="rule-title" className="input-field" placeholder="Unhappy client: {name} ({rating}★)" value={rule.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} />
          {rule.title && <p className="text-xs text-slate-400 mt-1">Example: {previewTitle(rule.title)}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rule-priority" className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
            <select id="rule-priority" className="input-field" value={rule.priority} onChange={(e) => set({ priority: e.target.value as RuleInput['priority'] })}>
              {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="rule-due" className="block text-sm font-medium text-slate-700 mb-1.5">Due</label>
            <select id="rule-due" className="input-field" value={rule.due_hours ?? ''} onChange={(e) => set({ due_hours: e.target.value ? Number(e.target.value) : null })}>
              {DUE_OPTIONS.map((d) => <option key={d.label} value={d.hours ?? ''}>{d.label}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-50">{ruleSummary({ ...rule, keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) }, appName)}. Each review, request or lead triggers a rule at most once.</p>
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || !rule.name.trim()} className="btn-primary">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {id ? 'Save' : 'Create automation'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
