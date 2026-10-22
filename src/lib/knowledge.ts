import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';
import { chatApi } from '@/lib/websiteChat';

/** Knowledge base (Live chat W3, migration 040 + the knowledge-import function). */
export interface KbArticle {
  id: string;
  title: string;
  body: string;
  category: string | null;
  status: 'published' | 'draft';
  source_url: string | null;
  views: number;
  helpful_yes: number;
  helpful_no: number;
  updated_at: string;
}
export type KbDraft = Pick<KbArticle, 'title' | 'body' | 'category' | 'status'>;
export const EMPTY_ARTICLE: KbDraft = { title: '', body: '', category: '', status: 'published' };

const COLUMNS = 'id, title, body, category, status, source_url, views, helpful_yes, helpful_no, updated_at';

export function useKnowledgeBase() {
  const { location } = useLocationContext();
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const { data, error } = await supabase.from('kb_articles').select(COLUMNS).eq('location_id', location.id)
      .order('category', { nullsFirst: false }).order('title').limit(1000);
    setArticles((data as KbArticle[]) ?? []);
    // Usually means migration 040 hasn't been run yet
    setError(error?.message ?? null);
    setLoading(false);
  }, [location]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (values: KbDraft, id?: string) => {
    if (!location) return 'No business selected';
    const row = { title: values.title, body: values.body, category: values.category?.trim() || null, status: values.status };
    const { error } = id
      ? await supabase.from('kb_articles').update(row).eq('id', id)
      : await supabase.from('kb_articles').insert({ location_id: location.id, ...row });
    if (error) return error.message;
    await load();
    return null;
  }, [location, load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('kb_articles').delete().eq('id', id);
    if (!error) setArticles((xs) => xs.filter((x) => x.id !== id));
    return error?.message ?? null;
  }, []);

  return { articles, loading, error, save, remove, reload: load };
}

export interface ImportResult {
  imported: { url: string; title: string; status: 'added' | 'updated' }[];
  skipped: { url: string; reason: string }[];
}
export const importPages = (urls: string[], status: KbDraft['status']) => callFunction<ImportResult>('knowledge-import', { action: 'import', urls, status });
export const importSitemap = (status: KbDraft['status']) => callFunction<ImportResult>('knowledge-import', { action: 'sitemap', status });

// ---------- public help centre (no sign-in; through the website-chat function) ----------
export interface PublicArticleSummary { id: string; title: string; category: string | null; snippet: string }
export interface PublicArticle { id: string; title: string; body: string; category: string | null; updated_at: string }

async function helpGet<T>(key: string, query: string): Promise<T> {
  const res = await fetch(`${chatApi()}?key=${encodeURIComponent(key)}&${query}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Not found');
  return body as T;
}
export const fetchHelpList = (key: string) => helpGet<{ businessName: string; articles: PublicArticleSummary[] }>(key, 'kb=list');
export const searchHelp = (key: string, q: string) => helpGet<{ results: PublicArticleSummary[] }>(key, `kb=search&q=${encodeURIComponent(q)}`);
export const fetchHelpArticle = (key: string, id: string) => helpGet<{ article: PublicArticle }>(key, `kb=article&id=${encodeURIComponent(id)}`);
export async function sendHelpFeedback(key: string, article: string, helpful: boolean) {
  await fetch(chatApi(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'kb_feedback', key, article, helpful }) });
}
