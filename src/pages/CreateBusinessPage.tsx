import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Globe, Loader2, LogOut, MapPin, Phone } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useAuth } from '@/context/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { supabase } from '@/lib/supabase';

/**
 * Shown to a signed-in account that doesn't belong to any business yet — e.g. one
 * created in the Supabase dashboard, or someone who left or was removed from a team.
 */
export function CreateBusinessPage() {
  const { user, signOut } = useAuth();
  const { refresh } = useLocationContext();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter your business name.');
      return;
    }
    if (website.trim() && !/^https?:\/\/\S+\.\S+/i.test(website.trim())) {
      setError('Website should start with https:// (e.g. https://acmeplumbing.com).');
      return;
    }

    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('create_organization_for_current_user', {
      business_name: name.trim(),
      p_phone: phone.trim() || null,
      p_address: address.trim() || null,
      p_website: website.trim() || null,
    });
    if (rpcError) {
      setSaving(false);
      setError(`Couldn't create your business: ${rpcError.message}`);
      return;
    }
    await refresh();
    navigate('/', { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <AuthLayout>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Set up your business</h2>
        <p className="text-sm text-slate-500 mt-1.5">
          You’re signed in as <span className="font-medium text-slate-700">{user?.email}</span>. Tell us about your
          business to get started — you can change these details later.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="biz-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Business name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="biz-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Premier Plumbing Solutions"
                maxLength={200}
                autoFocus
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="biz-phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Phone <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="biz-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(512) 555-0100"
                maxLength={50}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="biz-address" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Address <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="biz-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12 Main St, Austin, TX 78701"
                maxLength={300}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="biz-website" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Website <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="biz-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://premierplumbing.com"
                maxLength={300}
                className="input-field pl-10"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 animate-fade-in">
              {error}
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Creating your business…' : 'Create business'}
          </button>
        </form>

        <div className="mt-6 p-3.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Joining an existing business?</p>
          <p className="mt-0.5">
            Ask its owner or an admin to invite <span className="font-medium">{user?.email}</span> from their Team page,
            then refresh this page.
          </p>
        </div>

        <button onClick={handleSignOut} className="btn-ghost w-full mt-3 text-slate-500">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
