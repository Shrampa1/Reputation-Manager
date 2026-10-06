import { useEffect, useState } from 'react';
import { Check, Facebook, Loader2, Mail, MessageCircle, Phone, Plus, Smartphone, Star, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { supabase } from '@/lib/supabase';
import { STAGES, formatValue } from '@/lib/leads';
import type { Lead, LeadChannel, LeadStage, Location } from '@/types';

const CHANNELS: { key: LeadChannel; label: string; icon: typeof MessageCircle }[] = [
  { key: 'web_chat', label: 'Web Chat', icon: MessageCircle },
  { key: 'sms', label: 'SMS / Phone', icon: Smartphone },
  { key: 'messenger', label: 'Messenger', icon: Facebook },
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

/**
 * Adds a lead, or (with `lead`) shows and edits an existing one: contact shortcuts,
 * review request, save and delete.
 */
export function NewLeadModal({
  isOpen,
  onClose,
  location,
  lead = null,
  onDone,
  onRequestReview,
}: {
  isOpen: boolean;
  onClose: () => void;
  location: Location | null;
  /** Edit this lead instead of creating a new one */
  lead?: Lead | null;
  /** Called after a successful create, save or delete, with a message for a toast */
  onDone: (message: string) => void;
  /** Edit mode: open the review request form for this lead */
  onRequestReview?: (lead: Lead) => void;
}) {
  const isEdit = Boolean(lead);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(
        lead
          ? {
              customer_name: lead.customer_name,
              phone: lead.phone ?? '',
              email: lead.email ?? '',
              channel: lead.channel,
              stage: lead.stage,
              estimated_value: lead.estimated_value ?? '',
              notes: lead.notes ?? '',
            }
          : EMPTY
      );
      setError(null);
      setSaving(false);
      setDeleting(false);
      setConfirmDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset on open / when switching leads
  }, [isOpen, lead?.id]);

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
    const fields = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      channel: form.channel,
      stage: form.stage,
      estimated_value: formatValue(form.estimated_value),
      notes: form.notes.trim(),
    };
    const { error: saveError } = lead
      ? await supabase.from('leads').update(fields).eq('id', lead.id)
      : await supabase.from('leads').insert({ ...fields, location_id: location.id });
    setSaving(false);

    if (saveError) {
      setError(`Couldn't save the lead: ${saveError.message}`);
      return;
    }
    onDone(lead ? `Saved ${fields.customer_name}` : `${fields.customer_name} added to your pipeline`);
    onClose();
  };

  const handleDelete = async () => {
    if (!lead) return;
    setDeleting(true);
    setError(null);
    const { error: deleteError } = await supabase.from('leads').delete().eq('id', lead.id);
    setDeleting(false);
    if (deleteError) {
      setError(`Couldn't delete the lead: ${deleteError.message}`);
      return;
    }
    onDone(`Deleted ${lead.customer_name}`);
    onClose();
  };

  const busy = saving || deleting;
  const savedEmail = lead?.email ?? '';
  const savedPhone = lead?.phone ?? '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title={lead ? lead.customer_name : 'New lead'}
      subtitle={lead ? `Added ${new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Add a customer to your pipeline'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {isEdit && (
          <div className="grid grid-cols-3 gap-2">
            <a
              href={savedPhone ? `tel:${savedPhone.replace(/[^\d+]/g, '')}` : undefined}
              aria-disabled={!savedPhone}
              className={`btn-secondary !px-2 text-xs ${savedPhone ? '' : 'pointer-events-none opacity-40'}`}
            >
              <Phone className="w-4 h-4" /> Call
            </a>
            <a
              href={savedEmail ? `mailto:${savedEmail}` : undefined}
              aria-disabled={!savedEmail}
              className={`btn-secondary !px-2 text-xs ${savedEmail ? '' : 'pointer-events-none opacity-40'}`}
            >
              <Mail className="w-4 h-4" /> Email
            </a>
            <button
              type="button"
              disabled={!savedEmail || !onRequestReview}
              title={savedEmail ? 'Email this customer a review request' : 'Add an email address first'}
              onClick={() => lead && onRequestReview?.(lead)}
              className="btn-secondary !px-2 text-xs"
            >
              <Star className="w-4 h-4" /> Ask for review
            </button>
          </div>
        )}

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
            autoFocus={!isEdit}
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

        {confirmDelete ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
            <p className="text-sm text-rose-700 flex-1">Delete {lead?.customer_name}? This can’t be undone.</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleDelete} disabled={busy} className="btn-primary !bg-rose-600 hover:!bg-rose-700">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className="btn-secondary">
                Keep
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={busy} className="btn-primary flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add lead'}
            </button>
            {isEdit ? (
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-secondary text-rose-600 hover:bg-rose-50" aria-label="Delete lead">
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">
                Cancel
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
