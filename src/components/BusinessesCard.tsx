import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, ChevronRight, CreditCard, Plus, ShieldCheck } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { AddBusinessModal } from '@/components/BusinessSwitcher';

const roleLabel = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const;

/** Settings → Your businesses: switch business (also on phones), add one, plan & billing. */
export function BusinessesCard() {
  const { organization, memberships, switchOrganization, isAdmin, isPlatformAdmin } = useLocationContext();
  const [adding, setAdding] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
          <Building2 className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900">Your businesses</h2>
          <p className="text-sm text-slate-500">Switch between businesses you belong to</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn-secondary text-xs shrink-0"><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {memberships.map((m) => {
          const active = m.id === organization?.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => !active && switchOrganization(m.id)}
                aria-current={active}
                className={`w-full flex items-center gap-3 p-3 text-left ${active ? 'bg-sky-50/50' : 'hover:bg-slate-50'}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-900 truncate">{m.name}</span>
                  <span className="block text-xs text-slate-400">{roleLabel[m.role]}</span>
                </span>
                {active ? <span className="badge bg-sky-50 text-sky-600"><Check className="w-3 h-3" /> Current</span> : <span className="text-xs text-sky-600">Switch</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
        {isAdmin && (
          <Link to="/billing" className="flex items-center gap-3 p-3 hover:bg-slate-50">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <span className="flex-1 text-sm font-medium text-slate-900">Plan & billing</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        )}
        {isPlatformAdmin && (
          <Link to="/admin" className="flex items-center gap-3 p-3 hover:bg-slate-50">
            <ShieldCheck className="w-4 h-4 text-violet-500" />
            <span className="flex-1 text-sm font-medium text-slate-900">Platform admin</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </Link>
        )}
      </div>
      <AddBusinessModal isOpen={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
