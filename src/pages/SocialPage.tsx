import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Plus,
  Star,
  Image as ImageIcon,
  Facebook,
  Globe,
  Instagram,
  Clock,
  Check,
  FileText,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useIntegrations, useLocation, useReviews, useSocialPosts } from '@/hooks/useSupabaseData';
import { useLocationContext } from '@/context/LocationContext';
import type { PostPlatform, PostStatus, Review, SocialPost } from '@/types';
import { StarRating } from '@/components/ui/StarRating';
import { NewPostModal } from '@/components/social/NewPostModal';
import { ContentPlanner } from '@/components/social/ContentPlanner';
import { ReviewGraphicModal } from '@/components/social/ReviewGraphicModal';

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
  publishing: { label: 'Publishing…', color: 'bg-amber-50 text-amber-600' },
  published: { label: 'Published', color: 'bg-emerald-50 text-emerald-600' },
  failed: { label: 'Failed', color: 'bg-rose-50 text-rose-600' },
};

const isEditable = (post: SocialPost) => post.status !== 'published' && post.status !== 'publishing';

/** YYYY-MM-DD in the viewer's own timezone (not UTC), so evening posts land on the right day */
function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Cells for one month: blanks before day 1 so it lands on its weekday, and after the last day to fill the week */
function buildMonthGrid(month: Date): { date: number | null; isoDate: string | null }[] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const leading = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: { date: number | null; isoDate: string | null }[] = [];
  for (let i = 0; i < leading; i++) cells.push({ date: null, isoDate: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: d, isoDate: localDateKey(new Date(year, m, d)) });
  while (cells.length % 7 !== 0) cells.push({ date: null, isoDate: null });
  return cells;
}

