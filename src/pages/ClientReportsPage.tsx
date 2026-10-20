import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, FileBarChart, Loader2, Save, Send } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import {
  DEFAULT_SCHEDULE,
  REPORT_SECTIONS,
  parseEmails,
  previewReport,
  saveReportSchedule,
  sendTestReport,
  useReportSchedule,
  type ReportSchedule,
} from '@/lib/clientReports';

/** A2: a weekly or monthly report email, in the agency's branding, sent automatically. */
export function ClientReportsPage() {
  const { organization } = useLocationContext();
  const { schedule, deliveries, loading, reload } = useReportSchedule();
  const [form, setForm] = useState<ReportSchedule>(DEFAULT_SCHEDULE);
  const [emails, setEmails] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'test' | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    const s = schedule ?? DEFAULT_SCHEDULE;
    setForm(s);
    setEmails(s.recipients.join(', '));
  }, [schedule, loading]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    const { list, bad } = parseEmails(emails);
    if (bad) return setMessage({ ok: false, text: `“${bad}” isn’t a valid email address.` });
    if (list.length > 10) return setMessage({ ok: false, text: 'Up to 10 recipients.' });
    if (!form.sections.length) return setMessage({ ok: false, text: 'Choose at least one section.' });
    setSaving(true);
    const { error } = await saveReportSchedule(organization.id, { ...form, recipients: list });
    setSaving(false);
    setMessage(error ? { ok: false, text: error } : { ok: true, text: list.length ? 'Saved. Reports go out automatically.' : 'Saved. Add at least one recipient for reports to be sent.' });
    reload();
  };

  const runPreview = async () => {
    setBusy('preview');
    setMessage(null);
    try {
      setPreview(await previewReport({ frequency: form.frequency, sections: form.sections, note: form.note }));
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Preview failed' });
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy('test');
    setMessage(null);
    try {
      const r = await sendTestReport();
      setMessage({ ok: true, text: `Test report sent to ${r.sent_to}.` });
      reload();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Couldn’t send the test.' });
    } finally {
      setBusy(null);
    }
  };

  const toggleSection = (id: ReportSchedule['sections'][number]) =>
    setForm({ ...form, sections: form.sections.includes(id) ? form.sections.filter((x) => x !== id) : [...form.sections, id] });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Client reports</h1>
        <p className="text-sm text-slate-500 mt-1">
          A report email for {organization?.name ?? 'this business'}, sent automatically every week or month, in your agency’s branding (or this business’s report branding).
        </p>
      </div>

      <form onSubmit={save} className="card p-5 space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input type="checkbox" className="rounded border-slate-300" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Send this report automatically
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
          <div>
            <label htmlFor="cr-freq" className="block text-sm font-medium text-slate-700 mb-1.5">How often</label>
            <select id="cr-freq" className="input-field" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as ReportSchedule['frequency'] })}>
              <option value="monthly">Monthly (on the 1st)</option>
              <option value="weekly">Weekly (on Mondays)</option>
            </select>
          </div>
          <div>
            <label htmlFor="cr-to" className="block text-sm font-medium text-slate-700 mb-1.5">Send to <span className="font-normal text-slate-400">(up to 10, separated by commas)</span></label>
            <input id="cr-to" className="input-field" placeholder="owner@client.com, manager@client.com" value={emails} onChange={(e) => setEmails(e.target.value)} />
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-slate-700 mb-1.5">Include</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {REPORT_SECTIONS.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="rounded border-slate-300" checked={form.sections.includes(s.id)} onChange={() => toggleSection(s.id)} />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="cr-note" className="block text-sm font-medium text-slate-700 mb-1.5">Personal note at the top <span className="font-normal text-slate-400">(optional)</span></label>
          <textarea id="cr-note" className="input-field min-h-[70px]" maxLength={500} value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Hi Sara, here’s how the month went…" />
        </div>
        {message && (
          <p className={`text-sm flex items-start gap-2 ${message.ok ? 'text-emerald-700' : 'text-rose-600'}`} role="status">
            {message.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />} {message.text}
          </p>
        )}
        {schedule?.last_error && <p className="text-xs text-rose-600">Last attempt failed: {schedule.last_error}</p>}
        {schedule?.last_sent_at && <p className="text-xs text-slate-500">Last sent {relativeTime(schedule.last_sent_at)}.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
          <button type="button" onClick={runPreview} disabled={busy !== null} className="btn-secondary">{busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview</button>
          <button type="button" onClick={runTest} disabled={busy !== null || !schedule} title={schedule ? undefined : 'Save first'} className="btn-secondary">{busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send me a test</button>
        </div>
      </form>

      {preview && (
        <section className="card p-0 overflow-hidden">
          <p className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100">Subject: <span className="text-slate-800">{preview.subject}</span></p>
          {/* Sandboxed: the report is our own HTML, but it never needs to run scripts */}
          <iframe title="Report preview" sandbox="" srcDoc={preview.html} className="w-full h-[640px] bg-slate-100" />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">History</h2>
        {deliveries.length === 0 ? (
          <div className="card p-6 text-center text-sm text-slate-500"><FileBarChart className="w-7 h-7 text-slate-300 mx-auto mb-1" />No reports sent yet.</div>
        ) : (
          <ul className="card divide-y divide-slate-100 p-0 overflow-hidden">
            {deliveries.map((d) => (
              <li key={d.id} className="p-3 text-sm flex items-start gap-2">
                {d.status === 'failed' ? <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className="text-slate-800">
                    {d.status === 'test' ? 'Test' : d.frequency === 'monthly' ? 'Monthly report' : 'Weekly report'} · {d.period_start} to {d.period_end}
                    <span className="text-slate-400"> · {relativeTime(d.created_at)}</span>
                  </p>
                  <p className="text-xs text-slate-500 truncate">{d.status === 'failed' ? d.error : `To ${d.recipients.join(', ')}`}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
