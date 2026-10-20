import { useState } from 'react';
import { AlertCircle, ExternalLink, Loader2, Send, Zap } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  ACTION_KINDS,
  DUE_OPTIONS,
  PRIORITIES,
  actionStatusInfo,
  sendAction,
  type ActionKind,
  type ActionSource,
  type ExternalAction,
  type Priority,
} from '@/lib/automations';

const toneClass = {
  slate: 'bg-slate-100 text-slate-500',
  sky: 'bg-sky-50 text-sky-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-600',
};

/** Status chips for what was already sent to the connected app, e.g. "Task created in S.Ops → open". */
export function ActionChips({ actions, appName }: { actions: ExternalAction[] | undefined; appName: string | null }) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((a) => {
        const info = actionStatusInfo(a, appName);
        const tip = [a.title, a.rule_name ? `Automation: ${a.rule_name}` : 'Sent by hand', a.app_note, a.last_error].filter(Boolean).join(' · ');
        const body = (
          <>
            <Zap className="w-3 h-3" />
            {info.label}
            {a.external_url && <ExternalLink className="w-3 h-3" />}
          </>
        );
        return a.external_url ? (
          <a key={a.id} href={a.external_url} target="_blank" rel="noopener noreferrer" title={tip} className={`badge ${toneClass[info.tone]} hover:underline`}>
            {body}
          </a>
        ) : (
          <span key={a.id} title={tip} className={`badge ${toneClass[info.tone]}`}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

/** "Send to S.Ops" button + form. Renders nothing when no app receives actions. */
export function SendToAppButton({
  appName,
  sourceType,
  sourceId,
  defaultAction = 'create_task',
  suggestedTitle,
  onSent,
  compact = false,
}: {
  appName: string | null;
  sourceType: ActionSource;
  sourceId: string;
  defaultAction?: ActionKind;
  suggestedTitle: string;
  onSent: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<ActionKind>(defaultAction);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [dueHours, setDueHours] = useState<number | null>(24);
  const [assignee, setAssignee] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!appName) return null;

  const start = () => {
    setAction(defaultAction);
    setTitle(suggestedTitle);
    setDetails('');
    setPriority('normal');
    setDueHours(defaultAction === 'create_task' ? 24 : null);
    setAssignee('');
    setError(null);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error: err } = await sendAction({ sourceType, sourceId, action, title, details, priority, dueHours, assignee });
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setOpen(false);
    onSent();
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={
          compact
            ? 'mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition-colors'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition-colors'
        }
      >
        <Send className="w-3.5 h-3.5" /> Send to {appName}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={`Send to ${appName}`} subtitle="Creates it in the connected app. Its status shows here when the app reports back.">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">What to create</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ACTION_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setAction(k.id)}
                  aria-pressed={action === k.id}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    action === k.id ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {k.noun}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="act-title" className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
            <input id="act-title" className="input-field" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="act-details" className="block text-sm font-medium text-slate-700 mb-1.5">
              Notes <span className="font-normal text-slate-400">(optional; the review or feedback text is included anyway)</span>
            </label>
            <textarea id="act-details" className="input-field min-h-[72px]" value={details} maxLength={2000} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="act-priority" className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
              <select id="act-priority" className="input-field" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="act-due" className="block text-sm font-medium text-slate-700 mb-1.5">Due</label>
              <select id="act-due" className="input-field" value={dueHours ?? ''} onChange={(e) => setDueHours(e.target.value ? Number(e.target.value) : null)}>
                {DUE_OPTIONS.map((d) => <option key={d.label} value={d.hours ?? ''}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="act-assignee" className="block text-sm font-medium text-slate-700 mb-1.5">Assign to</label>
              <input id="act-assignee" className="input-field" placeholder="Optional" value={assignee} maxLength={80} onChange={(e) => setAssignee(e.target.value)} />
            </div>
          </div>
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={sending || !title.trim()} className="btn-primary">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
