import { useState } from 'react';
import {
  Check,
  Facebook,
  FilePlus2,
  Globe,
  Image as ImageIcon,
  Instagram,
  Loader2,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { PLATFORM_PROVIDER } from '@/lib/integrations';
import type { Integration, IntegrationProvider, Location, PostPlatform } from '@/types';

export interface PlannedPost {
  date: string; // YYYY-MM-DD
  platform: PostPlatform;
  theme: string;
  content: string;
  image_idea: string;
}

const PLATFORM_OPTIONS: { key: PostPlatform; label: string; icon: typeof Facebook; color: string }[] = [
  { key: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-50 text-blue-600' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-pink-50 text-pink-600' },
  { key: 'google', label: 'Google', icon: Globe, color: 'bg-red-50 text-red-600' },
];

const PERIODS = [
  { days: 7, label: 'Next 7 days' },
  { days: 14, label: 'Next 2 weeks' },
  { days: 30, label: 'Next 30 days' },
];

/** Local YYYY-MM-DD for "tomorrow" — plans start the day after you generate them */
function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 10:00 local time on a YYYY-MM-DD day */
function plannedPostTime(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 10, 0, 0, 0);
}

function dayLabel(date: string) {
  return plannedPostTime(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function ContentPlanner({
  location,
  byProvider,
  onUseIdea,
  onDraftsAdded,
}: {
  location: Location | null;
  byProvider: (provider: IntegrationProvider) => Integration | null;
  /** Open the post form prefilled with this idea, scheduled for 10:00 on its day */
  onUseIdea: (idea: PlannedPost, scheduleAt: Date) => void;
  onDraftsAdded: (count: number) => void;
}) {
  const connected = PLATFORM_OPTIONS.map((p) => p.key).filter((p) => byProvider(PLATFORM_PROVIDER[p])?.status === 'connected');

  const [prompt, setPrompt] = useState('');
  const [days, setDays] = useState(14);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [platforms, setPlatforms] = useState<PostPlatform[] | null>(null); // null = follow connected accounts
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<PlannedPost[]>([]);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [savingDrafts, setSavingDrafts] = useState(false);

  const selectedPlatforms = platforms ?? (connected.length > 0 ? connected : ['facebook', 'google']);

  const togglePlatform = (p: PostPlatform) => {
    const next = selectedPlatforms.includes(p) ? selectedPlatforms.filter((x) => x !== p) : [...selectedPlatforms, p];
    setPlatforms(next);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length < 3) {
      setError('Describe what you’d like to post about.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError('Choose at least one platform.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { posts } = await callFunction<{ posts: PlannedPost[] }>('generate-content-calendar', {
        prompt: prompt.trim(),
        startDate: tomorrowKey(),
        days,
        postsPerWeek,
        platforms: selectedPlatforms,
      });
      setIdeas(posts);
      setUsed(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleUse = (index: number) => {
    onUseIdea(ideas[index], plannedPostTime(ideas[index].date));
    setUsed((prev) => new Set(prev).add(index));
  };

  /** Saves every idea not yet opened as a draft on its planned day, so it shows on the calendar */
  const handleAddAllAsDrafts = async () => {
    if (!location) return;
    const remaining = ideas.map((idea, i) => ({ idea, i })).filter(({ i }) => !used.has(i));
    if (remaining.length === 0) return;
    setSavingDrafts(true);
    setError(null);
    const { error: insertError } = await supabase.from('social_posts').insert(
      remaining.map(({ idea }) => ({
        location_id: location.id,
        platform: idea.platform,
        content: idea.content,
        status: 'draft',
        scheduled_for: plannedPostTime(idea.date).toISOString(),
      }))
    );
    setSavingDrafts(false);
    if (insertError) {
      setError(`Couldn't save the drafts: ${insertError.message}`);
      return;
    }
    setUsed(new Set(ideas.map((_, i) => i)));
    onDraftsAdded(remaining.length);
  };

  const remainingCount = ideas.length - used.size;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">AI Content Calendar Generator</h2>
          <p className="text-xs text-slate-400">Describe your goals and AI plans your posts — you review everything before it goes out</p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="space-y-3" noValidate>
        <label htmlFor="planner-prompt" className="sr-only">What should the posts be about?</label>
        <textarea
          id="planner-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="e.g., Fall maintenance tips, promote our water heater service, and feature a happy customer"
          className="input-field resize-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="planner-period" className="sr-only">Period</label>
          <select id="planner-period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="input-field !w-auto !py-2">
            {PERIODS.map((p) => (
              <option key={p.days} value={p.days}>{p.label}</option>
            ))}
          </select>
          <label htmlFor="planner-frequency" className="sr-only">Posts per week</label>
          <select
            id="planner-frequency"
            value={postsPerWeek}
            onChange={(e) => setPostsPerWeek(Number(e.target.value))}
            className="input-field !w-auto !py-2"
          >
            {[2, 3, 4, 5, 7].map((n) => (
              <option key={n} value={n}>{n} posts / week</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5" role="group" aria-label="Platforms">
            {PLATFORM_OPTIONS.map((p) => {
              const active = selectedPlatforms.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePlatform(p.key)}
                  title={p.label}
                  className={`flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-medium transition-all ${
                    active ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <p.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{p.label}</span>
                </button>
              );
            })}
          </div>
          <button type="submit" disabled={generating} className="btn-primary sm:ml-auto">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Planning…' : ideas.length > 0 ? 'Regenerate' : 'Generate'}
          </button>
        </div>

        {generating && (
          <p className="text-xs text-slate-400" role="status">Planning your posts — this can take up to a minute.</p>
        )}
        {error && (
          <p className="text-sm text-rose-600" role="alert">{error}</p>
        )}
      </form>

      {ideas.length > 0 && (
        <div className="mt-5 animate-fade-in">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {ideas.length} post idea{ideas.length === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              onClick={handleAddAllAsDrafts}
              disabled={savingDrafts || remainingCount === 0 || !location}
              className="btn-secondary !py-1.5 text-xs"
              title="Saves them as drafts on their planned days; nothing is published until you schedule it"
            >
              {savingDrafts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
              {remainingCount === 0 ? 'All added' : `Add ${remainingCount === ideas.length ? 'all' : remainingCount} as drafts`}
            </button>
          </div>

          <ul className="space-y-2">
            {ideas.map((idea, i) => {
              const platform = PLATFORM_OPTIONS.find((p) => p.key === idea.platform) ?? PLATFORM_OPTIONS[0];
              const isUsed = used.has(i);
              return (
                <li key={i} className={`p-3 rounded-xl border ${isUsed ? 'border-slate-100 bg-slate-50/60' : 'border-sky-100 bg-sky-50/30'}`}>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${platform.color}`}>
                      <platform.icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{dayLabel(idea.date)}</span>
                    {idea.theme && <span className="badge bg-white border border-slate-200 text-slate-500">{idea.theme}</span>}
                    <button
                      type="button"
                      onClick={() => handleUse(i)}
                      disabled={isUsed}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 disabled:text-emerald-600 disabled:cursor-default"
                    >
                      {isUsed ? <Check className="w-3.5 h-3.5" /> : <PenLine className="w-3.5 h-3.5" />}
                      {isUsed ? 'Opened' : 'Edit & schedule'}
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{idea.content}</p>
                  {idea.image_idea && (
                    <p className="flex items-start gap-1.5 mt-2 text-xs text-slate-500">
                      <ImageIcon className="w-3.5 h-3.5 mt-px shrink-0" />
                      <span><span className="font-medium">Photo idea:</span> {idea.image_idea}</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
