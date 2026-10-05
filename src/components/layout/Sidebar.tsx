import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Star, MapPin, CalendarDays, Inbox, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Reviews', path: '/reviews', icon: Star },
  { label: 'Local SEO', path: '/seo', icon: MapPin },
  { label: 'Social', path: '/social', icon: CalendarDays },
  { label: 'Leads', path: '/leads', icon: Inbox },
];

function getInitials(email: string): string {
  const name = email.split('@')[0];
  return name.split(/[._-]/).map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-slate-200/80 bg-white">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-200/80">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 leading-tight">Reputation</p>
          <p className="text-xs text-slate-400 leading-tight">Engine</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
            }
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200/80">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold">
            {user ? getInitials(user.email || 'User') : 'JD'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.email || 'User'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
