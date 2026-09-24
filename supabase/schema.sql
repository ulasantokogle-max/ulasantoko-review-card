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