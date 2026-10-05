import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Facebook,
  FileText,
  Globe,
  ImagePlus,
  Instagram,
  Loader2,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { uploadPostImage } from '@/lib/media';
import { PLATFORM_PROVIDER } from '@/lib/integrations';
import { useLocationContext } from '@/context/LocationContext';
import type { Integration, IntegrationProvider, Location, PostPlatform, SocialPost } from '@/types';

type PublishMode = 'draft' | 'schedule' | 'now';

const PLATFORMS: {
  key: PostPlatform;
  label: string;
  icon: typeof Facebook;
  activeClass: string;
  maxLength: number;
  requiresImage: boolean;
}[] = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, activeClass: 'border-blue-400 bg-blue-50 text-blue-700', maxLength: 63206, requiresImage: false },
  { key: 'instagram', label: 'Instagram', icon: Instagram, activeClass: 'border-pink-400 bg-pink-50 text-pink-700', maxLength: 2200, requiresImage: true },
  { key: 'google', label: 'Google', icon: Globe, activeClass: 'border-red-400 bg-red-50 text-red-700', maxLength: 1500, requiresImage: false },
];

const MIN_SCHEDULE_LEAD_MS = 2 * 60_000;

/** ISO → value for <input type="datetime-local"> in the user's timezone */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultScheduleTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d);
}

export interface NewPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  byProvider: (provider: IntegrationProvider) => Integration | null;
  /** Edit an existing post instead of creating new ones */
  post?: SocialPost | null;
  /** Prefill content for a new post (e.g. from AI suggestions or a review) */
  initialContent?: string;
  /** Preselect platforms for a new post (defaults to every connected platform) */
  initialPlatforms?: PostPlatform[];
  /** Preselect a schedule time for a new post; ignored if it's already in the past */
  initialScheduleAt?: Date | null;
  onSaved: (message: string) => void;
}

