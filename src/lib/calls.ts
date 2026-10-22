import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { playChime } from '@/lib/liveChat';

/**
 * Web calls (Live chat W4, migration 041): the team member's side of a browser-to-browser voice
 * call with a website visitor. WebRTC with public STUN servers, no calling provider: each side
 * sends one complete offer/answer (no trickle ICE) through chat_calls.
 */
export interface CallRow {
  id: string;
  conversation_id: string;
  location_id: string;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'failed';
  agent_id: string | null;
  agent_name: string | null;
  offer_sdp: string;
  answer_sdp: string | null;
  created_at: string;
  answered_at: string | null;
}
export interface CallState {
  id: string | null;
  conversationId: string;
  label: string;
  direction: 'inbound' | 'outbound';
  /** calling: we rang the visitor · incoming: the visitor is ringing us · connecting · active */
  status: 'calling' | 'incoming' | 'connecting' | 'active';
  startedAt: number | null;
  muted: boolean;
  offer?: string;
  error?: string;
}

const ICE: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const CALL_COLUMNS = 'id, conversation_id, location_id, direction, status, agent_id, agent_name, offer_sdp, answer_sdp, created_at, answered_at';

let current: CallState | null = null;
let notice: string | null = null;
let pc: RTCPeerConnection | null = null;
let stream: MediaStream | null = null;
let ringTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const audio = typeof Audio !== 'undefined' ? new Audio() : null;
if (audio) audio.autoplay = true;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
// Read through a function so TypeScript doesn't keep a stale narrowing across awaits
const now = () => current;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useCall = () => useSyncExternalStore(subscribe, () => current);
export const useCallNotice = () => useSyncExternalStore(subscribe, () => notice);
export function dismissNotice() {
  notice = null;
  emit();
}

function set(next: CallState | null, message?: string | null) {
  current = next;
  if (message !== undefined) notice = message;
  emit();
}

function stopRing() {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
}

function cleanup(message?: string) {
  stopRing();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  pc?.close();
  pc = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  if (audio) audio.srcObject = null;
  set(null, message);
}

