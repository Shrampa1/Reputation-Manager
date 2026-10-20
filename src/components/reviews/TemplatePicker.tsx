import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { fillTemplate, matchesRating, ratingRangeLabel, useReplyTemplates, type TemplateKind } from '@/lib/templates';

/** "Use a template" dropdown: fills the reply with a saved template for this customer. */
export function TemplatePicker({ kind, rating, customerName, businessName, onPick }: {
  kind: TemplateKind;
  rating: number | null;
  customerName: string;
  businessName: string;
  onPick: (text: string) => void;
}) {
  const { templates, loading } = useReplyTemplates();
  const ofKind = templates.filter((t) => t.kind === kind);
  const suggested = ofKind.filter((t) => matchesRating(t, rating));
  const others = ofKind.filter((t) => !matchesRating(t, rating));

  if (loading) return null;
  if (ofKind.length === 0) {
    return (
      <Link to="/templates" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
        <FileText className="w-3.5 h-3.5" /> Add reply templates
      </Link>
    );
  }
  return (
    <select
      aria-label="Use a reply template"
      className="input-field !w-auto !py-1 text-xs"
      value=""
      onChange={(e) => {
        const t = ofKind.find((x) => x.id === e.target.value);
        if (t) onPick(fillTemplate(t.body, { name: customerName, business: businessName, rating }));
      }}
    >
      <option value="">Use a template…</option>
      {suggested.length > 0 && (
        <optgroup label={rating ? `For ${rating}★` : 'Templates'}>
          {suggested.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="Other templates">
          {others.map((t) => <option key={t.id} value={t.id}>{t.name} ({ratingRangeLabel(t)})</option>)}
        </optgroup>
      )}
    </select>
  );
}
