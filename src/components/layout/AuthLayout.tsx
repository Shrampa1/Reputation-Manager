import { Sparkles } from 'lucide-react';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/10 rounded-full translate-y-20 -translate-x-20" />
        <div className="relative flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-bold leading-tight">Reputation Engine</p>
              <p className="text-xs text-white/70 leading-tight">Local Marketing & SEO</p>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight mb-3">
              Grow your local business with one powerful dashboard.
            </h1>
            <p className="text-sm text-white/80 leading-relaxed max-w-md">
              Manage reviews, track local SEO rankings, publish social content, and convert leads — all powered by AI recommendations.
            </p>
          </div>
          <div className="space-y-2">
            {['AI-powered review replies', 'Geo-grid rank tracking', 'Unified lead inbox & CRM'].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-white/90">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                {feat}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 leading-tight">Reputation Engine</p>
              <p className="text-xs text-slate-400 leading-tight">Local Marketing & SEO</p>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
