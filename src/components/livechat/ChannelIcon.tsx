import { Facebook, Globe, Instagram, Phone } from 'lucide-react';
import { channelLabel } from '@/lib/aiAgent';

/** Small channel mark for conversations (W5): website, Messenger, Instagram, call. */
export function ChannelIcon({ channel }: { channel: string }) {
  const label = channelLabel(channel);
  if (channel === 'messenger') return <Facebook className="w-3.5 h-3.5 text-blue-600" aria-label={label} />;
  if (channel === 'instagram') return <Instagram className="w-3.5 h-3.5 text-pink-600" aria-label={label} />;
  if (channel === 'web_call') return <Phone className="w-3.5 h-3.5 text-emerald-600" aria-label={label} />;
  return <Globe className="w-3.5 h-3.5 text-slate-400" aria-label={label} />;
}
