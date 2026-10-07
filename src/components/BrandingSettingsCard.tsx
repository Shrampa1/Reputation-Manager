import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileText, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { uploadPostImage } from '@/lib/media';
import { DEFAULT_BRAND_COLOR, useReportSettings } from '@/lib/reportSettings';

/** Settings → Report branding: name, logo and colour on downloadable reports. */
export function BrandingSettingsCard() {
  const { organization, can } = useLocationContext();
  // Feature access (role default or Role access override)
  const isAdmin = can('business.edit');
  const { settings, save } = useReportSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [brandName, setBrandName] = useState('');
  const [preparedBy, setPreparedBy] = useState('');
  const [color, setColor] = useState(DEFAULT_BRAND_COLOR);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [hideApp, setHideApp] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setBrandName(settings?.brand_name ?? '');
    setPreparedBy(settings?.prepared_by ?? '');
    setColor(settings?.brand_color ?? DEFAULT_BRAND_COLOR);
    setLogoUrl(settings?.logo_url ?? null);
    setHideApp(settings?.hide_app_branding ?? false);
  }, [settings]);

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !organization) return;
    setUploading(true);
    setStatus(null);
    try {
      setLogoUrl(await uploadPostImage(organization.id, file));
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Upload failed' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^#[0-9a-f]{6}$/i.test(color)) return setStatus({ kind: 'error', text: 'Pick a colour like #0ea5e9.' });
    setSaving(true);
    setStatus(null);
    const { error } = await save({
      brand_name: brandName.trim() || null,
      prepared_by: preparedBy.trim() || null,
      brand_color: color.toLowerCase(),
      logo_url: logoUrl,
      hide_app_branding: hideApp,
    });
    setSaving(false);
    setStatus(error ? { kind: 'error', text: error } : { kind: 'success', text: 'Report branding saved' });
  };

  return (
    <form id="branding" onSubmit={handleSave} className="card p-5 scroll-mt-20">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
          <FileText className="w-[18px] h-[18px]" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-900">Report branding</h2>
          <p className="text-sm text-slate-500">Your logo and colours on downloadable PDF reports</p>
        </div>
        <Link to="/report" className="btn-secondary text-xs shrink-0">Open report</Link>
      </div>

      <fieldset disabled={!isAdmin} className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-20 h-20 rounded-xl border border-dashed border-slate-300 bg-slate-50 overflow-hidden shrink-0">
            {logoUrl ? <img src={logoUrl} alt="Report logo" className="max-w-full max-h-full object-contain" /> : <ImagePlus className="w-6 h-6 text-slate-300" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-xs">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} {logoUrl ? 'Change logo' : 'Upload logo'}
            </button>
            {logoUrl && (
              <button type="button" onClick={() => setLogoUrl(null)} className="btn-ghost text-xs text-slate-500">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="brand-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name on reports</label>
            <input id="brand-name" value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={100} placeholder={organization?.name} className="input-field" />
          </div>
          <div>
            <label htmlFor="brand-color" className="block text-sm font-medium text-slate-700 mb-1.5">Brand colour</label>
            <div className="flex gap-2">
              <input type="color" aria-label="Pick brand colour" value={/^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRAND_COLOR} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded-lg border border-slate-200 bg-white p-1 cursor-pointer" />
              <input id="brand-color" value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} className="input-field font-mono" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="prepared-by" className="block text-sm font-medium text-slate-700 mb-1.5">
              “Prepared by” line <span className="font-normal text-slate-400">(optional, e.g. your agency name and website)</span>
            </label>
            <input id="prepared-by" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} maxLength={200} className="input-field" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={hideApp} onChange={(e) => setHideApp(e.target.checked)} className="rounded border-slate-300" />
          Hide “Made with Reputation Engine” on reports (white-label)
        </label>
      </fieldset>

      {isAdmin ? (
        <div className="flex items-center gap-3 mt-4">
          <button type="submit" disabled={saving || uploading} className="btn-primary">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
          {status && (
            <p role={status.kind === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1.5 text-sm ${status.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {status.kind === 'success' && <Check className="w-4 h-4" />}
              {status.text}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 mt-3">Only owners and admins can change report branding.</p>
      )}
    </form>
  );
}
