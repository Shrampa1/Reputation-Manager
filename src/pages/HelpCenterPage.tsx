import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Loader2, Search } from 'lucide-react';
import { fetchHelpArticle, fetchHelpList, searchHelp, sendHelpFeedback, type PublicArticle, type PublicArticleSummary } from '@/lib/knowledge';
import { sitePath, useSite } from '@/lib/site';

/** W3: a business's public help centre (no sign-in): /help/:key and /help/:key/:articleId */
export function HelpCenterPage() {
  const params = useParams();
  // On a connected domain (D3) the help centre lives at the domain's route
  const site = useSite();
  const key = site?.key ?? params.key ?? '';
  const articleId = site ? site.sub ?? undefined : params.articleId;
  const helpPath = (id?: string) => (site ? sitePath(site, id) : `/help/${key}${id ? `/${id}` : ''}`);
  const [name, setName] = useState('');
  const [articles, setArticles] = useState<PublicArticleSummary[]>([]);
  const [results, setResults] = useState<PublicArticleSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHelpList(key)
      .then((r) => {
        setName(r.businessName);
        setArticles(r.articles);
        document.title = `${r.businessName} · Help centre`;
      })
      .catch(() => setError('This help centre isn’t available.'))
      .finally(() => setLoading(false));
  }, [key]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      searchHelp(key, q).then((r) => setResults(r.results)).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, key]);

  const groups = useMemo(() => {
    const m = new Map<string, PublicArticleSummary[]>();
    (results ?? articles).forEach((a) => m.set(a.category || 'General', [...(m.get(a.category || 'General') ?? []), a]));
    return [...m.entries()];
  }, [articles, results]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Link to={helpPath()} className="text-sm text-slate-300 hover:text-white">{name || 'Help centre'}</Link>
          <h1 className="text-2xl sm:text-3xl font-bold">How can we help?</h1>
          {!articleId && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="w-full rounded-xl pl-9 pr-3 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Search for answers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search for answers"
              />
            </div>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>
        ) : error ? (
          <p className="text-sm text-slate-600">{error}</p>
        ) : articleId ? (
          <ArticleView helpKey={key} id={articleId} home={helpPath()} />
        ) : groups.length === 0 ? (
          <p className="text-sm text-slate-600">{results ? `Nothing found for “${query}”.` : 'No articles yet.'}</p>
        ) : (
          <div className="space-y-6">
            {groups.map(([cat, items]) => (
              <section key={cat}>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{cat}</h2>
                <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                  {items.map((a) => (
                    <li key={a.id}>
                      <Link to={helpPath(a.id)} className="block px-4 py-3 hover:bg-slate-50">
                        <p className="text-sm font-medium text-slate-900">{a.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{a.snippet}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ArticleView({ helpKey, id, home }: { helpKey: string; id: string; home: string }) {
  const [article, setArticle] = useState<PublicArticle | null>(null);
  const [missing, setMissing] = useState(false);
  const [voted, setVoted] = useState<boolean | null>(null);

  useEffect(() => {
    setArticle(null);
    setVoted(null);
    fetchHelpArticle(helpKey, id).then((r) => setArticle(r.article)).catch(() => setMissing(true));
  }, [helpKey, id]);

  if (missing) return <p className="text-sm text-slate-600">This article isn’t available. <Link to={home} className="text-sky-600 hover:underline">All articles</Link></p>;
  if (!article) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-slate-400 animate-spin" /></div>;

  const vote = (helpful: boolean) => {
    setVoted(helpful);
    sendHelpFeedback(helpKey, id, helpful);
  };

  return (
    <article className="space-y-4">
      <Link to={home} className="text-sm text-sky-600 hover:underline inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> All articles</Link>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 space-y-4">
        {article.category && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1"><BookOpen className="w-3 h-3" /> {article.category}</p>}
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{article.title}</h2>
        <div className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap">{article.body}</div>
        <p className="text-xs text-slate-400">Updated {new Date(article.updated_at).toLocaleDateString()}</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm flex items-center gap-3 flex-wrap">
        {voted === null ? (
          <>
            <span className="text-slate-700">Was this helpful?</span>
            <button type="button" onClick={() => vote(true)} className="btn-secondary text-sm !py-1">Yes</button>
            <button type="button" onClick={() => vote(false)} className="btn-secondary text-sm !py-1">No</button>
          </>
        ) : (
          <span className="text-slate-700">{voted ? 'Glad it helped!' : 'Thanks for telling us. Contact us and we’ll help.'}</span>
        )}
      </div>
    </article>
  );
}
