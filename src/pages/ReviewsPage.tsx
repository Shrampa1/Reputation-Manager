import { useState, useMemo } from 'react';
import {
  Star,
  Search,
  Send,
  Sparkles,
  Check,
  Edit3,
  Shield,
  ShieldCheck,
  Phone,
  Smartphone,
  Inbox as InboxIcon,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useReviews } from '@/hooks/useSupabaseData';
import { supabase } from '@/lib/supabase';
import { useLocation } from '@/hooks/useSupabaseData';
import type { Review, ReviewPlatformFilter, ReviewRequestSettings } from '@/types';
import { StarRating } from '@/components/ui/StarRating';
import { PlatformIcon, PlatformLabel } from '@/components/ui/PlatformIcon';
import { Modal } from '@/components/ui/Modal';

const platformFilters: { key: ReviewPlatformFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'google', label: 'Google Business' },
  { key: 'facebook', label: 'Meta / Facebook' },
  { key: 'trustpilot', label: 'Trustpilot' },
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Yesterday';
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function ReviewsPage() {
  const { reviews, loading } = useReviews();
  const { location } = useLocation();
  const [activeFilter, setActiveFilter] = useState<ReviewPlatformFilter>('all');
  const [search, setSearch] = useState('');
  const [replyReview, setReplyReview] = useState<Review | null>(null);
  const [draftReply, setDraftReply] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestSettings, setRequestSettings] = useState<ReviewRequestSettings>({
    channel: 'sms',
    negativeFeedbackShield: true,
    messageTemplate: 'Hi {name}, thanks for choosing us! We\'d love to hear about your experience. Leave us a review: {link}',
  });
  const [toast, setToast] = useState<string | null>(null);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (activeFilter !== 'all' && r.platform !== activeFilter) return false;
      if (search && !r.author_name.toLowerCase().includes(search.toLowerCase()) && !r.content.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [reviews, activeFilter, search]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openReplyModal = (review: Review) => {
    setReplyReview(review);
    setDraftReply(review.ai_reply_draft || '');
    setIsEditing(false);
    setGenerateError(null);
  };

  const closeReplyModal = () => {
    setReplyReview(null);
    setDraftReply('');
    setIsEditing(false);
    setGenerateError(null);
  };

  const handleGenerateReply = async () => {
    if (!replyReview || !location) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ai-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({
            // The function loads content/rating/business name itself (under RLS)
            reviewId: replyReview.id,
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      const data = await response.json();
      if (!data.aiReplyDraft) {
        throw new Error('No draft returned from AI service');
      }
      setDraftReply(data.aiReplyDraft);
      setReplyReview({ ...replyReview, ai_reply_draft: data.aiReplyDraft });
      showToast('AI draft generated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate reply';
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handlePostReply = async () => {
    if (!replyReview) return;
    const { error } = await supabase
      .from('reviews')
      .update({ is_replied: true, ai_reply_draft: draftReply })
      .eq('id', replyReview.id);
    if (error) {
      showToast('Failed to post reply');
    } else {
      showToast('Reply posted successfully');
    }
    closeReplyModal();
  };

  const handleSendRequest = () => {
    showToast(`Review request sent via ${requestSettings.channel.toUpperCase()}`);
    setRequestModalOpen(false);
  };

  const reviewStats = {
    total: reviews.length,
    replied: reviews.filter((r) => r.is_replied).length,
    avg: reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : '—',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Review Inbox</h1>
          <p className="text-sm text-slate-500 mt-1">Manage reviews across all platforms in one place.</p>
        </div>
        <button onClick={() => setRequestModalOpen(true)} className="btn-primary">
          <Send className="w-4 h-4" />
          Send Review Request
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{reviewStats.total}</p>
          <p className="text-xs text-slate-400">Total Reviews</p>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-2xl font-bold text-emerald-600">{reviewStats.replied}</p>
          <p className="text-xs text-slate-400">Replied</p>
        </div>
        <div className="card p-3 sm:p-4 text-center">
          <p className="text-lg sm:text-2xl font-bold text-amber-600 flex items-center justify-center gap-1">
            {reviewStats.avg}
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </p>
          <p className="text-xs text-slate-400">Avg Rating</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reviews by name or content..."
              className="input-field pl-10"
            />
          </div>

          {/* Platform Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {platformFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeFilter === filter.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {filter.label}
                {filter.key !== 'all' && (
                  <span className={`ml-1.5 text-xs ${activeFilter === filter.key ? 'text-slate-300' : 'text-slate-400'}`}>
                    {reviews.filter((r) => r.platform === filter.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Review List */}
          <div className="space-y-3">
            {filteredReviews.length === 0 && (
              <div className="card p-8 text-center">
                <InboxIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No reviews match your filters.</p>
              </div>
            )}
            {filteredReviews.map((review) => (
              <div key={review.id} className="card card-hover p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-sm font-semibold shrink-0">
                    {review.author_avatar || getInitials(review.author_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{review.author_name}</p>
                      <span className="text-xs text-slate-400">{formatDate(review.review_date)}</span>
                      {review.is_replied && (
                        <span className="badge bg-emerald-50 text-emerald-600">
                          <Check className="w-3 h-3" /> Replied
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StarRating rating={review.rating} size="sm" />
                      <PlatformIcon platform={review.platform} />
                      <PlatformLabel platform={review.platform} />
                    </div>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{review.content}</p>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => openReplyModal(review)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 text-xs font-medium hover:bg-sky-100 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {review.is_replied ? 'View Reply' : 'AI Draft Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* AI Draft Reply Modal */}
      <Modal
        isOpen={!!replyReview}
        onClose={closeReplyModal}
        title="AI Draft Reply"
        subtitle={replyReview ? `Replying to ${replyReview.author_name}'s review` : ''}
        maxWidth="lg"
      >
        {replyReview && (
          <div className="space-y-4">
            {/* Original review */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 mb-1.5">
                <StarRating rating={replyReview.rating} />
                <PlatformIcon platform={replyReview.platform} />
                <span className="text-xs text-slate-400">{replyReview.author_name}</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{replyReview.content}</p>
            </div>

            {/* AI Draft */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  <span className="text-sm font-semibold text-slate-900">Suggested Reply</span>
                  {draftReply && <span className="badge bg-sky-50 text-sky-600">AI Generated</span>}
                </div>
                {draftReply && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {isEditing ? 'Preview' : 'Edit'}
                  </button>
                )}
              </div>

              {!draftReply && !generating && (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center">
                  <p className="text-sm text-slate-400 mb-3">No draft yet. Generate an AI reply to get started.</p>
                  <button onClick={handleGenerateReply} className="btn-primary">
                    <Sparkles className="w-4 h-4" />
                    Generate AI Reply
                  </button>
                </div>
              )}

              {generating && (
                <div className="p-6 rounded-xl border border-sky-100 bg-sky-50/30 text-center">
                  <Loader2 className="w-6 h-6 text-sky-500 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Generating a tailored reply…</p>
                </div>
              )}

              {generateError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-start gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {generateError}
                </div>
              )}

              {draftReply && !generating && (
                isEditing ? (
                  <textarea
                    value={draftReply}
                    onChange={(e) => setDraftReply(e.target.value)}
                    rows={5}
                    className="input-field resize-none"
                  />
                ) : (
                  <div className="p-3.5 rounded-xl border border-sky-100 bg-sky-50/30">
                    <p className="text-sm text-slate-700 leading-relaxed">{draftReply}</p>
                  </div>
                )
              )}
            </div>

            {/* Actions */}
            {draftReply && (
              <div className="flex items-center gap-2 pt-1">
                <button onClick={handlePostReply} className="btn-primary flex-1">
                  <Check className="w-4 h-4" />
                  Approve & Post
                </button>
                <button onClick={() => setIsEditing(true)} className="btn-secondary">
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button onClick={handleGenerateReply} disabled={generating} className="btn-secondary">
                  <Sparkles className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Send Review Request Modal */}
      <Modal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Send Review Request"
        subtitle="Ask a customer to leave a review"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">Channel</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRequestSettings({ ...requestSettings, channel: 'sms' })}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                  requestSettings.channel === 'sms'
                    ? 'border-sky-400 bg-sky-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${requestSettings.channel === 'sms' ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">SMS</p>
                  <p className="text-xs text-slate-500">Text message</p>
                </div>
              </button>
              <button
                onClick={() => setRequestSettings({ ...requestSettings, channel: 'whatsapp' })}
                className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                  requestSettings.channel === 'whatsapp'
                    ? 'border-emerald-400 bg-emerald-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${requestSettings.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Phone className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900">WhatsApp</p>
                  <p className="text-xs text-slate-500">Chat message</p>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Customer Phone</label>
            <input type="tel" placeholder="(512) 555-0000" className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Message</label>
            <textarea
              value={requestSettings.messageTemplate}
              onChange={(e) => setRequestSettings({ ...requestSettings, messageTemplate: e.target.value })}
              rows={3}
              className="input-field resize-none text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Use {'{name}'} and {'{link}'} as placeholders.</p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Negative Feedback Shield</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Intercept dissatisfied customers with a private feedback form before they reach public review platforms.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRequestSettings({ ...requestSettings, negativeFeedbackShield: !requestSettings.negativeFeedbackShield })}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                  requestSettings.negativeFeedbackShield ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    requestSettings.negativeFeedbackShield ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            {requestSettings.negativeFeedbackShield && (
              <div className="flex items-center gap-1.5 mt-2.5 text-xs text-emerald-600 font-medium animate-fade-in">
                <ShieldCheck className="w-3.5 h-3.5" />
                Shield is active — low ratings will be intercepted privately
              </div>
            )}
          </div>

          <button onClick={handleSendRequest} className="btn-primary w-full">
            <Send className="w-4 h-4" />
            Send Request
          </button>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
