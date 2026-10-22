import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Star } from 'lucide-react';
import { useLocationContext } from '@/context/LocationContext';
import { fetchChatAnalytics, pagePath, type CallStats, type ChatAnalytics } from '@/lib/liveChat';
import { LiveChatHeader } from '@/components/livechat/LiveChatHeader';

const RANGES: [number, string][] = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']];

const duration = (secs: number | null | undefined) => {
  if (secs == null) return '—';
  if (secs < 60) return `${Math.round(secs)}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  return `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m`;
};
const chats = (n: number) => `${n} chat${n === 1 ? '' : 's'}`;
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

/** W1b: how the chat is doing. Chats, AI vs team, response time, ratings, leads, calls. */
export function LiveChatAnalyticsPage() {
  const { location } = useLocationContext();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ analytics: ChatAnalytics; calls: CallStats | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    setLoading(true);
    fetchChatAnalytics(location.id, days)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Couldn’t load analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [location, days]);

  const a = data?.analytics;
  const calls = data?.calls;

  return (
    <div className="space-y-4">
      <LiveChatHeader />
      <div className="flex items-center gap-2">
        <select className="input-field !w-auto text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
          {RANGES.map(([d, label]) => <option key={d} value={d}>{label}</option>)}
        </select>
        {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
      </div>
      {error && <p className="text-sm text-rose-700 inline-flex items-start gap-1.5"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</p>}
      {a && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Chats" value={a.chats.toLocaleString()} sub={`${a.visitor_messages.toLocaleString()} visitor messages`} />
            <Tile label="Answered by AI only" value={pct(a.handled_by_ai, a.chats)} sub={`${chats(a.handled_by_ai)} · ${a.ai_answers} AI answers`} />
            <Tile label="Team joined" value={pct(a.handled_by_team, a.chats)} sub={`${chats(a.handled_by_team)} · ${a.team_replies} repl${a.team_replies === 1 ? 'y' : 'ies'}`} />
            <Tile label="Missed" value={a.missed.toLocaleString()} sub="Asked for a person, no reply in 15 min" warn={a.missed > 0} />
            <Tile label="First team reply" value={duration(a.avg_first_response_seconds)} sub="Average, after the visitor’s first message" />
            <Tile label="Rating" value={a.avg_rating != null ? `${Number(a.avg_rating).toFixed(1)} ★` : '—'} sub={`${a.ratings} rating${a.ratings === 1 ? '' : 's'}`} />
            <Tile label="Leads from chat" value={a.leads.toLocaleString()} sub={pct(a.leads, a.chats) + ' of chats'} />
            <Tile label="Calls" value={calls ? calls.calls.toLocaleString() : '—'} sub={calls ? `${calls.answered} answered · ${calls.missed} missed · avg ${duration(calls.avg_seconds)}` : 'Web calls add-on'} />
          </div>

          <section className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Chats per day</h2>
            <DayBars rows={a.by_day} days={days} />
            <p className="text-xs text-slate-500 flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sky-500" /> Chats</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-violet-500" /> Team joined</span>
            </p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Busiest hours <span className="font-normal text-slate-400">(visitor messages, UTC)</span></h2>
              <HourBars rows={a.by_hour} />
            </section>
            <section className="card p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Ratings</h2>
              {a.ratings === 0 ? <p className="text-sm text-slate-500">No ratings yet. Visitors are asked to rate when you resolve a chat.</p> : (
                <ul className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map((n) => {
                    const count = a.rating_breakdown[String(n)] ?? 0;
                    return (
                      <li key={n} className="flex items-center gap-2 text-sm">
                        <span className="w-8 inline-flex items-center gap-0.5 text-slate-600">{n}<Star className="w-3 h-3 fill-amber-400 text-amber-400" /></span>
                        <span className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full bg-amber-400" style={{ width: pct(count, a.ratings) }} /></span>
                        <span className="w-8 text-right text-slate-500">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <TableCard title="Top pages chats start on" empty="No chats yet." rows={a.top_pages.map((p) => [pagePath(p.page) ?? p.page, p.chats])} />
            <TableCard title="Tags" empty="No tags yet. Add them from the visitor panel in the Inbox." rows={a.top_tags.map((t) => [t.tag, t.chats])} />
          </div>

          <section className="card overflow-hidden">
            <h2 className="text-sm font-semibold text-slate-900 px-5 pt-5 pb-3">Team</h2>
            {a.team.length === 0 ? <p className="text-sm text-slate-500 px-5 pb-5">Nobody from the team has replied in this period.</p> : (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50 text-left">
                  <tr><th className="px-5 py-2 font-medium">Team member</th><th className="px-5 py-2 font-medium">Chats</th><th className="px-5 py-2 font-medium">Replies</th><th className="px-5 py-2 font-medium">Rating</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {a.team.map((t) => (
                    <tr key={t.user_id}>
                      <td className="px-5 py-2 text-slate-800">{t.name ?? 'Team member'}</td>
                      <td className="px-5 py-2">{t.chats}</td>
                      <td className="px-5 py-2">{t.replies}</td>
                      <td className="px-5 py-2">{t.avg_rating != null ? `${Number(t.avg_rating).toFixed(1)} ★` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className={`card p-4 ${warn ? 'border-amber-300 bg-amber-50/40' : ''}`}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

function DayBars({ rows, days }: { rows: ChatAnalytics['by_day']; days: number }) {
  // Every day in the period, including days without chats
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const list = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(d) ?? { day: d, chats: 0, team: 0, leads: 0 };
  });
  const max = Math.max(1, ...list.map((r) => r.chats));
  return (
    <div className="flex items-end gap-[2px] h-40" role="img" aria-label="Chats per day">
      {list.map((r) => (
        <div key={r.day} className="flex-1 flex flex-col justify-end h-full group relative" title={`${r.day}: ${r.chats} chats, team joined ${r.team}, ${r.leads} leads`}>
          <div className="w-full bg-sky-500 rounded-t-sm relative" style={{ height: `${(r.chats / max) * 100}%`, minHeight: r.chats ? 2 : 0 }}>
            <div className="absolute bottom-0 left-0 right-0 bg-violet-500" style={{ height: r.chats ? `${(r.team / r.chats) * 100}%` : 0 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function HourBars({ rows }: { rows: ChatAnalytics['by_hour'] }) {
  const byHour = new Map(rows.map((r) => [r.hour, r.messages]));
  const max = Math.max(1, ...rows.map((r) => r.messages));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-28" role="img" aria-label="Visitor messages by hour">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="flex-1 bg-sky-400 rounded-t-sm" style={{ height: `${((byHour.get(h) ?? 0) / max) * 100}%`, minHeight: byHour.get(h) ? 2 : 0 }} title={`${h}:00 · ${byHour.get(h) ?? 0} messages`} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span></div>
    </div>
  );
}

function TableCard({ title, empty, rows }: { title: string; empty: string; rows: [string, number][] }) {
  return (
    <section className="card p-5 space-y-2">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-slate-500">{empty}</p> : (
        <ul className="space-y-1.5 text-sm">
          {rows.map(([label, n]) => (
            <li key={label} className="flex items-center gap-2">
              <span className="flex-1 truncate text-slate-700">{label}</span>
              <span className="text-slate-500">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
