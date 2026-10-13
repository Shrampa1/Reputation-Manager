import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ChevronDown, Copy, KeyRound, Loader2, Lock, Plus, Send, Trash2, Webhook, Zap } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { usePlan } from '@/lib/billing';
import { relativeTime } from '@/lib/activity';
import {
  API_BASE,
  WEBHOOK_EVENTS,
  addWebhook,
  createApiKey,
  deleteWebhook,
  revokeApiKey,
  rotateWebhookSecret,
  sendTestWebhook,
  updateWebhook,
  urlHost,
  useApiAccess,
  type WebhookEndpoint,
  type WebhookEvent,
} from '@/lib/apiAccess';
import { Modal } from '@/components/ui/Modal';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="btn-secondary !py-1 text-xs shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : label}
    </button>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="text-[11px] leading-relaxed bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto whitespace-pre">{children}</pre>;
}

const curlExample = (key: string) => `curl -X POST ${API_BASE}/review-requests \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Jane Doe","email":"jane@example.com","delay_minutes":120,"external_id":"job-1042"}'`;

const verifyExample = `// Node.js: check X-Reputation-Signature before trusting a webhook
import crypto from 'node:crypto';
const [t, v1] = header.split(',').map((p) => p.split('=')[1]);
const expected = crypto.createHmac('sha256', SECRET).update(\`\${t}.\${rawBody}\`).digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected))
  && Math.abs(Date.now() / 1000 - Number(t)) < 300;`;

const statusTone: Record<string, string> = {
  delivered: 'bg-emerald-50 text-emerald-600',
  pending: 'bg-slate-100 text-slate-500',
  failed: 'bg-rose-50 text-rose-600',
};

