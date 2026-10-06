import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocationContext } from '@/context/LocationContext';
import { FunctionCallError } from '@/lib/functions';
import { sendReviewRequest } from '@/lib/reviewRequests';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ReviewRequestModal({
  isOpen,
  onClose,
  initialName = '',
  initialEmail = '',
  leadId = null,
  onSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  initialEmail?: string;
  /** Moves this lead to "Review Requested" once the email is sent */
  leadId?: string | null;
  onSent: (message: string) => void;
}) {
  const { location, isAdmin } = useLocationContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatWarning, setRepeatWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialName);
    setEmail(initialEmail);
    setNote('');
    setError(null);
    setRepeatWarning(null);
    setSending(false);
  }, [isOpen, initialName, initialEmail]);

  const hasReviewLink = Boolean(location?.review_link);
  const shield = location?.review_shield_enabled ?? true;

  const submit = async (allowRepeat = false) => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) return setError('Enter the customer’s name.');
    if (!EMAIL_RE.test(trimmedEmail)) return setError('Enter a valid email address.');
    setSending(true);
    setError(null);
    try {
      await sendReviewRequest({ name: trimmedName, email: trimmedEmail, note: note.trim(), leadId, allowRepeat });
      onSent(`Review request emailed to ${trimmedName}`);
      onClose();
    } catch (err) {
      if (err instanceof FunctionCallError && err.payload?.code === 'recently_requested') {
        setRepeatWarning(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Couldn’t send the request');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Review Request" subtitle="Email a customer asking about their experience" maxWidth="md">
      {!hasReviewLink ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Add your review link first</p>
              <p className="mt-1">
                Customers need somewhere to leave their review, usually your Google Business Profile.
                {isAdmin ? ' Add the link in Settings, then come back.' : ' Ask an owner or admin to add it in Settings.'}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Link to="/settings#review-requests" onClick={onClose} className="btn-primary w-full">
              Open Settings
            </Link>
          )}
        </div>
      ) : (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="rr-name" className="block text-sm font-semibold text-slate-900 mb-1.5">Customer name</label>
              <input id="rr-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="off" className="input-field" placeholder="Jane Smith" />
            </div>
            <div>
              <label htmlFor="rr-email" className="block text-sm font-semibold text-slate-900 mb-1.5">Email</label>
              <input
                id="rr-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setRepeatWarning(null);
                }}
                autoComplete="off"
                className="input-field"
                placeholder="jane@example.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rr-note" className="block text-sm font-semibold text-slate-900 mb-1.5">
              Personal note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="rr-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={600}
              className="input-field resize-none text-sm"
              placeholder={`Thanks for choosing ${location?.name ?? 'us'}! We'd love to hear how we did. It only takes a minute.`}
            />
            <p className="text-xs text-slate-400 mt-1">Leave blank to use the message shown. A “Rate us” button is added below it.</p>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
            <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${shield ? 'text-emerald-600' : 'text-slate-400'}`} />
            <p className="text-xs text-slate-600 leading-relaxed">
              {shield ? (
                <>
                  <span className="font-semibold text-slate-900">Feedback Shield is on.</span> Customers rate you first. 4–5 stars go
                  straight to your review page; 1–3 stars are invited to tell you privately what went wrong, and can still post publicly.
                </>
              ) : (
                <>
                  <span className="font-semibold text-slate-900">Feedback Shield is off.</span> Customers go straight to your review page.
                </>
              )}
              {isAdmin && (
                <>
                  {' '}
                  <Link to="/settings#review-requests" onClick={onClose} className="text-sky-600 hover:underline">Change</Link>
                </>
              )}
            </p>
          </div>

          {repeatWarning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 space-y-2" role="alert">
              <p>{repeatWarning} Sending again too soon can annoy customers.</p>
              <button type="button" onClick={() => submit(true)} disabled={sending} className="btn-secondary !py-1.5 text-xs">
                Send anyway
              </button>
            </div>
          )}
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

          <button type="submit" disabled={sending} className="btn-primary w-full">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send Request'}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <Mail className="w-3.5 h-3.5" /> Sent by email from {location?.name}. Replies come to your inbox.
          </p>
        </form>
      )}
    </Modal>
  );
}
