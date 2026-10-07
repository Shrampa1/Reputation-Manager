import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

export interface ReportSettings {
  organization_id: string;
  brand_name: string | null;
  logo_url: string | null;
  brand_color: string;
  prepared_by: string | null;
  hide_app_branding: boolean;
}

export const DEFAULT_BRAND_COLOR = '#0ea5e9';

export function useReportSettings() {
  const { organization } = useLocationContext();
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organization) return;
    let cancelled = false;
    supabase
      .from('report_settings')
      .select('organization_id, brand_name, logo_url, brand_color, prepared_by, hide_app_branding')
      .eq('organization_id', organization.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSettings((data as ReportSettings | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organization]);

  const save = useCallback(
    async (values: Omit<ReportSettings, 'organization_id'>) => {
      if (!organization) return { error: 'No business loaded' };
      const { data, error } = await supabase
        .from('report_settings')
        .upsert({ organization_id: organization.id, ...values, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' })
        .select('organization_id, brand_name, logo_url, brand_color, prepared_by, hide_app_branding')
        .single();
      if (error) return { error: error.message };
      setSettings(data as ReportSettings);
      return { error: null };
    },
    [organization]
  );

  return { settings, loading, save };
}
