// ===== Database-aligned types =====

// Reviews — DB enum: review_platform (google, facebook, trustpilot, custom)
export type ReviewPlatform = 'google' | 'facebook' | 'trustpilot' | 'custom';
export type ReviewPlatformFilter = 'all' | ReviewPlatform;

export interface Review {
  id: string;
  location_id: string;
  platform: ReviewPlatform;
  author_name: string;
  author_avatar: string;
  rating: number;
  content: string;
  review_date: string;
  ai_reply_draft: string | null;
  is_replied: boolean;
  created_at: string;
}

export interface ReviewRequestSettings {
  channel: 'sms' | 'whatsapp';
  negativeFeedbackShield: boolean;
  messageTemplate: string;
}

// Leads — DB enum: lead_stage (new_lead, quote_sent, job_booked, completed, review_requested)
// DB enum: lead_channel (web_chat, sms, messenger)
export type LeadStage = 'new_lead' | 'quote_sent' | 'job_booked' | 'completed' | 'review_requested';
export type LeadChannel = 'web_chat' | 'sms' | 'messenger';

export interface Lead {
  id: string;
  location_id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  channel: LeadChannel;
  stage: LeadStage;
  estimated_value: string;
  notes: string;
  created_at: string;
}

// Social Posts — DB enum: post_status (draft, scheduled, published)
export type PostStatus = 'draft' | 'scheduled' | 'published';
export type PostPlatform = 'facebook' | 'instagram' | 'google';

export interface SocialPost {
  id: string;
  location_id: string;
  content: string;
  media_url: string | null;
  platform: string;
  scheduled_for: string | null;
  status: PostStatus;
  created_at: string;
}

// Smart Tasks
export interface SmartTask {
  id: string;
  location_id: string;
  title: string;
  description: string;
  action_type: string;
  action_route: string;
  priority: 'high' | 'medium' | 'low';
  is_completed: boolean;
  created_at: string;
}

// Locations
export interface Location {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  gbp_place_id: string | null;
  created_at: string;
}

// Organization
export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

// ===== UI-only types (not in DB) =====

export interface KPI {
  label: string;
  value: string;
  subtext: string;
  trend: 'up' | 'down' | 'flat';
  trendValue: string;
  icon: 'star' | 'reviews' | 'leads' | 'tasks';
  accent: 'amber' | 'blue' | 'emerald' | 'violet';
}

export interface NAPInfo {
  name: string;
  address: string;
  phone: string;
  website: string;
}

export interface NAPConsistency {
  platform: string;
  icon: string;
  name: string;
  address: string;
  phone: string;
  status: 'consistent' | 'warning' | 'inconsistent';
}

export interface GeoGridCell {
  id: string;
  rank: number;
  label: string;
}

export interface GeoGridData {
  query: string;
  cells: GeoGridCell[][];
}

export interface Conversation {
  id: string;
  name: string;
  channel: LeadChannel;
  lastMessage: string;
  timestamp: string;
  unread: number;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  from: 'lead' | 'owner';
  text: string;
  time: string;
}