export function ApiWebhooksSection() {
  const { organization, can } = useLocationContext();
  const allowed = can('integrations.manage');
  const { usage, loading: planLoading } = usePlan();
  const { keys, endpoints, deliveries, loading, error, reload } = useApiAccess();
  const limits = (usage?.limits ?? {}) as Record<string, number | undefined>;
  // Missing limit = billing not set up → don't block
  const keyLimit = limits.api_keys ?? -1;
  const hookLimit = limits.webhooks ?? -1;
  const locked = !planLoading && keyLimit === 0 && hookLimit === 0;

  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [guide, setGuide] = useState<'zapier' | 'make' | 'other' | null>('zapier');
  const [form, setForm] = useState<{ url: string; description: string; events: WebhookEvent[] }>({
    url: '', description: '', events: ['review.created', 'review_request.rated', 'feedback.received'],
  });
  const [showSecret, setShowSecret] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'revoke' | 'delete'; id: string; label: string } | null>(null);

  if (!organization) return null;
  const activeKeys = keys.filter((k) => !k.revoked_at);

  const run = async (key: string, fn: () => Promise<{ error: string | null }>, success?: string) => {
    setBusy(key);
    setNotice(null);
    const { error: err } = await fn();
    setBusy(null);
    if (err) setNotice({ kind: 'error', text: err });
    else {
      if (success) setNotice({ kind: 'success', text: success });
      await reload();
    }
    return !err;
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return setNotice({ kind: 'error', text: 'Give the key a name, e.g. “Zapier”.' });
    setBusy('create-key');
    setNotice(null);
    const { key, error: err } = await createApiKey(organization.id, keyName.trim());
    setBusy(null);
    if (err || !key) return setNotice({ kind: 'error', text: err ?? 'Could not create the key.' });
    setKeyName('');
    setNewKey(key.key);
    reload();
  };

  const submitWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^https:\/\/\S+$/.test(form.url.trim())) return setNotice({ kind: 'error', text: 'Paste the full https:// address your app gave you.' });
    if (!form.events.length) return setNotice({ kind: 'error', text: 'Pick at least one event.' });
    const ok = await run('add-hook', () => addWebhook(organization.id, { url: form.url.trim(), description: form.description.trim(), events: form.events }), 'Webhook added. Use “Send test” to check it.');
    if (ok) setForm({ url: '', description: '', events: form.events });
  };

  const toggleEvent = (id: WebhookEvent) =>
    setForm((f) => ({ ...f, events: f.events.includes(id) ? f.events.filter((x) => x !== id) : [...f.events, id] }));

  const endpointStatus = (ep: WebhookEndpoint) => {
    if (!ep.active) return { text: ep.disabled_reason ? `Off: ${ep.disabled_reason}` : 'Off', tone: 'bg-slate-100 text-slate-500' };
    if (ep.failure_count > 0) return { text: `${ep.failure_count} failed in a row`, tone: 'bg-amber-50 text-amber-700' };
    return { text: ep.last_success_at ? `Working · ${relativeTime(ep.last_success_at)}` : 'Waiting for the first event', tone: 'bg-emerald-50 text-emerald-600' };
  };

  return (
    <section id="api" className="card p-5 space-y-5 scroll-mt-20">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-600 shrink-0"><Zap className="w-5 h-5" /></div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Zapier, Make &amp; API</h2>
          <p className="text-sm text-slate-500">
            Send review requests automatically when a job is done in your other apps (CRM, booking, invoicing), and send
            new reviews and feedback to Slack, Sheets or your CRM.
          </p>
        </div>
      </div>

      {!allowed ? (
        <p className="text-sm text-slate-500 flex items-center gap-2"><Lock className="w-4 h-4" /> Ask an owner or admin to set up connected apps.</p>
      ) : locked ? (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600 flex flex-col sm:flex-row sm:items-center gap-3">
          <Lock className="w-5 h-5 text-slate-400 shrink-0" />
          <p className="flex-1">Connecting other apps is included in the <b>Pro</b> and <b>Agency</b> plans.</p>
          <Link to="/billing" className="btn-primary text-sm">See plans</Link>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-sky-500 animate-spin" /></div>
      ) : (
        <>
          {(error || notice) && (
            <p className={`text-sm ${notice?.kind === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} role={notice?.kind === 'success' ? 'status' : 'alert'}>
              {notice?.text ?? error}
            </p>
          )}

          {/* ---------------- API keys ---------------- */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><KeyRound className="w-4 h-4 text-slate-400" /> API keys</h3>
            <p className="text-xs text-slate-500 mb-2">
              One key per app makes it easy to switch one off later.{keyLimit > 0 && ` Your plan includes ${keyLimit} active keys.`}
            </p>
            {activeKeys.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 mb-2">
                {activeKeys.map((k) => (
                  <li key={k.id} className="flex items-center gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{k.name}</p>
                      <p className="text-xs text-slate-400"><code>{k.prefix}…</code> · created {relativeTime(k.created_at)} · {k.last_used_at ? `last used ${relativeTime(k.last_used_at)}` : 'not used yet'}</p>
                    </div>
                    <button onClick={() => setConfirm({ kind: 'revoke', id: k.id, label: k.name })} className="btn-ghost text-xs text-slate-500 hover:text-rose-600">Revoke</button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={createKey} className="flex flex-col sm:flex-row gap-2" noValidate>
              <label htmlFor="api-key-name" className="sr-only">Key name</label>
              <input id="api-key-name" value={keyName} onChange={(e) => setKeyName(e.target.value)} maxLength={60} placeholder="Key name, e.g. Zapier" className="input-field flex-1" />
              <button type="submit" disabled={busy !== null} className="btn-primary shrink-0">
                {busy === 'create-key' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create key
              </button>
            </form>
          </div>

          {/* ---------------- Setup guides ---------------- */}
          <div>
            <h3 className="text-sm font-bold text-slate-900">Send a review request from another app</h3>
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <code className="text-xs text-slate-700 truncate flex-1">POST {API_BASE}/review-requests</code>
              <CopyButton text={`${API_BASE}/review-requests`} label="Copy URL" />
            </div>
            <div className="mt-2 rounded-xl border border-slate-100 divide-y divide-slate-100">
              {([
                ['zapier', 'Zapier'],
                ['make', 'Make'],
                ['other', 'Any other app (fields and example)'],
              ] as const).map(([id, label]) => (
                <div key={id}>
                  <button type="button" onClick={() => setGuide(guide === id ? null : id)} className="w-full flex items-center justify-between p-3 text-sm font-semibold text-slate-800">
                    {label}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${guide === id ? 'rotate-180' : ''}`} />
                  </button>
                  {guide === id && (
                    <div className="px-3 pb-3 text-sm text-slate-600 space-y-2">
                      {id === 'zapier' && (
                        <ol className="list-decimal ml-5 space-y-1">
                          <li>Create a Zap. <b>Trigger</b>: the moment a job is finished in your app (e.g. “Invoice paid”, “Appointment completed”).</li>
                          <li><b>Action</b>: <i>Webhooks by Zapier → POST</i>.</li>
                          <li>URL: the address above. Payload type: <b>json</b>.</li>
                          <li>Data: <code>name</code> → customer name, <code>email</code> → customer email, and optionally <code>delay_minutes</code> (e.g. 120) and <code>external_id</code> → the job or invoice ID.</li>
                          <li>Headers: <code>Authorization</code> → <code>Bearer</code> followed by your API key.</li>
                          <li>Test the step: the request appears under Reviews → Review requests.</li>
                        </ol>
                      )}
                      {id === 'make' && (
                        <ol className="list-decimal ml-5 space-y-1">
                          <li>Add your trigger module (e.g. “Watch paid invoices”).</li>
                          <li>Add <i>HTTP → Make a request</i>. Method <b>POST</b>, URL: the address above.</li>
                          <li>Header <code>Authorization</code>: <code>Bearer</code> + your API key. Body type <b>Raw</b>, content type <b>JSON</b>.</li>
                          <li>Body: <code>{'{"name": "…", "email": "…", "delay_minutes": 120, "external_id": "…"}'}</code> mapped from your trigger.</li>
                        </ol>
                      )}
                      {id === 'other' && (
                        <>
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-slate-100">
                              {[
                                ['email', 'Required. Customer’s email.'],
                                ['name', 'Customer’s name (used in “Hi Jane,”).'],
                                ['delay_minutes', 'Optional. Wait before emailing (0 to 43200). Good for “2 hours after the job”.'],
                                ['external_id', 'Optional. Your job/order ID. The same ID is never emailed twice, so retries are safe.'],
                                ['note', 'Optional. A personal line in the email (up to 600 characters).'],
                                ['allow_repeat', 'Optional. true to ask someone who was already asked in the last 30 days.'],
                              ].map(([f, d]) => (
                                <tr key={f}><td className="py-1.5 pr-3 font-mono text-slate-800 align-top">{f}</td><td className="py-1.5 text-slate-600">{d}</td></tr>
                              ))}
                            </tbody>
                          </table>
                          <Code>{curlExample('re_your_key')}</Code>
                          <p className="text-xs text-slate-500">
                            Also available: <code>GET /me</code> (test the key), <code>GET /review-requests</code>, <code>DELETE /review-requests/&#123;id&#125;</code> (cancel a scheduled one),
                            and <code>POST /webhooks</code> / <code>DELETE /webhooks/&#123;id&#125;</code> for apps that subscribe themselves.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">Requests count towards your monthly allowance; customers asked in the last 30 days are skipped.</p>
          </div>

          {/* ---------------- Webhooks ---------------- */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Webhook className="w-4 h-4 text-slate-400" /> Webhooks: send events to your apps</h3>
            <p className="text-xs text-slate-500 mb-2">
              Paste a “Catch Hook” URL from Zapier, a Make webhook URL, or your own endpoint. We send events within about a minute and retry failures for a day.
              {hookLimit > 0 && ` Your plan includes ${hookLimit} webhooks.`}
            </p>

            {endpoints.length > 0 && (
              <ul className="space-y-2 mb-3">
                {endpoints.map((ep) => {
                  const st = endpointStatus(ep);
                  return (
                    <li key={ep.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                      <div className="flex items-start gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 truncate">{ep.description || urlHost(ep.url)}</p>
                          <p className="text-xs text-slate-400 truncate">{ep.url}{ep.source === 'api' && ' · added by a connected app'}</p>
                        </div>
                        <span className={`badge ${st.tone}`}>{st.text}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ep.events.map((e) => (
                          <span key={e} className="badge bg-slate-50 text-slate-600">{WEBHOOK_EVENTS.find((x) => x.id === e)?.label ?? e}</span>
                        ))}
                      </div>
                      {ep.last_error && ep.failure_count > 0 && <p className="text-xs text-amber-700 mt-1">Last error: {ep.last_error}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button onClick={() => run(`test-${ep.id}`, () => sendTestWebhook(ep.id), 'Test event queued; it arrives within about a minute.')} disabled={busy !== null || !ep.active} className="btn-secondary !py-1 text-xs">
                          {busy === `test-${ep.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send test
                        </button>
                        <button onClick={() => run(`toggle-${ep.id}`, () => updateWebhook(ep.id, { active: !ep.active }))} disabled={busy !== null} className="btn-secondary !py-1 text-xs">
                          {ep.active ? 'Turn off' : 'Turn on'}
                        </button>
                        <button onClick={() => setShowSecret(showSecret === ep.id ? null : ep.id)} className="btn-ghost !py-1 text-xs text-slate-500">
                          {showSecret === ep.id ? 'Hide signing secret' : 'Signing secret'}
                        </button>
                        <button onClick={() => setConfirm({ kind: 'delete', id: ep.id, label: ep.description || urlHost(ep.url) })} className="btn-ghost !py-1 text-xs text-slate-500 hover:text-rose-600 ml-auto" aria-label="Remove webhook">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {showSecret === ep.id && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <code className="text-xs truncate flex-1">{ep.secret}</code>
                            <CopyButton text={ep.secret} />
                            <button onClick={() => run(`rotate-${ep.id}`, async () => { const r = await rotateWebhookSecret(ep.id); return { error: r.error }; }, 'New signing secret created. Update it in your app.')} disabled={busy !== null} className="btn-ghost !py-1 text-xs text-slate-500">New secret</button>
                          </div>
                          <p className="text-xs text-slate-500">Optional: your own server can check each event really came from us. Zapier and Make don’t need this.</p>
                          <Code>{verifyExample}</Code>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <form onSubmit={submitWebhook} className="rounded-xl border border-dashed border-slate-200 p-3 space-y-2" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label htmlFor="hook-url" className="block text-xs font-semibold text-slate-500 mb-1">Webhook URL</label>
                  <input id="hook-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://hooks.zapier.com/hooks/catch/…" className="input-field" inputMode="url" />
                </div>
                <div>
                  <label htmlFor="hook-name" className="block text-xs font-semibold text-slate-500 mb-1">Name (optional)</label>
                  <input id="hook-name" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={100} placeholder="e.g. Slack alerts" className="input-field" />
                </div>
              </div>
              <fieldset>
                <legend className="text-xs font-semibold text-slate-500 mb-1">Send these events</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <label key={ev.id} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={form.events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} className="mt-1" />
                      <span><b className="font-medium">{ev.label}</b> <span className="text-xs text-slate-400">{ev.hint}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" disabled={busy !== null} className="btn-primary text-sm">
                {busy === 'add-hook' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add webhook
              </button>
            </form>
          </div>

          {/* ---------------- Deliveries ---------------- */}
          {deliveries.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Recent deliveries</h3>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 text-xs">
                {deliveries.map((d) => {
                  const ep = endpoints.find((x) => x.id === d.endpoint_id);
                  return (
                    <li key={d.id} className="flex items-center gap-2 p-2.5">
                      <span className={`badge ${statusTone[d.status]}`}>{d.status === 'pending' && d.attempts > 0 ? 'retrying' : d.status}</span>
                      <span className="font-mono text-slate-700">{d.webhook_events?.type ?? 'event'}</span>
                      <span className="text-slate-400 truncate flex-1">→ {ep ? ep.description || urlHost(ep.url) : 'removed webhook'}</span>
                      <span className="text-slate-400 shrink-0">
                        {d.response_status ? `HTTP ${d.response_status} · ` : d.last_error ? `${d.last_error} · ` : ''}{relativeTime(d.created_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      <Modal isOpen={newKey !== null} onClose={() => setNewKey(null)} title="Your new API key" subtitle="Copy it now: for your security it won't be shown again.">
        {newKey && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
              <code className="text-xs break-all flex-1">{newKey}</code>
              <CopyButton text={newKey} />
            </div>
            <p className="text-xs text-amber-700 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Anyone with this key can send review requests as your business. Keep it in Zapier/Make only; don’t paste it in emails or chats.</p>
            <p className="text-xs font-semibold text-slate-500">Try it:</p>
            <Code>{curlExample(newKey)}</Code>
            <button onClick={() => setNewKey(null)} className="btn-primary w-full">I’ve copied it</button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'revoke' ? `Revoke “${confirm?.label}”?` : `Remove “${confirm?.label}”?`}
        subtitle={confirm?.kind === 'revoke' ? 'Apps using this key stop working immediately, and webhooks they added are removed.' : 'Events stop being sent to this address.'}
        maxWidth="sm"
      >
        <div className="flex gap-2 justify-end">
          <button onClick={() => setConfirm(null)} className="btn-ghost">Cancel</button>
          <button
            onClick={async () => {
              if (!confirm) return;
              const c = confirm;
              setConfirm(null);
              await run(c.kind, () => (c.kind === 'revoke' ? revokeApiKey(c.id) : deleteWebhook(c.id)), c.kind === 'revoke' ? 'Key revoked.' : 'Webhook removed.');
            }}
            className="btn-primary !bg-rose-600 hover:!bg-rose-700"
          >
            {confirm?.kind === 'revoke' ? 'Revoke key' : 'Remove'}
          </button>
        </div>
      </Modal>
    </section>
  );
}