export function NewPostModal({
  isOpen,
  onClose,
  location,
  byProvider,
  post,
  initialContent,
  initialPlatforms,
  initialScheduleAt,
  onSaved,
}: NewPostModalProps) {
  const isEdit = Boolean(post);
  const { isAdmin } = useLocationContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [platforms, setPlatforms] = useState<PostPlatform[]>([]);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<PublishMode>('draft');
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleTime());
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = (p: PostPlatform) => byProvider(PLATFORM_PROVIDER[p])?.status === 'connected';

  // Reset the form every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setImageFile(null);
    setSubmitting(false);
    setDeleting(false);
    if (post) {
      setPlatforms([post.platform]);
      setContent(post.content);
      setExistingMediaUrl(post.media_url);
      setImagePreview(post.media_url);
      if (post.status === 'scheduled' && post.scheduled_for) {
        setMode('schedule');
        setScheduleAt(toLocalInput(new Date(post.scheduled_for)));
      } else {
        setMode('draft');
        setScheduleAt(defaultScheduleTime());
      }
    } else {
      const connected = PLATFORMS.map((p) => p.key).filter((p) => byProvider(PLATFORM_PROVIDER[p])?.status === 'connected');
      setPlatforms(initialPlatforms?.length ? initialPlatforms : connected.length > 0 ? connected : ['facebook']);
      setContent(initialContent ?? '');
      setExistingMediaUrl(null);
      setImagePreview(null);
      if (initialScheduleAt && initialScheduleAt.getTime() > Date.now() + MIN_SCHEDULE_LEAD_MS) {
        setMode('schedule');
        setScheduleAt(toLocalInput(initialScheduleAt));
      } else {
        setMode('draft');
        setScheduleAt(defaultScheduleTime());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open
  }, [isOpen, post?.id]);

  // Revoke blob URLs for locally picked images
  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const selected = PLATFORMS.filter((p) => platforms.includes(p.key));
  const maxLength = selected.length > 0 ? Math.min(...selected.map((p) => p.maxLength)) : 63206;
  const hasImage = Boolean(imageFile || existingMediaUrl);
  const disconnectedSelected = selected.filter((p) => !isConnected(p.key));

  const validationError = useMemo(() => {
    if (platforms.length === 0) return 'Choose at least one platform.';
    if (!content.trim()) return 'Write something to post.';
    if (content.length > maxLength) return `Too long for ${selected.find((p) => content.length > p.maxLength)?.label} (max ${maxLength.toLocaleString()} characters).`;
    if (mode !== 'draft') {
      const needImage = selected.find((p) => p.requiresImage && !hasImage);
      if (needImage) return `${needImage.label} posts need an image.`;
      if (disconnectedSelected.length > 0) {
        return `Connect ${disconnectedSelected.map((p) => p.label).join(' and ')} before ${mode === 'now' ? 'publishing' : 'scheduling'}, or save as a draft.`;
      }
    }
    if (mode === 'schedule') {
      const when = new Date(scheduleAt).getTime();
      if (Number.isNaN(when)) return 'Pick a date and time.';
      if (when < Date.now() + MIN_SCHEDULE_LEAD_MS) return 'Schedule at least a few minutes in the future.';
    }
    return null;
  }, [platforms, content, maxLength, selected, mode, hasImage, disconnectedSelected, scheduleAt]);

  const togglePlatform = (p: PostPlatform) => {
    if (isEdit) return;
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPEG, PNG or WebP).');
      return;
    }
    setError(null);
    setImageFile(file);
    setExistingMediaUrl(null);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setExistingMediaUrl(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (validationError || !location) {
      setError(validationError ?? 'No business location loaded.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      let mediaUrl = existingMediaUrl;
      if (imageFile) mediaUrl = await uploadPostImage(location.organization_id, imageFile);

      const fields = {
        content: content.trim(),
        media_url: mediaUrl,
        status: mode === 'schedule' ? 'scheduled' : 'draft',
        scheduled_for: mode === 'schedule' ? new Date(scheduleAt).toISOString() : null,
      } as const;

      let ids: string[];
      if (post) {
        const { error: updateError } = await supabase.from('social_posts').update(fields).eq('id', post.id);
        if (updateError) throw new Error(updateError.message);
        ids = [post.id];
      } else {
        const { data, error: insertError } = await supabase
          .from('social_posts')
          .insert(platforms.map((platform) => ({ ...fields, platform, location_id: location.id })))
          .select('id');
        if (insertError) throw new Error(insertError.message);
        ids = (data ?? []).map((r) => r.id as string);
      }

      if (mode !== 'now') {
        const noun = ids.length > 1 ? `${ids.length} posts` : 'Post';
        onSaved(
          mode === 'schedule'
            ? `${noun} scheduled for ${new Date(scheduleAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : `${noun} saved as draft`
        );
        onClose();
        return;
      }

      // Publish now: one call per platform post
      const results = await Promise.allSettled(ids.map((postId) => callFunction('publish-post', { postId })));
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length === 0) {
        onSaved(ids.length > 1 ? `Published to ${ids.length} platforms` : 'Post published');
        onClose();
      } else if (failed.length < results.length) {
        onSaved(`Published to ${results.length - failed.length} of ${results.length} platforms. Failed posts are marked in the list.`);
        onClose();
      } else {
        // Posts were saved (marked failed), so close and let the list show the error
        onSaved(`Publishing failed: ${(failed[0].reason as Error)?.message ?? 'unknown error'}`);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from('social_posts').delete().eq('id', post.id);
    setDeleting(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onSaved('Post deleted');
    onClose();
  };

  const submitLabel = mode === 'now' ? 'Publish now' : mode === 'schedule' ? 'Schedule' : 'Save draft';
  const SubmitIcon = mode === 'now' ? Send : mode === 'schedule' ? CalendarClock : FileText;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={isEdit ? 'Edit post' : 'New post'}
      subtitle={isEdit ? undefined : 'Write once, publish to every selected platform'}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {post?.status === 'failed' && post.last_error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-700">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Last attempt failed: {post.last_error}</p>
          </div>
        )}

        {/* Platforms */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-2">{isEdit ? 'Platform' : 'Post to'}</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.filter((p) => !isEdit || platforms.includes(p.key)).map((p) => {
              const active = platforms.includes(p.key);
              const connected = isConnected(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePlatform(p.key)}
                  disabled={isEdit}
                  aria-pressed={active}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    active ? p.activeClass : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  } ${isEdit ? 'cursor-default' : ''}`}
                >
                  <p.icon className="w-4 h-4" />
                  {p.label}
                  {active && <Check className="w-3.5 h-3.5" />}
                  {!connected && <span className="text-[10px] font-semibold uppercase text-slate-400">Not connected</span>}
                </button>
              );
            })}
          </div>
          {disconnectedSelected.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              You can save drafts for any platform.{' '}
              {isAdmin ? (
                <>
                  <Link to="/integrations" className="font-medium text-sky-600 hover:text-sky-700" onClick={onClose}>
                    Connect accounts
                  </Link>{' '}
                  to schedule or publish.
                </>
              ) : (
                'Ask an owner or admin to connect the account to schedule or publish.'
              )}
            </p>
          )}
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="post-content" className="text-sm font-semibold text-slate-900">Content</label>
            <span className={`text-xs ${content.length > maxLength ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
              {content.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          </div>
          <textarea
            id="post-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="What would you like to share with your customers?"
            className="input-field resize-y leading-relaxed"
          />
        </div>

        {/* Image */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-2">
            Image{' '}
            <span className="font-normal text-slate-400">
              {platforms.includes('instagram') ? '(required for Instagram)' : '(optional)'}
            </span>
          </p>
          {imagePreview ? (
            <div className="relative inline-block">
              <img src={imagePreview} alt="Post attachment preview" className="h-40 w-auto max-w-full rounded-xl border border-slate-200 object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                aria-label="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className="w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-sky-300 hover:bg-sky-50/30 transition-all"
            >
              <ImagePlus className="w-6 h-6 text-slate-400" />
              <span className="text-sm font-medium">Add an image</span>
              <span className="text-xs text-slate-400">JPEG, PNG or WebP — resized and converted to JPEG</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        {/* When */}
        <div>
          <p className="text-sm font-semibold text-slate-900 mb-2">When</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {([
              { key: 'draft', label: 'Save draft', icon: FileText },
              { key: 'schedule', label: 'Schedule', icon: CalendarClock },
              { key: 'now', label: 'Publish now', icon: Send },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={mode === opt.key}
                onClick={() => setMode(opt.key)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  mode === opt.key ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <opt.icon className="w-4 h-4" />
                {opt.label}
              </button>
            ))}
          </div>
          {mode === 'schedule' && (
            <input
              type="datetime-local"
              value={scheduleAt}
              min={toLocalInput(new Date(Date.now() + MIN_SCHEDULE_LEAD_MS))}
              onChange={(e) => setScheduleAt(e.target.value)}
              className="input-field mt-2"
              aria-label="Schedule date and time"
            />
          )}
        </div>

        {(error || (validationError && content.trim())) && (
          <p className="text-sm text-rose-600">{error ?? validationError}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={handleSubmit} disabled={submitting || deleting || Boolean(validationError)} className="btn-primary flex-1">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SubmitIcon className="w-4 h-4" />}
            {submitting ? (mode === 'now' ? 'Publishing…' : 'Saving…') : submitLabel}
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting || deleting}
              className="btn-secondary text-rose-600"
              aria-label="Delete post"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
