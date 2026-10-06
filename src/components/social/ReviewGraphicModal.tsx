import { useEffect, useState } from 'react';
import { Download, Loader2, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { GRAPHIC_TEMPLATES, graphicFileName, renderReviewGraphic, type GraphicTemplate } from '@/lib/reviewGraphic';
import type { Review } from '@/types';

/** Turns a review into a downloadable image, or attaches it to a new post. */
export function ReviewGraphicModal({
  review,
  businessName,
  onClose,
  onUseInPost,
}: {
  review: Review | null;
  businessName: string;
  onClose: () => void;
  onUseInPost: (image: File, caption: string) => void;
}) {
  const [template, setTemplate] = useState<GraphicTemplate>('ocean');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (review) setTemplate('ocean');
  }, [review?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render the real image whenever the review or template changes
  useEffect(() => {
    if (!review) return;
    let cancelled = false;
    let url: string | null = null;
    setBlob(null);
    setError(null);
    renderReviewGraphic({
      content: review.content,
      authorName: review.author_name,
      rating: review.rating,
      businessName,
      template,
    })
      .then((b) => {
        if (cancelled) return;
        url = URL.createObjectURL(b);
        setBlob(b);
        setPreviewUrl(url);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Couldn’t create the image.'));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [review, businessName, template]);

  const download = () => {
    if (!blob || !review) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = graphicFileName(review.author_name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const useInPost = () => {
    if (!blob || !review) return;
    const file = new File([blob], graphicFileName(review.author_name), { type: 'image/jpeg' });
    const firstName = review.author_name.split(' ')[0];
    onUseInPost(file, `Thank you, ${firstName}, for the kind words! ⭐ We love hearing from our customers.`);
  };

  return (
    <Modal isOpen={Boolean(review)} onClose={onClose} title="Review-to-Graphic" subtitle="A 1080×1080 image ready for Instagram, Facebook and Google" maxWidth="md">
      {review && (
        <div className="space-y-4">
          <div className="relative aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden shadow-xl bg-slate-100">
            {previewUrl && <img src={previewUrl} alt={`Graphic of ${review.author_name}'s review`} className={`w-full h-full object-cover transition-opacity ${blob ? '' : 'opacity-50'}`} />}
            {!blob && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin drop-shadow" />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-rose-600 text-center" role="alert">{error}</p>}

          <div>
            <p className="text-sm font-semibold text-slate-900 mb-2">Template Style</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Template style">
              {GRAPHIC_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.key}
                  type="button"
                  role="radio"
                  aria-checked={template === tmpl.key}
                  onClick={() => setTemplate(tmpl.key)}
                  className={`p-2 rounded-xl border-2 transition-all ${
                    template === tmpl.key ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-full aspect-square rounded-lg bg-gradient-to-br ${tmpl.preview} mb-1`} />
                  <p className="text-xs font-medium text-slate-700">{tmpl.name}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={useInPost} disabled={!blob} className="btn-primary flex-1">
              <Send className="w-4 h-4" />
              Use in a Post
            </button>
            <button onClick={download} disabled={!blob} className="btn-secondary">
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
