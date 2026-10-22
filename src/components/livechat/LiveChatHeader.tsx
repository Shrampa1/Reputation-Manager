import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Bell, Volume2, VolumeX } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { setPresence, setSoundOn, soundOn, useChatBadge, usePresence } from '@/lib/liveChat';

const tabs = [
  { label: 'Inbox', path: '/chat', end: true },
  { label: 'Visitors', path: '/chat/visitors' },
  { label: 'Knowledge', path: '/chat/knowledge' },
  { label: 'Saved replies', path: '/chat/replies' },
  { label: 'Analytics', path: '/chat/analytics' },
  { label: 'Settings', path: '/chat/settings' },
];

/** Title, section tabs and the agent's own controls (online/away, sound, desktop alerts). */
export function LiveChatHeader({ subtitle }: { subtitle?: string }) {
  const { can } = useLocationContext();
  const presence = usePresence();
  const waiting = useChatBadge();
  const [sound, setSound] = useState(soundOn());
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));

  const askAlerts = async () => {
    if (!('Notification' in window)) return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Live chat</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {can('chat.reply') && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 text-sm rounded-full border border-slate-200 bg-white pl-3 pr-1 py-1">
              <span className={`w-2 h-2 rounded-full ${presence === 'online' ? 'bg-emerald-500' : 'bg-amber-400'}`} aria-hidden="true" />
              <select
                className="bg-transparent text-sm text-slate-700 focus:outline-none pr-1"
                value={presence}
                onChange={(e) => setPresence(e.target.value as 'online' | 'away')}
                aria-label="Your chat status"
              >
                <option value="online">Online</option>
                <option value="away">Away</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => { setSoundOn(!sound); setSound(!sound); }}
              className="btn-secondary text-sm !px-2.5"
              aria-label={sound ? 'Turn chat sounds off' : 'Turn chat sounds on'}
              title={sound ? 'Sounds on' : 'Sounds off'}
            >
              {sound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {permission === 'default' && (
              <button type="button" onClick={askAlerts} className="btn-secondary text-sm">
                <Bell className="w-4 h-4" /> Desktop alerts
              </button>
            )}
          </div>
        )}
      </div>
      <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto" aria-label="Live chat">
        {tabs.map((t) => (
          <NavLink
            key={t.path}
            to={t.path}
            end={t.end}
            className={({ isActive }) =>
              `px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${isActive ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`
            }
          >
            {t.label}
            {t.path === '/chat' && waiting > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[11px] font-semibold">{waiting}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
