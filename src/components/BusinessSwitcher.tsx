import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { Modal } from '@/components/ui/Modal';

const roleLabel = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const;

/** Form to create another business (allowed by the Agency plan). */
export function AddBusinessModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createBusiness } = useLocationContext();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setPhone('');
    setAddress('');
    setWebsite('');
    setError(null);
  }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Enter the business name.');
    setSaving(true);
    setError(null);
    const { error: createError } = await createBusiness({ name: name.trim(), phone: phone.trim(), address: address.trim(), website: website.trim() });
    setSaving(false);
    if (createError) return setError(createError);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="Add a business" subtitle="Manage another business from the same account" maxWidth="md">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div>
          <label htmlFor="nb-name" className="block text-sm font-medium text-slate-700 mb-1.5">Business name</label>
          <input id="nb-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="input-field" autoFocus />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="nb-phone" className="block text-sm font-medium text-slate-700 mb-1.5">Phone <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="nb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={50} className="input-field" />
          </div>
          <div>
            <label htmlFor="nb-website" className="block text-sm font-medium text-slate-700 mb-1.5">Website <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="nb-website" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} className="input-field" />
          </div>
        </div>
        <div>
          <label htmlFor="nb-address" className="block text-sm font-medium text-slate-700 mb-1.5">Address <span className="font-normal text-slate-400">(optional)</span></label>
          <input id="nb-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} className="input-field" />
        </div>
        {error && (
          <p className="text-sm text-rose-600" role="alert">
            {error}{' '}
            {/plan/i.test(error) && <Link to="/billing" onClick={onClose} className="underline">See plans</Link>}
          </p>
        )}
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create business
        </button>
      </form>
    </Modal>
  );
}

/** Sidebar dropdown: shows the active business and switches between the user's businesses. */
export function BusinessSwitcher() {
  const { organization, memberships, switchOrganization, loading } = useLocationContext();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative px-3 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-left"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-slate-400 leading-tight">Business</span>
          <span className="block text-sm font-semibold text-slate-900 truncate">{organization?.name ?? '—'}</span>
        </span>
        <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-3 right-3 mt-1 z-30 rounded-xl border border-slate-200 bg-white shadow-lg py-1" role="listbox" aria-label="Businesses">
          {memberships.map((m) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={m.id === organization?.id}
              onClick={() => {
                setOpen(false);
                if (m.id !== organization?.id) switchOrganization(m.id);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-900 truncate">{m.name}</span>
                <span className="block text-[11px] text-slate-400">{roleLabel[m.role]}</span>
              </span>
              {m.id === organization?.id && <Check className="w-4 h-4 text-sky-600 shrink-0" />}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setAdding(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sky-600 hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" /> Add a business
            </button>
          </div>
        </div>
      )}
      <AddBusinessModal isOpen={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
