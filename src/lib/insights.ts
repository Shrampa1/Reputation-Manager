import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';

export interface InsightTheme {
  theme: string;
  detail: string;
  mentions: number;
}

export interface ReviewInsight {
  id: string;
  location_id: string;
  period_start: string;
  period_end: string;
  kind: 'manual' | 'monthly';
  review_count: number;
  feedback_count: number;
  avg_rating: number | null;
  summary: {
    headline: string;
    sentiment: { positive: number; neutral: number; negative: number };
    praise: InsightTheme[];
    complaints: InsightTheme[];
    suggestions: { title: string; detail: string }[];
    quotes: { text: string; rating: number }[];
  };
  created_at: string;
}

const COLUMNS = 'id, location_id, period_start, period_end, kind, review_count, feedback_count, avg_rating, summary, created_at';

/** The business's saved summaries, newest first. */
export function useReviewInsights(locationId: string | undefined) {
  const [insights, setInsights] = useState<ReviewInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('review_insights')
      .select(COLUMNS)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(24);
    setError(err ? err.message : null);
    setInsights(((data ?? []) as ReviewInsight[]).map((r) => ({ ...r, avg_rating: r.avg_rating === null ? null : Number(r.avg_rating) })));
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    load();
  }, [load]);

  return { insights, loading, error, reload: load };
}

export async function generateInsights(days: 30 | 90): Promise<ReviewInsight> {
  const { insight } = await callFunction<{ insight: ReviewInsight }>('review-insights', { days });
  return insight;
}

export function periodLabel(i: Pick<ReviewInsight, 'period_start' | 'period_end' | 'kind'>) {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, opts);
  if (i.kind === 'monthly') return fmt(i.period_start, { month: 'long', year: 'numeric' });
  return `${fmt(i.period_start, { month: 'short', day: 'numeric' })} – ${fmt(i.period_end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
