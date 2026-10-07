import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Gauge, Info, MapPin, Map as MapIcon, Search, Swords } from 'lucide-react';
import { geoGridData } from '@/data/mockData';
import { WebsiteHealth } from '@/components/seo/WebsiteHealth';
import { GoogleListing } from '@/components/seo/GoogleListing';
import { SearchConsole } from '@/components/seo/SearchConsole';
import { Competitors } from '@/components/seo/Competitors';

type Tab = 'website' | 'search' | 'google' | 'competitors' | 'rank';

const TABS: { key: Tab; label: string; icon: typeof Gauge }[] = [
  { key: 'website', label: 'Website Health', icon: Gauge },
  { key: 'search', label: 'Search Console', icon: Search },
  { key: 'google', label: 'Google Listing', icon: MapPin },
  { key: 'competitors', label: 'Competitors', icon: Swords },
  { key: 'rank', label: 'Rank Map', icon: MapIcon },
];

function rankColor(rank: number): { bg: string; text: string } {
  if (rank <= 3) return { bg: 'bg-emerald-500', text: 'text-white' };
  if (rank <= 6) return { bg: 'bg-amber-400', text: 'text-white' };
  if (rank <= 10) return { bg: 'bg-orange-400', text: 'text-white' };
  return { bg: 'bg-rose-400', text: 'text-white' };
}

/** Example of the local rank grid. Live tracking needs a rank-data provider (not connected yet). */
function RankMap() {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-2.5 p-3 mb-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold">Sample data.</span> Live rank tracking shows where you appear in Google Maps for a search
          (e.g. “{geoGridData.query}”) from different points around your area. It needs a paid rank-data provider, which isn’t connected yet.
        </p>
      </div>
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 opacity-80" style={{ aspectRatio: '1 / 1', maxWidth: '420px', margin: '0 auto' }}>
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100"
          style={{
            backgroundImage: 'linear-gradient(to right, rgb(203 213 225 / .5) 1px, transparent 1px), linear-gradient(to bottom, rgb(203 213 225 / .5) 1px, transparent 1px)',
            backgroundSize: '33.33% 33.33%',
          }}
        />
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-2">
          {geoGridData.cells.flat().map((cell) => {
            const colors = rankColor(cell.rank);
            return (
              <div key={cell.id} className="flex flex-col items-center justify-center gap-1">
                <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full ${colors.bg} ${colors.text} font-bold text-sm shadow-lg ring-4 ring-white/60`}>
                  {cell.rank}
                </div>
                <span className="text-[10px] font-medium text-slate-500 bg-white/70 px-1.5 py-0.5 rounded whitespace-nowrap">{cell.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SeoPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'website') as Tab;
  const [toast, setToast] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Back from Google sign-in: /seo?tab=search&integration=search_console&status=connected|error&message=…
  useEffect(() => {
    if (params.get('integration') !== 'search_console') return;
    const status = params.get('status');
    setBanner(
      status === 'connected'
        ? { kind: 'success', text: 'Google Search Console connected.' }
        : { kind: 'error', text: `Couldn't connect Search Console: ${params.get('message') || 'unknown error'}` }
    );
    setParams({ tab: 'search' }, { replace: true });
  }, [params, setParams]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">SEO & Website</h1>
        <p className="text-sm text-slate-500 mt-1">Check your website’s health, your Google listing and how you show up in search.</p>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit max-w-full overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParams(t.key === 'website' ? {} : { tab: t.key }, { replace: true })}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {banner && (
        <div
          role={banner.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 p-3 rounded-xl text-sm ${banner.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {banner.kind === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <Check className="w-4 h-4 shrink-0 mt-0.5" />}
          <span className="flex-1">{banner.text}</span>
          <button onClick={() => setBanner(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {tab === 'website' && <WebsiteHealth />}
      {tab === 'search' && <SearchConsole />}
      {tab === 'google' && <GoogleListing onToast={showToast} />}
      {tab === 'competitors' && <Competitors />}
      {tab === 'rank' && <RankMap />}

      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
