create extension if not exists pgcrypto;
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  card_code text not null unique,
  business_name text not null,
  google_review_url text not null,
  status text not null default 'inactive' check(status in ('inactive','active','blocked')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cards_card_code_idx on public.cards(card_code);
create index if not exists cards_status_idx on public.cards(status);

-- ============================================================
-- V2 STANDALONE CUSTOMER SETTINGS
-- Run this migration in Supabase SQL Editor.
-- It only adds fields to V2 and does not modify legacy tables.
-- ============================================================

alter table if exists public.v2_landing_pages
  add column if not exists settings jsonb not null default '{}'::jsonb;

create index if not exists v2_landing_pages_settings_gin_idx
  on public.v2_landing_pages using gin (settings);

-- Public read for uploaded V2 customer assets; writes still happen only
-- through the server-side service-role API.
insert into storage.buckets (id, name, public)
values ('v2-assets', 'v2-assets', true)
on conflict (id) do nothing;
