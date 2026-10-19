import { Link } from 'react-router-dom';
import { LogoMark, Logo } from '@/components/Logo';
import { useBranding } from '@/hooks/useBranding';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const branding = useBranding();

  if (branding) {
    // Agency client portal: the agency's name, logo and colour only
    return (
      <div className="min-h-screen flex">
        <div
          className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgb(var(--brand-500)), rgb(var(--brand-700)))' }}
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/10 rounded-full translate-y-20 -translate-x-20" />
          <div className="relative flex flex-col justify-between p-12 text-white">
            <Logo tone="light" markClassName="w-10 h-10" branding={branding} />
            <div>
              <h1 className="text-3xl font-bold leading-tight mb-3">Your reviews and reputation, in one place.</h1>
              <p className="text-sm text-white/80 leading-relaxed max-w-md">
                See new reviews as they arrive, how your rating is trending, and ask happy customers for a review in a click.
              </p>
            </div>
            {branding.support_email ? (
              <p className="text-sm text-white/80">
                Need help? <a href={`mailto:${branding.support_email}`} className="underline underline-offset-2">{branding.support_email}</a>
              </p>
            ) : (
              <span />
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-sm">
            <div className="flex lg:hidden w-fit mb-8">
              <Logo markClassName="w-10 h-10" branding={branding} />
            </div>
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/10 rounded-full translate-y-20 -translate-x-20" />
        <div className="relative flex flex-col justify-between p-12 text-white">
          <Link to="/" className="w-fit">
            <Logo tone="light" markClassName="w-10 h-10" tagline="Reviews · SEO · Growth" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold leading-tight mb-3">
              More reviews. Better rankings. More customers.
            </h1>
            <p className="text-sm text-white/80 leading-relaxed max-w-md">
              Reviews, Google listing, website SEO, social posts and leads in one dashboard, with AI that tells you what to fix next.
            </p>
          </div>
          <div className="space-y-2">
            {['AI review replies and review requests', 'Website health, Search Console and speed checks', 'Social planner, leads and weekly reports'].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-white/90">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                {feat}
              </div>
            ))}
          </div>
        </div>
        <LogoMark className="absolute -right-16 -bottom-16 w-80 h-80 opacity-10" />
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link to="/" className="flex lg:hidden w-fit mb-8">
            <Logo markClassName="w-10 h-10" tagline="Reviews · SEO · Growth" />
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
