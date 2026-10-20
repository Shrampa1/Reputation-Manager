import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { useLocationContext } from '@/context/LocationContext';

/** Local rank tracker (Phase B2, migration 032 + the rank-tracker function). */
export interface RankKeyword {
  id: string;
  keyword: string;
  grid_size: 3 | 5 | 7;
  radius_km: number;
  weekly: boolean;
  last_scan_at: string | null;
  created_at: string;
}

export interface RankPoint { lat: number; lng: number; rank: number | null; top: string[] }

export interface RankScan {
  id: string;
  keyword_id: string;
  grid_size: number;
  radius_km: number;
  points: RankPoint[];
  competitors: Record<string, string>;
  avg_rank: number | null;
  top3_points: number;
  found_points: number;
  total_points: number;
  created_at: string;
}

/** Colour for a grid cell: green = top 3, lime = 4–10, amber = 11–20, red = not in the top 20. */
export function rankColor(rank: number | null) {
  if (rank === null) return 'bg-rose-500 text-white';
  if (rank <= 3) return 'bg-emerald-500 text-white';
  if (rank <= 10) return 'bg-lime-400 text-slate-900';
  return 'bg-amber-400 text-slate-900';
}

/** The businesses that most often take the #1 spot across the grid. */
export function topRivals(scan: RankScan, ownRanked: boolean) {
  const counts = new Map<string, number>();
  for (const p of scan.points) {
    const first = p.top[0];
    if (first && !(ownRanked && p.rank === 1)) counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, n]) => ({ name: scan.competitors[id] ?? 'Another business', points: n }));
}

export function useRankings() {
  const { location } = useLocationContext();
  const [keywords, setKeywords] = useState<RankKeyword[]>([]);
  const [scans, setScans] = useState<RankScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!location) return;
    const [k, s] = await Promise.all([
      supabase.from('rank_keywords').select('id, keyword, grid_size, radius_km, weekly, last_scan_at, created_at').eq('location_id', location.id).order('created_at'),
      supabase.from('rank_scans').select('id, keyword_id, grid_size, radius_km, points, competitors, avg_rank, top3_points, found_points, total_points, created_at')
        .eq('location_id', location.id).order('created_at', { ascending: false }).limit(200),
    ]);
    setKeywords(((k.data as RankKeyword[]) ?? []).map((x) => ({ ...x, radius_km: Number(x.radius_km) })));
    setScans(((s.data as RankScan[]) ?? []).map((x) => ({ ...x, avg_rank: x.avg_rank === null ? null : Number(x.avg_rank), radius_km: Number(x.radius_km) })));
    const err = k.error ?? s.error;
    setError(err ? `Couldn't load rankings: ${err.message}` : null);
    setLoading(false);
  }, [location]);

  useEffect(() => {
    load();
  }, [load]);

  return { keywords, scans, loading, error, reload: load };
}

function friendly(raw: string) {
  if (raw.includes('idx_rank_keywords_unique')) return 'That keyword is already tracked.';
  if (raw.includes('row-level security')) return 'You don’t have access to change tracked keywords.';
  return raw;
}

export async function addKeyword(locationId: string, input: { keyword: string; grid_size: number; radius_km: number }) {
  const { error } = await supabase.from('rank_keywords').insert({ location_id: locationId, ...input });
  return { error: error ? friendly(error.message) : null };
}

export async function updateKeyword(id: string, patch: Partial<Pick<RankKeyword, 'weekly' | 'grid_size' | 'radius_km'>>) {
  const { error } = await supabase.from('rank_keywords').update(patch).eq('id', id);
  return { error: error ? friendly(error.message) : null };
}

export async function deleteKeyword(id: string) {
  const { error } = await supabase.from('rank_keywords').delete().eq('id', id);
  return { error: error ? friendly(error.message) : null };
}

export const scanKeyword = (keywordId: string) => callFunction<{ scan: RankScan }>('rank-tracker', { action: 'scan', keywordId });
