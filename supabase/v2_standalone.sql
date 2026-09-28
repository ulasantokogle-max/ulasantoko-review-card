-- V2 STANDALONE SCHEMA
-- Safe/additive migration. Does NOT alter legacy cards/feedback_pages.

create extension if not exists pgcrypto;

create table if not exists public.v2_businesses (
  id uuid primary key default gen_random_uuid(),
  business_code text not null unique,
  business_name text not null default '',
  google_maps_url text,
  google_review_url text,
  google_place_id text,
  logo_url text,
  phone text,
  address text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_cards (
  id uuid primary key default gen_random_uuid(),
  card_code text not null unique,
  business_id uuid not null references public.v2_businesses(id) on delete cascade,
  activation_pin_hash text,
  status text not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_landing_pages (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references public.v2_cards(id) on delete cascade,
  lp_slug text not null unique,
  template_key text default 'lp002',
  title text,
  headline text,
  description text,
  primary_color text default '#173A32',
  secondary_color text default '#D49A3A',
  review_enabled boolean not null default true,
  complaint_enabled boolean not null default true,
  feedback_enabled boolean not null default true,
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_qr_configs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references public.v2_cards(id) on delete cascade,
  target_path text not null,
  qr_style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_feedback (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.v2_cards(id) on delete cascade,
  rating smallint,
  message text,
  customer_name text,
  customer_phone text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Add missing V2 columns when tables were created earlier with a smaller schema.
alter table if exists public.v2_businesses add column if not exists business_code text;
alter table if exists public.v2_businesses add column if not exists business_name text default '';
alter table if exists public.v2_businesses add column if not exists google_maps_url text;
alter table if exists public.v2_businesses add column if not exists google_review_url text;
alter table if exists public.v2_businesses add column if not exists google_place_id text;
alter table if exists public.v2_businesses add column if not exists logo_url text;
alter table if exists public.v2_businesses add column if not exists phone text;
alter table if exists public.v2_businesses add column if not exists address text;
alter table if exists public.v2_businesses add column if not exists status text default 'active';
alter table if exists public.v2_businesses add column if not exists updated_at timestamptz default now();

alter table if exists public.v2_cards add column if not exists business_id uuid;
alter table if exists public.v2_cards add column if not exists activation_pin_hash text;
alter table if exists public.v2_cards add column if not exists status text default 'inactive';
alter table if exists public.v2_cards add column if not exists updated_at timestamptz default now();

alter table if exists public.v2_landing_pages add column if not exists card_id uuid;
alter table if exists public.v2_landing_pages add column if not exists lp_slug text;
alter table if exists public.v2_landing_pages add column if not exists template_key text default 'lp002';
alter table if exists public.v2_landing_pages add column if not exists title text;
alter table if exists public.v2_landing_pages add column if not exists headline text;
alter table if exists public.v2_landing_pages add column if not exists description text;
alter table if exists public.v2_landing_pages add column if not exists primary_color text default '#173A32';
alter table if exists public.v2_landing_pages add column if not exists secondary_color text default '#D49A3A';
alter table if exists public.v2_landing_pages add column if not exists review_enabled boolean default true;
alter table if exists public.v2_landing_pages add column if not exists complaint_enabled boolean default true;
alter table if exists public.v2_landing_pages add column if not exists feedback_enabled boolean default true;
alter table if exists public.v2_landing_pages add column if not exists is_active boolean default true;
alter table if exists public.v2_landing_pages add column if not exists settings jsonb default '{}'::jsonb;
alter table if exists public.v2_landing_pages add column if not exists updated_at timestamptz default now();

alter table if exists public.v2_qr_configs add column if not exists card_id uuid;
alter table if exists public.v2_qr_configs add column if not exists target_path text;
alter table if exists public.v2_qr_configs add column if not exists qr_style jsonb default '{}'::jsonb;
alter table if exists public.v2_qr_configs add column if not exists updated_at timestamptz default now();

-- Recommended indexes for card-code based resolution.
create index if not exists v2_cards_card_code_idx on public.v2_cards(card_code);
create index if not exists v2_cards_business_id_idx on public.v2_cards(business_id);
create index if not exists v2_landing_pages_card_id_idx on public.v2_landing_pages(card_id);
create index if not exists v2_landing_pages_settings_gin_idx on public.v2_landing_pages using gin(settings);

-- Public object delivery for V2 logo/cover files. Uploads are performed only
-- by the server-side API using the service-role key.
insert into storage.buckets (id, name, public)
values ('v2-assets', 'v2-assets', true)
on conflict (id) do update set public = true;
