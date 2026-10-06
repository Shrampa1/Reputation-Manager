import type { LeadStage } from '@/types';

export const STAGES: { key: LeadStage; label: string }[] = [
  { key: 'new_lead', label: 'New Lead' },
  { key: 'quote_sent', label: 'Quote Sent' },
  { key: 'job_booked', label: 'Job Booked' },
  { key: 'completed', label: 'Completed' },
  { key: 'review_requested', label: 'Review Requested' },
];

/** "450", "$1200", "1,200.50" → "$1,200" (the pipeline sums digits from this text field) */
export function formatValue(raw: string): string {
  const num = Math.round(Number(raw.replace(/[^0-9.]/g, '')));
  return raw.trim() && Number.isFinite(num) && num > 0 ? `$${num.toLocaleString('en-US')}` : '';
}
