import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  Unplug,
  X,
} from 'lucide-react';
import { useIntegrations, useMemberRole } from '@/hooks/useSupabaseData';
import {
  PROVIDERS,
  connectTwilio,
  disconnectIntegration,
  providerName,
  startOAuth,
  type ProviderInfo,
} from '@/lib/integrations';
import { Modal } from '@/components/ui/Modal';
import type { Integration, IntegrationProvider } from '@/types';

type Banner = { kind: 'success' | 'error' | 'info'; text: string } | null;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function IntegrationsPage() {
  const { loading, byProvider } = useIntegrations();
  const { isAdmin, loading: roleLoading } = useMemberRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState<IntegrationProvider | null>(null);
  const [twilioOpen, setTwilioOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<Integration | null>(null);

  // Result of an OAuth redirect: /integrations?integration=facebook&status=connected
  useEffect(() => {
    const provider = searchParams.get('integration') as IntegrationProvider | null;
    const status = searchParams.get('status');
    if (!provider || !status) return;

    if (status === 'connected') {
      const parts = [`${providerName(provider)} connected.`];
      if (provider === 'facebook') {
        const ig = searchParams.get('instagram');
        if (ig === 'connected') parts.push('Instagram was connected too.');
        if (ig === 'not_linked') parts.push('No Instagram Business account is linked to that Page, so Instagram was not connected.');
      }
      setBanner({ kind: 'success', text: parts.join(' ') });
    } else {
      setBanner({
        kind: 'error',
        text: `Couldn't connect ${providerName(provider)}: ${searchParams.get('message') || 'unknown error'}`,
      });
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleConnect = async (info: ProviderInfo) => {
    setBanner(null);
    if (info.connectMethod === 'twilio') {
      setTwilioOpen(true);
      return;
    }
    setBusy(info.provider);
    try {
      await startOAuth(info.provider);
      // Browser navigates away on success; keep the spinner until it does.
    } catch (err) {
      setBusy(null);
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Could not start connection' });
    }
  };

  const handleDisconnect = async () => {
    if (!confirmDisconnect) return;
    const target = confirmDisconnect;
    setBusy(target.provider);
    try {
      await disconnectIntegration(target.id);
      setBanner({ kind: 'info', text: `${providerName(target.provider)} disconnected.` });
    } catch (err) {
      setBanner({ kind: 'error', text: err instanceof Error ? err.message : 'Could not disconnect' });
    } finally {
      setBusy(null);
      setConfirmDisconnect(null);
    }
  };

  const connectedCount = PROVIDERS.filter((p) => byProvider(p.provider)?.status === 'connected').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Integrations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect your accounts so Reputation Engine can publish posts, manage reviews and message customers.
          </p>
        </div>
        {!loading && (
          <span className="badge bg-slate-100 text-slate-600 self-start sm:self-auto">
            {connectedCount} of {PROVIDERS.length} connected
          </span>
        )}
      </div>

      {banner && (
        <div
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-sm ${
            banner.kind === 'success'
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : banner.kind === 'error'
              ? 'bg-rose-50 border-rose-100 text-rose-800'
              : 'bg-sky-50 border-sky-100 text-sky-800'
          }`}
          role="status"
        >
          {banner.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : banner.kind === 'error' ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <p className="flex-1">{banner.text}</p>
          <button onClick={() => setBanner(null)} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!roleLoading && !isAdmin && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
          <Lock className="w-4 h-4 shrink-0" />
          Only owners and admins can connect or disconnect integrations.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map((info) => (
            <IntegrationCard
              key={info.provider}
              info={info}
              integration={byProvider(info.provider)}
              canManage={isAdmin}
              busy={busy === info.provider}
              onConnect={() => handleConnect(info)}
              onDisconnect={(i) => setConfirmDisconnect(i)}
            />
          ))}
        </div>
      )}

      <TwilioModal
        isOpen={twilioOpen}
        onClose={() => setTwilioOpen(false)}
        onConnected={() => {
          setTwilioOpen(false);
          setBanner({ kind: 'success', text: 'Twilio SMS connected.' });
        }}
      />

      <Modal
        isOpen={confirmDisconnect !== null}
        onClose={() => setConfirmDisconnect(null)}
        title={`Disconnect ${confirmDisconnect ? providerName(confirmDisconnect.provider) : ''}?`}
        maxWidth="sm"
      >
        <p className="text-sm text-slate-600">
          Scheduled posts for this platform will fail until you connect it again. Stored access tokens are deleted.
        </p>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={handleDisconnect} disabled={busy !== null} className="btn-primary flex-1 !bg-rose-600 hover:!bg-rose-700">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
            Disconnect
          </button>
          <button onClick={() => setConfirmDisconnect(null)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}

function IntegrationCard({
  info,
  integration,
  canManage,
  busy,
  onConnect,
  onDisconnect,
}: {
  info: ProviderInfo;
  integration: Integration | null;
  canManage: boolean;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: (integration: Integration) => void;
}) {
  const Icon = info.icon;
  const status = integration?.status ?? 'disconnected';

  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-start gap-3">
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${info.iconClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-slate-900">{info.name}</h2>
            {status === 'connected' && (
              <span className="badge bg-emerald-50 text-emerald-600">
                <Check className="w-3 h-3 mr-1" />
                Connected
              </span>
            )}
            {status === 'error' && (
              <span className="badge bg-rose-50 text-rose-600">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs attention
              </span>
            )}
            {status === 'disconnected' && <span className="badge bg-slate-100 text-slate-500">Not connected</span>}
          </div>
          <p className="text-sm text-slate-500 mt-1">{info.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {info.usedFor.map((u) => (
          <span key={u} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-100">
            {u}
          </span>
        ))}
      </div>

      {integration && status !== 'disconnected' && (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
          <p className="text-slate-900 font-medium truncate">{integration.account_name || 'Connected account'}</p>
          <p className="text-xs text-slate-400 mt-0.5">Connected {formatDate(integration.connected_at)}</p>
          {status === 'error' && integration.last_error && (
            <p className="text-xs text-rose-600 mt-2">{integration.last_error}</p>
          )}
        </div>
      )}

      {!integration && info.setupNote && (
        <p className="flex items-start gap-1.5 text-xs text-slate-400 mt-4">
          <Info className="w-3.5 h-3.5 mt-px shrink-0" />
          {info.setupNote}
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto pt-4">
        {status === 'connected' ? (
          <>
            {info.connectMethod === 'oauth' && (
              <button onClick={onConnect} disabled={!canManage || busy} className="btn-secondary text-sm">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Reconnect
              </button>
            )}
            <button
              onClick={() => integration && onDisconnect(integration)}
              disabled={!canManage || busy}
              className="btn-ghost text-sm text-rose-600 hover:bg-rose-50"
            >
              <Unplug className="w-4 h-4" />
              Disconnect
            </button>
          </>
        ) : (
          <>
            <button onClick={onConnect} disabled={!canManage || busy} className="btn-primary text-sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              {status === 'error' ? 'Reconnect' : info.connectLabel}
            </button>
            {status === 'error' && integration && (
              <button
                onClick={() => onDisconnect(integration)}
                disabled={!canManage || busy}
                className="btn-ghost text-sm text-rose-600 hover:bg-rose-50"
              >
                Disconnect
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TwilioModal({
  isOpen,
  onClose,
  onConnected,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setAuthToken('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await connectTwilio({ accountSid: accountSid.trim(), authToken: authToken.trim(), phoneNumber: phoneNumber.trim() });
      setAccountSid('');
      setPhoneNumber('');
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect Twilio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Twilio" subtitle="Find these in your Twilio Console" maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="twilio-sid" className="block text-sm font-medium text-slate-700 mb-1.5">Account SID</label>
          <input
            id="twilio-sid"
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            placeholder="AC…"
            autoComplete="off"
            spellCheck={false}
            required
            className="input-field font-mono"
          />
        </div>
        <div>
          <label htmlFor="twilio-token" className="block text-sm font-medium text-slate-700 mb-1.5">Auth Token</label>
          <input
            id="twilio-token"
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            autoComplete="off"
            required
            className="input-field font-mono"
          />
        </div>
        <div>
          <label htmlFor="twilio-phone" className="block text-sm font-medium text-slate-700 mb-1.5">Twilio phone number</label>
          <input
            id="twilio-phone"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+15125550100"
            required
            className="input-field"
          />
          <p className="text-xs text-slate-400 mt-1">International format, including the country code.</p>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 mt-px shrink-0" />
          Your Auth Token is verified with Twilio and stored server-side. It's never shown again.
        </p>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
            {saving ? 'Verifying…' : 'Connect'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}