import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Star, MapPin, CalendarDays, Inbox, LogOut, Plug, UserCog, Users, History, CreditCard, ShieldCheck, KeyRound } from 'lucide-react';
import type { Permission } from '@/lib/permissions';
import { Logo } from '@/components/Logo';
import { BusinessSwitcher } from '@/components/BusinessSwitcher';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { displayName, getInitials } from '@/lib/user';

const navItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Reviews', path: '/reviews', icon: Star },
  { label: 'SEO & Website', path: '/seo', icon: MapPin },
  { label: 'Social', path: '/social', icon: CalendarDays },
  { label: 'Leads', path: '/leads', icon: Inbox },
];

const settingsItems = [
  { label: 'Integrations', path: '/integrations', icon: Plug, permission: 'integrations.manage' as Permission },
  { label: 'Team', path: '/team', icon: Users },
  { label: 'Role access', path: '/access', icon: KeyRound, ownerOnly: true },
  { label: 'Activity', path: '/activity', icon: History, permission: 'activity.view' as Permission },
  { label: 'Plan & billing', path: '/billing', icon: CreditCard, permission: 'billing.manage' as Permission },
  { label: 'Profile & Settings', path: '/settings', icon: UserCog },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
  const { organization, can, isOwnerLike, isPlatformAdmin } = useLocationContext();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-slate-200/80 bg-white">
      <Link to="/" className="flex items-center px-5 h-16 border-b border-slate-200/80 text-sm">
        <Logo />
      </Link>

      <BusinessSwitcher />

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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

        <p className="px-3 pt-5 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Settings</p>
        {settingsItems.filter((item) => (item.permission ? can(item.permission) : item.ownerOnly ? isOwnerLike : true)).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
            }
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        {isPlatformAdmin && (
          <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}>
            <ShieldCheck className="w-[18px] h-[18px] shrink-0" />
            <span>Super admin</span>
          </NavLink>
        )}
      </nav>

      <div className="p-3 border-t border-slate-200/80">
        <div className="flex items-center gap-1 p-1.5 rounded-xl bg-slate-50">
          <Link
            to="/settings"
            title="Profile & Settings"
            className="flex items-center gap-3 min-w-0 flex-1 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold shrink-0">
              {getInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{displayName(user)}</p>
              {organization?.name && <p className="text-xs text-slate-400 truncate">{organization.name}</p>}
            </div>
          </Link>
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
