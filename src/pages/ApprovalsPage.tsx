import { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ClipboardCheck, Loader2, MessageSquareWarning, Pencil } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { StarRating } from '@/components/ui/StarRating';
import { relativeTime } from '@/lib/activity';
import {
  APPROVAL_BADGE,
  respondToApproval,
  saveApprovalSettings,
  useApprovalQueue,
  useApprovalSettings,
  type ApprovalStatus,
} from '@/lib/approvals';

const PLATFORM_NAMES: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', google: 'Google', tiktok: 'TikTok' };

/** Approvals: the client approves the agency's posts and review replies before they go out. */
export function ApprovalsPage() {
  const { organization, can, isClient } = useLocationContext();
  const { settings, loaded, reload: reloadSettings } = useApprovalSettings();
  const { posts, replies, loading, error, reload } = useApprovalQueue();
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const canRespond = can('approvals.respond');
  const canConfigure = can('business.edit') && !isClient;

  const toggle = async (key: 'posts' | 'replies') => {
    if (!organization) return;
    setSaving(true);
    const { error: err } = await saveApprovalSettings(organization.id, { ...settings, [key]: !settings[key] });
    setPageError(err);
    setSaving(false);
    reloadSettings();
    reload();
  };

  const waiting = posts.filter((p) => p.approval_status === 'pending').length + replies.filter((r) => r.reply_approval_status === 'pending').length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">
          {isClient
            ? 'Posts and review replies your agency prepared for you. Approve them, edit them, or ask for changes.'
            : 'When approvals are on, posts and review replies wait for the client’s OK before they go out.'}
        </p>
      </div>

      {canConfigure && loaded && (
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-900">Require client approval for</p>
          {(['posts', 'replies'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="rounded border-slate-300" checked={settings[k]} disabled={saving} onChange={() => toggle(k)} />
              {k === 'posts' ? 'Social posts (nothing publishes until approved)' : 'Review replies (marked replied once approved)'}
            </label>
          ))}
          <p className="text-xs text-slate-500">Clients approve on this page in their portal. Turning a switch off releases anything still waiting.</p>
        </div>
      )}

      {(error || pageError) && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {pageError ?? error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>
      ) : posts.length === 0 && replies.length === 0 ? (
        <div className="card p-8 text-center">
          <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Nothing waiting for approval.</p>
        </div>
      ) : (
        <>
          {waiting > 0 && <p className="text-sm text-slate-600">{waiting} item{waiting === 1 ? '' : 's'} waiting for approval.</p>}
          {posts.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Posts</h2>
              {posts.map((p) => (
                <ApprovalCard
                  key={p.id}
                  kind="post"
                  id={p.id}
                  status={p.approval_status}
                  note={p.approval_note}
                  canRespond={canRespond}
                  title={`${PLATFORM_NAMES[p.platform] ?? p.platform} post${p.scheduled_for ? ` · scheduled ${new Date(p.scheduled_for).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}`}
                  text={p.content}
                  media={p.media_url && p.media_type !== 'video' ? p.media_url : null}
                  meta={`Updated ${relativeTime(p.updated_at)}`}
                  onDone={reload}
                />
              ))}
            </section>
          )}
          {replies.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">Review replies</h2>
              {replies.map((r) => (
                <ApprovalCard
                  key={r.id}
                  kind="reply"
                  id={r.id}
                  status={r.reply_approval_status}
                  note={r.reply_approval_note}
                  canRespond={canRespond}
                  title={`Reply to ${r.author_name}’s ${PLATFORM_NAMES[r.platform] ?? r.platform} review`}
                  quote={{ rating: r.rating, text: r.content }}
                  text={r.ai_reply_draft ?? ''}
                  meta={r.reply_proposed_by ? `Written by ${r.reply_proposed_by}${r.reply_proposed_at ? ` · ${relativeTime(r.reply_proposed_at)}` : ''}` : ''}
                  onDone={reload}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ApprovalCard({ kind, id, status, note, canRespond, title, text, media, quote, meta, onDone }: {
  kind: 'post' | 'reply'; id: string; status: ApprovalStatus; note: string | null; canRespond: boolean; title: string; text: string;
  media?: string | null; quote?: { rating: number; text: string }; meta: string; onDone: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'changes'>('view');
  const [draft, setDraft] = useState(text);
  const [changes, setChanges] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badge = APPROVAL_BADGE[status];

  const act = async (decision: 'approve' | 'request_changes') => {
    setBusy(true);
    setError(null);
    const { error: err } = await respondToApproval(kind, id, decision, decision === 'request_changes' ? changes : undefined, decision === 'approve' && mode === 'edit' ? draft : undefined);
    setBusy(false);
    if (err) setError(err);
    else onDone();
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className={`badge ${badge.className}`}>{badge.label}</span>
      </div>
      {quote && (
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <StarRating rating={quote.rating} size="sm" />
          <p className="text-sm text-slate-600 mt-1">{quote.text || '(no written review)'}</p>
        </div>
      )}
      {mode === 'edit' ? (
        <textarea className="input-field min-h-[120px]" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit before approving" />
      ) : (
        <p className="text-sm text-slate-800 whitespace-pre-line">{text}</p>
      )}
      {media && <img src={media} alt="" className="max-h-56 rounded-xl border border-slate-200 object-cover" />}
      {status === 'changes_requested' && note && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-2.5 flex gap-2">
          <MessageSquareWarning className="w-4 h-4 shrink-0 mt-0.5" /> {note}
        </p>
      )}
      {meta && <p className="text-xs text-slate-400">{meta}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {canRespond && status === 'pending' && (
        mode === 'changes' ? (
          <div className="space-y-2">
            <textarea className="input-field min-h-[70px]" placeholder="What should change?" value={changes} onChange={(e) => setChanges(e.target.value)} aria-label="What should change" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setMode('view')} className="btn-secondary text-sm">Cancel</button>
              <button onClick={() => act('request_changes')} disabled={busy || !changes.trim()} className="btn-primary text-sm">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => act('approve')} disabled={busy || (mode === 'edit' && !draft.trim())} className="btn-primary text-sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'edit' ? <Check className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              {mode === 'edit' ? 'Save & approve' : 'Approve'}
            </button>
            {mode === 'view' && <button onClick={() => setMode('edit')} className="btn-secondary text-sm"><Pencil className="w-4 h-4" /> Edit</button>}
            {mode === 'edit' && <button onClick={() => { setMode('view'); setDraft(text); }} className="btn-secondary text-sm">Cancel edit</button>}
            <button onClick={() => setMode('changes')} className="btn-secondary text-sm"><MessageSquareWarning className="w-4 h-4" /> Ask for changes</button>
          </div>
        )
      )}
    </div>
  );
}
