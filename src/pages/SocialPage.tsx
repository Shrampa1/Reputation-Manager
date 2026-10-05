import { useState } from 'react';
import {
  CalendarDays,
  Plus,
  Sparkles,
  Star,
  Image as ImageIcon,
  Facebook,
  Globe,
  Instagram,
  Clock,
  Check,
  FileText,
  Send,
  Quote,
  Loader2,
} from 'lucide-react';
import { useReviews, useSocialPosts } from '@/hooks/useSupabaseData';
import type { PostStatus, Review } from '@/types';
import { StarRating } from '@/components/ui/StarRating';
import { Modal } from '@/components/ui/Modal';

const platformIconMap: Record<string, typeof Facebook> = {
  facebook: Facebook,
  google: Globe,
  instagram: Instagram,
};

const platformColorMap: Record<string, string> = {
  facebook: 'bg-blue-50 text-blue-600',
  google: 'bg-red-50 text-red-600',
  instagram: 'bg-pink-50 text-pink-600',
};

const statusConfig: Record<PostStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-500' },
  scheduled: { label: 'Scheduled', color: 'bg-sky-50 text-sky-600' },
  published: { label: 'Published', color: 'bg-emerald-50 text-emerald-600' },
};

const calendarDays: { date: number | null; isoDate: string | null }[] = (() => {
  const days: { date: number | null; isoDate: string | null }[] = [];
  const firstDayOfWeek = 4;
  for (let i = 0; i < firstDayOfWeek; i++) days.push({ date: null, isoDate: null });
  for (let d = 1; d <= 31; d++) {
    const iso = `2026-10-${String(d).padStart(2, '0')}`;
    days.push({ date: d, isoDate: iso });
  }
  return days;
})();

