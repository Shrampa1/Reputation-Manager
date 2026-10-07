import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Download, Loader2, Trash2, UserX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { deleteMyAccount, exportMyData, previewAccountDeletion, type DeletionPreview } from '@/lib/accountData';

/** Settings → Your data & account: export everything as JSON, or delete the account. */
export function AccountDataCard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) return null;

  const handleExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      await exportMyData(user);
      setStatus({ kind: 'success', text: 'Your data was downloaded as a JSON file.' });
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  const openDelete = async () => {
    setLoadingPreview(true);
    setDeleteError(null);
    setConfirmEmail('');
    try {
      setPreview(await previewAccountDeletion());
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Couldn’t check your account' });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount(confirmEmail);
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Couldn’t delete your account');
      setDeleting(false);
    }
  };

  const emailMatches = confirmEmail.trim().toLowerCase() === (user.email ?? '').toLowerCase();

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 shrink-0">
          <UserX className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Your data & account</h2>
          <p className="text-sm text-slate-500">Download a copy of your data, or delete your account</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button onClick={handleExport} disabled={exporting} className="btn-secondary">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export my data
        </button>
        <button onClick={openDelete} disabled={loadingPreview} className="btn-secondary text-rose-600 hover:bg-rose-50">
          {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete my account
        </button>
      </div>
      {status && (
        <p role={status.kind === 'error' ? 'alert' : 'status'} className={`text-sm mt-3 ${status.kind === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>{status.text}</p>
      )}

      <Modal isOpen={Boolean(preview)} onClose={() => !deleting && setPreview(null)} title="Delete your account?" subtitle={user.email ?? ''} maxWidth="md">
        {preview && (
          <div className="space-y-4">
            {preview.blockers.length > 0 ? (
              <>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Before you can delete your account:</p>
                  <ul className="list-disc ml-5 space-y-1">{preview.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                </div>
                <button onClick={() => setPreview(null)} className="btn-secondary w-full">OK</button>
              </>
            ) : (
              <form onSubmit={handleDelete} className="space-y-4" noValidate>
                <div className="text-sm text-slate-700 space-y-2">
                  <p>This can’t be undone. We’ll delete your login and:</p>
                  <ul className="list-disc ml-5 space-y-1">
                    {preview.deleteBusinesses.map((b) => (
                      <li key={b.id}><span className="font-semibold">Delete “{b.name}”</span> and all its reviews, leads, posts, reports and settings</li>
                    ))}
                    {preview.leaveBusinesses.map((b) => (
                      <li key={b.id}>Remove you from “{b.name}” (the business itself stays)</li>
                    ))}
                    {preview.deleteBusinesses.length === 0 && preview.leaveBusinesses.length === 0 && <li>Your profile</li>}
                  </ul>
                  <p className="text-slate-500">Tip: export your data first if you want a copy.</p>
                </div>
                <div>
                  <label htmlFor="confirm-delete-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Type <span className="font-mono">{user.email}</span> to confirm
                  </label>
                  <input id="confirm-delete-email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} autoComplete="off" className="input-field" />
                </div>
                {deleteError && <p className="text-sm text-rose-600" role="alert">{deleteError}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={!emailMatches || deleting} className="btn-primary flex-1 !bg-rose-600 hover:!bg-rose-700">
                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete my account
                  </button>
                  <button type="button" onClick={() => setPreview(null)} disabled={deleting} className="btn-secondary">Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
