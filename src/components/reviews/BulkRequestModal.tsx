import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, FileUp, Loader2, Send, ShieldCheck, Users, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useLocationContext } from '@/context/LocationContext';
import {
  BULK_BATCH_SIZE,
  parseCustomerList,
  sendBulkReviewRequests,
  type BulkSendResult,
  type BulkSkipReason,
  type CustomerRow,
} from '@/lib/reviewRequests';

const MAX_ROWS = 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Step = 'input' | 'review' | 'sending' | 'done';

const skipLabels: Record<BulkSkipReason, string> = {
  recent: 'Already asked in the last 30 days',
  limit: 'Over your daily or monthly allowance',
  invalid: 'Email address isn’t valid',
  duplicate: 'Listed twice',
};

/** Reviews → Send to many: upload a CSV (or paste a list) and email everyone a review request. */
export function BulkRequestModal({
  isOpen,
  onClose,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { location, can } = useLocationContext();
  const isAdmin = can('business.edit');
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkSendResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep('input');
    setText('');
    setFileName(null);
    setRows([]);
    setNote('');
    setError(null);
    setProgress(0);
    setResult(null);
  }, [isOpen]);

  const ready = useMemo(() => rows.filter((r) => !r.problem), [rows]);
  const problems = rows.length - ready.length;
  const hasReviewLink = Boolean(location?.review_link);
  const shield = location?.review_shield_enabled ?? true;

  const readFile = (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_BYTES) return setError('That file is too big. Use a CSV under 2 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setFileName(file.name);
    };
    reader.onerror = () => setError('Couldn’t read that file.');
    reader.readAsText(file);
  };

  const check = () => {
    const parsed = parseCustomerList(text);
    if (parsed.length === 0) return setError('No customers found. Each line needs at least an email address.');
    if (parsed.length > MAX_ROWS) return setError(`That’s ${parsed.length} customers. Send at most ${MAX_ROWS} at a time — split the file.`);
    if (!parsed.some((r) => !r.problem)) return setError('None of those lines has a valid email address.');
    setRows(parsed);
    setError(null);
    setStep('review');
  };

  const send = async () => {
    setStep('sending');
    setProgress(0);
    const total: BulkSendResult = { sent: 0, failed: 0, skipped: [] };
    // Problem rows are reported back as skipped without a round trip
    for (const r of rows) if (r.problem) total.skipped.push({ name: r.name, email: r.email, reason: r.problem });
    const list = ready.map(({ name, email }) => ({ name, email }));
    for (let i = 0; i < list.length; i += BULK_BATCH_SIZE) {
      const batch = list.slice(i, i + BULK_BATCH_SIZE);
      try {
        const res = await sendBulkReviewRequests(batch, note.trim());
        total.sent += res.sent;
        total.failed += res.failed;
        total.skipped.push(...res.skipped);
        if (res.error) total.error = res.error;
        // Allowance used up: don't keep asking for every remaining batch
        if (res.skipped.some((s) => s.reason === 'limit')) {
          for (const r of list.slice(i + BULK_BATCH_SIZE)) total.skipped.push({ ...r, reason: 'limit' });
          break;
        }
      } catch (err) {
        total.error = err instanceof Error ? err.message : 'Sending stopped because of an error.';
        total.failed += list.length - i;
        break;
      }
      setProgress(Math.min(list.length, i + BULK_BATCH_SIZE) / list.length);
    }
    setResult(total);
    setStep('done');
    if (total.sent) onDone(`Review requests emailed to ${total.sent} customer${total.sent === 1 ? '' : 's'}`);
  };

  const skippedByReason = useMemo(() => {
    const counts = new Map<BulkSkipReason, number>();
    for (const s of result?.skipped ?? []) counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1);
    return [...counts.entries()];
  }, [result]);

  const close = () => step !== 'sending' && onClose();

  return (
    <Modal isOpen={isOpen} onClose={close} title="Send to many customers" subtitle="Upload a customer list and email everyone a review request" maxWidth="lg">
      {!hasReviewLink ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Add your review link first</p>
              <p className="mt-1">
                Customers need somewhere to leave their review.
                {isAdmin ? ' Add the link in Settings, then come back.' : ' Ask an owner or admin to add it in Settings.'}
              </p>
            </div>
          </div>
          {isAdmin && <Link to="/settings#review-requests" onClick={onClose} className="btn-primary w-full">Open Settings</Link>}
        </div>
      ) : step === 'input' ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 transition-colors"
          >
            <FileUp className="w-7 h-7 text-sky-500" />
            <span className="text-sm font-semibold text-slate-900">{fileName ?? 'Choose a CSV file or drop it here'}</span>
            <span className="text-xs text-slate-500">From Excel, Google Sheets, Shopify, Square, your POS… Needs an email column; a name column is optional.</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = '';
            }}
          />

          <div>
            <label htmlFor="bulk-paste" className="block text-sm font-semibold text-slate-900 mb-1.5">…or paste your list</label>
            <textarea
              id="bulk-paste"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFileName(null);
              }}
              rows={6}
              className="input-field resize-y font-mono text-xs"
              placeholder={'Jane Smith, jane@example.com\nRaj Patel, raj@example.com\nmaria@example.com'}
            />
          </div>

          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <button type="button" onClick={check} disabled={!text.trim()} className="btn-primary w-full">
            <Users className="w-4 h-4" /> Check list
          </button>
          <p className="text-xs text-slate-400 text-center">
            Only email customers who did business with you and would expect to hear from you.
          </p>
        </div>
      ) : step === 'review' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">{ready.length}</p>
              <p className="text-xs text-slate-400">Ready to send</p>
            </div>
            <div className="card p-3 text-center">
              <p className={`text-lg font-bold ${problems ? 'text-amber-600' : 'text-slate-400'}`}>{problems}</p>
              <p className="text-xs text-slate-400">Will be skipped</p>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto scrollbar-thin rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Name</th>
                  <th className="text-left font-semibold px-3 py-2">Email</th>
                  <th className="w-8" aria-label="Remove" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 300).map((r, i) => (
                  <tr key={`${r.email}-${i}`} className={r.problem ? 'bg-amber-50/50' : ''}>
                    <td className="px-3 py-2 text-slate-900">{r.name || <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2 text-slate-600 break-all">
                      {r.email || <span className="text-slate-400">—</span>}
                      {r.problem && <span className="ml-2 badge bg-amber-100 text-amber-700">{r.problem === 'invalid' ? 'Bad email' : 'Duplicate'}</span>}
                    </td>
                    <td className="pr-2">
                      <button
                        type="button"
                        onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
                        aria-label={`Remove ${r.name || r.email}`}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 300 && <p className="text-xs text-slate-400 text-center py-2">…and {rows.length - 300} more</p>}
          </div>

          <div>
            <label htmlFor="bulk-note" className="block text-sm font-semibold text-slate-900 mb-1.5">
              Message <span className="font-normal text-slate-400">(optional, same for everyone)</span>
            </label>
            <textarea
              id="bulk-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={600}
              className="input-field resize-none text-sm"
              placeholder={`Thanks for choosing ${location?.name ?? 'us'}! We'd love to hear how we did. It only takes a minute.`}
            />
            <p className="text-xs text-slate-400 mt-1">Each email starts with “Hi [first name],” and ends with a “Rate us” button.</p>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-600 leading-relaxed">
            <ShieldCheck className={`w-5 h-5 shrink-0 ${shield ? 'text-emerald-600' : 'text-slate-400'}`} />
            <p>
              Customers already asked in the last 30 days are skipped automatically.
              {shield ? ' Feedback Shield is on: 1–3 star ratings come to you privately first.' : ''}
            </p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => setStep('input')} className="btn-secondary">Back</button>
            <button type="button" onClick={send} disabled={ready.length === 0} className="btn-primary flex-1">
              <Send className="w-4 h-4" /> Send to {ready.length} customer{ready.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      ) : step === 'sending' ? (
        <div className="py-8 text-center space-y-4" role="status">
          <Loader2 className="w-7 h-7 text-sky-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-900">Sending review requests…</p>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="text-xs text-slate-400">Keep this window open until it finishes.</p>
        </div>
      ) : (
        result && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${result.sent ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${result.sent ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                {result.sent ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {result.sent} review request{result.sent === 1 ? '' : 's'} sent
                </p>
                <p className="text-xs text-slate-500">Track replies in Reviews → Review requests.</p>
              </div>
            </div>

            {result.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700" role="alert">
                {result.failed > 0 && <p className="font-semibold">{result.failed} not sent</p>}
                <p>{result.error}</p>
              </div>
            )}

            {skippedByReason.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <p className="font-semibold text-slate-900 mb-1">{result.skipped.length} skipped</p>
                <ul className="space-y-0.5 text-slate-600">
                  {skippedByReason.map(([reason, count]) => (
                    <li key={reason}>{count} · {skipLabels[reason]}</li>
                  ))}
                </ul>
                {skippedByReason.some(([r]) => r === 'limit') && (
                  <p className="text-xs text-slate-500 mt-2">
                    Send the rest tomorrow, or <Link to="/billing" onClick={onClose} className="text-sky-600 hover:underline">upgrade your plan</Link> for a bigger monthly allowance.
                  </p>
                )}
              </div>
            )}

            <button type="button" onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        )
      )}
    </Modal>
  );
}
