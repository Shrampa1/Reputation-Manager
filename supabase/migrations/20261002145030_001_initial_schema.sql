/*
# Reputation Engine — Initial Schema (Multi-Tenant)

## Overview
Creates the complete multi-tenant database for Reputation Engine, a local marketing/SEO/reputation
management SaaS. Each user belongs to an organization; all business data (reviews, leads, social posts,
smart tasks) is scoped through organizations and locations.

## 1. Extensions & Enums
- `pgcrypto` for UUID generation (gen_random_uuid).
- `review_platform` enum: google, facebook, trustpilot, custom.
- `lead_stage` enum: new_lead, quote_sent, job_booked, completed, review_requested.
- `post_status` enum: draft, scheduled, published.
- `member_role` enum: owner, admin, member.
- `lead_channel` enum: web_chat, sms, messenger.

## 2. Core Tables
- `organizations` — top-level tenant entity (name).
- `organization_members` — joins auth.users to organizations with a role.
- `locations` — business locations under an organization.
- `reviews` — customer reviews on a location (platform, author, rating 1-5, content, ai_reply_draft, is_replied).
- `leads` — CRM leads on a location (customer_name, phone, email, channel, stage, estimated_value).
- `social_posts` — scheduled/published social content.
- `smart_tasks` — AI action recommendations.

## 3. Security
- RLS enabled on ALL tables.
- Helper function `get_user_org_ids()` returns UUID[] of org IDs the current auth user belongs to.
- All policies scoped TO authenticated only.
- Organization policies check membership via get_user_org_ids().
- Child table policies check location's org via EXISTS subquery.
- organization_members.user_id defaults to auth.uid() for client inserts.

## 4. Important Notes
- Tables created before helper function (dependency order).
- All child tables reference locations with ON DELETE CASCADE.
- Indexes on foreign keys and frequently queried columns.
*/

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
  CREATE TYPE review_platform AS ENUM ('google', 'facebook', 'trustpilot', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_stage AS ENUM ('new_lead', 'quote_sent', 'job_booked', 'completed', 'review_requested');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE post_status AS ENUM ('draft', 'scheduled', 'published');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_channel AS ENUM ('web_chat', 'sms', 'messenger');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ======================== Organizations ========================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ======================== Organization Members ========================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);

-- ======================== Locations ========================
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  gbp_place_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_locations_org_id ON locations(organization_id);

-- ======================== Reviews ========================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  platform review_platform NOT NULL DEFAULT 'google',
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT NOT NULL DEFAULT '',
  review_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_reply_draft TEXT,
  is_replied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reviews_location_id ON reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);

-- ======================== Leads ========================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  channel lead_channel NOT NULL DEFAULT 'web_chat',
  stage lead_stage NOT NULL DEFAULT 'new_lead',
  estimated_value TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_leads_location_id ON leads(location_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);

-- ======================== Social Posts ========================
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  platform TEXT NOT NULL DEFAULT 'facebook',
  scheduled_for TIMESTAMPTZ,
  status post_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_social_posts_location_id ON social_posts(location_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);

-- ======================== Smart Tasks ========================
CREATE TABLE IF NOT EXISTS smart_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  action_type TEXT NOT NULL DEFAULT 'general',
  action_route TEXT DEFAULT '/',
  priority TEXT NOT NULL DEFAULT 'medium',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE smart_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_smart_tasks_location_id ON smart_tasks(location_id);
CREATE INDEX IF NOT EXISTS idx_smart_tasks_completed ON smart_tasks(is_completed);

-- ======================== Helper Function (after tables) ========================
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(organization_id),
    ARRAY[]::UUID[]
  )
  FROM organization_members
  WHERE user_id = auth.uid();
$$;

-- ======================== RLS Policies ========================

