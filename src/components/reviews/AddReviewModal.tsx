import { useEffect, useState } from 'react';
import { Loader2, Plus, Star } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import type { Location, ReviewPlatform } from '@/types';

const PLATFORMS: { key: ReviewPlatform; label: string }[] = [
  { key: 'google', label: 'Google' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'trustpilot', label: 'Trustpilot' },
  { key: 'custom', label: 'Other' },
];

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Adds a review by hand (until review platforms are connected and import them automatically). */
export function AddReviewModal({
  isOpen,
  onClose,
  location,
  onAdded,
}: {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  onAdded: (message: string) => void;
}) {
  const [platform, setPlatform] = useState<ReviewPlatform>('google');
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [date, setDate] = useState(todayInput());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPlatform('google');
    setAuthor('');
    setRating(5);
    setContent('');
    setDate(todayInput());
    setError(null);
    setSaving(false);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    if (!author.trim()) return setError('Enter the reviewer’s name.');
    if (!date || date > todayInput()) return setError('Choose a date that isn’t in the future.');
    setSaving(true);
    setError(null);
    const [y, m, d] = date.split('-').map(Number);
    // Noon local time keeps the review on the chosen day in any timezone display
    const reviewDate = new Date(y, m - 1, d, 12).toISOString();
    const { error: insertError } = await supabase.from('reviews').insert({
      location_id: location.id,
      platform,
      author_name: author.trim(),
      rating,
      content: content.trim(),
      review_date: reviewDate,
    });
    setSaving(false);
    if (insertError) {
      setError(`Couldn’t add the review: ${insertError.message}`);
      return;
    }
    onAdded(`Added ${author.trim()}'s review`);
    onClose();
  };

  const shown = hoverRating ?? rating;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add a Review" subtitle="Copy in a review you received elsewhere" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <p className="block text-sm font-semibold text-slate-900 mb-1.5">Platform</p>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={platform === p.key}
                onClick={() => setPlatform(p.key)}
                className={`px-2 py-2 rounded-xl border text-sm font-medium transition-all ${
                  platform === p.key ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ar-author" className="block text-sm font-semibold text-slate-900 mb-1.5">Reviewer name</label>
            <input id="ar-author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={100} className="input-field" placeholder="Jane Smith" />
          </div>
          <div>
            <label htmlFor="ar-date" className="block text-sm font-semibold text-slate-900 mb-1.5">Date</label>
            <input id="ar-date" type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value)} className="input-field" />
          </div>
        </div>

        <div>
          <p className="block text-sm font-semibold text-slate-900 mb-1.5">Rating</p>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHoverRating(null)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                className="p-0.5"
              >
                <Star className={`w-7 h-7 transition-colors ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
            <span className="ml-2 text-sm text-slate-500">{rating} of 5</span>
          </div>
        </div>

        <div>
          <label htmlFor="ar-content" className="block text-sm font-semibold text-slate-900 mb-1.5">
            Review text <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea id="ar-content" value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={5000} className="input-field resize-none text-sm" />
        </div>

        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

        <button type="submit" disabled={saving || !location} className="btn-primary w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Review
        </button>
      </form>
    </Modal>
  );
}
