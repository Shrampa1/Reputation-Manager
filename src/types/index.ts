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
  /** Set for reviews synced from Google (the review's id there) */
  external_id?: string | null;
  external_url?: string | null;
  created_at: string;
}

// Review requests — written by the send-review-request / review-landing edge functions
export type ReviewRequestStatus = 'sending' | 'sent' | 'failed';

export interface ReviewRequest {
  id: string;
  location_id: string;
  lead_id: string | null;
  customer_name: string;
  email: string;
  channel: 'email' | 'sms';
  status: ReviewRequestStatus;
  error: string | null;
  /** Ratings of 1-3 were asked for private feedback first */
  shield: boolean;
  rating: number | null;
  feedback: string | null;
  responded_at: string | null;
  clicked_review_at: string | null;
  sent_by: string | null;
  created_at: string;
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
export type IntegrationProvider = 'google_business' | 'facebook' | 'instagram' | 'twilio' | 'search_console';
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
/** A member role, or 'superadmin' for the app's super admins (owner-level access everywhere) */
export type ViewerRole = MemberRole | 'superadmin';

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
  /** Public "write a review" URL customers are sent to */
  review_link: string | null;
  /** Ask 1-3 star customers for private feedback before showing the review link */
  review_shield_enabled: boolean;
  // Google listing, as last synced from the Places API (gbp_place_id holds the Places ID)
  google_rating?: number | null;
  google_review_count?: number | null;
  google_maps_url?: string | null;
  google_listing?: GoogleListing | null;
  google_synced_at?: string | null;
  google_sync_error?: string | null;
  created_at: string;
}

export interface GoogleListing {
  name: string | null;
  address: string | null;
  phone: string | null;
  international_phone: string | null;
  website: string | null;
  business_status: string | null;
  reviews_url: string | null;
}

export interface PlaceCandidate {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number;
  mapsUrl: string | null;
}

// Website audits — written by the website-audit edge function
export type AuditCheckStatus = 'pass' | 'warn' | 'fail' | 'info';
export type AuditCheckCategory = 'indexing' | 'onpage' | 'links' | 'performance' | 'ecommerce' | 'security';

export interface AuditCheck {
  id: string;
  category: AuditCheckCategory;
  status: AuditCheckStatus;
  title: string;
  detail: string;
  weight: number;
}

export interface PageSpeedResult {
  strategy: 'mobile' | 'desktop';
  scores: { performance: number | null; seo: number | null; accessibility: number | null; best_practices: number | null };
  metrics: { id: string; title: string; value: string; score: number | null }[];
  field: { overall: string | null; metrics: { id: string; label: string; percentile: number; category: string }[]; source: 'url' | 'origin' | null };
  opportunities: { id: string; title: string; savings: string }[];
  seo_issues: string[];
}

export interface ProductPageReport {
  url: string;
  status: number;
  title: string | null;
  hasProductSchema: boolean;
  hasPrice: boolean;
  hasAvailability: boolean;
  hasRating: boolean;
  hasImage: boolean;
  hasIdentifier: boolean;
  hasDescription: boolean;
  imagesMissingAlt: number;
  canonical: string | null;
}

export interface AuditResults {
  checks: AuditCheck[];
  page?: {
    title: string;
    description: string;
    h1: string[];
    wordCount: number;
    htmlBytes: number;
    responseMs: number;
    lang: string | null;
    canonical: string | null;
    schemaTypes: string[];
    ogImage: string | null;
    redirects: string[];
  };
  robots?: { found: boolean; blocksAll: boolean; sitemaps: string[] };
  sitemap?: { found: boolean; url: string | null; isIndex: boolean; urlCount: number };
  links?: {
    internal: number;
    external: number;
    nofollow: number;
    emptyAnchors: number;
    checked: number;
    broken: { url: string; status: number; error?: string }[];
    unverified: number;
  };
  pagespeed?: { mobile: PageSpeedResult | { error: string }; desktop: PageSpeedResult | { error: string } };
  ecommerce?: { platform: string | null; detected: boolean; productPages: ProductPageReport[] } | null;
}

export interface AuditAction {
  title: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  how_to_fix: string;
  platform_tip: string;
}

// Google Search Console (search-console edge function)
export interface GscMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscOverview {
  range: { startDate: string; endDate: string };
  previous: { startDate: string; endDate: string };
  totals: GscMetrics;
  previousTotals: GscMetrics;
  series: (GscMetrics & { date: string })[];
  queries: (GscMetrics & { query: string })[];
  pages: (GscMetrics & { page: string; prevClicks: number })[];
  losingPages: { page: string; prevClicks: number; clicks: number }[];
  devices: { device: string; clicks: number; impressions: number }[];
  sitemaps: {
    path: string;
    lastSubmitted: string | null;
    lastDownloaded: string | null;
    isPending: boolean;
    isIndex: boolean;
    warnings: number;
    errors: number;
    submitted: number;
  }[];
}

export interface GscInspection {
  url: string;
  verdict: string;
  coverageState: string;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  link: string | null;
  richResults: { type: string; issues: number }[];
}

export interface GscCoverage {
  sampled: number;
  indexed: number;
  notIndexed: number;
  reasons: { reason: string; count: number }[];
  results: GscInspection[];
  partial: boolean;
}

export interface WebsiteAudit {
  id: string;
  location_id: string;
  url: string;
  final_url: string | null;
  status: 'complete' | 'failed';
  error: string | null;
  overall_score: number | null;
  scores: Partial<Record<'seo_checks' | 'performance_mobile' | 'performance_desktop' | 'lighthouse_seo' | 'accessibility' | 'best_practices', number | null>>;
  results: AuditResults;
  recommendations: { summary: string; actions: AuditAction[]; generated_at: string } | null;
  is_ecommerce: boolean;
  platform: string | null;
  created_by: string | null;
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
