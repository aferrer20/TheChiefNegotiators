-- The Chief Negotiators Exchange: Supabase setup
-- Paste all of this into Supabase -> SQL Editor -> New query -> Run.
-- Safe to run again; it only creates what is missing and refreshes the rules.
--
-- Who can do what:
--   Anyone (the public exchange page)  read live / under-offer lots, open requirements and live website partners
--   Admins (signed in, email listed in exchange_admins)  read everything, add, edit, delete
-- Nobody else can write, whatever they send.

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
create table if not exists public.exchange_admins (
  email text primary key
);

create table if not exists public.exchange_lots (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  kind        text not null default 'hardware' check (kind in ('gpuaas', 'hardware')),
  model       text not null check (length(model) between 1 and 200),
  config      text,
  gpu_count   integer not null check (gpu_count > 0),
  condition   text,
  region      text,
  available   text,
  price       numeric check (price is null or price >= 0),
  price_unit  text,
  term_months integer,
  deposit_pct numeric,
  min_commit  integer,
  featured    boolean not null default false,
  status      text not null default 'live' check (status in ('live', 'reserved', 'hidden')),
  notes       text check (notes is null or length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.exchange_requirements (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'either' check (kind in ('gpuaas', 'hardware', 'either')),
  model      text not null check (length(model) between 1 and 200),
  gpu_count  integer not null check (gpu_count > 0),
  region     text,
  timeline   text,
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current
create or replace function public.exchange_touch() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists exchange_lots_touch on public.exchange_lots;
create trigger exchange_lots_touch before update on public.exchange_lots
  for each row execute function public.exchange_touch();
drop trigger if exists exchange_requirements_touch on public.exchange_requirements;
create trigger exchange_requirements_touch before update on public.exchange_requirements
  for each row execute function public.exchange_touch();

-- ---------------------------------------------------------------
-- Admin check: the signed-in user's email is in exchange_admins
-- ---------------------------------------------------------------
create or replace function public.is_exchange_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exchange_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_exchange_admin() from public;
grant execute on function public.is_exchange_admin() to anon, authenticated;

-- ---------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------
alter table public.exchange_admins       enable row level security;
alter table public.exchange_lots         enable row level security;
alter table public.exchange_requirements enable row level security;

-- exchange_admins has no policies: it is managed only from the SQL Editor.
revoke all on public.exchange_admins from anon, authenticated;

grant select on public.exchange_lots, public.exchange_requirements to anon;
grant select, insert, update, delete on public.exchange_lots, public.exchange_requirements to authenticated;

drop policy if exists "public reads listed lots" on public.exchange_lots;
create policy "public reads listed lots" on public.exchange_lots
  for select to anon, authenticated
  using (status in ('live', 'reserved') or public.is_exchange_admin());

drop policy if exists "admins write lots" on public.exchange_lots;
create policy "admins write lots" on public.exchange_lots
  for all to authenticated
  using (public.is_exchange_admin()) with check (public.is_exchange_admin());

drop policy if exists "public reads open requirements" on public.exchange_requirements;
create policy "public reads open requirements" on public.exchange_requirements
  for select to anon, authenticated
  using (status = 'open' or public.is_exchange_admin());

drop policy if exists "admins write requirements" on public.exchange_requirements;
create policy "admins write requirements" on public.exchange_requirements
  for all to authenticated
  using (public.is_exchange_admin()) with check (public.is_exchange_admin());

-- ---------------------------------------------------------------
-- Website partners: the ecosystem shown on the public website
-- (homepage Ecosystem section and /partners). Managed in the desk
-- console -> Partners tab. Anyone can read live rows; only exchange
-- admins can change them.
--
-- This is deliberately a separate table from the CRM's public.partners,
-- which holds private fields (owner_rep, data). crm_id links a website
-- entry back to its CRM record; nothing here reads or changes the CRM
-- table's structure, and the website never reads the CRM table.
-- ---------------------------------------------------------------
create table if not exists public.site_partners (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{1,80}$'),
  name        text not null check (length(name) between 1 and 120),
  layer       text not null default 'other' check (layer in ('compute', 'capacity', 'power', 'cooling', 'network', 'licensing', 'finance', 'other')),
  blurb       text check (blurb is null or length(blurb) <= 400),
  website     text check (website is null or website ~* '^https://'),
  logo_url    text check (logo_url is null or logo_url ~* '^https://'),
  region      text check (region is null or length(region) <= 80),
  featured    boolean not null default false,
  status      text not null default 'live' check (status in ('live', 'hidden')),
  sort        integer not null default 100,
  crm_id      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists site_partners_touch on public.site_partners;
create trigger site_partners_touch before update on public.site_partners
  for each row execute function public.exchange_touch();

alter table public.site_partners enable row level security;
grant select on public.site_partners to anon;
grant select, insert, update, delete on public.site_partners to authenticated;

drop policy if exists "public reads live site partners" on public.site_partners;
create policy "public reads live site partners" on public.site_partners
  for select to anon, authenticated
  using (status = 'live' or public.is_exchange_admin());

drop policy if exists "admins write site partners" on public.site_partners;
create policy "admins write site partners" on public.site_partners
  for all to authenticated
  using (public.is_exchange_admin()) with check (public.is_exchange_admin());

-- Seed the partner already named on the site (skipped if it exists).
insert into public.site_partners (slug, name, layer, blurb, website, region, featured, sort) values
  ('opticool', 'OptiCool Technologies', 'cooling',
   'Two-phase refrigerant cooling for high-density and AI workloads: rear-door heat exchangers, water-free at the rack, deployable against live racks.',
   'https://opticooltechnologies.com/', 'Global', true, 10)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- Your admin login. Change the email to the one you will sign in
-- with (add more lines for more people), then create that user in
-- Authentication -> Users -> Add user (tick "Auto Confirm User").
-- ---------------------------------------------------------------
insert into public.exchange_admins (email) values
  ('sales@thechiefnegotiators.com')
on conflict do nothing;
