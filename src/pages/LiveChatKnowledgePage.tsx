import { useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Download, ExternalLink, Eye, Loader2, Pencil, Plus, Search, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { relativeTime } from '@/lib/activity';
import { EMPTY_ARTICLE, importPages, importSitemap, useKnowledgeBase, type ImportResult, type KbArticle, type KbDraft } from '@/lib/knowledge';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';
import { Modal } from '@/components/ui/Modal';

/** W3: help articles the AI answers from, shown in the chat's Help tab and the public help centre. */
export function LiveChatKnowledgePage() {
  const { location, can } = useLocationContext();
  const canEdit = can('chat.reply');
  const { articles, loading, error, save, remove, reload } = useKnowledgeBase();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ id?: string; draft: KbDraft } | null>(null);
  const [importing, setImporting] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q));
  }, [articles, query]);
  const groups = useMemo(() => {
    const m = new Map<string, KbArticle[]>();
    shown.forEach((a) => m.set(a.category || 'General', [...(m.get(a.category || 'General') ?? []), a]));
    return [...m.entries()];
  }, [shown]);
  const categories = useMemo(() => [...new Set(articles.map((a) => a.category).filter(Boolean))] as string[], [articles]);
  const key = location?.public_key;

  return (
    <div className="space-y-4">
      <LiveChatHeader subtitle="Articles and FAQs. The AI answers from them (and links them), visitors can search them in the chat’s Help tab, and they make up your public help centre." />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input-field !pl-9 text-sm" placeholder="Search articles" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search articles" />
        </div>
        {key && (
          <a href={`/help/${key}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm">
            <ExternalLink className="w-4 h-4" /> Help centre
          </a>
        )}
        {canEdit && (
          <>
            <button type="button" onClick={() => setImporting(true)} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Import from website</button>
            <button type="button" onClick={() => setEditing({ draft: EMPTY_ARTICLE })} className="btn-primary text-sm"><Plus className="w-4 h-4" /> New article</button>
          </>
        )}
      </div>

      {error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> Couldn’t load articles: {error}</p>}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : articles.length === 0 ? (
        <div className="card p-8 text-center space-y-2">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700">No articles yet</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">Write answers to the questions customers ask most, or import your website’s pages (services, pricing, FAQ) in one click.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([cat, items]) => (
            <section key={cat} className="card overflow-hidden">
              <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-b border-slate-200">{cat} · {items.length}</p>
              <ul className="divide-y divide-slate-100">
                {items.map((a) => (
                  <li key={a.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 flex items-center gap-2 flex-wrap">
                        {a.title}
                        {a.status === 'draft' && <span className="text-[11px] font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">Draft</span>}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{a.body.replace(/\s+/g, ' ').slice(0, 160)}</p>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {a.views}</span>
                        <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> {a.helpful_yes}</span>
                        <span className="inline-flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> {a.helpful_no}</span>
                        <span>updated {relativeTime(a.updated_at)}</span>
                        {a.source_url && <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline truncate max-w-[220px]">{a.source_url.replace(/^https?:\/\//, '')}</a>}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => setEditing({ id: a.id, draft: { title: a.title, body: a.body, category: a.category ?? '', status: a.status } })} className="p-1.5 text-slate-400 hover:text-slate-700" aria-label={`Edit ${a.title}`}><Pencil className="w-4 h-4" /></button>
                        <button type="button" onClick={() => { if (window.confirm(`Delete “${a.title}”?`)) remove(a.id); }} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label={`Delete ${a.title}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!shown.length && <p className="text-sm text-slate-500">No articles match “{query}”.</p>}
        </div>
      )}

      {editing && (
        <ArticleEditor
          initial={editing.draft}
          categories={categories}
          isNew={!editing.id}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            const err = await save(draft, editing.id);
            if (!err) setEditing(null);
            return err;
          }}
        />
      )}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={reload} />}
    </div>
  );
}

function ArticleEditor({ initial, categories, isNew, onClose, onSave }: { initial: KbDraft; categories: string[]; isNew: boolean; onClose: () => void; onSave: (d: KbDraft) => Promise<string | null> }) {
  const [draft, setDraft] = useState<KbDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await onSave(draft));
    setBusy(false);
  };
  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'New article' : 'Edit article'} maxWidth="xl">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="kb-title" className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
          <input id="kb-title" className="input-field" maxLength={200} required placeholder="How much does teeth whitening cost?" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="kb-cat" className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
            <input id="kb-cat" className="input-field" maxLength={60} list="kb-cats" placeholder="Pricing" value={draft.category ?? ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <datalist id="kb-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label htmlFor="kb-status" className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select id="kb-status" className="input-field" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as KbDraft['status'] })}>
              <option value="published">Published (AI, chat and help centre use it)</option>
              <option value="draft">Draft (hidden)</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="kb-body" className="block text-sm font-medium text-slate-700 mb-1.5">Answer</label>
          <textarea id="kb-body" className="input-field text-sm" rows={12} maxLength={20000} required value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <p className="text-xs text-slate-400 mt-1">{draft.body.length.toLocaleString()} / 20,000 characters. Plain text; blank lines make paragraphs.</p>
        </div>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary text-sm">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [urls, setUrls] = useState('');
  const [status, setStatus] = useState<KbDraft['status']>('published');
  const [busy, setBusy] = useState<'urls' | 'sitemap' | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'urls' | 'sitemap') => {
    const list = urls.split(/\s+/).map((u) => u.trim()).filter(Boolean);
    if (kind === 'urls' && !list.length) return setError('Paste at least one page address.');
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const r = kind === 'urls' ? await importPages(list, status) : await importSitemap(status);
      setResult(r);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Import from your website" maxWidth="lg">
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Each page becomes an article with its text (menus and footers left out). Importing a page again updates its article.</p>
        <textarea className="input-field text-sm font-mono" rows={5} placeholder={'https://yoursite.com/services\nhttps://yoursite.com/faq'} value={urls} onChange={(e) => setUrls(e.target.value)} aria-label="Page addresses" />
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input-field !w-auto text-sm" value={status} onChange={(e) => setStatus(e.target.value as KbDraft['status'])} aria-label="Import as">
            <option value="published">Import as published</option>
            <option value="draft">Import as drafts (review first)</option>
          </select>
          <button type="button" disabled={Boolean(busy)} onClick={() => run('urls')} className="btn-primary text-sm">{busy === 'urls' && <Loader2 className="w-4 h-4 animate-spin" />} Import these pages</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => run('sitemap')} className="btn-secondary text-sm">{busy === 'sitemap' && <Loader2 className="w-4 h-4 animate-spin" />} Import from my sitemap</button>
        </div>
        <p className="text-xs text-slate-400">Up to 20 pages at a time, or 25 from your sitemap (your website address from Settings).</p>
        {error && <p className="text-sm text-rose-700">{error}</p>}
        {result && (
          <div className="text-sm space-y-2">
            <p className="text-emerald-700">{result.imported.length} page{result.imported.length === 1 ? '' : 's'} imported.</p>
            {result.imported.length > 0 && (
              <ul className="text-xs text-slate-600 space-y-0.5 max-h-40 overflow-y-auto">
                {result.imported.map((r) => <li key={r.url}>{r.status === 'added' ? 'Added' : 'Updated'}: {r.title}</li>)}
              </ul>
            )}
            {result.skipped.length > 0 && (
              <ul className="text-xs text-amber-800 space-y-0.5 max-h-40 overflow-y-auto">
                {result.skipped.map((r) => <li key={r.url}>Skipped {r.url}: {r.reason}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
