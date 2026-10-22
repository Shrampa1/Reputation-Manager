import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { answerIncoming, checkRingingCalls, declineIncoming, dismissNotice, handleCallRow, hangUp, toggleMute, useCall, useCallNotice, visitorName, type CallRow } from '@/lib/calls';

/**
 * Web calls (W4) on every page for team members who answer chats: rings for visitors' calls and
 * shows the call in progress (timer, mute, hang up), wherever they are in the app.
 */
export function CallManager() {
  const { location, can } = useLocationContext();
  const call = useCall();
  const notice = useCallNotice();
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const enabled = Boolean(location && can('chat.reply'));

  useEffect(() => {
    if (!enabled || !location) return;
    const channel = supabase
      .channel(`chat_calls:${location.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_calls', filter: `location_id=eq.${location.id}` }, async (p) => {
        const row = p.new as CallRow;
        if (!row?.id) return;
        handleCallRow(row, row.direction === 'inbound' && row.status === 'ringing' ? await visitorName(row.conversation_id) : undefined);
      })
      .subscribe();
    // Safety net if the live connection drops
    const timer = setInterval(() => { if (document.visibilityState === 'visible') checkRingingCalls(location.id); }, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [enabled, location]);

  // Call timer
  useEffect(() => {
    if (call?.status !== 'active') return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [call?.status]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(dismissNotice, 6000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!enabled || (!call && !notice)) return null;

  const secs = call?.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 z-50 w-[320px] max-w-[calc(100vw-32px)]" role="status" aria-live="polite">
      {call ? (
        <div className="rounded-2xl bg-slate-900 text-white shadow-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${call.status === 'incoming' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}>
              {call.status === 'incoming' ? <PhoneIncoming className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{call.label}</p>
              <p className="text-xs text-slate-300">
                {call.status === 'incoming' ? 'Calling you from the website…'
                  : call.status === 'calling' ? 'Ringing…'
                  : call.status === 'connecting' ? 'Connecting…'
                  : `On a call · ${clock}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {call.status === 'incoming' ? (
              <>
                <button type="button" onClick={answerIncoming} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 py-2 text-sm font-semibold">
                  <Phone className="w-4 h-4" /> Answer
                </button>
                <button type="button" onClick={declineIncoming} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-500 hover:bg-rose-600 py-2 text-sm font-semibold">
                  <PhoneOff className="w-4 h-4" /> Decline
                </button>
              </>
            ) : (
              <>
                {call.status === 'active' && (
                  <button type="button" onClick={toggleMute} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm font-semibold" aria-pressed={call.muted}>
                    {call.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {call.muted ? 'Unmute' : 'Mute'}
                  </button>
                )}
                <button type="button" onClick={() => navigate(`/chat?c=${call.conversationId}`)} className="inline-flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm font-semibold">
                  Open chat
                </button>
                <button type="button" onClick={() => hangUp()} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-rose-500 hover:bg-rose-600 py-2 text-sm font-semibold">
                  <PhoneOff className="w-4 h-4" /> {call.status === 'calling' ? 'Cancel' : 'Hang up'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-900 text-white shadow-xl px-4 py-3 text-sm flex items-start gap-2">
          <p className="flex-1">{notice}</p>
          <button type="button" onClick={dismissNotice} className="text-slate-400 hover:text-white" aria-label="Dismiss"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
