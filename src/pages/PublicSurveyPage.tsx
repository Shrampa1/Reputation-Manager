import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { surveyPublic } from '@/lib/surveys';

interface SurveyInfo {
  business: { name: string };
  question: string;
  commentQuestion: string;
  accent: string | null;
  firstName?: string;
  score?: number | null;
  comment?: string | null;
}
interface Outcome {
  category: string | null;
  thanks: string | null;
  reviewLink: string | null;
}

/**
 * C3: a customer answers a survey. /nps/:token comes from the email (a number tapped there
 * arrives as ?score=N and is saved straight away); /nps/l/:key is the public link / QR code.
 */
export function PublicSurveyPage({ mode = 'token' }: { mode?: 'token' | 'link' }) {
  const { token: routeToken = '', key = '' } = useParams();
  const [params] = useSearchParams();
  const [info, setInfo] = useState<SurveyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(mode === 'token' ? routeToken : '');
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoSent = useRef(false);

  const answer = async (n: number, final: boolean) => {
    setBusy(true);
    setError(null);
    try {
      let res: Outcome & { token?: string };
      if (mode === 'link' && !token) {
        res = await surveyPublic<Outcome & { token: string }>({ action: 'link_answer', key, score: n, comment: final ? comment : undefined, final });
        if (res.token) setToken(res.token);
      } else {
        res = await surveyPublic<Outcome>({ action: 'answer', token, score: n, ...(final ? { comment, final: true } : {}) });
      }
      setScore(n);
      setOutcome(res);
      if (final) setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const load = mode === 'link' ? surveyPublic<SurveyInfo>({ action: 'link_get', key }) : surveyPublic<SurveyInfo & Outcome>({ action: 'get', token: routeToken });
    load
      .then((s) => {
        setInfo(s);
        document.title = s.business.name;
        if (typeof s.score === 'number') {
          setScore(s.score);
          setComment(s.comment ?? '');
          setOutcome(s as SurveyInfo & Outcome);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'This survey isn’t available.'));
  }, [mode, key, routeToken]);

  // A number tapped in the email counts straight away (once)
  useEffect(() => {
    const n = Number(params.get('score'));
    if (!info || mode !== 'token' || autoSent.current || params.get('score') === null || !Number.isInteger(n) || n < 0 || n > 10) return;
    autoSent.current = true;
    if (info.score !== n) answer(n, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  if (!info) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        {error ? <p className="text-slate-600 text-center">{error}</p> : <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />}
      </div>
    );
  }
  const accent = info.accent || '#0284c7';
  const openReview = () => {
    if (!outcome?.reviewLink) return;
    if (token) surveyPublic({ action: 'review_click', token }).catch(() => undefined);
    window.open(outcome.reviewLink, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start sm:items-center justify-center p-4 sm:p-6">
      <main className="w-full max-w-xl bg-white rounded-2xl shadow-sm border-t-4 p-6 sm:p-8 space-y-5" style={{ borderTopColor: accent }}>
        <p className="text-sm font-semibold text-slate-500">{info.business.name}</p>
        {done ? (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2 className="w-12 h-12 mx-auto" style={{ color: accent }} />
            <p className="text-lg font-semibold text-slate-900">{outcome?.thanks ?? 'Thank you!'}</p>
            {outcome?.reviewLink && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Would you share that in a quick review? It really helps a small business.</p>
                <button type="button" onClick={openReview} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-white font-semibold" style={{ background: accent }}>
                  <Star className="w-4 h-4" /> Leave a review
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {info.firstName && <p className="text-sm text-slate-700">Hi {info.firstName},</p>}
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">{info.question}</h1>
            <div>
              <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label="Score from 0 to 10">
                {Array.from({ length: 11 }, (_, i) => (
                  <button key={i} type="button" role="radio" aria-checked={score === i} disabled={busy} onClick={() => answer(i, false)}
                    className={`aspect-square rounded-lg border text-sm font-semibold transition ${score === i ? 'text-white border-transparent' : 'border-slate-200 text-slate-800 hover:border-slate-400'}`}
                    style={score === i ? { background: accent } : undefined}>
                    {i}
                  </button>
                ))}
              </div>
              <p className="flex justify-between text-xs text-slate-500 mt-1.5"><span>Not likely</span><span>Very likely</span></p>
            </div>
            {score !== null && (
              <div className="space-y-3">
                <label className="block">
                  <span className="block text-sm font-medium text-slate-800 mb-1.5">{info.commentQuestion} <span className="text-slate-400 font-normal">(optional)</span></span>
                  <textarea className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
                <button type="button" disabled={busy} onClick={() => answer(score, true)} className="w-full rounded-xl py-3 text-white font-semibold inline-flex items-center justify-center gap-2" style={{ background: accent }}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send
                </button>
              </div>
            )}
            {error && <p className="text-sm text-rose-700">{error}</p>}
          </>
        )}
      </main>
    </div>
  );
}
