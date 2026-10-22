import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Star, MapPin, CalendarDays, Inbox, Megaphone, LogOut, Plug, UserCog, Users, History, CreditCard, ShieldCheck, KeyRound, Briefcase,
  FileText, Workflow, Target, MessageSquareText, ClipboardCheck, MapPinned, Crosshair, ListChecks, FileBarChart, MessagesSquare, ClipboardList, Gauge,
  BookUser, Mail, ChevronDown,
} from 'lucide-react';
import { useBranding } from '@/hooks/useBranding';
import type { Permission } from '@/lib/permissions';
import { Logo } from '@/components/Logo';
import { BusinessSwitcher } from '@/components/BusinessSwitcher';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { displayName, getInitials } from '@/lib/user';
import { useChatBadge } from '@/lib/liveChat';

type NavItem = {
  label: string;
  path: string;
  icon: typeof Star;
  permission?: Permission;
  /** Shown to view-only client logins (agency portal) too */
  client?: boolean;
  ownerOnly?: boolean;
  /** Agency plan (or super admin) only */
  agency?: boolean;
  superAdmin?: boolean;
};

const sections: { id: string; label: string; items: NavItem[] }[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, client: true },
      { label: 'Approvals', path: '/approvals', icon: ClipboardCheck, permission: 'approvals.respond', client: true },
    ],
  },
  {
    id: 'reputation',
    label: 'Reputation',
    items: [
      { label: 'Reviews', path: '/reviews', icon: Star, client: true },
      { label: 'Surveys', path: '/surveys', icon: Gauge },
      { label: 'Reply templates', path: '/templates', icon: MessageSquareText, permission: 'reviews.reply' },
    ],
  },
  {
    id: 'local',
    label: 'Local SEO',
    items: [
      { label: 'SEO & Website', path: '/seo', icon: MapPin },
      { label: 'Google profile', path: '/google', icon: MapPinned },
      { label: 'Local rankings', path: '/rankings', icon: Crosshair },
      { label: 'Listings check', path: '/listings', icon: ListChecks },
    ],
  },
  {
    id: 'leads',
    label: 'Leads & customers',
    items: [
      { label: 'Leads', path: '/leads', icon: Inbox },
      { label: 'Live chat', path: '/chat', icon: MessagesSquare },
      { label: 'Lead forms', path: '/forms', icon: ClipboardList },
      { label: 'Contacts', path: '/contacts', icon: BookUser, permission: 'reviews.request' },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { label: 'Social', path: '/social', icon: CalendarDays },
      { label: 'Email campaigns', path: '/campaigns', icon: Mail, permission: 'campaigns.send' },
      { label: 'Ads', path: '/ads', icon: Megaphone, permission: 'ads.view' },
    ],
  },
  {
    id: 'agency',
    label: 'Agency',
    items: [
      { label: 'Agency', path: '/agency', icon: Briefcase, agency: true },
      { label: 'Prospects', path: '/prospects', icon: Target, permission: 'prospects.manage' },
      { label: 'Client reports', path: '/client-reports', icon: FileBarChart, permission: 'business.edit' },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    items: [
      { label: 'Automations', path: '/automations', icon: Workflow, permission: 'integrations.manage' },
      { label: 'Integrations', path: '/integrations', icon: Plug, permission: 'integrations.manage' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { label: 'Team', path: '/team', icon: Users },
      { label: 'Role access', path: '/access', icon: KeyRound, ownerOnly: true },
      { label: 'Activity', path: '/activity', icon: History, permission: 'activity.view' },
      { label: 'Plan & billing', path: '/billing', icon: CreditCard, permission: 'billing.manage' },
      { label: 'Profile & Settings', path: '/settings', icon: UserCog, client: true },
      { label: 'Super admin', path: '/admin', icon: ShieldCheck, superAdmin: true },
    ],
  },
];

const STORAGE_KEY = 're-sidebar-collapsed';
const readCollapsed = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const isOn = (pathname: string, path: string) => (path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`));

export function Sidebar() {
  const { user, signOut } = useAuth();
  const { organization, can, isOwnerLike, isPlatformAdmin, isClient, hasAgencyPlan } = useLocationContext();
  const branding = useBranding();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const chatWaiting = useChatBadge();
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };
  const toggle = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id];
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: only for this visit */
    }
  };

  const visible = (item: NavItem) => {
    if (isClient) return Boolean(item.client);
    if (item.superAdmin) return isPlatformAdmin;
    if (item.agency) return hasAgencyPlan || isPlatformAdmin;
    if (item.ownerOnly) return isOwnerLike;
    return !item.permission || can(item.permission);
  };

  const link = (item: NavItem) => (
    <NavLink
      key={item.path}
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => `nav-link !py-2 ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`}
    >
      <item.icon className="w-[18px] h-[18px] shrink-0" />
      <span>{item.label}</span>
      {item.path === '/chat' && chatWaiting > 0 && (
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-semibold" aria-label={`${chatWaiting} chats waiting`}>
          {chatWaiting}
        </span>
      )}
    </NavLink>
  );

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-slate-200/80 bg-white">
      <Link to="/" className="flex items-center px-5 h-16 border-b border-slate-200/80 text-sm">
        <Logo branding={branding} />
      </Link>

      <BusinessSwitcher />

      <nav className="flex-1 px-3 py-3 overflow-y-auto" aria-label="Main">
        {isClient ? (
          // Client logins see a short, flat menu
          <div className="space-y-0.5">
            <p className="px-3 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
            {sections.flatMap((s) => s.items).filter(visible).map(link)}
            {can('reports.download') && (
              <NavLink to="/report" className="nav-link !py-2 nav-link-inactive">
                <FileText className="w-[18px] h-[18px] shrink-0" />
                <span>Monthly report</span>
              </NavLink>
            )}
          </div>
        ) : (
          sections.map((section) => {
            const items = section.items.filter(visible);
            if (!items.length) return null;
            const current = items.some((i) => isOn(pathname, i.path));
            // The section with the page you're on always stays open
            const open = current || !collapsed.includes(section.id);
            const badge = !open && items.some((i) => i.path === '/chat') && chatWaiting > 0;
            return (
              <div key={section.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggle(section.id)}
                  disabled={current}
                  aria-expanded={open}
                  className="w-full flex items-center gap-2 px-3 pt-3 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 disabled:hover:text-slate-400 disabled:cursor-default"
                >
                  <span className="flex-1 text-left">{section.label}</span>
                  {badge && <span className="w-2 h-2 rounded-full bg-rose-500" aria-label={`${chatWaiting} chats waiting`} />}
                  {!current && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />}
                </button>
                {open && <div className="space-y-0.5">{items.map(link)}</div>}
              </div>
            );
          })
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
