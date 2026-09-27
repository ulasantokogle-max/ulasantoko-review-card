-- Ulasantoko V2 standalone foundation
-- Additive only: does not alter, reference, or depend on legacy tables.

create extension if not exists pgcrypto;

create sequence if not exists public.v2_lp_seq start 101;
create sequence if not exists public.v2_business_seq start 1;

create table if not exists public.v2_businesses (
  id uuid primary key default gen_random_uuid(),
  business_code text not null unique,
  business_name text not null,
  google_review_url text,
  google_place_id text,
  logo_url text,
  address text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_cards (
  id uuid primary key default gen_random_uuid(),
  card_code text not null unique,
  business_id uuid not null references public.v2_businesses(id) on delete restrict,
  status text not null default 'inactive' check (status in ('inactive','active','blocked')),
  activation_pin_hash text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_landing_pages (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references public.v2_cards(id) on delete cascade,
  lp_slug text not null unique,
  template_key text not null default 'lp002',
  title text,
  headline text,
  description text,
  primary_color text,
  secondary_color text,
  review_enabled boolean not null default true,
  complaint_enabled boolean not null default true,
  feedback_enabled boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_feedback (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.v2_cards(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  customer_name text,
  is_anonymous boolean not null default false,
  message text,
  created_at timestamptz not null default now()
);

create table if not exists public.v2_complaints (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.v2_cards(id) on delete cascade,
  customer_name text,
  phone text,
  is_anonymous boolean not null default false,
  category text,
  message text not null,
  status text not null default 'pending' check (status in ('pending','reviewed','resolved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v2_complaint_photos (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.v2_complaints(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.v2_qr_configs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null unique references public.v2_cards(id) on delete cascade,
  target_path text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists v2_cards_business_id_idx on public.v2_cards(business_id);
create index if not exists v2_cards_status_idx on public.v2_cards(status);
create index if not exists v2_landing_pages_slug_idx on public.v2_landing_pages(lp_slug);
create index if not exists v2_feedback_card_id_idx on public.v2_feedback(card_id);
create index if not exists v2_complaints_card_id_idx on public.v2_complaints(card_id);
create index if not exists v2_complaints_status_idx on public.v2_complaints(status);

create or replace function public.v2_next_business_code()
returns text
language sql
volatile
as $$
  select 'BUS' || lpad(nextval('public.v2_business_seq')::text, 6, '0');
$$;

create or replace function public.v2_next_lp_code()
returns text
language sql
volatile
as $$
  select 'LP' || lpad(nextval('public.v2_lp_seq')::text, 5, '0');
$$;

create or replace function public.v2_create_card(
  p_business_name text,
  p_google_review_url text default null,
  p_google_place_id text default null,
  p_logo_url text default null,
  p_address text default null,
  p_phone text default null,
  p_title text default null,
  p_headline text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_card_id uuid;
  v_lp_id uuid;
  v_code text;
  v_pin text;
  v_business_code text;
begin
  if nullif(trim(p_business_name), '') is null then
    raise exception 'business_name_required';
  end if;

  v_business_code := public.v2_next_business_code();
  v_code := public.v2_next_lp_code();
  v_pin := lpad((floor(random() * 1000000))::int::text, 6, '0');

  insert into public.v2_businesses (
    business_code, business_name, google_review_url, google_place_id,
    logo_url, address, phone
  ) values (
    v_business_code, trim(p_business_name), nullif(trim(p_google_review_url), ''),
    nullif(trim(p_google_place_id), ''), nullif(trim(p_logo_url), ''),
    nullif(trim(p_address), ''), nullif(trim(p_phone), '')
  ) returning id into v_business_id;

  insert into public.v2_cards (
    card_code, business_id, activation_pin_hash
  ) values (
    v_code, v_business_id, crypt(v_pin, gen_salt('bf'))
  ) returning id into v_card_id;

  insert into public.v2_landing_pages (
    card_id, lp_slug, title, headline, description
  ) values (
    v_card_id,
    v_code,
    coalesce(nullif(trim(p_title), ''), trim(p_business_name)),
    nullif(trim(p_headline), ''),
    nullif(trim(p_description), '')
  ) returning id into v_lp_id;

  insert into public.v2_qr_configs (card_id, target_path)
  values (v_card_id, '/lp/' || v_code);

  return jsonb_build_object(
    'card_id', v_card_id,
    'business_id', v_business_id,
    'landing_page_id', v_lp_id,
    'card_code', v_code,
    'lp_slug', v_code,
    'activation_pin', v_pin,
    'public_path', '/lp/' || v_code
  );
end;
$$;

create or replace function public.v2_activate_card(
  p_card_code text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.v2_cards%rowtype;
  v_business_name text;
begin
  select * into v_card
  from public.v2_cards
  where card_code = upper(trim(p_card_code))
  for update;

  if not found then
    raise exception 'card_not_found';
  end if;

  if v_card.status = 'blocked' then
    raise exception 'card_blocked';
  end if;

  if v_card.status = 'active' then
    select business_name into v_business_name
    from public.v2_businesses where id = v_card.business_id;

    return jsonb_build_object(
      'ok', true,
      'already_active', true,
      'card_code', v_card.card_code,
      'business_name', v_business_name,
      'public_path', '/lp/' || v_card.card_code
    );
  end if;

  if v_card.activation_pin_hash is null
     or crypt(trim(p_pin), v_card.activation_pin_hash) <> v_card.activation_pin_hash then
    raise exception 'invalid_pin';
  end if;

  update public.v2_cards
  set status = 'active', activated_at = now(), updated_at = now()
  where id = v_card.id;

  select business_name into v_business_name
  from public.v2_businesses where id = v_card.business_id;

  return jsonb_build_object(
    'ok', true,
    'already_active', false,
    'card_code', v_card.card_code,
    'business_name', v_business_name,
    'public_path', '/lp/' || v_card.card_code
  );
end;
$$;

alter table public.v2_businesses enable row level security;
alter table public.v2_cards enable row level security;
alter table public.v2_landing_pages enable row level security;
alter table public.v2_feedback enable row level security;
alter table public.v2_complaints enable row level security;
alter table public.v2_complaint_photos enable row level security;
alter table public.v2_qr_configs enable row level security;

revoke all on table public.v2_businesses, public.v2_cards, public.v2_landing_pages,
  public.v2_feedback, public.v2_complaints, public.v2_complaint_photos, public.v2_qr_configs
from anon, authenticated;

grant select on table public.v2_businesses, public.v2_cards, public.v2_landing_pages to anon, authenticated;
grant insert on table public.v2_feedback, public.v2_complaints, public.v2_complaint_photos to anon, authenticated;

drop policy if exists "V2 public can view active businesses" on public.v2_businesses;
create policy "V2 public can view active businesses"
on public.v2_businesses for select to anon, authenticated
using (status = 'active');

drop policy if exists "V2 public can view active cards" on public.v2_cards;
create policy "V2 public can view active cards"
on public.v2_cards for select to anon, authenticated
using (status = 'active');

drop policy if exists "V2 public can view active landing pages" on public.v2_landing_pages;
create policy "V2 public can view active landing pages"
on public.v2_landing_pages for select to anon, authenticated
using (is_active = true);

drop policy if exists "V2 public can submit feedback" on public.v2_feedback;
create policy "V2 public can submit feedback"
on public.v2_feedback for insert to anon, authenticated
with check (
  exists (
    select 1 from public.v2_cards c
    where c.id = card_id and c.status = 'active'
  )
);

drop policy if exists "V2 public can submit complaints" on public.v2_complaints;
create policy "V2 public can submit complaints"
on public.v2_complaints for insert to anon, authenticated
with check (
  exists (
    select 1 from public.v2_cards c
    where c.id = card_id and c.status = 'active'
  )
);

revoke execute on function public.v2_create_card(text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.v2_create_card(text,text,text,text,text,text,text,text,text) to service_role;

revoke execute on function public.v2_activate_card(text,text) from public, anon, authenticated;
grant execute on function public.v2_activate_card(text,text) to service_role;

revoke execute on function public.v2_next_business_code() from public, anon, authenticated;
revoke execute on function public.v2_next_lp_code() from public, anon, authenticated;
