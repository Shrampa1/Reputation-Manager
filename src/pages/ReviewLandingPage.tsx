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
 * Public page customers reach from a review-request email (no sign-in).
 * They rate the experience; happy customers are pointed to the public review page,
 * unhappy ones are invited to tell the business privately (and can still post publicly).
 */
export function ReviewLandingPage() {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<LandingInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('rate');
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [reviewLink, setReviewLink] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    callFunction<LandingInfo>('review-landing', { action: 'get', token })
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
  }, [token]);

  useEffect(() => {
    if (info) document.title = `Rate ${info.businessName}`;
  }, [info]);

  const handleRate = async (value: number) => {
    setRating(value);
    setBusy(true);
    setError(null);
    try {
      const res = await callFunction<{ reviewLink: string | null; askFeedback: boolean }>('review-landing', { action: 'rate', token, rating: value });
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
    setBusy(true);
    setError(null);
    try {
      await callFunction('review-landing', { action: 'feedback', token, feedback: feedback.trim() });
      setStep('thanks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Recorded in the background; the link opens in a new tab either way
  const trackClick = () => {
    callFunction('review-landing', { action: 'clicked', token }).catch(() => undefined);
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
                  Hi {info.firstName}, how was your experience?
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
                <h1 className="text-xl font-bold text-slate-900 mt-4">Thank you, {info.firstName}!</h1>
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
                  Tell us what happened and the owner will get back to you personally.
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
                <p className="text-sm text-slate-500 mt-2">Your message went straight to {info.businessName}. We’ll be in touch.</p>
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
