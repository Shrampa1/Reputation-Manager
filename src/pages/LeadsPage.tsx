import { useState } from 'react';
import {
  MessageCircle,
  Smartphone,
  Facebook,
  Send,
  Phone,
  PhoneMissed,
  Reply,
  Plus,
  Clock,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useLeads, useLocation } from '@/hooks/useSupabaseData';
import { NewLeadModal } from '@/components/leads/NewLeadModal';
import { conversations, leadStages } from '@/data/mockData';
import type { LeadChannel, LeadStage, Lead, Conversation } from '@/types';

const channelIconMap: Record<LeadChannel, typeof MessageCircle> = {
  web_chat: MessageCircle,
  sms: Smartphone,
  messenger: Facebook,
};

const channelColorMap: Record<LeadChannel, string> = {
  web_chat: 'bg-sky-50 text-sky-600',
  sms: 'bg-emerald-50 text-emerald-600',
  messenger: 'bg-blue-50 text-blue-600',
};

const channelLabelMap: Record<LeadChannel, string> = {
  web_chat: 'Web Chat',
  sms: 'SMS',
  messenger: 'Messenger',
};

const stageColorMap: Record<string, { bg: string; text: string; dot: string }> = {
  new_lead: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  quote_sent: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  job_booked: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  review_requested: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
};

