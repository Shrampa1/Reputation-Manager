import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Download } from 'lucide-react';
import { AuditReport } from '@/components/prospects/AuditReport';
import type { ReportData } from '@/lib/prospects';

const PRINT_CSS = `
  @page { size: A4; margin: 12mm; }
  @media print { html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff; } }
`;

/** Toolbar + report, used by the in-app view and the public share link. */
export function ReportShell({ data, back, shareLink }: { data: ReportData; back?: boolean; shareLink?: string | null }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the address bar has it too */
    }
  };
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          {back && <Link to="/prospects" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Prospects</Link>}
          <div className="flex items-center gap-2 ml-auto">
            {shareLink && (
              <button onClick={copy} className="btn-secondary text-sm">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy share link'}
              </button>
            )}
            <button onClick={() => window.print()} className="btn-primary text-sm"><Download className="w-4 h-4" /> Download PDF</button>
          </div>
        </div>
      </div>
      <div className="py-6 px-3 print:p-0">
        <div className="rounded-2xl overflow-hidden shadow-sm print:shadow-none print:rounded-none">
          <AuditReport data={data} />
        </div>
      </div>
    </div>
  );
}
