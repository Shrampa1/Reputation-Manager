import { useEffect, useState } from 'react';
import { Check, ExternalLink, Link2, Loader2, ShieldCheck } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';

/** Normalizes a pasted link and checks it's a usable https URL. */
function parseReviewLink(raw: string): { url: string | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { url: null, error: null };
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:') return { url: null, error: 'Use a secure link that starts with https://' };
    if (!u.hostname.includes('.')) return { url: null, error: 'That doesn’t look like a web address.' };
    return { url: u.toString(), error: null };
  } catch {
    return { url: null, error: 'That doesn’t look like a web address.' };
  }
}

/** Settings → Review requests: where customers are sent, and the feedback shield. */
export function ReviewSettingsCard() {
  const { location, updateLocation, can } = useLocationContext();
  // Feature access (role default or Role access override)
  const isAdmin = can('business.edit');
  const [link, setLink] = useState('');
  const [shield, setShield] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLink(location?.review_link ?? '');
    setShield(location?.review_shield_enabled ?? true);
  }, [location?.review_link, location?.review_shield_enabled]);

  const dirty = link.trim() !== (location?.review_link ?? '') || shield !== (location?.review_shield_enabled ?? true);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseReviewLink(link);
    if (parsed.error) {
      setStatus({ kind: 'error', text: parsed.error });
      return;
    }
    setSaving(true);
    setStatus(null);
    const { error } = await updateLocation({ review_link: parsed.url, review_shield_enabled: shield });
    setSaving(false);
    setStatus(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Review settings saved' });
  };

  return (
    <form id="review-requests" onSubmit={handleSave} className="card p-5 scroll-mt-20">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
          <Link2 className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Review requests</h2>
          <p className="text-sm text-slate-500">Where customers go to leave you a review</p>
        </div>
      </div>

      <label htmlFor="settings-review-link" className="block text-sm font-medium text-slate-700 mb-1.5">Review link</label>
      <input
        id="settings-review-link"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        disabled={!isAdmin}
        placeholder="https://g.page/r/your-business/review"
        className="input-field disabled:bg-slate-50 disabled:text-slate-500"
      />
      <details className="mt-2 text-xs text-slate-500">
        <summary className="cursor-pointer text-sky-600 hover:underline w-fit">Where do I find my Google review link?</summary>
        <ol className="list-decimal ml-4 mt-2 space-y-1">
          <li>Search Google for your business name while signed in to the account that manages it.</li>
          <li>In your Business Profile panel, choose <span className="font-medium">Ask for reviews</span> (or <span className="font-medium">Read reviews → Get more reviews</span>).</li>
          <li>Copy the link it shows (it looks like <span className="font-mono">g.page/r/…/review</span>) and paste it here.</li>
        </ol>
      </details>
      {location?.review_link && (
        <a href={location.review_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-slate-500 hover:text-slate-700">
          Test current link <ExternalLink className="w-3 h-3" />
        </a>
      )}

      <div className="flex items-start justify-between gap-3 mt-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Feedback Shield</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Customers rate you first. 4–5 stars are sent to your review link; 1–3 stars are invited to tell you privately
              what went wrong. Everyone can still choose to post a public review, as Google’s review policy requires.
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={shield}
          aria-label="Feedback Shield"
          disabled={!isAdmin}
          onClick={() => setShield((s) => !s)}
          className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${shield ? 'bg-sky-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${shield ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {isAdmin ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
          <button type="submit" disabled={saving || !dirty} className="btn-primary sm:w-auto">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
          {status && (
            <p role={status.kind === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1.5 text-sm ${status.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {status.kind === 'success' && <Check className="w-4 h-4 shrink-0" />}
              {status.text}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 mt-3">Only owners and admins can change review settings.</p>
      )}
    </form>
  );
}
