import { useEffect, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { callFunction } from '@/lib/functions';
import { TikTokIcon } from '@/components/ui/TikTokIcon';
import type { TikTokPostOptions } from '@/types';
import type { TikTokCreatorInfo, TikTokOptions } from '@/lib/tiktok';

const PRIVACY_LABEL: Record<NonNullable<TikTokPostOptions['privacy_level']>, string> = {
  PUBLIC_TO_EVERYONE: 'Everyone',
  MUTUAL_FOLLOW_FRIENDS: 'Friends (followers you follow back)',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
};

/** TikTok's required posting settings (Content Posting API guidelines): no defaults, the person picks. */
export function TikTokSettings({
  connected,
  options,
  onChange,
  onInfo,
}: {
  connected: boolean;
  options: TikTokOptions;
  onChange: (next: TikTokOptions) => void;
  onInfo: (info: TikTokCreatorInfo | null) => void;
}) {
  const [info, setInfo] = useState<TikTokCreatorInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    callFunction<TikTokCreatorInfo>('publish-post', { action: 'tiktok_creator_info' })
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        onInfo(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load your TikTok account');
        onInfo(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per open
  }, [connected]);

  const set = (patch: Partial<TikTokOptions>) => onChange({ ...options, ...patch });

  if (!connected) {
    return <p className="text-xs text-slate-500">Connect TikTok on the Integrations page to choose its posting settings.</p>;
  }

  return (
    <div className="space-y-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900 text-white shrink-0">
          <TikTokIcon className="w-4 h-4" />
        </span>
        {loading ? (
          <span className="flex items-center gap-1.5 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Loading your TikTok account…</span>
        ) : info ? (
          <p className="text-sm text-slate-700 min-w-0">
            Posting to TikTok as <b className="break-all">{info.nickname || info.username}</b>
            {info.username && info.nickname && <span className="text-slate-400"> @{info.username}</span>}
          </p>
        ) : (
          <p className="text-sm text-rose-600">{error}</p>
        )}
      </div>

      {info && (
        <>
          {!info.audited && (
            <p className="flex items-start gap-1.5 text-xs text-slate-500">
              <Info className="w-3.5 h-3.5 mt-px shrink-0" />
              Until TikTok approves Reputation Engine, videos can only be posted as “Only me”. You can change who sees them in the TikTok app.
            </p>
          )}

          <div>
            <label htmlFor="tiktok-privacy" className="block text-xs font-medium text-slate-600 mb-1">Who can see this video</label>
            <select
              id="tiktok-privacy"
              value={options.privacy_level ?? ''}
              onChange={(e) => set({ privacy_level: (e.target.value || undefined) as TikTokOptions['privacy_level'] })}
              className="input-field !py-2"
            >
              <option value="">Choose…</option>
              {info.privacy_level_options.map((p) => (
                <option key={p} value={p} disabled={p === 'SELF_ONLY' && options.branded_content}>
                  {PRIVACY_LABEL[p]}{p === 'SELF_ONLY' && options.branded_content ? ' (not allowed for branded content)' : ''}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-slate-600 mb-1">Allow people to</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {([
                ['allow_comment', 'Comment', info.comment_disabled],
                ['allow_duet', 'Duet', info.duet_disabled],
                ['allow_stitch', 'Stitch', info.stitch_disabled],
              ] as const).map(([key, label, off]) => (
                <label key={key} className={`flex items-center gap-1.5 text-sm ${off ? 'text-slate-400' : 'text-slate-700'}`}>
                  <input
                    type="checkbox"
                    disabled={off}
                    checked={!off && options[key] === true}
                    onChange={(e) => set({ [key]: e.target.checked })}
                    className="rounded border-slate-300"
                  />
                  {label}
                  {off && <span className="text-[11px]">(off in your TikTok settings)</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={options.commercial === true}
                onChange={(e) => set(e.target.checked ? { commercial: true } : { commercial: false, brand_organic: false, branded_content: false })}
                className="rounded border-slate-300"
              />
              This video promotes a brand, product or service
            </label>
            {options.commercial && (
              <div className="mt-2 ml-6 space-y-1.5">
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={options.brand_organic === true} onChange={(e) => set({ brand_organic: e.target.checked })} className="mt-0.5 rounded border-slate-300" />
                  <span>Your brand <span className="block text-xs text-slate-400">Labeled “Promotional content”</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={options.branded_content === true}
                    onChange={(e) => set({ branded_content: e.target.checked, ...(e.target.checked && options.privacy_level === 'SELF_ONLY' ? { privacy_level: undefined } : {}) })}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>Branded content (paid partnership) <span className="block text-xs text-slate-400">Labeled “Paid partnership”</span></span>
                </label>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            By posting, you agree to TikTok’s{' '}
            {options.branded_content && (
              <>
                <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">Branded Content Policy</a>
                {' and '}
              </>
            )}
            <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">Music Usage Confirmation</a>.
            {' '}TikTok can take a few minutes to process the video after it’s sent.
          </p>
        </>
      )}
    </div>
  );
}
