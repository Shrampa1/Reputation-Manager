import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ExternalLink, Heart, Loader2, Star } from 'lucide-react';
import { callFunction } from '@/lib/functions';

interface LandingInfo {
  businessName: string;
  firstName: string;
  shield: boolean;
  rating: number | null;
  feedbackSent: boolean;
  reviewLink: string | null;
}

type Step = 'rate' | 'public' | 'feedback' | 'thanks';

/**
 * Public page customers reach from a review-request email (/r/<token>) or by scanning the
 * business's QR code (/q/<key>). No sign-in.
 * They rate the experience; happy customers are pointed to the public review page,
 * unhappy ones are invited to tell the business privately (and can still post publicly).
 */
export function ReviewLandingPage({ mode = 'request' }: { mode?: 'request' | 'qr' }) {
  const { token: linkToken = '', key = '' } = useParams();
  // QR visitors get a token once they've rated; feedback and clicks are recorded against it
  const [token, setToken] = useState(mode === 'qr' ? '' : linkToken);
  const [info, setInfo] = useState<LandingInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('rate');
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  // QR visitors are anonymous; they can leave an email if they'd like a reply
  const isQr = mode === 'qr';
  const [contactEmail, setContactEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = mode === 'qr' ? { action: 'qr-get', key } : { action: 'get', token: linkToken };
    callFunction<LandingInfo>('review-landing', load)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setReviewLink(data.reviewLink);
        if (data.rating !== null) {
          setRating(data.rating);
          setStep(data.shield && data.rating <= 3 ? (data.feedbackSent ? 'thanks' : 'feedback') : 'public');
        }
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'This link isn’t valid.'));
    return () => {
      cancelled = true;
    };
  }, [mode, key, linkToken]);

  useEffect(() => {
    if (info) document.title = `Rate ${info.businessName}`;
  }, [info]);

  const handleRate = async (value: number) => {
    setRating(value);
    setBusy(true);
    setError(null);
    try {
      const res = await callFunction<{ token?: string; reviewLink: string | null; askFeedback: boolean }>(
        'review-landing',
        mode === 'qr' ? { action: 'qr-rate', key, rating: value } : { action: 'rate', token, rating: value }
      );
      if (res.token) setToken(res.token);
      setReviewLink(res.reviewLink);
      setStep(res.askFeedback ? 'feedback' : 'public');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setRating(null);
    } finally {
      setBusy(false);
    }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return setError('Write a few words first.');
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return setError('Check your email address, or leave it blank.');
    setBusy(true);
    setError(null);
    try {
      await callFunction('review-landing', { action: 'feedback', token, feedback: feedback.trim(), ...(isQr && contactEmail.trim() ? { email: contactEmail.trim() } : {}) });
      setStep('thanks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Recorded in the background; the link opens in a new tab either way
  const trackClick = () => {
    if (token) callFunction('review-landing', { action: 'clicked', token }).catch(() => undefined);
  };

  const shown = hover ?? rating ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md card p-6 sm:p-8 text-center">
        {!info && !loadError && <Loader2 className="w-6 h-6 text-sky-500 animate-spin mx-auto my-10" />}

        {loadError && (
          <div className="py-6">
            <p className="text-lg font-bold text-slate-900">Link unavailable</p>
            <p className="text-sm text-slate-500 mt-2">{loadError}</p>
          </div>
        )}

        {info && (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">{info.businessName}</p>

            {step === 'rate' && (
              <>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">
                  {info.firstName ? `Hi ${info.firstName}, how was your experience?` : 'How was your experience?'}
                </h1>
                <p className="text-sm text-slate-500 mt-2">Tap a star to rate us.</p>
                <div className="flex items-center justify-center gap-1.5 mt-6" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(null)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} star${n === 1 ? '' : 's'}`}
                      disabled={busy}
                      onClick={() => handleRate(n)}
                      onMouseEnter={() => setHover(n)}
                      className="p-1 transition-transform hover:scale-110 disabled:cursor-wait"
                    >
                      <Star className={`w-10 h-10 sm:w-11 sm:h-11 ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    </button>
                  ))}
                </div>
                {busy && <Loader2 className="w-5 h-5 text-sky-500 animate-spin mx-auto mt-4" />}
              </>
            )}

            {step === 'public' && (
              <>
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 mx-auto mt-4">
                  <Heart className="w-7 h-7" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mt-4">{info.firstName ? `Thank you, ${info.firstName}!` : 'Thank you!'}</h1>
                <p className="text-sm text-slate-500 mt-2">
                  Would you share your experience publicly? It really helps a local business like ours.
                </p>
                {reviewLink ? (
                  <a href={reviewLink} target="_blank" rel="noopener noreferrer" onClick={trackClick} className="btn-primary w-full mt-6">
                    Write a review <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400 mt-6">Thanks for your feedback.</p>
                )}
              </>
            )}

            {step === 'feedback' && (
              <form onSubmit={handleFeedback} className="text-left mt-2" noValidate>
                <h1 className="text-xl font-bold text-slate-900 text-center">We’re sorry we fell short</h1>
                <p className="text-sm text-slate-500 mt-2 text-center">
                  {isQr
                    ? 'Tell us what happened so we can put it right.'
                    : 'Tell us what happened and the owner will get back to you personally.'}
                </p>
                <label htmlFor="landing-feedback" className="sr-only">Your feedback</label>
                <textarea
                  id="landing-feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  className="input-field resize-none mt-5"
                  placeholder="What could we have done better?"
                />
                {isQr && (
                  <>
                    <label htmlFor="landing-email" className="block text-xs font-medium text-slate-600 mt-3 mb-1">
                      Your email <span className="font-normal text-slate-400">(optional, if you’d like a reply)</span>
                    </label>
                    <input
                      id="landing-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      maxLength={254}
                      autoComplete="email"
                      className="input-field"
                      placeholder="you@example.com"
                    />
                  </>
                )}
                <button type="submit" disabled={busy} className="btn-primary w-full mt-3">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send to {info.businessName}
                </button>
                {reviewLink && (
                  <p className="text-xs text-slate-400 text-center mt-4">
                    Prefer to post a public review?{' '}
                    <a href={reviewLink} target="_blank" rel="noopener noreferrer" onClick={trackClick} className="text-sky-600 hover:underline">
                      Leave one here
                    </a>
                  </p>
                )}
              </form>
            )}

            {step === 'thanks' && (
              <>
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-sky-50 text-sky-600 mx-auto mt-4">
                  <Check className="w-7 h-7" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 mt-4">Thanks for telling us</h1>
                <p className="text-sm text-slate-500 mt-2">
                  Your message went straight to {info.businessName}.{isQr && !contactEmail.trim() ? '' : ' We’ll be in touch.'}
                </p>
                {reviewLink && (
                  <p className="text-xs text-slate-400 mt-6">
                    You can also{' '}
                    <a href={reviewLink} target="_blank" rel="noopener noreferrer" onClick={trackClick} className="text-sky-600 hover:underline">
                      post a public review
                    </a>
                    .
                  </p>
                )}
              </>
            )}

            {error && <p className="text-sm text-rose-600 mt-4" role="alert">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
