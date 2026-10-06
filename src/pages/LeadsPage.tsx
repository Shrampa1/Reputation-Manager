import { useMemo, useState } from 'react';
import {
  MessageCircle,
  Smartphone,
  Facebook,
  Plus,
  Clock,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
  LayoutGrid,
  List,
  Users,
} from 'lucide-react';
import { useLeads, useLocation } from '@/hooks/useSupabaseData';
import { NewLeadModal } from '@/components/leads/NewLeadModal';
import { STAGES } from '@/lib/leads';
import { ReviewRequestModal } from '@/components/reviews/ReviewRequestModal';
import type { LeadChannel, LeadStage, Lead } from '@/types';

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

const stageColorMap: Record<LeadStage, { bg: string; text: string; dot: string }> = {
  new_lead: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  quote_sent: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  job_booked: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  review_requested: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
};

const stageOrder: LeadStage[] = STAGES.map((s) => s.key);
const stageLabel = (stage: LeadStage) => STAGES.find((s) => s.key === stage)?.label ?? stage;
const OPEN_STAGES: LeadStage[] = ['new_lead', 'quote_sent', 'job_booked'];

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

/** Digits in the free-text value field, e.g. "$1,200" → 1200 */
function leadValue(lead: Lead): number {
  const num = parseInt((lead.estimated_value || '').replace(/[^0-9]/g, ''));
  return isNaN(num) ? 0 : num;
}

export function LeadsPage() {
  const { leads, loading, updateLeadStage, refetch: refetchLeads } = useLeads();
  const { location } = useLocation();
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [search, setSearch] = useState('');
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [reviewFor, setReviewFor] = useState<Lead | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [movingLead, setMovingLead] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.customer_name, l.email, l.phone, l.notes].some((v) => v?.toLowerCase().includes(q))
    );
  }, [leads, search]);

  const stats = useMemo(() => {
    const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return {
      open: open.length,
      openValue: open.reduce((s, l) => s + leadValue(l), 0),
      newThisMonth: leads.filter((l) => new Date(l.created_at).getTime() >= monthStart).length,
      readyForReview: leads.filter((l) => l.stage === 'completed').length,
    };
  }, [leads]);

  const handleMoveLead = async (lead: Lead, direction: 'left' | 'right') => {
    const currentIdx = stageOrder.indexOf(lead.stage);
    const newIdx = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
    if (newIdx < 0 || newIdx >= stageOrder.length) return;
    const newStage = stageOrder[newIdx];
    setMovingLead(lead.id);
    await updateLeadStage(lead.id, newStage);
    setMovingLead(null);
    showToast(`${lead.customer_name} moved to ${stageLabel(newStage)}`);
  };

  const askForReview = (lead: Lead) => {
    setDetailLead(null);
    setReviewFor(lead);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Leads & CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Track every customer from first contact to review.</p>
        </div>
        <button className="btn-primary" onClick={() => setNewLeadOpen(true)}>
          <Plus className="w-4 h-4" />
          New Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-400">Open leads</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">{stats.open}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-400">Open pipeline value</p>
          <p className="text-lg sm:text-2xl font-bold text-slate-900">${stats.openValue.toLocaleString()}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-400">New this month</p>
          <p className="text-lg sm:text-2xl font-bold text-sky-600">{stats.newThisMonth}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-400">Completed, not yet asked for a review</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600">{stats.readyForReview}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone or notes…"
            aria-label="Search leads"
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit" role="tablist" aria-label="View">
          {([
            ['pipeline', 'Pipeline', LayoutGrid],
            ['list', 'List', List],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="card p-10 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-900">No leads yet</p>
          <p className="text-sm text-slate-500 mt-1">Add customers as they contact you to track quotes, jobs and reviews.</p>
          <button className="btn-primary mt-4" onClick={() => setNewLeadOpen(true)}>
            <Plus className="w-4 h-4" />
            Add your first lead
          </button>
        </div>
      ) : view === 'pipeline' ? (
        <div className="overflow-x-auto scrollbar-thin -mx-4 px-4 pb-2">
          <div className="flex gap-3 min-w-max">
            {STAGES.map((stage) => {
              const stageLeads = filtered.filter((l) => l.stage === stage.key);
              const colors = stageColorMap[stage.key];
              const totalValue = stageLeads.reduce((sum, l) => sum + leadValue(l), 0);
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
                        <div key={lead.id} className="card card-hover p-3">
                          <button
                            type="button"
                            onClick={() => setDetailLead(lead)}
                            className="w-full flex items-start gap-2.5 text-left"
                            aria-label={`Open ${lead.customer_name}`}
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-xs font-semibold shrink-0">
                              {getInitials(lead.customer_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900 truncate">{lead.customer_name}</p>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{lead.notes || lead.email || lead.phone || 'No notes'}</p>
                            </div>
                            {movingLead === lead.id && <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" />}
                          </button>

                          {lead.stage === 'completed' && lead.email && (
                            <button
                              type="button"
                              onClick={() => askForReview(lead)}
                              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
                            >
                              <Star className="w-3.5 h-3.5" /> Ask for a review
                            </button>
                          )}

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
                                aria-label={`Move ${lead.customer_name} back a stage`}
                                className="flex items-center justify-center w-6 h-6 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleMoveLead(lead, 'right')}
                                disabled={currentIdx === stageOrder.length - 1 || movingLead === lead.id}
                                aria-label={`Move ${lead.customer_name} forward a stage`}
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
                        <p className="text-xs text-slate-300">{search ? 'No matches' : 'No leads'}</p>
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
      ) : (
        <div className="card p-0 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No leads match “{search}”.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((lead) => {
                const colors = stageColorMap[lead.stage];
                const Icon = channelIconMap[lead.channel];
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onClick={() => setDetailLead(lead)}
                      className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="relative shrink-0">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-sm font-semibold">
                          {getInitials(lead.customer_name)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full ring-2 ring-white ${channelColorMap[lead.channel]}`}>
                          <Icon className="w-3 h-3" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{lead.customer_name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {[lead.phone, lead.email].filter(Boolean).join(' · ') || 'No contact details'}
                        </p>
                      </div>
                      <span className={`hidden sm:inline-flex badge ${colors.bg} ${colors.text}`}>{stageLabel(lead.stage)}</span>
                      <span className="text-sm font-medium text-slate-600 w-20 text-right shrink-0">{lead.estimated_value || '—'}</span>
                      <span className="hidden md:block text-xs text-slate-400 w-16 text-right shrink-0">
                        {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <NewLeadModal
        isOpen={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        location={location}
        onDone={(message) => {
          showToast(message);
          refetchLeads();
        }}
      />

      <NewLeadModal
        isOpen={Boolean(detailLead)}
        onClose={() => setDetailLead(null)}
        location={location}
        lead={detailLead}
        onRequestReview={askForReview}
        onDone={(message) => {
          showToast(message);
          refetchLeads();
        }}
      />

      <ReviewRequestModal
        isOpen={Boolean(reviewFor)}
        onClose={() => setReviewFor(null)}
        initialName={reviewFor?.customer_name ?? ''}
        initialEmail={reviewFor?.email ?? ''}
        leadId={reviewFor?.id ?? null}
        onSent={(message) => {
          showToast(message);
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