function waitForIce(p: RTCPeerConnection) {
  return new Promise<void>((resolve) => {
    if (p.iceGatheringState === 'complete') return resolve();
    const t = setTimeout(resolve, 3000);
    p.addEventListener('icegatheringstatechange', () => {
      if (p.iceGatheringState === 'complete') {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

async function newPeer() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const p = new RTCPeerConnection({ iceServers: ICE });
  stream.getTracks().forEach((t) => p.addTrack(t, stream!));
  p.ontrack = (e) => {
    if (audio) audio.srcObject = e.streams[0];
  };
  p.onconnectionstatechange = () => {
    if (p === pc && p.connectionState === 'failed') hangUp('The call couldn’t connect on this network.');
  };
  pc = p;
  return p;
}

const micMessage = (err: unknown) =>
  err instanceof DOMException && err.name === 'NotAllowedError' ? 'Allow microphone access in your browser to make calls.' : 'Your microphone isn’t available.';

/** Watches our call's row until it's answered or ends (live updates do the same; this is the safety net). */
function watch(id: string) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const { data } = await supabase.from('chat_calls').select(CALL_COLUMNS).eq('id', id).maybeSingle();
    if (data) handleCallRow(data as CallRow);
  }, 1500);
}

/** Calls the visitor in this conversation (they must have the website open). */
export async function startOutbound(conversationId: string, label: string) {
  if (current) return;
  set({ id: null, conversationId, label, direction: 'outbound', status: 'calling', startedAt: null, muted: false }, null);
  try {
    const p = await newPeer();
    await p.setLocalDescription(await p.createOffer());
    await waitForIce(p);
    const { data, error } = await supabase.rpc('chat_call_start', { p_conversation: conversationId, p_sdp: p.localDescription!.sdp });
    if (error) throw new Error(error.message);
    const row = data as CallRow;
    const cur = now();
    if (!cur) {
      // Hung up while we were setting up
      await supabase.rpc('chat_call_end', { p_call: row.id });
      return;
    }
    set({ ...cur, id: row.id });
    watch(row.id);
  } catch (err) {
    cleanup(err instanceof Error && !(err instanceof DOMException) ? err.message : micMessage(err));
  }
}

/** Answers a visitor's call (the first team member to answer gets it). */
export async function answerIncoming() {
  if (!current || current.status !== 'incoming' || !current.id || !current.offer) return;
  stopRing();
  const { id, offer } = current;
  set({ ...current, status: 'connecting' });
  try {
    const p = await newPeer();
    await p.setRemoteDescription({ type: 'offer', sdp: offer });
    await p.setLocalDescription(await p.createAnswer());
    await waitForIce(p);
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc('chat_call_answer', { p_call: id, p_sdp: p.localDescription!.sdp });
    if (error) throw new Error(error.message);
    const row = data as CallRow;
    if (row.status !== 'active' || row.agent_id !== user.user?.id) {
      cleanup(row.status === 'active' ? `${row.agent_name ?? 'Someone else'} answered this call.` : 'The visitor hung up.');
      return;
    }
    const cur = now();
    if (!cur) {
      // Hung up while connecting
      await supabase.rpc('chat_call_end', { p_call: id });
      return;
    }
    set({ ...cur, status: 'active', startedAt: Date.now() });
    watch(id);
  } catch (err) {
    await supabase.rpc('chat_call_end', { p_call: id });
    cleanup(err instanceof Error && !(err instanceof DOMException) ? err.message : micMessage(err));
  }
}

export async function declineIncoming() {
  if (!current?.id) return;
  const id = current.id;
  cleanup();
  await supabase.rpc('chat_call_decline', { p_call: id });
}

export async function hangUp(message?: string) {
  const id = current?.id;
  cleanup(message);
  if (id) await supabase.rpc('chat_call_end', { p_call: id });
}

export function toggleMute() {
  if (!current || !stream) return;
  const muted = !current.muted;
  stream.getAudioTracks().forEach((t) => {
    t.enabled = !muted;
  });
  set({ ...current, muted });
}

/** Every change to a call row (live updates or polling) comes through here. */
export function handleCallRow(row: CallRow, label?: string) {
  const live = row.status === 'ringing' || row.status === 'active';
  if (current && current.id === row.id) {
    if (!live) {
      const why = row.status === 'declined' ? 'The visitor declined the call.' : row.status === 'missed' ? (current.direction === 'outbound' ? 'The visitor didn’t answer.' : 'The call was missed.') : 'Call ended.';
      cleanup(current.status === 'active' || current.status === 'connecting' ? 'Call ended.' : why);
      return;
    }
    // The visitor answered our call
    if (current.direction === 'outbound' && current.status === 'calling' && row.status === 'active' && row.answer_sdp && pc) {
      // Live updates and polling can both deliver the answer: apply it once
      set({ ...current, status: 'connecting' });
      pc.setRemoteDescription({ type: 'answer', sdp: row.answer_sdp })
        .then(() => {
          const cur = now();
          if (cur) set({ ...cur, status: 'active', startedAt: Date.now() });
        })
        .catch(() => hangUp('The call couldn’t connect.'));
    }
    // Someone else on the team answered the call ringing here
    if (current.direction === 'inbound' && current.status === 'incoming' && row.status === 'active') {
      cleanup(`${row.agent_name ?? 'Someone else'} answered the call.`);
    }
    return;
  }
  // A visitor is calling
  if (!current && row.direction === 'inbound' && row.status === 'ringing' && Date.now() - Date.parse(row.created_at) < 45_000) {
    set({ id: row.id, conversationId: row.conversation_id, label: label ?? 'Website visitor', direction: 'inbound', status: 'incoming', startedAt: null, muted: false, offer: row.offer_sdp }, null);
    playChime();
    ringTimer = setInterval(() => playChime(), 2500);
  }
}

/** Ringing visitor calls for this business (safety net for live updates). */
export async function checkRingingCalls(locationId: string) {
  if (current) return;
  const { data } = await supabase.from('chat_calls').select(CALL_COLUMNS)
    .eq('location_id', locationId).eq('status', 'ringing').eq('direction', 'inbound')
    .gte('created_at', new Date(Date.now() - 45_000).toISOString()).order('created_at').limit(1);
  const row = (data as CallRow[] | null)?.[0];
  if (row) handleCallRow(row, await visitorName(row.conversation_id));
}

export async function visitorName(conversationId: string) {
  const { data } = await supabase.from('chat_conversations').select('visitor_name, visitor_id').eq('id', conversationId).maybeSingle();
  return data ? (data.visitor_name || `Visitor ${String(data.visitor_id).slice(-4).toUpperCase()}`) : 'Website visitor';
}
