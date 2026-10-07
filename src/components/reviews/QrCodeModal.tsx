import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Copy, Download, Loader2, Printer, RefreshCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { QrCode } from '@/components/QrCode';
import { useLocationContext } from '@/context/LocationContext';
import { supabase } from '@/lib/supabase';
import { downloadQrPng, reviewQrUrl } from '@/lib/qr';

/** Reviews → QR code: a code for the counter, receipts and flyers that opens the rating page. */
export function QrCodeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { location, can, refresh } = useLocationContext();
  const isAdmin = can('business.edit');
  const [copied, setCopied] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = location?.public_key;
  const url = key ? reviewQrUrl(key) : '';
  const fileSafeName = (location?.name ?? 'business').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Couldn’t copy. Select the link and copy it yourself.');
    }
  };

  const rotate = async () => {
    if (!location) return;
    setRotating(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('rotate_location_public_key', { p_location: location.id });
    if (rpcError) setError(rpcError.message);
    else await refresh();
    setRotating(false);
    setConfirmRotate(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Review QR code" subtitle="Customers scan it with their phone camera to rate you" maxWidth="md">
      {!location?.review_link ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Add your review link first</p>
              <p className="mt-1">The QR code sends happy customers to your review page, so it needs that link.</p>
            </div>
          </div>
          {isAdmin && <Link to="/settings#review-requests" onClick={onClose} className="btn-primary w-full">Open Settings</Link>}
        </div>
      ) : !key ? (
        <p className="text-sm text-slate-500">
          The QR code isn’t available yet. Apply the latest database update (migration 016) and reload.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <QrCode text={url} className="w-56 h-56 rounded-xl border border-slate-200" title={`QR code for ${location.name} reviews`} />
          </div>

          <div className="flex items-center gap-2">
            <input readOnly value={url} aria-label="QR code link" className="input-field !py-2 text-xs font-mono" onFocus={(e) => e.target.select()} />
            <button type="button" onClick={copy} className="btn-secondary shrink-0 !py-2" aria-label="Copy link">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link to="/review-poster" target="_blank" className="btn-primary">
              <Printer className="w-4 h-4" /> Print a poster
            </Link>
            <button type="button" onClick={() => downloadQrPng(url, `${fileSafeName}-review-qr.png`)} className="btn-secondary">
              <Download className="w-4 h-4" /> Download image
            </button>
          </div>

          <ul className="text-xs text-slate-500 space-y-1 list-disc ml-4">
            <li>Put it on the counter, tables, receipts, invoices, packaging or business cards.</li>
            <li>Ratings and private feedback show up under Review requests, marked “QR code”.</li>
            <li>It never changes, so printed copies keep working.</li>
          </ul>

          {isAdmin && (
            <div className="pt-3 border-t border-slate-100">
              {confirmRotate ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 space-y-2">
                  <p>Make a new code? Every printed QR code and your website reviews widget snippet stop working until you replace them.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={rotate} disabled={rotating} className="btn-secondary !py-1.5 text-xs">
                      {rotating && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Yes, make a new code
                    </button>
                    <button type="button" onClick={() => setConfirmRotate(false)} className="btn-ghost !py-1.5 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmRotate(true)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
                  <RefreshCw className="w-3.5 h-3.5" /> Code being misused? Make a new one
                </button>
              )}
            </div>
          )}
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
