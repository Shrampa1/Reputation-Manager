import type { TikTokPostOptions } from '@/types';

export interface TikTokCreatorInfo {
  username: string | null;
  nickname: string | null;
  avatar_url: string | null;
  privacy_level_options: NonNullable<TikTokPostOptions['privacy_level']>[];
  audited: boolean;
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number | null;
}

export type TikTokOptions = TikTokPostOptions & { commercial?: boolean };

/** Problems that stop a TikTok post from being scheduled or published (null = fine). */
export function tiktokProblem(
  options: TikTokOptions,
  info: TikTokCreatorInfo | null,
  durationSec: number | null,
): string | null {
  if (!info) return 'Waiting for your TikTok account details.';
  if (!options.privacy_level) return 'Choose who can see the TikTok post.';
  if (!info.privacy_level_options.includes(options.privacy_level)) return 'That TikTok privacy setting isn’t available. Pick another one.';
  if (options.commercial && !options.brand_organic && !options.branded_content) {
    return 'Say whether the TikTok video promotes your own brand, a paid partner, or both.';
  }
  if (options.branded_content && options.privacy_level === 'SELF_ONLY') {
    return 'Branded content can’t be private on TikTok. Pick another privacy setting.';
  }
  if (info.max_video_post_duration_sec && durationSec && durationSec > info.max_video_post_duration_sec + 0.5) {
    return `This video is ${Math.round(durationSec)} s long. Your TikTok account allows up to ${info.max_video_post_duration_sec} s.`;
  }
  return null;
}