const stageOrder: LeadStage[] = ['new_lead', 'quote_sent', 'job_booked', 'completed', 'review_requested'];

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export function LeadsPage() {
  const { leads, loading, updateLeadStage, refetch: refetchLeads } = useLeads();
  const { location } = useLocation();
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<LeadChannel | 'all'>('all');
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(conversations[0]);
  const [messageInput, setMessageInput] = useState('');
  const [missedCallEnabled, setMissedCallEnabled] = useState(true);
  const [missedCallMessage, setMissedCallMessage] = useState(
    'Hi! Sorry we missed your call. How can we help you today? — Premier Plumbing'
  );
  const [toast, setToast] = useState<string | null>(null);
  const [movingLead, setMovingLead] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const filteredConversations = activeChannel === 'all'
    ? conversations
    : conversations.filter((c) => c.channel === activeChannel);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConv) return;
    showToast('Message sent');
    setMessageInput('');
  };

  const handleMoveLead = async (lead: Lead, direction: 'left' | 'right') => {
    const currentIdx = stageOrder.indexOf(lead.stage);
    const newIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= stageOrder.length) return;
    const newStage = stageOrder[newIdx];
    setMovingLead(lead.id);
    await updateLeadStage(lead.id, newStage);
    setMovingLead(null);
    showToast(`${lead.customer_name} moved to ${leadStages.find((s) => s.key === newStage)?.label}`);
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Leads & CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Unified inbox, pipeline, and automated follow-ups.</p>
        </div>
        <button className="btn-primary" onClick={() => setNewLeadOpen(true)}>
          <Plus className="w-4 h-4" />
          New Lead
        </button>
      </div>

      {/* Unified Inbox + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Unified Inbox */}
        <div className="lg:col-span-2 card p-0 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
          <div className="px-4 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-base font-bold text-slate-900">Unified Inbox</h2>
              {totalUnread > 0 && <span className="badge bg-rose-50 text-rose-600">{totalUnread} unread</span>}
            </div>
            <div className="flex items-center gap-1.5">
              {(['all', 'web_chat', 'sms', 'messenger'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setActiveChannel(ch)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeChannel === ch
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {ch === 'all' ? 'All' : (
                    <>
                      {ch === 'web_chat' && <MessageCircle className="w-3 h-3" />}
                      {ch === 'sms' && <Smartphone className="w-3 h-3" />}
                      {ch === 'messenger' && <Facebook className="w-3 h-3" />}
                      {channelLabelMap[ch]}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredConversations.map((conv) => {
              const Icon = channelIconMap[conv.channel];
              const isActive = selectedConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full flex items-start gap-3 p-3.5 text-left transition-colors border-b border-slate-50 ${
                    isActive ? 'bg-sky-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-sm font-semibold">
                      {getInitials(conv.name)}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full ring-2 ring-white ${channelColorMap[conv.channel]}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{conv.name}</p>
                      <span className="text-xs text-slate-400 shrink-0">{conv.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{conv.lastMessage}</p>
                  </div>
                  {conv.unread > 0 && (
                    <span className="shrink-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold">
                      {conv.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:col-span-3 card p-0 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
          {selectedConv ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-sm font-semibold">
                  {getInitials(selectedConv.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{selectedConv.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    {(() => {
                      const Icon = channelIconMap[selectedConv.channel];
                      return <Icon className="w-3 h-3" />;
                    })()}
                    {channelLabelMap[selectedConv.channel]}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-slate-50/30">
                {selectedConv.messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.from === 'owner' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.from === 'owner'
                          ? 'bg-sky-500 text-white rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${msg.from === 'owner' ? 'text-sky-100' : 'text-slate-400'}`}>
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a reply..."
                    className="input-field flex-1"
                  />
                  <button onClick={handleSendMessage} className="btn-primary px-3">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>

      {/* Kanban Pipeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">Sales Pipeline</h2>
          <span className="text-xs text-slate-400">{leads.length} leads total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 pb-2">
            <div className="flex gap-3 min-w-max">
              {leadStages.map((stage) => {
                const stageKey = stage.key as LeadStage;
                const stageLeads = leads.filter((l) => l.stage === stageKey);
                const colors = stageColorMap[stage.key];
                const totalValue = stageLeads.reduce((sum, l) => {
                  const num = parseInt((l.estimated_value || '').replace(/[^0-9]/g, ''));
                  return sum + (isNaN(num) ? 0 : num);
                }, 0);
                return (
                  <div key={stage.key} className="w-64 shrink-0">
                    <div className={`flex items-center justify-between p-2.5 rounded-xl ${colors.bg} mb-2`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className={`text-sm font-semibold ${colors.text}`}>{stage.label}</span>
                      </div>
                      <span className={`text-xs font-medium ${colors.text}`}>{stageLeads.length}</span>
                    </div>

                    <div className="space-y-2">
                      {stageLeads.map((lead) => {
                        const Icon = channelIconMap[lead.channel];
                        const currentIdx = stageOrder.indexOf(lead.stage);
                        return (
                          <div
                            key={lead.id}
                            className="card card-hover p-3"
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-xs font-semibold shrink-0">
                                {getInitials(lead.customer_name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 truncate">{lead.customer_name}</p>
                                <p className="text-xs text-slate-400 truncate mt-0.5">{lead.notes}</p>
                              </div>
                              {movingLead === lead.id && (
                                <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-50">
                              <div className="flex items-center gap-1">
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${channelColorMap[lead.channel]}`}>
                                  <Icon className="w-3 h-3" />
                                </span>
                                <span className="text-xs font-medium text-slate-500">{lead.estimated_value || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400 flex items-center gap-0.5 mr-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                <button
                                  onClick={() => handleMoveLead(lead, 'left')}
                                  disabled={currentIdx === 0 || movingLead === lead.id}
                                  className="flex items-center justify-center w-6 h-6 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleMoveLead(lead, 'right')}
                                  disabled={currentIdx === stageOrder.length - 1 || movingLead === lead.id}
                                  className="flex items-center justify-center w-6 h-6 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {stageLeads.length === 0 && (
                        <div className="card p-4 text-center border-dashed">
                          <p className="text-xs text-slate-300">No leads</p>
                        </div>
                      )}
                    </div>

                    {totalValue > 0 && (
                      <div className="mt-2 px-2.5 py-1.5 text-xs text-slate-400 flex items-center justify-between">
                        <span>Stage value</span>
                        <span className="font-semibold text-slate-600">${totalValue.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Missed-Call Text Back Settings */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-rose-600 shrink-0">
              <PhoneMissed className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Instant Missed-Call Text Back</h2>
              <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">
                Automatically send a text message to anyone who calls but doesn't get through, so you never lose a lead.
              </p>
            </div>
          </div>
          <button
            onClick={() => setMissedCallEnabled(!missedCallEnabled)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
              missedCallEnabled ? 'bg-sky-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                missedCallEnabled ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {missedCallEnabled && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Auto-Reply Message</label>
              <textarea
                value={missedCallMessage}
                onChange={(e) => setMissedCallMessage(e.target.value)}
                rows={2}
                className="input-field resize-none text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">This message will be sent instantly when a call is missed.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Phone className="w-3.5 h-3.5" />
                  Calls today
                </div>
                <p className="text-lg font-bold text-slate-900">12</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <PhoneMissed className="w-3.5 h-3.5" />
                  Missed
                </div>
                <p className="text-lg font-bold text-rose-500">3</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <Reply className="w-3.5 h-3.5" />
                  Auto-replied
                </div>
                <p className="text-lg font-bold text-emerald-500">3</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">
                <span className="font-semibold">2 leads recovered</span> this week from auto-replies.
              </p>
            </div>
          </div>
        )}
      </div>

      <NewLeadModal
        isOpen={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        location={location}
        onCreated={(name) => {
          showToast(`${name} added to your pipeline`);
          refetchLeads();
        }}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-lg">
            <Check className="w-4 h-4 text-emerald-400" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
