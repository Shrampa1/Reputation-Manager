import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Palette, Printer, Star } from 'lucide-react';
import { QrCode } from '@/components/QrCode';
import { useLocationContext } from '@/context/LocationContext';
import { reviewQrUrl } from '@/lib/qr';
import { DEFAULT_BRAND_COLOR, useReportSettings } from '@/lib/reportSettings';

/** Print-ready A4 poster with the review QR code (counter, window, tables). */
export function ReviewPosterPage() {
  const { location } = useLocationContext();
  const { settings } = useReportSettings();
  const [headline, setHeadline] = useState('Enjoyed your visit?');
  const [subtext, setSubtext] = useState('Scan to leave us a quick review. It really helps!');

  const brandColor = settings?.brand_color ?? DEFAULT_BRAND_COLOR;
  const brandName = settings?.brand_name || location?.name || '';
  const key = location?.public_key;

  useEffect(() => {
    if (location) document.title = `Review poster · ${location.name}`;
  }, [location]);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`
        @page { size: A4; margin: 0; }
        @media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; } }
      `}</style>

      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <Link to="/reviews" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Back</Link>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={40} aria-label="Headline" className="input-field !w-auto flex-1 min-w-[10rem] !py-1.5 text-sm" />
          <input value={subtext} onChange={(e) => setSubtext(e.target.value)} maxLength={80} aria-label="Line under the headline" className="input-field !w-auto flex-[2] min-w-[12rem] !py-1.5 text-sm" />
          <Link to="/settings#branding" className="btn-secondary text-xs"><Palette className="w-3.5 h-3.5" /> Logo & colour</Link>
          <button onClick={() => window.print()} disabled={!key} className="btn-primary text-sm"><Printer className="w-4 h-4" /> Print</button>
        </div>
        <p className="max-w-3xl mx-auto px-4 pb-2 text-xs text-slate-400">Edit the text above, then Print (or choose “Save as PDF” to send it to a print shop).</p>
      </div>

      {!key ? (
        <p className="text-center text-sm text-slate-500 py-20">The QR code isn’t available yet. Apply the latest database update (migration 016) and reload.</p>
      ) : (
        <article
          className="mx-auto my-6 print:my-0 bg-white shadow-sm print:shadow-none flex flex-col items-center text-center overflow-hidden"
          style={{ width: '210mm', height: '297mm', maxWidth: '100%' }}
        >
          <div className="w-full h-4" style={{ background: brandColor }} />
          <div className="flex-1 w-full flex flex-col items-center justify-center px-[18mm]">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={brandName} className="max-h-[28mm] max-w-[90mm] object-contain mb-[8mm]" />
            ) : (
              <p className="text-[9mm] font-bold text-slate-900 mb-[6mm] leading-tight">{brandName}</p>
            )}
            <h1 className="text-[15mm] font-extrabold leading-[1.05] text-slate-900">{headline}</h1>
            <p className="text-[6mm] text-slate-600 mt-[5mm] max-w-[150mm] leading-snug">{subtext}</p>
            <div className="flex gap-[2mm] mt-[8mm]" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="w-[11mm] h-[11mm] fill-amber-400 text-amber-400" />)}
            </div>
            <div className="mt-[8mm] p-[4mm] rounded-[6mm] border-[1.5mm]" style={{ borderColor: brandColor }}>
              <QrCode text={reviewQrUrl(key)} className="w-[95mm] h-[95mm]" title={`QR code for ${brandName} reviews`} />
            </div>
            <p className="text-[5mm] font-semibold text-slate-800 mt-[7mm]">Point your phone camera at the code</p>
            <p className="text-[4mm] text-slate-500 mt-[1.5mm]">No app needed · takes 30 seconds</p>
          </div>
          <div className="w-full py-[6mm] text-[4.5mm] font-semibold text-white" style={{ background: brandColor }}>
            Thank you for supporting {brandName}!
          </div>
        </article>
      )}
    </div>
  );
}
