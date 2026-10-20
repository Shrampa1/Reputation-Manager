import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { callFunction } from '@/lib/functions';
import { relativeTime } from '@/lib/activity';
import type { Integration } from '@/types';

const DELAYS = [
  { value: 0, label: 'Right away' },
  { value: 60, label: '1 hour after payment' },
  { value: 120, label: '2 hours after payment' },
  { value: 1440, label: '1 day after payment' },
  { value: 2880, label: '2 days after payment' },
  { value: 4320, label: '3 days after payment' },
];

const SKIP_REASONS: Record<string, string> = {
  no_email: 'the customer had no email on the payment or their Square profile',
  recently_asked: 'the customer was already asked in the last 30 days',
  no_review_link: 'no review link is set (Settings → Review requests)',
  monthly_limit: 'your plan’s monthly review requests were used up',
  plan: 'Square is part of the Pro and Agency plans',
  amount: 'the payment was below your minimum amount',
  location: 'it was at a location you don’t send from',
};

type SquareMeta = {
  send_after_payment?: boolean;
  delay_minutes?: number;
  min_amount?: number;
  location_ids?: string[];
  available_locations?: { id: string; name: string; currency: string | null }[];
  environment?: string;
  requests_created?: number;
  skipped_no_email?: number;
  last_payment_at?: string;
  last_skip_reason?: string | null;
};

/** Square card: when to ask paying customers for a review. */
export function SquareSettings({ integration, canManage, onSaved }: { integration: Integration; canManage: boolean; onSaved: () => void }) {
  const m = integration.metadata as SquareMeta;
  const [enabled, setEnabled] = useState(m.send_after_payment !== false);
  const [delay, setDelay] = useState(m.delay_minutes ?? 120);
  const [minAmount, setMinAmount] = useState(String(m.min_amount ?? 0));
  const [locationIds, setLocationIds] = useState<string[]>(m.location_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const locations = m.available_locations ?? [];

  useEffect(() => {
    setEnabled(m.send_after_payment !== false);
    setDelay(m.delay_minutes ?? 120);
    setMinAmount(String(m.min_amount ?? 0));
    setLocationIds(m.location_ids ?? []);
  }, [integration.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const amount = Number(minAmount || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setStatus({ kind: 'error', text: 'Enter a minimum amount of 0 or more.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await callFunction('square', { action: 'settings', send_after_payment: enabled, delay_minutes: delay, min_amount: amount, location_ids: locationIds });
      setStatus({ kind: 'success', text: 'Square settings saved' });
      onSaved();
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 text-sm">
      {m.environment === 'sandbox' && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">Square sandbox (test payments only)</p>
      )}
      <label className="flex items-start gap-2.5">
        <input type="checkbox" checked={enabled} disabled={!canManage} onChange={(e) => setEnabled(e.target.checked)} className="mt-0.5 rounded border-slate-300" />
        <span>
          <span className="font-medium text-slate-900">Ask for a review after each payment</span>
          <span className="block text-xs text-slate-500">Customers with an email on the payment or in Square Customers get one email.</span>
        </span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="square-delay" className="block text-xs font-medium text-slate-600 mb-1">Send the email</label>
          <select id="square-delay" value={delay} disabled={!canManage || !enabled} onChange={(e) => setDelay(Number(e.target.value))} className="input-field !py-1.5">
            {DELAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="square-min" className="block text-xs font-medium text-slate-600 mb-1">Only payments of at least</label>
          <input id="square-min" type="number" min="0" step="1" inputMode="decimal" value={minAmount} disabled={!canManage || !enabled}
            onChange={(e) => setMinAmount(e.target.value)} className="input-field !py-1.5 tabular-nums" />
        </div>
      </div>
      {locations.length > 1 && (
        <fieldset>
          <legend className="text-xs font-medium text-slate-600 mb-1">Square locations</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {locations.map((l) => (
              <label key={l.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  disabled={!canManage || !enabled}
                  checked={locationIds.length === 0 || locationIds.includes(l.id)}
                  onChange={(e) => {
                    const all = locations.map((x) => x.id);
                    const current = locationIds.length === 0 ? all : locationIds;
                    const next = e.target.checked ? [...new Set([...current, l.id])] : current.filter((id) => id !== l.id);
                    setLocationIds(next.length === all.length ? [] : next);
                  }}
                  className="rounded border-slate-300"
                />
                {l.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="text-xs text-slate-500">
        {m.requests_created ? `${m.requests_created} review request${m.requests_created === 1 ? '' : 's'} created from Square payments` : m.last_payment_at ? 'No review requests created yet' : 'No payments received yet'}
        {m.last_payment_at ? ` · last payment ${relativeTime(m.last_payment_at)}` : ''}
        {m.skipped_no_email ? ` · ${m.skipped_no_email} skipped (no customer email)` : ''}
      </p>
      {m.last_skip_reason && SKIP_REASONS[m.last_skip_reason] && (
        <p className="text-xs text-slate-500">Last skipped because {SKIP_REASONS[m.last_skip_reason]}.</p>
      )}
      {canManage && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="btn-secondary text-sm">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Square settings
          </button>
          {status && (
            <p role={status.kind === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1 text-xs ${status.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
              {status.kind === 'success' && <Check className="w-3.5 h-3.5" />}
              {status.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
