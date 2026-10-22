import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Copy, Download, ExternalLink, Loader2, Mail, QrCode, Save, Send, Star, Trash2, Users } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import { parseCustomerList } from '@/lib/reviewRequests';
import { useEmailableContacts } from '@/lib/contacts';
import { downloadText } from '@/lib/liveChat';
import { downloadQrPng } from '@/lib/qr';
import {
  CATEGORY_LABEL, CATEGORY_TONE, SKIP_LABEL, SURVEY_DEFAULTS, deleteResponse, fetchResponses, fetchSurvey, publicSurveyUrl,
  responsesCsv, saveSurvey, sendSurvey, setFollowUp, type FollowUp, type Survey, type SurveyResponse, type SurveySendResult, type SurveySettings,
} from '@/lib/surveys';

type Tab = 'responses' | 'send' | 'settings' | 'share';
const TABS: [Tab, string][] = [['responses', 'Answers'], ['send', 'Send'], ['settings', 'Settings'], ['share', 'Link & QR']];
type Filter = 'all' | 'promoter' | 'passive' | 'detractor' | 'follow_up' | 'waiting';
const FILTERS: [Filter, string][] = [['all', 'All'], ['follow_up', 'Needs follow-up'], ['promoter', 'Promoters'], ['passive', 'Passives'], ['detractor', 'Detractors'], ['waiting', 'Not answered']];
const FOLLOW_UP: Record<FollowUp, string> = { open: 'To do', contacted: 'Contacted', resolved: 'Resolved' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** C3: one survey's answers, sending, texts and public link. */
export function SurveyDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { can } = useLocationContext();
  const canEdit = can('reviews.request');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [saved, setSaved] = useState<Survey | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const tab = (TABS.some(([t]) => t === params.get('tab')) ? params.get('tab') : 'responses') as Tab;
  const setTab = (t: Tab) => setParams((p) => { p.set('tab', t); return p; }, { replace: true });

  useEffect(() => {
    fetchSurvey(id)
      .then((s) => {
        if (!s) return setLoadError('Survey not found.');
        setSurvey(s);
        setSaved(s);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Couldn’t load the survey'));
  }, [id]);
  const dirty = useMemo(() => JSON.stringify(survey) !== JSON.stringify(saved), [survey, saved]);

  if (loadError) return <p className="text-sm text-rose-700">{loadError} <Link to="/surveys" className="text-sky-600 hover:underline">Back to surveys</Link></p>;
  if (!survey) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  const setSettings = (patch: Partial<SurveySettings>) => setSurvey({ ...survey, settings: { ...survey.settings, ...patch } });
  const save = async (patch?: Partial<Survey>) => {
    const next = { ...survey, ...patch };
    const bad = (next.settings.alert_emails ?? []).find((e) => !EMAIL_RE.test(e));
    if (bad) return setMessage({ ok: false, text: `“${bad}” isn’t a valid email address.` });
    setSaving(true);
    setMessage(null);
    try {
      const s = await saveSurvey(next);
      setSurvey(s);
      setSaved(s);
      setMessage({ ok: true, text: s.status === 'active' ? 'Saved.' : 'Saved. The survey is paused.' });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Couldn’t save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/surveys" className="p-1 text-slate-500 hover:text-slate-800" aria-label="Back to surveys"><ArrowLeft className="w-5 h-5" /></Link>
        <input className="text-xl font-bold text-slate-900 bg-transparent border-0 focus:ring-2 focus:ring-sky-300 rounded-lg px-1 min-w-0 flex-1" value={survey.name} maxLength={80} onChange={(e) => setSurvey({ ...survey, name: e.target.value })} disabled={!canEdit} aria-label="Survey name" />
        <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${survey.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{survey.status === 'active' ? 'Active' : 'Paused'}</span>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => save({ status: survey.status === 'active' ? 'paused' : 'active' })} disabled={saving} className="btn-secondary text-sm">{survey.status === 'active' ? 'Pause' : 'Turn on'}</button>
            <button type="button" onClick={() => save()} disabled={saving || !dirty} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
          </div>
        )}
      </div>
      {message && (
        <p className={`text-sm inline-flex items-center gap-1.5 ${message.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {message.text}
        </p>
      )}
      <nav className="flex gap-1 border-b border-slate-200 overflow-x-auto" aria-label="Survey sections">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{label}</button>
        ))}
      </nav>
      {tab === 'responses' && <Responses survey={survey} />}
      {tab === 'send' && <SendPanel survey={survey} dirty={dirty} />}
      {tab === 'settings' && <Settings survey={survey} set={setSettings} disabled={!canEdit} />}
      {tab === 'share' && <Share survey={survey} />}
    </div>
  );
}

function Responses({ survey }: { survey: Survey }) {
  const { can } = useLocationContext();
  const [params] = useSearchParams();
  const [rows, setRows] = useState<SurveyResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(params.get('filter') === 'follow_up' ? 'follow_up' : 'all');
  const [open, setOpen] = useState<string | null>(params.get('response'));
  useEffect(() => {
    fetchResponses(survey.id).then(setRows).catch((e) => setError(e instanceof Error ? e.message : 'Couldn’t load answers'));
  }, [survey.id]);
  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>;

  const shown = rows.filter((r) =>
    filter === 'all' ? true
    : filter === 'follow_up' ? r.follow_up === 'open' || r.follow_up === 'contacted'
    : filter === 'waiting' ? r.score === null
    : r.category === filter);
  const update = (id: string, patch: Partial<SurveyResponse>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const count = (f: Filter) => rows.filter((r) => (f === 'follow_up' ? r.follow_up === 'open' || r.follow_up === 'contacted' : f === 'waiting' ? r.score === null : r.category === f)).length;

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-slate-200 flex-wrap">
        <div className="flex gap-1 flex-wrap flex-1">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${filter === f ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {label}{f !== 'all' && ` ${count(f)}`}
            </button>
          ))}
        </div>
        {rows.length > 0 && <button type="button" onClick={() => downloadText(`${survey.name.replace(/[^\w-]+/g, '-').toLowerCase()}-answers.csv`, responsesCsv(rows))} className="btn-secondary text-sm"><Download className="w-4 h-4" /> CSV</button>}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-slate-500 p-4">{rows.length === 0 ? 'No one has been asked yet. Send the survey, or share its link.' : 'Nothing here.'}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {shown.map((r) => (
            <li key={r.id} className={open === r.id ? 'bg-slate-50' : ''}>
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50" aria-expanded={open === r.id}>
                <span className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-sm font-bold ${r.category ? CATEGORY_TONE[r.category] : 'bg-slate-100 text-slate-400'}`}>{r.score ?? '–'}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-900">{r.name || r.email || 'Anonymous (public link)'}</span>
                  {r.email && r.name && <span className="text-xs text-slate-500 ml-2">{r.email}</span>}
                  <span className="block text-sm text-slate-600 truncate">{r.comment ?? (r.score === null ? statusText(r) : 'No comment')}</span>
                </span>
                <span className="text-right shrink-0">
                  {r.follow_up && <span className={`block text-[11px] font-medium rounded-full px-2 py-0.5 ${r.follow_up === 'resolved' ? 'bg-emerald-50 text-emerald-700' : r.follow_up === 'contacted' ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700'}`}>{FOLLOW_UP[r.follow_up]}</span>}
                  <span className="block text-xs text-slate-400 mt-0.5">{relativeTime(r.answered_at ?? r.created_at)}</span>
                </span>
              </button>
              {open === r.id && <ResponseDetail r={r} canEdit={can('reviews.request')} onChange={(p) => update(r.id, p)} onDelete={() => setRows(rows.filter((x) => x.id !== r.id))} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const statusText = (r: SurveyResponse) =>
  r.status === 'queued' ? `Will be sent ${r.send_after ? new Date(r.send_after).toLocaleDateString() : 'soon'}`
  : r.status === 'failed' ? `Couldn’t send: ${r.error ?? 'unknown error'}`
  : r.status === 'cancelled' ? `Not sent: ${r.error ?? 'cancelled'}`
  : 'Waiting for an answer';

function ResponseDetail({ r, canEdit, onChange, onDelete }: { r: SurveyResponse; canEdit: boolean; onChange: (p: Partial<SurveyResponse>) => void; onDelete: () => void }) {
  const [note, setNote] = useState(r.follow_up_note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setStatus = async (status: FollowUp | null, withNote = false) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await setFollowUp(r.id, status, withNote ? note : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="px-4 pb-4 pl-16 space-y-3 text-sm">
      {r.category && <span className={`inline-block text-[11px] font-medium rounded-full px-2 py-0.5 ${CATEGORY_TONE[r.category]}`}>{CATEGORY_LABEL[r.category]}</span>}
      {r.comment && <p className="whitespace-pre-wrap text-slate-800 bg-white border border-slate-200 rounded-lg p-3">{r.comment}</p>}
      <p className="text-xs text-slate-500">
        {r.channel === 'link' ? 'Answered on the public link' : r.channel === 'auto' ? 'Sent automatically after a completed job' : 'Sent by email'}
        {' · '}asked {new Date(r.created_at).toLocaleDateString()}
        {r.answered_at && ` · answered ${new Date(r.answered_at).toLocaleString()}`}
        {r.review_clicked_at && ' · opened your review page'}
        {r.lead_id && <> · <Link to="/leads" className="text-sky-600 hover:underline">lead</Link></>}
      </p>
      {r.score !== null && canEdit && (
        <div className="space-y-2">
          <div className="flex gap-1.5 flex-wrap items-center">
            <span className="text-xs font-medium text-slate-600 mr-1">Follow-up:</span>
            {(['open', 'contacted', 'resolved'] as FollowUp[]).map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => setStatus(s)} aria-pressed={r.follow_up === s}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${r.follow_up === s ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{FOLLOW_UP[s]}</button>
            ))}
            {r.follow_up && <button type="button" disabled={busy} onClick={() => setStatus(null)} className="text-xs text-slate-500 hover:underline ml-1">Not needed</button>}
          </div>
          <div className="flex gap-2 items-start">
            <textarea className="input-field text-sm flex-1" rows={2} maxLength={1000} placeholder="Note for the team (what you did, what you promised…)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" disabled={busy || note === (r.follow_up_note ?? '')} onClick={() => setStatus(r.follow_up ?? 'contacted', true)} className="btn-secondary text-sm">Save note</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="flex gap-2">
        {r.email && <a href={`mailto:${r.email}?subject=${encodeURIComponent('About your feedback')}`} className="btn-secondary text-xs !py-1"><Mail className="w-3.5 h-3.5" /> Email {r.name.split(' ')[0] || 'them'}</a>}
        {canEdit && (
          <button type="button" onClick={async () => { if (window.confirm('Delete this answer?')) { await deleteResponse(r.id); onDelete(); } }} className="btn-secondary text-xs !py-1 text-rose-700"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
        )}
      </div>
    </div>
  );
}

function SendPanel({ survey, dirty }: { survey: Survey; dirty: boolean }) {
  const { location, can } = useLocationContext();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SurveySendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickContacts, setPickContacts] = useState(false);
  const { contacts, loading } = useEmailableContacts(pickContacts);
  const [tag, setTag] = useState('');
  const tags = useMemo(() => [...new Set(contacts.flatMap((c) => c.tags))].sort(), [contacts]);
  const parsed = useMemo(() => parseCustomerList(text), [text]);
  const valid = parsed.filter((r) => !r.problem);
  if (!can('reviews.request')) return <p className="text-sm text-slate-500">You don’t have access to send surveys.</p>;

  const addContacts = () => {
    const pick = contacts.filter((c) => !tag || c.tags.includes(tag));
    const lines = pick.map((c) => `${c.name.replace(/[,;\t\r\n]+/g, ' ')}, ${c.email}`);
    setText((t) => [t.trim(), ...lines].filter(Boolean).join('\n'));
    setPickContacts(false);
  };
  const send = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    try {
      const r = await sendSurvey(survey.id, valid.map((v) => ({ name: v.name, email: v.email })), setProgress);
      setResult(r);
      if (r.sent) setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t send');
    } finally {
      setBusy(false);
    }
  };
  const first = valid[0]?.name || 'Alex';
  const s = survey.settings;
  const fill = (v: string) => v.replace(/\{business\}/g, location?.name ?? 'your business').replace(/\{first_name\}/g, first.split(' ')[0]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(0,520px)] gap-4 items-start">
      <section className="card p-5 space-y-3">
        {survey.status !== 'active' && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">This survey is paused. Turn it on (top right) to send it.</p>}
        {dirty && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">You have unsaved changes. Save first so the email uses them.</p>}
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Customers (one per line: name, email, or paste from a spreadsheet)</span>
          <textarea className="input-field text-sm font-mono" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Maria Lopez, maria@example.com\nJohn Smith <john@example.com>'} />
        </label>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <button type="button" onClick={() => setPickContacts(!pickContacts)} className="btn-secondary text-sm"><Users className="w-4 h-4" /> Add from contacts</button>
          {pickContacts && (loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (
            <>
              <select className="input-field !w-auto text-sm" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Contacts with tag">
                <option value="">All contacts ({contacts.length})</option>
                {tags.map((t) => <option key={t} value={t}>Tagged “{t}” ({contacts.filter((c) => c.tags.includes(t)).length})</option>)}
              </select>
              <button type="button" onClick={addContacts} className="btn-secondary text-sm">Add</button>
            </>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {valid.length} to send{parsed.length > valid.length && `, ${parsed.length - valid.length} with a problem (bad or repeated email)`}. People asked in the last 30 days, and anyone who unsubscribed, are skipped.
        </p>
        <button type="button" onClick={send} disabled={busy || !valid.length || survey.status !== 'active' || dirty} className="btn-primary text-sm">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending {progress}/{valid.length}</> : <><Send className="w-4 h-4" /> Send to {valid.length}</>}
        </button>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {result && (
          <div className="text-sm rounded-lg border border-slate-200 p-3 space-y-1">
            <p className="font-medium text-slate-900">{result.sent} sent{result.failed ? `, ${result.failed} failed` : ''}{result.skipped.length ? `, ${result.skipped.length} skipped` : ''}.</p>
            {result.error && <p className="text-rose-700">{result.error}</p>}
            {result.skipped.slice(0, 20).map((k) => <p key={`${k.email}-${k.reason}`} className="text-xs text-slate-500">{k.email || k.name}: {SKIP_LABEL[k.reason]}</p>)}
          </div>
        )}
      </section>
      <section className="card overflow-hidden xl:sticky xl:top-4">
        <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Email preview</p>
        <div className="bg-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-2">Subject: <span className="text-slate-800 font-medium">{fill(s.subject?.trim() || SURVEY_DEFAULTS.subject)}</span></p>
          <div className="bg-white rounded-xl p-5 border-t-4" style={{ borderTopColor: s.accent || '#0ea5e9' }}>
            <p className="font-bold text-slate-900">Hi {first.split(' ')[0]},</p>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{fill(s.intro?.trim() || SURVEY_DEFAULTS.intro)}</p>
            <p className="text-sm font-semibold text-slate-900 mt-4">{fill(s.question?.trim() || SURVEY_DEFAULTS.question)}</p>
            <div className="flex gap-1 mt-2 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => (
                <span key={i} className={`w-8 h-8 rounded-md border border-slate-200 text-xs font-semibold flex items-center justify-center ${i <= 6 ? 'bg-rose-50' : i <= 8 ? 'bg-amber-50' : 'bg-emerald-50'}`}>{i}</span>
              ))}
            </div>
            <p className="flex justify-between text-[11px] text-slate-500 mt-1 max-w-[410px]"><span>Not likely</span><span>Very likely</span></p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Customers tap a number, then can add a comment. The email ends with an unsubscribe link.</p>
        </div>
      </section>
    </div>
  );
}

function Settings({ survey, set, disabled }: { survey: Survey; set: (p: Partial<SurveySettings>) => void; disabled: boolean }) {
  const { location } = useLocationContext();
  const s = survey.settings;
  const [alerts, setAlerts] = useState((s.alert_emails ?? []).join(', '));
  return (
    <fieldset disabled={disabled} className="card p-5 space-y-4 max-w-3xl">
      <h2 className="text-sm font-semibold text-slate-900">Email</h2>
      <Text label="Subject" value={s.subject} placeholder={SURVEY_DEFAULTS.subject} onChange={(v) => set({ subject: v })} max={150} />
      <Text label="Message" value={s.intro} placeholder={SURVEY_DEFAULTS.intro} onChange={(v) => set({ intro: v })} max={1000} area />
      <h2 className="text-sm font-semibold text-slate-900 pt-2">Questions</h2>
      <Text label="Main question (0–10)" value={s.question} placeholder={SURVEY_DEFAULTS.question} onChange={(v) => set({ question: v })} max={200} />
      <Text label="Follow-up question" value={s.comment_question} placeholder={SURVEY_DEFAULTS.comment_question} onChange={(v) => set({ comment_question: v })} max={200} />
      <h2 className="text-sm font-semibold text-slate-900 pt-2">Thank-you messages</h2>
      <Text label="Promoters (9–10)" value={s.thanks_promoter} placeholder={SURVEY_DEFAULTS.thanks_promoter} onChange={(v) => set({ thanks_promoter: v })} max={500} area />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="rounded border-slate-300 mt-0.5" checked={s.ask_review !== false} onChange={(e) => set({ ask_review: e.target.checked })} />
        <span>Ask promoters to leave a public review{!location?.review_link && <span className="block text-xs text-amber-700">Add your review link in Settings → Review requests first.</span>}</span>
      </label>
      <Text label="Passives (7–8)" value={s.thanks_passive} placeholder={SURVEY_DEFAULTS.thanks_passive} onChange={(v) => set({ thanks_passive: v })} max={500} area />
      <Text label="Detractors (0–6)" value={s.thanks_detractor} placeholder={SURVEY_DEFAULTS.thanks_detractor} onChange={(v) => set({ thanks_detractor: v })} max={500} area />
      <h2 className="text-sm font-semibold text-slate-900 pt-2">Unhappy customers</h2>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1.5">Email these people when someone scores 0–6 (up to 5, comma separated)</span>
        <input className="input-field text-sm" value={alerts} placeholder="owner@yourbusiness.com" onChange={(e) => setAlerts(e.target.value)}
          onBlur={() => set({ alert_emails: alerts.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 5) })} />
        <span className="block text-xs text-slate-500 mt-1">Every unhappy answer also appears under Answers → Needs follow-up.</span>
      </label>
      <h2 className="text-sm font-semibold text-slate-900 pt-2">Send automatically</h2>
      <label className="flex items-center gap-2 text-sm text-slate-700 flex-wrap">
        <input type="checkbox" className="rounded border-slate-300" checked={Boolean(s.auto_lead_completed)} onChange={(e) => set({ auto_lead_completed: e.target.checked })} />
        When a lead with an email is moved to Completed, send this survey
        <select className="input-field !w-auto text-sm" value={s.auto_delay_days ?? 1} onChange={(e) => set({ auto_delay_days: Number(e.target.value) })} disabled={disabled || !s.auto_lead_completed} aria-label="Delay">
          {[0, 1, 2, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d === 0 ? 'straight away' : `${d} day${d === 1 ? '' : 's'} later`}</option>)}
        </select>
      </label>
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-1.5">Colour</p>
        <input type="color" className="h-[42px] w-20 rounded-lg border border-slate-300 cursor-pointer" value={s.accent || '#0ea5e9'} onChange={(e) => set({ accent: e.target.value })} aria-label="Colour" />
      </div>
      <p className="text-xs text-slate-500">You can use {'{business}'} and {'{first_name}'} in the texts. Remember to Save (top right).</p>
    </fieldset>
  );
}

function Text({ label, value, onChange, max, area, placeholder }: { label: string; value?: string; onChange: (v: string) => void; max: number; area?: boolean; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      {area
        ? <textarea className="input-field text-sm" rows={2} maxLength={max} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
        : <input className="input-field text-sm" maxLength={max} placeholder={placeholder} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function Share({ survey }: { survey: Survey }) {
  const [copied, setCopied] = useState(false);
  const url = publicSurveyUrl(survey.public_key);
  return (
    <section className="card p-5 space-y-4 max-w-3xl">
      <p className="text-sm text-slate-600">Anyone with this link can answer, without an email: put it on receipts, in your email signature, on your website, or print the QR code for your counter.</p>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-sm bg-slate-100 rounded-lg px-3 py-2 break-all flex-1 min-w-0">{url}</code>
        <button type="button" onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})} className="btn-secondary text-sm">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} Copy
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm"><ExternalLink className="w-4 h-4" /> Open</a>
        <button type="button" onClick={() => downloadQrPng(url, `${survey.name.replace(/[^\w-]+/g, '-').toLowerCase()}-survey-qr.png`)} className="btn-secondary text-sm"><QrCode className="w-4 h-4" /> QR code</button>
      </div>
      {survey.status !== 'active' && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">The survey is paused, so the link shows “not available” until you turn it on.</p>}
      <p className="text-xs text-slate-500 inline-flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Promoters see your review link after answering (if turned on in Settings).</p>
    </section>
  );
}
