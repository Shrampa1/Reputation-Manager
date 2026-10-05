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

// Social Posts — DB enum: post_status (draft, scheduled, publishing, published, failed)
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
export type PostPlatform = 'facebook' | 'instagram' | 'google';

export interface SocialPost {
  id: string;
  location_id: string;
  content: string;
  media_url: string | null;
  platform: PostPlatform;
  scheduled_for: string | null;
  status: PostStatus;
  published_at: string | null;
  external_post_id: string | null;
  external_url: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// Integrations — DB enums: integration_provider, integration_status
export type IntegrationProvider = 'google_business' | 'facebook' | 'instagram' | 'twilio';
export type IntegrationStatus = 'connected' | 'error' | 'disconnected';

export interface Integration {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  account_id: string | null;
  account_name: string | null;
  metadata: Record<string, unknown>;
  last_error: string | null;
  connected_at: string;
  updated_at: string;
}

export type MemberRole = 'owner' | 'admin' | 'member';

// Activity log — written by database triggers, readable by owners/admins
export type ActivityCategory = 'business' | 'team' | 'integrations' | 'posts' | 'leads' | 'reviews';

export interface ActivityEntry {
  id: string;
  organization_id: string;
  actor_id: string | null;
  /** Name or email at the time; null for automatic actions (e.g. scheduled publishing) */
  actor_label: string | null;
  category: ActivityCategory;
  action: string;
  summary: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Row returned by the get_org_members() database function
export interface TeamMember {
  user_id: string;
  email: string;
  full_name: string | null;
  role: MemberRole;
  joined_at: string;
  last_sign_in_at: string | null;
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