export function SocialPage() {
  const { reviews, loading: reviewsLoading } = useReviews();
  const { posts, loading: postsLoading, refetch: refetchPosts } = useSocialPosts();
  const { location } = useLocation();
  const { can } = useLocationContext();
  const canPublish = can('social.publish');
  const { byProvider } = useIntegrations();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [composerContent, setComposerContent] = useState('');
  const [composerPlatforms, setComposerPlatforms] = useState<PostPlatform[] | undefined>(undefined);
  const [composerScheduleAt, setComposerScheduleAt] = useState<Date | null>(null);
  const [composerImage, setComposerImage] = useState<File | null>(null);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const calendarDays = useMemo(() => buildMonthGrid(month), [month]);
  const todayKey = localDateKey(new Date());
  const isCurrentMonth = month.getTime() === startOfMonth(new Date()).getTime();
  const shiftMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const openComposer = (content = '', platforms?: PostPlatform[], scheduleAt: Date | null = null, image: File | null = null) => {
    setEditingPost(null);
    setComposerContent(content);
    setComposerPlatforms(platforms);
    setComposerScheduleAt(scheduleAt);
    setComposerImage(image);
    setComposerOpen(true);
  };

  const openEditor = (post: SocialPost) => {
    if (!isEditable(post)) return;
    setEditingPost(post);
    setComposerOpen(true);
  };

  const openGraphicModal = (review: Review) => setSelectedReview(review);

  const fiveStarReviews = reviews.filter((r) => r.rating === 5);
  const isLoading = reviewsLoading || postsLoading;

  // Calendar events: scheduled posts by their scheduled time, "Publish now" posts by when they went out
  const calendarEvents = posts
    .map((p) => ({ post: p, when: p.scheduled_for ?? p.published_at }))
    .filter((e): e is { post: SocialPost; when: string } => Boolean(e.when))
    .sort((a, b) => a.when.localeCompare(b.when))
    .map(({ post: p, when }) => ({
      id: p.id,
      title: p.content.slice(0, 30) + (p.content.length > 30 ? '…' : ''),
      date: localDateKey(new Date(when)),
      time: new Date(when).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      platform: p.platform,
      status: p.status,
    }));
  const monthKeyPrefix = localDateKey(month).slice(0, 7);
  const postsThisMonth = calendarEvents.filter((e) => e.date.startsWith(monthKeyPrefix)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Social Publisher</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule posts, generate content, and turn reviews into graphics.</p>
        </div>
        <button className="btn-primary" onClick={() => openComposer()} disabled={!canPublish} title={canPublish ? undefined : 'You don’t have access to create posts'}>
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
          {canPublish && <ContentPlanner
            location={location}
            byProvider={byProvider}
            onUseIdea={(idea, scheduleAt) => openComposer(idea.content, [idea.platform], scheduleAt)}
            onDraftsAdded={(count) => {
              showToast(`${count} draft${count === 1 ? '' : 's'} added to your calendar`);
              refetchPosts();
            }}
          />}

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
                <div>
                  <h3 className="text-base font-bold text-slate-900" aria-live="polite">
                    {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {postsThisMonth === 0 ? 'No posts this month' : `${postsThisMonth} post${postsThisMonth === 1 ? '' : 's'} this month`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => shiftMonth(-1)} className="btn-ghost text-sm px-2.5 py-1" aria-label="Previous month">‹</button>
                  <button
                    onClick={() => setMonth(startOfMonth(new Date()))}
                    disabled={isCurrentMonth}
                    className="btn-ghost text-xs px-2 py-1"
                  >
                    Today
                  </button>
                  <button onClick={() => shiftMonth(1)} className="btn-ghost text-sm px-2.5 py-1" aria-label="Next month">›</button>
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
                          <p
                            className={`text-xs font-medium mb-1 ${
                              day.isoDate === todayKey
                                ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-white'
                                : dayEvents.length > 0
                                ? 'text-sky-600'
                                : 'text-slate-400'
                            }`}
                            aria-current={day.isoDate === todayKey ? 'date' : undefined}
                          >
                            {day.date}
                          </p>
                          <div className="space-y-1">
                            {dayEvents.map((event) => {
                              const Icon = platformIconMap[event.platform] || Globe;
                              return (
                                <button
                                  type="button"
                                  key={event.id}
                                  title={`${event.time} · ${statusConfig[event.status]?.label ?? event.status}`}
                                  onClick={() => {
                                    const post = posts.find((p) => p.id === event.id);
                                    if (post) openEditor(post);
                                  }}
                                  className={`w-full text-left flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium ${platformColorMap[event.platform] || 'bg-slate-100 text-slate-500'} truncate cursor-pointer hover:opacity-80 transition-opacity`}
                                >
                                  <Icon className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{event.title}</span>
                                </button>
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
                  <div
                    key={post.id}
                    className={`card card-hover p-4 ${isEditable(post) ? 'cursor-pointer' : ''}`}
                    onClick={() => openEditor(post)}
                  >
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
                        {post.media_url && (
                          <img src={post.media_url} alt="" className="mt-2 h-20 w-auto rounded-lg border border-slate-100 object-cover" />
                        )}
                        {post.status === 'failed' && post.last_error && (
                          <p className="flex items-start gap-1.5 mt-2 text-xs text-rose-600">
                            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                            {post.last_error} — click to edit and retry.
                          </p>
                        )}
                        {post.status === 'published' && post.external_url && (
                          <a
                            href={post.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-sky-600 hover:text-sky-700"
                          >
                            View post
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ReviewGraphicModal
        review={selectedReview}
        businessName={location?.name ?? ''}
        onClose={() => setSelectedReview(null)}
        onUseInPost={(image, caption) => {
          setSelectedReview(null);
          openComposer(caption, undefined, null, image);
        }}
      />

      <NewPostModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        location={location}
        byProvider={byProvider}
        post={editingPost}
        initialContent={composerContent}
        initialPlatforms={composerPlatforms}
        initialScheduleAt={composerScheduleAt}
        initialImage={composerImage}
        onSaved={(message) => {
          showToast(message);
          refetchPosts();
        }}
      />

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
