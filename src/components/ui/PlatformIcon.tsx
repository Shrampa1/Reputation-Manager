import { Globe, Facebook, CircleCheck, HelpCircle } from 'lucide-react';
import type { ReviewPlatform } from '@/types';

interface PlatformIconProps {
  platform: ReviewPlatform;
  size?: 'sm' | 'md';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

const colorMap: Record<ReviewPlatform, string> = {
  google: 'text-blue-500 bg-blue-50',
  facebook: 'text-blue-600 bg-blue-50',
  trustpilot: 'text-emerald-600 bg-emerald-50',
  custom: 'text-slate-500 bg-slate-100',
};

const labelMap: Record<ReviewPlatform, string> = {
  google: 'Google',
  facebook: 'Facebook',
  trustpilot: 'Trustpilot',
  custom: 'Custom',
};

const iconMap: Record<ReviewPlatform, typeof Globe> = {
  google: Globe,
  facebook: Facebook,
  trustpilot: CircleCheck,
  custom: HelpCircle,
};

export function PlatformIcon({ platform, size = 'sm' }: PlatformIconProps) {
  const Icon = iconMap[platform];
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${colorMap[platform]}`}>
      <Icon className={sizeMap[size]} />
    </span>
  );
}

export function PlatformLabel({ platform }: { platform: ReviewPlatform }) {
  return <span className="text-xs font-medium text-slate-500">{labelMap[platform]}</span>;
}
