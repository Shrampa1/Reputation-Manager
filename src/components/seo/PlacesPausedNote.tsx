import { Info } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';

/** Shown in place of Google listing features while Google Places is off for the app. */
export function PlacesPausedNote({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin } = useLocationContext();
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600">
      <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
      <div className="space-y-1">
        {children}
        {isPlatformAdmin && (
          <p className="text-xs text-amber-700">
            Platform admin: Google is refusing GOOGLE_API_KEY for Places API (New), usually because billing is off on the Google Cloud
            project. See “Google Places” in SETUP-LATER.md. After fixing it, open the app in a new tab.
          </p>
        )}
      </div>
    </div>
  );
}
