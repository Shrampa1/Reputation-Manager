import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';

/** Live chat settings (migrations 035, 039) + the website-chat function + public/chat.js. Inbox: lib/liveChat.ts. */
export type FieldMode = 'off' | 'optional' | 'required';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface HoursRange { from: string; to: string }

/** Everything about how the chat looks and behaves on the website (chat_settings.widget). */
export interface WidgetConfig {
  appearance?: {
    launcher?: 'bubble' | 'bubble_text';
    launcher_text?: string;
    title?: string;
    subtitle?: string;
    logo_url?: string;
    offset_x?: number;
    offset_y?: number;
    hide_on_mobile?: boolean;
    sound?: boolean;
  };
  texts?: Partial<Record<TextKey, string>>;
  hours?: { enabled?: boolean; timezone?: string; days?: Partial<Record<Weekday, HoursRange[]>>; outside?: 'ai' | 'form' };
  prechat?: { enabled?: boolean; title?: string; button?: string; name?: FieldMode; email?: FieldMode; phone?: FieldMode; question?: string; question_required?: boolean };
  quick_questions?: string[];
  suggestions?: boolean;
  attention?: { enabled?: boolean; text?: string; delay?: number };
  pages?: { mode?: 'all' | 'only' | 'except'; patterns?: string[] };
  proactive?: { contains?: string; delay?: number; message?: string }[];
  calls?: { enabled?: boolean };
  help?: { enabled?: boolean };
}

/** Visitor-facing labels that can be changed (any language). Defaults match public/chat.js. */
export const TEXT_DEFAULTS = {
  placeholder: 'Type your message…',
  send: 'Send',
  online: 'We’re online',
  away: 'We usually reply in a few minutes',
  closed: 'We’re away right now',
  waiting: 'A team member will join soon',
  chatting: 'You’re chatting with',
  typing: 'is typing…',
  newChat: 'New chat',
  transcript: 'Email me this chat',
  chatTab: 'Chat',
  helpTab: 'Help',
  searchHelp: 'Search our help articles',
  prechatTitle: 'Before we start',
  prechatStart: 'Start chat',
  offlineTitle: 'Leave us a message',
  offlineIntro: 'We’re away right now. Leave your details and we’ll get back to you.',
  offlineSend: 'Send message',
  rateTitle: 'How did we do?',
  rateThanks: 'Thanks for your feedback!',
  helpful: 'Was this helpful?',
  call: 'Call us',
  calling: 'Calling…',
  incoming: 'is calling you',
  connected: 'On a call',
  accept: 'Accept',
  decline: 'Decline',
  hangUp: 'Hang up',
  mute: 'Mute',
  unmute: 'Unmute',
};
export type TextKey = keyof typeof TEXT_DEFAULTS;

export const WEEKDAYS: [Weekday, string][] = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];

export const DEFAULT_WIDGET: WidgetConfig = {
  appearance: { launcher: 'bubble', offset_x: 20, offset_y: 20, sound: true },
  hours: {
    enabled: false,
    outside: 'ai',
    days: { mon: [{ from: '09:00', to: '17:00' }], tue: [{ from: '09:00', to: '17:00' }], wed: [{ from: '09:00', to: '17:00' }], thu: [{ from: '09:00', to: '17:00' }], fri: [{ from: '09:00', to: '17:00' }] },
  },
  prechat: { enabled: false, name: 'optional', email: 'required', phone: 'off' },
  quick_questions: [],
  suggestions: true,
  attention: { enabled: false, text: '👋 Need help? Ask us anything.', delay: 8 },
  pages: { mode: 'all', patterns: [] },
  proactive: [],
  calls: { enabled: false },
  help: { enabled: true },
};

export interface ChatSettings {
  enabled: boolean;
  greeting: string;
  accent: string;
  position: 'left' | 'right';
  business_info: string;
  collect_leads: boolean;
  widget: WidgetConfig;
  updated_at?: string;
}

export const DEFAULT_CHAT: ChatSettings = {
  enabled: false,
  greeting: 'Hi! Ask me anything about us.',
  accent: '#0284c7',
  position: 'right',
  business_info: '',
  collect_leads: true,
  widget: DEFAULT_WIDGET,
};
export const MAX_INFO = 8000;

