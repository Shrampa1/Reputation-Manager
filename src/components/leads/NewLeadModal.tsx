import { useEffect, useState } from 'react';
import { Facebook, Loader2, MessageCircle, Plus, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import type { LeadChannel, LeadStage, Location } from '@/types';

const CHANNELS: { key: LeadChannel; label: string; icon: typeof MessageCircle }[] = [
  { key: 'web_chat', label: 'Web Chat', icon: MessageCircle },
  { key: 'sms', label: 'SMS / Phone', icon: Smartphone },
  { key: 'messenger', label: 'Messenger', icon: Facebook },
];

const STAGES: { key: LeadStage; label: string }[] = [
  { key: 'new_lead', label: 'New Lead' },
  { key: 'quote_sent', label: 'Quote Sent' },
  { key: 'job_booked', label: 'Job Booked' },
  { key: 'completed', label: 'Completed' },
  { key: 'review_requested', label: 'Review Requested' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  customer_name: string;
  phone: string;
  email: string;
  channel: LeadChannel;
  stage: LeadStage;
  estimated_value: string;
  notes: string;
}

const EMPTY: FormState = {
  customer_name: '',
  phone: '',
  email: '',
  channel: 'sms',
  stage: 'new_lead',
  estimated_value: '',
  notes: '',
};

/** "450", "$1200", "1,200.50" → "$1,200" (the pipeline sums digits from this text field) */
function formatValue(raw: string): string {
  const num = Math.round(Number(raw.replace(/[^0-9.]/g, '')));
  return raw.trim() && Number.isFinite(num) && num > 0 ? `$${num.toLocaleString('en-US')}` : '';
}

export function NewLeadModal({
  isOpen,
  onClose,
  location,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  onCreated: (name: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(EMPTY);
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const validate = (): string | null => {
    if (!form.customer_name.trim()) return 'Customer name is required.';
    if (!form.phone.trim() && !form.email.trim()) return 'Add a phone number or email so you can follow up.';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) return 'That email address doesn’t look right.';
    if (form.phone.trim() && form.phone.replace(/\D/g, '').length < 7) return 'That phone number looks too short.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    if (!location) {
      setError('No business location loaded. Refresh the page and try again.');
      return;
    }

    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('leads').insert({
      location_id: location.id,
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      channel: form.channel,
      stage: form.stage,
      estimated_value: formatValue(form.estimated_value),
      notes: form.notes.trim(),
    });
    setSaving(false);

    if (insertError) {
      setError(`Couldn't save the lead: ${insertError.message}`);
      return;
    }
    onCreated(form.customer_name.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={() => !saving && onClose()} title="New lead" subtitle="Add a customer to your pipeline" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="lead-name" className="block text-sm font-medium text-slate-700 mb-1.5">
            Customer name <span className="text-rose-500">*</span>
          </label>
          <input
            id="lead-name"
            value={form.customer_name}
            onChange={(e) => set('customer_name', e.target.value)}
            placeholder="Jane Smith"
            autoComplete="off"
            autoFocus
            className="input-field"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="lead-phone" className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
            <input
              id="lead-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(512) 555-0142"
              autoComplete="off"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="lead-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              id="lead-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="jane@example.com"
              autoComplete="off"
              className="input-field"
            />
          </div>
        </div>

        <div>
          <p className="block text-sm font-medium text-slate-700 mb-1.5">Came in via</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Lead channel">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={form.channel === c.key}
                onClick={() => set('channel', c.key)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  form.channel === c.key ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <c.icon className="w-4 h-4" />
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="lead-stage" className="block text-sm font-medium text-slate-700 mb-1.5">Stage</label>
            <select
              id="lead-stage"
              value={form.stage}
              onChange={(e) => set('stage', e.target.value as LeadStage)}
              className="input-field"
            >
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lead-value" className="block text-sm font-medium text-slate-700 mb-1.5">Estimated value</label>
            <input
              id="lead-value"
              inputMode="decimal"
              value={form.estimated_value}
              onChange={(e) => set('estimated_value', e.target.value)}
              onBlur={() => set('estimated_value', formatValue(form.estimated_value))}
              placeholder="$450"
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label htmlFor="lead-notes" className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
          <textarea
            id="lead-notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="What do they need? e.g. Leaking water heater, wants a quote this week"
            className="input-field resize-none"
          />
        </div>

        {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Add lead'}
          </button>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
