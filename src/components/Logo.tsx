import { useId } from 'react';
import type { Branding } from '@/lib/branding';

const STAR = '30,17 34.35,28.01 46.17,28.75 37.04,36.29 39.99,47.75 30,41.4 20.01,47.75 22.96,36.29 13.83,28.75 25.65,28.01';
const SPARK = 'M48,8.5 Q49.43,13.57 54.5,15 Q49.43,16.43 48,21.5 Q46.57,16.43 41.5,15 Q46.57,13.57 48,8.5Z';

/** The Reputation Engine mark: a star (reviews) with an AI spark, on the brand gradient. */
export function LogoMark({ className = 'w-9 h-9', spark = true }: { className?: string; spark?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`re-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#re-${id})`} />
      <polygon points={STAR} fill="#fff" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
      {spark && <path d={SPARK} fill="#fff" opacity="0.9" />}
    </svg>
  );
}

/** Mark + wordmark. `tone="light"` for dark backgrounds. With `branding`, the agency's logo and name instead. */
export function Logo({
  className = '',
  markClassName = 'w-9 h-9',
  tone = 'dark',
  tagline,
  branding,
}: {
  className?: string;
  markClassName?: string;
  tone?: 'dark' | 'light';
  tagline?: string;
  branding?: Branding | null;
}) {
  if (branding) {
    return (
      <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}>
        {branding.logo_url ? (
          <img src={branding.logo_url} alt="" className={`${markClassName} shrink-0 rounded-lg object-contain bg-white`} />
        ) : (
          <span
            className={`${markClassName} shrink-0 rounded-lg flex items-center justify-center text-white font-bold`}
            style={{ backgroundColor: branding.brand_color }}
            aria-hidden
          >
            {branding.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span className={`font-bold tracking-tight truncate ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}>{branding.name}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={`${markClassName} shrink-0`} />
      <span className="leading-tight">
        <span className={`block font-bold tracking-tight ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}>
          Reputation <span className={tone === 'light' ? 'text-sky-200' : 'text-sky-600'}>Engine</span>
        </span>
        {tagline && <span className={`block text-xs ${tone === 'light' ? 'text-white/70' : 'text-slate-400'}`}>{tagline}</span>}
      </span>
    </span>
  );
}