export function SocialPage() {
  const { reviews, loading: reviewsLoading } = useReviews();
  const { posts, loading: postsLoading } = useSocialPosts();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [graphicModalOpen, setGraphicModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const openGraphicModal = (review: Review) => {
    setSelectedReview(review);
    setGraphicModalOpen(true);
  };

  const handleGenerateCalendar = () => {
    setAiGenerating(true);
    setTimeout(() => {
      setAiGenerating(false);
      setAiResults([
        'Mon Oct 5 — "Tip: Don\'t ignore a slow drain — it could signal a bigger issue. Call us for a free inspection!"',
        'Wed Oct 7 — "Behind the scenes: Meet our lead technician Marcus, 15 years of plumbing expertise!"',
        'Fri Oct 9 — Customer spotlight: Share a recent 5-star review as a graphic post',
        'Mon Oct 12 — "Fall is here! Schedule your water heater maintenance before winter hits."',
        'Thu Oct 15 — "Did you know? Replacing old pipes can improve water pressure by up to 40%."',
      ]);
    }, 1500);
  };

  const fiveStarReviews = reviews.filter((r) => r.rating === 5);
  const isLoading = reviewsLoading || postsLoading;

  // Build calendar events from live posts
  const calendarEvents = posts
    .filter((p) => p.scheduled_for)
    .map((p) => ({
      id: p.id,
      title: p.content.slice(0, 30) + (p.content.length > 30 ? '…' : ''),
      date: p.scheduled_for!.slice(0, 10),
      platform: p.platform,
      status: p.status,
    }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Social Publisher</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule posts, generate content, and turn reviews into graphics.</p>
        </div>
        <button className="btn-primary" onClick={() => showToast('New post composer opened')}>
          <Plus className="w-4 h-4" />
          New Post
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Review-to-Graphic Quick Access */}
          <div className="card p-5 bg-gradient-to-r from-violet-50/50 to-sky-50/50 border-violet-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-violet-600 text-white">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Review-to-Graphic</h2>
                <p className="text-xs text-slate-500">Turn a 5-star review into a social media image</p>
              </div>
            </div>
            {fiveStarReviews.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No 5-star reviews yet.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {fiveStarReviews.map((review) => (
                  <button
                    key={review.id}
                    onClick={() => openGraphicModal(review)}
                    className="shrink-0 w-56 p-3 rounded-xl bg-white border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all text-left group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-xs text-slate-400">{review.author_name}</span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{review.content}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-violet-600 group-hover:gap-2.5 transition-all">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Create Graphic
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Content Calendar Generator */}
          <div className="card p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">AI Content Calendar Generator</h2>
                <p className="text-xs text-slate-400">Describe your goals and let AI plan your posts</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Generate 2 weeks of plumbing tips and customer highlights for October..."
                className="input-field flex-1"
              />
              <button
                onClick={handleGenerateCalendar}
                disabled={aiGenerating}
                className="btn-primary shrink-0"
              >
                {aiGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate
                  </>
                )}
              </button>
            </div>

            {aiResults.length > 0 && (
              <div className="mt-4 space-y-2 animate-fade-in">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suggested Calendar</p>
                {aiResults.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-sky-50/40 border border-sky-100">
                    <FileText className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-slate-700 flex-1">{item}</p>
                    <button
                      onClick={() => showToast('Post added to scheduler')}
                      className="shrink-0 text-xs font-medium text-sky-600 hover:text-sky-700"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'calendar' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'list' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
              }`}
            >
              <FileText className="w-4 h-4" />
              List
            </button>
          </div>

          {/* Calendar View */}
          {view === 'calendar' && (
            <div className="card p-3 sm:p-5">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-base font-bold text-slate-900">October 2026</h3>
                <div className="flex items-center gap-1">
                  <button className="btn-ghost text-xs px-2 py-1">‹</button>
                  <button className="btn-ghost text-xs px-2 py-1">Today</button>
                  <button className="btn-ghost text-xs px-2 py-1">›</button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-slate-400 py-1.5">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const dayEvents = day.isoDate
                    ? calendarEvents.filter((e) => e.date === day.isoDate)
                    : [];
                  return (
                    <div
                      key={i}
                      className={`min-h-[60px] sm:min-h-[80px] rounded-lg p-1.5 border ${
                        day.date === null
                          ? 'border-transparent'
                          : dayEvents.length > 0
                          ? 'border-sky-100 bg-sky-50/20'
                          : 'border-slate-100 bg-white'
                      }`}
                    >
                      {day.date && (
                        <>
                          <p className={`text-xs font-medium mb-1 ${dayEvents.length > 0 ? 'text-sky-600' : 'text-slate-400'}`}>
                            {day.date}
                          </p>
                          <div className="space-y-1">
                            {dayEvents.map((event) => {
                              const Icon = platformIconMap[event.platform] || Globe;
                              return (
                                <div
                                  key={event.id}
                                  className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium ${platformColorMap[event.platform] || 'bg-slate-100 text-slate-500'} truncate cursor-pointer hover:opacity-80 transition-opacity`}
                                >
                                  <Icon className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{event.title}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="space-y-3">
              {posts.length === 0 && (
                <div className="card p-8 text-center">
                  <p className="text-sm text-slate-500">No posts scheduled yet.</p>
                </div>
              )}
              {posts.map((post) => {
                const PlatformIcon = platformIconMap[post.platform] || Globe;
                const status = statusConfig[post.status] || statusConfig.draft;
                return (
                  <div key={post.id} className="card card-hover p-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${platformColorMap[post.platform] || 'bg-slate-100 text-slate-500'} shrink-0`}>
                        <PlatformIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`badge ${status.color}`}>{status.label}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {post.scheduled_for
                              ? new Date(post.scheduled_for).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                              : 'Not scheduled'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">{post.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Review-to-Graphic Modal */}
      <Modal
        isOpen={graphicModalOpen}
        onClose={() => setGraphicModalOpen(false)}
        title="Review-to-Graphic"
        subtitle="Social media image preview"
        maxWidth="md"
      >
        {selectedReview && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 aspect-square max-w-sm mx-auto shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-8 -translate-x-8" />

              <div className="relative h-full flex flex-col items-center justify-center p-8 text-white text-center">
                <Quote className="w-8 h-8 text-white/40 mb-3" />
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-amber-300 text-amber-300" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed font-medium mb-4 line-clamp-4">
                  "{selectedReview.content}"
                </p>
                <div className="mt-auto">
                  <p className="text-xs font-semibold text-white/90">— {selectedReview.author_name}</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900 mb-2">Template Style</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: 'Ocean', active: true, bg: 'from-sky-500 to-blue-700' },
                  { name: 'Sunset', active: false, bg: 'from-orange-400 to-rose-600' },
                  { name: 'Forest', active: false, bg: 'from-emerald-500 to-teal-700' },
                ].map((tmpl) => (
                  <button
                    key={tmpl.name}
                    className={`p-2 rounded-xl border-2 transition-all ${
                      tmpl.active ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-full aspect-square rounded-lg bg-gradient-to-br ${tmpl.bg} mb-1`} />
                    <p className="text-xs font-medium text-slate-700">{tmpl.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  showToast('Graphic posted to social media');
                  setGraphicModalOpen(false);
                }}
                className="btn-primary flex-1"
              >
                <Send className="w-4 h-4" />
                Post to Social
              </button>
              <button
                onClick={() => showToast('Image downloaded')}
                className="btn-secondary"
              >
                <ImageIcon className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        )}
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