-- Organizations
DROP POLICY IF EXISTS "org_select_member" ON organizations;
CREATE POLICY "org_select_member" ON organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "org_insert_member" ON organizations;
CREATE POLICY "org_insert_member" ON organizations
  FOR INSERT TO authenticated
  WITH CHECK (id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "org_update_member" ON organizations;
CREATE POLICY "org_update_member" ON organizations
  FOR UPDATE TO authenticated
  USING (id IN (SELECT unnest(get_user_org_ids())))
  WITH CHECK (id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "org_delete_owner" ON organizations;
CREATE POLICY "org_delete_owner" ON organizations
  FOR DELETE TO authenticated
  USING (id IN (SELECT unnest(get_user_org_ids())));

-- Organization Members
DROP POLICY IF EXISTS "member_select_self" ON organization_members;
CREATE POLICY "member_select_self" ON organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "member_insert_self" ON organization_members;
CREATE POLICY "member_insert_self" ON organization_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "member_update_own" ON organization_members;
CREATE POLICY "member_update_own" ON organization_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT unnest(get_user_org_ids())))
  WITH CHECK (user_id = auth.uid() OR organization_id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "member_delete_own" ON organization_members;
CREATE POLICY "member_delete_own" ON organization_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT unnest(get_user_org_ids())));

-- Locations
DROP POLICY IF EXISTS "loc_select" ON locations;
CREATE POLICY "loc_select" ON locations
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "loc_insert" ON locations;
CREATE POLICY "loc_insert" ON locations
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "loc_update" ON locations;
CREATE POLICY "loc_update" ON locations
  FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT unnest(get_user_org_ids())))
  WITH CHECK (organization_id IN (SELECT unnest(get_user_org_ids())));

DROP POLICY IF EXISTS "loc_delete" ON locations;
CREATE POLICY "loc_delete" ON locations
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT unnest(get_user_org_ids())));

-- Reviews
DROP POLICY IF EXISTS "review_select" ON reviews;
CREATE POLICY "review_select" ON reviews
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = reviews.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "review_insert" ON reviews;
CREATE POLICY "review_insert" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = reviews.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "review_update" ON reviews;
CREATE POLICY "review_update" ON reviews
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = reviews.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))))
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = reviews.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "review_delete" ON reviews;
CREATE POLICY "review_delete" ON reviews
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = reviews.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

-- Leads
DROP POLICY IF EXISTS "lead_select" ON leads;
CREATE POLICY "lead_select" ON leads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = leads.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "lead_insert" ON leads;
CREATE POLICY "lead_insert" ON leads
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = leads.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "lead_update" ON leads;
CREATE POLICY "lead_update" ON leads
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = leads.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))))
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = leads.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "lead_delete" ON leads;
CREATE POLICY "lead_delete" ON leads
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = leads.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

-- Social Posts
DROP POLICY IF EXISTS "post_select" ON social_posts;
CREATE POLICY "post_select" ON social_posts
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = social_posts.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "post_insert" ON social_posts;
CREATE POLICY "post_insert" ON social_posts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = social_posts.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "post_update" ON social_posts;
CREATE POLICY "post_update" ON social_posts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = social_posts.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))))
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = social_posts.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "post_delete" ON social_posts;
CREATE POLICY "post_delete" ON social_posts
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = social_posts.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

-- Smart Tasks
DROP POLICY IF EXISTS "task_select" ON smart_tasks;
CREATE POLICY "task_select" ON smart_tasks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = smart_tasks.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "task_insert" ON smart_tasks;
CREATE POLICY "task_insert" ON smart_tasks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = smart_tasks.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "task_update" ON smart_tasks;
CREATE POLICY "task_update" ON smart_tasks
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = smart_tasks.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))))
  WITH CHECK (EXISTS (SELECT 1 FROM locations WHERE locations.id = smart_tasks.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));

DROP POLICY IF EXISTS "task_delete" ON smart_tasks;
CREATE POLICY "task_delete" ON smart_tasks
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM locations WHERE locations.id = smart_tasks.location_id AND locations.organization_id IN (SELECT unnest(get_user_org_ids()))));
