import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { compactWidget, withDefaults, type ChatSettings, type WidgetConfig } from '@/lib/websiteChat';

/**
 * Extra chat widgets (migration 046): each has its own embed code, look, purpose and switches.
 * The main widget stays in chat_settings (lib/websiteChat.ts).
 */
export interface ChatWidget {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  greeting: string;
  accent: string;
  position: 'left' | 'right';
  widget: WidgetConfig;
  extra_info: string;
  ai_enabled: boolean;
  agent_name: string | null;
  collect_leads: boolean;
  assign_to: string | null;
  created_at: string;
  updated_at: string;
}
/** The widget-only fields the Settings page edits next to the shared ChatSettings shape. */
export type WidgetExtras = Pick<ChatWidget, 'name' | 'extra_info' | 'ai_enabled' | 'agent_name' | 'assign_to'>;

export const MAX_EXTRA_INFO = 4000;
const COLUMNS = 'id, name, key, enabled, greeting, accent, position, widget, extra_info, ai_enabled, agent_name, collect_leads, assign_to, created_at, updated_at';

/** A widget as the Settings form sees it (same shape as the main widget's settings). */
export const widgetToSettings = (w: ChatWidget): ChatSettings =>
  withDefaults({ enabled: w.enabled, greeting: w.greeting, accent: w.accent, position: w.position, business_info: '', collect_leads: w.collect_leads, widget: w.widget, updated_at: w.updated_at });
export const widgetExtras = (w: ChatWidget): WidgetExtras => ({ name: w.name, extra_info: w.extra_info, ai_enabled: w.ai_enabled, agent_name: w.agent_name, assign_to: w.assign_to });

export function useChatWidgets() {
  const { location } = useLocationContext();
  const [widgets, setWidgets] = useState<ChatWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const { data, error } = await supabase.from('chat_widgets').select(COLUMNS).eq('location_id', location.id).order('created_at');
    setWidgets((data as ChatWidget[]) ?? []);
    // Usually means migration 046 hasn't been run yet
    setError(error?.message ?? null);
    setLoading(false);
  }, [location]);
  useEffect(() => {
    load();
  }, [load]);

  /** A new widget starts as a copy of the main widget's look and behaviour. */
  const create = useCallback(async (name: string, from: ChatSettings) => {
    if (!location) throw new Error('No business selected');
    const { data, error } = await supabase.from('chat_widgets').insert({
      location_id: location.id, name: name.trim() || 'New widget', greeting: from.greeting, accent: from.accent, position: from.position,
      collect_leads: from.collect_leads, widget: compactWidget(from.widget),
    }).select(COLUMNS).single();
    if (error) throw new Error(error.message);
    const w = data as ChatWidget;
    setWidgets((ws) => [...ws, w]);
    return w;
  }, [location]);

  const save = useCallback(async (id: string, s: ChatSettings, x: WidgetExtras) => {
    const { data, error } = await supabase.from('chat_widgets').update({
      name: x.name, extra_info: x.extra_info, ai_enabled: x.ai_enabled, agent_name: x.agent_name?.trim() || null, assign_to: x.assign_to || null,
      enabled: s.enabled, greeting: s.greeting, accent: s.accent, position: s.position, collect_leads: s.collect_leads, widget: compactWidget(s.widget),
    }).eq('id', id).select(COLUMNS).single();
    if (error) return { error: error.message, widget: null };
    const w = data as ChatWidget;
    setWidgets((ws) => ws.map((x2) => (x2.id === id ? w : x2)));
    return { error: null, widget: w };
  }, []);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('chat_widgets').delete().eq('id', id);
    if (!error) setWidgets((ws) => ws.filter((w) => w.id !== id));
    return error?.message ?? null;
  }, []);

  return { widgets, loading, error, create, save, remove, reload: load };
}
