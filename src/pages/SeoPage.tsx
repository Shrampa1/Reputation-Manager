import { useState } from 'react';
import {
  MapPin,
  Phone,
  Globe,
  Building2,
  Check,
  AlertTriangle,
  X,
  TrendingUp,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { napConsistency, geoGridData } from '@/data/mockData';
import { useLocationUpdate } from '@/hooks/useSupabaseData';
import type { Location } from '@/types';

const platformIcons: Record<string, string> = {
  google: 'G',
  apple: '',
  bing: 'B',
};

const statusConfig = {
  consistent: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: Check, label: 'Consistent' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', icon: AlertTriangle, label: 'Minor Issue' },
  inconsistent: { bg: 'bg-rose-50', text: 'text-rose-600', icon: X, label: 'Inconsistent' },
};

function rankColor(rank: number): { bg: string; text: string; label: string } {
  if (rank === 1) return { bg: 'bg-emerald-500', text: 'text-white', label: '#1' };
  if (rank <= 3) return { bg: 'bg-emerald-400', text: 'text-white', label: `#${rank}` };
  if (rank <= 6) return { bg: 'bg-amber-400', text: 'text-white', label: `#${rank}` };
  if (rank <= 10) return { bg: 'bg-orange-400', text: 'text-white', label: `#${rank}` };
  return { bg: 'bg-rose-400', text: 'text-white', label: `#${rank}` };
}

export function SeoPage() {
  const { location, updateLocation } = useLocationUpdate();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Pick<Location, 'name' | 'address' | 'phone' | 'website'>>({
    name: '', address: '', phone: '', website: '',
  });

  // Sync form when location loads
  const startEditing = () => {
    if (location) {
      setForm({
        name: location.name,
        address: location.address || '',
        phone: location.phone || '',
        website: location.website || '',
      });
    }
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateLocation(form);
    setSaving(false);
    if (!error) {
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const allRanks = geoGridData.cells.flat().map((c) => c.rank);
  const avgRank = (allRanks.reduce((s, r) => s + r, 0) / allRanks.length).toFixed(1);
  const topThree = allRanks.filter((r) => r <= 3).length;

  if (!location && !editing) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Local SEO & Geo-Grid</h1>
        <p className="text-sm text-slate-500 mt-1">Track your local search rankings and business listing consistency.</p>
      </div>

      {/* SEO Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-400">Avg Rank</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">#{avgRank}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-400">Top 3</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">{topThree}/9</p>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-400">NAP Issues</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900">1</p>
        </div>
      </div>

      {/* Business Info Editor (NAP) */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sky-50 text-sky-600">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Business Info (NAP)</h2>
              <p className="text-xs text-slate-400">Name, Address, Phone consistency</p>
            </div>
          </div>
          <button
            onClick={() => (editing ? handleSave() : startEditing())}
            disabled={saving}
            className={saved ? 'btn-secondary text-emerald-600' : 'btn-secondary text-xs'}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="w-4 h-4" /> Saved
              </>
            ) : editing ? (
              'Save Changes'
            ) : (
              'Edit'
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Business Name</label>
            {editing ? (
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" />
            ) : (
              <p className="text-sm font-medium text-slate-900 py-2.5">{location?.name}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
            {editing ? (
              <input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" />
            ) : (
              <p className="text-sm font-medium text-slate-900 py-2.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {location?.phone || '—'}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Address</label>
            {editing ? (
              <input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
            ) : (
              <p className="text-sm font-medium text-slate-900 py-2.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {location?.address || '—'}
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Website</label>
            {editing ? (
              <input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} className="input-field" />
            ) : (
              <p className="text-sm font-medium text-slate-900 py-2.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                {location?.website || '—'}
              </p>
            )}
          </div>
        </div>

        {/* NAP Consistency Preview */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-sm font-semibold text-slate-900 mb-3">Directory Consistency</p>
          <div className="space-y-2.5">
            {napConsistency.map((entry) => {
              const cfg = statusConfig[entry.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={entry.platform} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600 font-bold text-sm shrink-0">
                    {platformIcons[entry.icon] || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{entry.platform}</p>
                    <p className="text-xs text-slate-500 truncate">{entry.address}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`badge ${cfg.bg} ${cfg.text}`}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Geo-Grid Rank Tracker */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Geo-Grid Rank Tracker</h2>
              <p className="text-xs text-slate-400">Search: "{geoGridData.query}"</p>
            </div>
          </div>
          <button className="btn-ghost text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-slate-200" style={{ aspectRatio: '1 / 1', maxWidth: '480px', margin: '0 auto' }}>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: `
                linear-gradient(to right, rgb(203 213 225) 1px, transparent 1px),
                linear-gradient(to bottom, rgb(203 213 225) 1px, transparent 1px)
              `,
              backgroundSize: '33.33% 33.33%',
            }} />
            <div className="absolute top-1/3 left-0 right-0 h-1.5 bg-slate-200/60" />
            <div className="absolute top-2/3 left-0 right-0 h-1.5 bg-slate-200/60" />
            <div className="absolute left-1/3 top-0 bottom-0 w-1.5 bg-slate-200/60" />
            <div className="absolute left-2/3 top-0 bottom-0 w-1.5 bg-slate-200/60" />
            <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-sky-100/50 rounded-tl-full" />
          </div>

          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0 p-2">
            {geoGridData.cells.flat().map((cell) => {
              const colors = rankColor(cell.rank);
              return (
                <div key={cell.id} className="relative flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full ${colors.bg} ${colors.text} font-bold text-sm shadow-lg ring-4 ring-white/60 cursor-pointer hover:scale-110 transition-transform`}
                    >
                      {cell.rank}
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-medium text-slate-500 bg-white/70 px-1.5 py-0.5 rounded whitespace-nowrap">
                      {cell.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 sm:gap-6 mt-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">Top 3</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-xs text-slate-500">4–6</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-orange-400" />
            <span className="text-xs text-slate-500">7–10</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-400" />
            <span className="text-xs text-slate-500">10+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
