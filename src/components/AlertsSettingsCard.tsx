import { useEffect, useState } from 'react';
import { Activity, BellRing, Check, Loader2, Mail, RefreshCw } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/functions';
import { relativeTime } from '@/lib/activity';

interface NotificationSettings {
  location_id: string;
  website_monitoring: boolean;
  weekly_digest: boolean;
  recipients: string[];
  monitor_state: { down?: boolean; noindex?: boolean; status?: number; error?: string | null; checked_url?: string };
  last_check_at: string | null;
  last_weekly_at: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-sky-500' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** Settings → Alerts & reports: daily website monitoring and the weekly summary email. */
export function AlertsSettingsCard() {
  const { location, can } = useLocationContext();
  // Feature access (role default or Role access override)
  const isAdmin = can('business.edit');
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [monitoring, setMonitoring] = useState(true);
  const [digest, setDigest] = useState(true);
  const [recipients, setRecipients] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'test' | 'check' | null>(null);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!location) return;
    supabase
      .from('notification_settings')
      .select('*')
      .eq('location_id', location.id)
      .maybeSingle()
      .then(({ data }) => {
        const s = data as NotificationSettings | null;
        setSettings(s);
        setMonitoring(s?.website_monitoring ?? true);
        setDigest(s?.weekly_digest ?? true);
        setRecipients((s?.recipients ?? []).join(', '));
      });
  }, [location]);

  const parsedRecipients = recipients.split(/[,\s;]+/).map((e) => e.trim()).filter(Boolean);
  const dirty =
    monitoring !== (settings?.website_monitoring ?? true) ||
    digest !== (settings?.weekly_digest ?? true) ||
    parsedRecipients.join(',') !== (settings?.recipients ?? []).join(',');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location) return;
    const bad = parsedRecipients.find((r) => !EMAIL_RE.test(r));
    if (bad) return setStatus({ kind: 'error', text: `“${bad}” isn’t a valid email address.` });
    if (parsedRecipients.length > 10) return setStatus({ kind: 'error', text: 'Add up to 10 email addresses.' });
    setSaving(true);
    setStatus(null);
    const { data, error } = await supabase
      .from('notification_settings')
      .upsert({ location_id: location.id, website_monitoring: monitoring, weekly_digest: digest, recipients: parsedRecipients }, { onConflict: 'location_id' })
      .select('*')
      .single();
    setSaving(false);
    if (error) return setStatus({ kind: 'error', text: error.message });
    setSettings(data as NotificationSettings);
    setStatus({ kind: 'success', text: 'Alert settings saved' });
  };

  const sendTest = async () => {
    setBusy('test');
    setStatus(null);
    try {
      const { sentTo } = await callFunction<{ sentTo: string }>('monitor', { action: 'test-digest' });
      setStatus({ kind: 'success', text: `Test summary sent to ${sentTo}` });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Couldn’t send the test email' });
    } finally {
      setBusy(null);
    }
  };

  const checkNow = async () => {
    setBusy('check');
    setStatus(null);
    try {
      const { settings: updated } = await callFunction<{ settings: NotificationSettings }>('monitor', { action: 'check-now' });
      if (updated) setSettings(updated);
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'The check failed' });
    } finally {
      setBusy(null);
    }
  };

  const st = settings?.monitor_state ?? {};
  const lastCheck = settings?.last_check_at;

  return (
    <form id="alerts" onSubmit={save} className="card p-5 scroll-mt-20">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
          <BellRing className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Alerts & reports</h2>
          <p className="text-sm text-slate-500">We watch your website and send a weekly summary by email</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-start gap-2.5">
            <Activity className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Website monitoring</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Checks your website daily and emails you if it goes down, comes back, or starts blocking Google. Re-runs the full
                website health check every week.
              </p>
              {location?.website ? (
                <p className="text-xs mt-1.5 flex items-center gap-1.5 flex-wrap">
                  {lastCheck ? (
                    <>
                      <span className={`badge ${st.down ? 'bg-rose-50 text-rose-600' : st.noindex ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {st.down ? 'Down' : st.noindex ? 'Blocking Google' : 'Up'}
                      </span>
                      <span className="text-slate-400">checked {relativeTime(lastCheck)}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">Not checked yet</span>
                  )}
                  {isAdmin && (
                    <button type="button" onClick={checkNow} disabled={busy !== null} className="text-sky-600 hover:underline inline-flex items-center gap-1">
                      {busy === 'check' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Check now
                    </button>
                  )}
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1.5">Add your website address (SEO & Website → Google Listing → Edit your details) to start monitoring.</p>
              )}
            </div>
          </div>
          <Toggle checked={monitoring} onChange={setMonitoring} disabled={!isAdmin} label="Website monitoring" />
        </div>

        <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-start gap-2.5">
            <Mail className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Weekly summary email</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Every week: new reviews and your Google rating, review requests, leads, posts, website score and Google search
                clicks, plus a short to-do list.
              </p>
              {settings?.last_weekly_at && <p className="text-xs text-slate-400 mt-1">Last sent {relativeTime(settings.last_weekly_at)}</p>}
            </div>
          </div>
          <Toggle checked={digest} onChange={setDigest} disabled={!isAdmin} label="Weekly summary email" />
        </div>

        <div>
          <label htmlFor="alert-recipients" className="block text-sm font-medium text-slate-700 mb-1.5">Send to</label>
          <input
            id="alert-recipients"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            disabled={!isAdmin}
            placeholder="Leave empty to send to all owners and admins"
            className="input-field disabled:bg-slate-50 disabled:text-slate-500"
          />
          <p className="text-xs text-slate-400 mt-1">Separate several addresses with commas.</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4">
          <button type="submit" disabled={saving || !dirty} className="btn-primary sm:w-auto">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
          <button type="button" onClick={sendTest} disabled={busy !== null} className="btn-secondary sm:w-auto">
            {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Email me a test summary
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400 mt-3">Only owners and admins can change alerts.</p>
      )}
      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={`flex items-center gap-1.5 text-sm mt-3 ${status.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {status.kind === 'success' && <Check className="w-4 h-4 shrink-0" />}
          {status.text}
        </p>
      )}
    </form>
  );
}
