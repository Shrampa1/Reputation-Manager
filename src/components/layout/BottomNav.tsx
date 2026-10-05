import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Star, MapPin, CalendarDays, Inbox, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { label: 'Home', path: '/', icon: LayoutDashboard },
  { label: 'Reviews', path: '/reviews', icon: Star },
  { label: 'SEO', path: '/seo', icon: MapPin },
  { label: 'Social', path: '/social', icon: CalendarDays },
  { label: 'Leads', path: '/leads', icon: Inbox },
];

function getInitials(email: string): string {
  const name = email.split('@')[0];
  return name.split(/[._-]/).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-200/80 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around px-2 h-16">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                isActive ? 'text-sky-600' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${isActive ? 'bg-sky-50' : ''}`}>
                  <item.icon className="w-[20px] h-[20px]" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function MobileHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white/90 backdrop-blur-lg border-b border-slate-200/80">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 leading-none">Reputation Engine</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-semibold">
          {user ? getInitials(user.email || 'User') : 'JD'}
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
