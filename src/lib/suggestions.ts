import type { Integration, Lead, Location, Review, SocialPost } from '@/types';

export interface Suggestion {
  /** Stable per kind of suggestion, so a dismissal hides it for a day */
  id: string;
  title: string;
  description: string;
  route: string;
  priority: 'high' | 'medium' | 'low';
}

const DAY = 86_400_000;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Recommendations worked out from the business's own data (no AI, nothing stored). */
export function computeSuggestions(input: {
  reviews: Review[];
  leads: Lead[];
  posts: SocialPost[];
  integrations: Integration[];
  location: Location | null;
  isAdmin: boolean;
  now?: number;
}): Suggestion[] {
  const { reviews, leads, posts, integrations, location, isAdmin } = input;
  const now = input.now ?? Date.now();
  const out: Suggestion[] = [];

  const unreplied = reviews.filter((r) => !r.is_replied);
  const critical = unreplied.filter((r) => r.rating <= 3);
  if (critical.length > 0) {
    out.push({
      id: 'reply-critical',
      title: `Reply to ${plural(critical.length, 'critical review')}`,
      description: 'A quick, calm reply to a 1–3 star review shows future customers you care. AI can draft it for you.',
      route: '/reviews',
      priority: 'high',
    });
  }
  const positive = unreplied.length - critical.length;
  if (positive > 0) {
    out.push({
      id: 'reply-positive',
      title: `Thank ${plural(positive, 'happy customer')}`,
      description: `${plural(positive, 'positive review')} ${positive === 1 ? 'is' : 'are'} waiting for a reply.`,
      route: '/reviews',
      priority: 'medium',
    });
  }

  const broken = integrations.filter((i) => i.status === 'error');
  if (isAdmin && broken.length > 0) {
    out.push({
      id: 'fix-integrations',
      title: `Reconnect ${plural(broken.length, 'account')}`,
      description: 'Scheduled posts to a disconnected account will fail until you reconnect it.',
      route: '/integrations',
      priority: 'high',
    });
  }

  if (isAdmin && location && !location.gbp_place_id) {
    out.push({
      id: 'connect-google-listing',
      title: 'Connect your Google listing',
      description: 'See your Google rating here, import Google reviews automatically and check your details match.',
      route: '/seo?tab=google',
      priority: 'medium',
    });
  }

  if (isAdmin && location && !location.review_link) {
    out.push({
      id: 'add-review-link',
      title: 'Add your Google review link',
      description: 'Needed before you can email customers asking for reviews.',
      route: '/settings#review-requests',
      priority: 'high',
    });
  }

  const readyForReview = leads.filter((l) => l.stage === 'completed' && l.email);
  if (readyForReview.length > 0) {
    out.push({
      id: 'ask-for-reviews',
      title: `Ask ${plural(readyForReview.length, 'recent customer')} for a review`,
      description: 'Jobs marked Completed are the best time to ask, while the experience is fresh.',
      route: '/leads',
      priority: 'medium',
    });
  }

  const staleNew = leads.filter((l) => l.stage === 'new_lead' && now - new Date(l.created_at).getTime() > 2 * DAY);
  if (staleNew.length > 0) {
    out.push({
      id: 'follow-up-leads',
      title: `Follow up with ${plural(staleNew.length, 'new lead')}`,
      description: 'They contacted you more than 2 days ago and are still marked New Lead.',
      route: '/leads',
      priority: staleNew.length >= 3 ? 'high' : 'medium',
    });
  }

  const nextWeek = posts.filter((p) => {
    if (p.status !== 'scheduled' || !p.scheduled_for) return false;
    const t = new Date(p.scheduled_for).getTime();
    return t >= now && t <= now + 7 * DAY;
  });
  if (nextWeek.length === 0) {
    out.push({
      id: 'plan-posts',
      title: 'Nothing scheduled for the next 7 days',
      description: 'Regular posts keep your profiles active. Let AI plan a week of posts in a minute.',
      route: '/social',
      priority: 'medium',
    });
  }

  if (isAdmin && !integrations.some((i) => i.status === 'connected' && i.provider !== 'twilio')) {
    out.push({
      id: 'connect-accounts',
      title: 'Connect a social account',
      description: 'Link Google Business Profile, Facebook or Instagram to publish straight from here.',
      route: '/integrations',
      priority: 'low',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ---- Dismissals (per browser, for 24 hours)
const storageKey = (locationId: string) => `dismissed-suggestions:${locationId}`;

export function loadDismissed(locationId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(storageKey(locationId));
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const cutoff = Date.now() - DAY;
    return Object.fromEntries(Object.entries(parsed).filter(([, t]) => typeof t === 'number' && t > cutoff));
  } catch {
    return {};
  }
}

export function saveDismissed(locationId: string, dismissed: Record<string, number>) {
  try {
    localStorage.setItem(storageKey(locationId), JSON.stringify(dismissed));
  } catch {
    /* storage unavailable: the dismissal just won't survive a reload */
  }
}