const COLUMNS = 'enabled, greeting, accent, position, business_info, collect_leads, widget, updated_at';

/** Saved settings merged over the defaults (older rows have no widget settings). */
const withDefaults = (s: Partial<ChatSettings> | null): ChatSettings => {
  const w = (s?.widget ?? {}) as WidgetConfig;
  return {
    ...DEFAULT_CHAT,
    ...(s ?? {}),
    widget: {
      ...DEFAULT_WIDGET,
      ...w,
      appearance: { ...DEFAULT_WIDGET.appearance, ...w.appearance },
      hours: { ...DEFAULT_WIDGET.hours, ...w.hours },
      prechat: { ...DEFAULT_WIDGET.prechat, ...w.prechat },
      attention: { ...DEFAULT_WIDGET.attention, ...w.attention },
      pages: { ...DEFAULT_WIDGET.pages, ...w.pages },
      calls: { ...DEFAULT_WIDGET.calls, ...w.calls },
      help: { ...DEFAULT_WIDGET.help, ...w.help },
    },
  };
};

/** Drops empty values so the saved JSON stays small. */
function compactWidget(w: WidgetConfig): WidgetConfig {
  const texts = Object.fromEntries(Object.entries(w.texts ?? {}).filter(([k, v]) => v && v.trim() && v !== TEXT_DEFAULTS[k as TextKey]));
  return {
    ...w,
    texts,
    quick_questions: (w.quick_questions ?? []).map((q) => q.trim()).filter(Boolean).slice(0, 6),
    proactive: (w.proactive ?? []).filter((p) => p.message?.trim()).slice(0, 5),
    pages: { ...w.pages, patterns: (w.pages?.patterns ?? []).map((p) => p.trim()).filter(Boolean).slice(0, 20) },
  };
}

/** Settings, this month's AI usage and whether the plan includes web calls. */
export function useWebsiteChat() {
  const { location, organization } = useLocationContext();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [callsAvailable, setCallsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location || !organization) return;
    const [s, used, limit, calls] = await Promise.all([
      supabase.from('chat_settings').select(COLUMNS).eq('location_id', location.id).maybeSingle(),
      supabase.rpc('chat_messages_used', { p_org: organization.id }),
      supabase.rpc('plan_limit', { p_org: organization.id, p_key: 'chat_messages' }),
      supabase.rpc('chat_calls_enabled', { p_org: organization.id }),
    ]);
    setSettings(withDefaults(s.data as Partial<ChatSettings> | null));
    setUsage(used.error || limit.error ? null : { used: Number(used.data), limit: Number(limit.data) });
    setCallsAvailable(calls.data === true);
    // Usually means a migration (035/039) hasn't been run yet
    setLoadError(s.error?.message ?? null);
    setLoading(false);
  }, [location, organization]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (values: ChatSettings) => {
    if (!location) return 'No business selected';
    const { enabled, greeting, accent, position, business_info, collect_leads, widget } = values;
    const { data, error } = await supabase.from('chat_settings')
      .upsert({ location_id: location.id, enabled, greeting, accent, position, business_info, collect_leads, widget: compactWidget(widget) })
      .select(COLUMNS).single();
    if (error) return error.message;
    setSettings(withDefaults(data as Partial<ChatSettings>));
    return null;
  }, [location]);

  return { settings, usage, callsAvailable, loading, loadError, save, reload: load };
}

export const chatApi = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/website-chat`;

/** The HTML a business pastes into their website, just before </body>. */
export function chatSnippet(publicKey: string) {
  return `<script src="${window.location.origin}/chat.js" data-key="${publicKey}" data-api="${chatApi()}" async></script>`;
}

/** Starting text for "About your business". */
export function draftBusinessInfo(name: string) {
  return [
    `${name} is …(what you do, in one sentence).`,
    '',
    'Services and prices:',
    '- …',
    '',
    'Opening hours:',
    '- Mon–Fri …',
    '',
    'Areas we serve: …',
    '',
    'How to book: …',
    '',
    'Common questions:',
    '- Q: … A: …',
  ].join('\n');
}
