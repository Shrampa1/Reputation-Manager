import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailX } from 'lucide-react';
import { campaignApi } from '@/lib/campaigns';
import { surveyApi } from '@/lib/surveys';

/** Public: /u/c/<token> (email campaigns) and /u/s/<token> (surveys). */
export function UnsubscribePage() {
  const { kind = '', token = '' } = useParams();
  const api = kind === 's' ? surveyApi() : campaignApi();
  const [info, setInfo] = useState<{ business: string; email: string | null; unsubscribed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const isTest = token === 'test';

  const call = async (action: string) => {
    const res = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
    return body;
  };

  useEffect(() => {
    if (isTest || !['c', 's'].includes(kind)) return;
    call('unsubscribe_info').then(setInfo).catch((e) => setError(e instanceof Error ? e.message : 'This link isn’t valid.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, token]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await call('unsubscribe');
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <main className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8 text-center space-y-4">
        {isTest ? (
          <p className="text-slate-700">This is the unsubscribe link from a test email. In real emails, it unsubscribes the person it was sent to.</p>
        ) : done || info?.unsubscribed ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-lg font-semibold text-slate-900">You’re unsubscribed</h1>
            <p className="text-sm text-slate-600">{info ? `${info.business} won’t send ${info.email ?? 'you'} marketing emails or surveys any more.` : 'You won’t get these emails any more.'}</p>
          </>
        ) : info ? (
          <>
            <MailX className="w-12 h-12 text-slate-400 mx-auto" />
            <h1 className="text-lg font-semibold text-slate-900">Unsubscribe from {info.business}?</h1>
            <p className="text-sm text-slate-600">{info.email ?? 'You'} will stop getting their emails and surveys.</p>
            <button type="button" onClick={confirm} disabled={busy} className="btn-primary w-full justify-center">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Unsubscribe</button>
            {error && <p className="text-sm text-rose-700">{error}</p>}
          </>
        ) : error ? (
          <p className="text-slate-600">{error}</p>
        ) : (
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" />
        )}
      </main>
    </div>
  );
}
