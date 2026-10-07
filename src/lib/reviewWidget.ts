import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import type { ReviewWidgetSettings } from '@/types';

export const DEFAULT_WIDGET: Omit<ReviewWidgetSettings, 'location_id'> = {
  enabled: false,
  layout: 'carousel',
  theme: 'light',
  accent: '#0ea5e9',
  min_rating: 4,
  max_reviews: 9,
  require_text: true,
  show_summary: true,
};

const COLUMNS = 'location_id, enabled, layout, theme, accent, min_rating, max_reviews, require_text, show_summary, updated_at';

/** The business's website widget settings (defaults until first saved). */
export function useReviewWidget() {
  const { location } = useLocationContext();
  const [settings, setSettings] = useState<ReviewWidgetSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('review_widgets')
      .select(COLUMNS)
      .eq('location_id', location.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSettings((data as ReviewWidgetSettings | null) ?? { location_id: location.id, ...DEFAULT_WIDGET });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location]);

  const save = useCallback(
    async (values: Omit<ReviewWidgetSettings, 'location_id' | 'updated_at'>) => {
      if (!location) return 'No business selected';
      const { data, error } = await supabase
        .from('review_widgets')
        .upsert({ location_id: location.id, ...values })
        .select(COLUMNS)
        .single();
      if (error) return error.message;
      setSettings(data as ReviewWidgetSettings);
      return null;
    },
    [location]
  );

  return { settings, loading, save };
}

/** The HTML a business pastes into their website. */
export function widgetSnippet(publicKey: string) {
  const api = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reviews-widget`;
  return `<div class="reputation-engine-reviews" data-key="${publicKey}"></div>
<script src="${window.location.origin}/widget.js" data-api="${api}" async></script>`;
}
