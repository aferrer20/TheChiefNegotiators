-- =====================================================================
-- The Chief Negotiators Exchange — Supabase schema
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Design notes
--   * Every member applies; nobody trades until TCN approves them.
--   * Sellers never see buyers and buyers never see sellers. Every deal
--     routes through an "introduction" that TCN controls, so the desk
--     can't be cut out of a transaction.
--   * Guests can see the floor (model, size, window, region) but not
--     price or terms. Approved members see terms. Seller identity is
--     never exposed outside the admin role.
--   * Status changes that matter (approve member, list/delist,
--     move a deal) only happen through admin policies or admin RPCs.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------
create table if not exists public.members (
  id           uuid primary key references auth.users on delete cascade,
  email        text,
  full_name    text,
  company      text,
  title        text,
  phone        text,
  website      text,
  side         text not null default 'buyer' check (side in ('buyer','seller','both')),
  answers      jsonb not null default '{}'::jsonb,   -- raw application answers
  score        int  not null default 0,
  tier         text,                                 -- priority | qualified | waitlist
  status       text not null default 'pending' check (status in ('pending','approved','declined')),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.members where id = auth.uid()), false)
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'approved' from public.members where id = auth.uid()), false)
$$;

alter table public.members enable row level security;

drop policy if exists members_self_read  on public.members;
drop policy if exists members_admin_all  on public.members;
drop policy if exists members_self_edit  on public.members;
create policy members_self_read on public.members for select using (id = auth.uid() or public.is_admin());
create policy members_admin_all on public.members for update using (public.is_admin());
create policy members_self_edit on public.members for update using (id = auth.uid());

-- Members can only edit contact fields on their own row. Status, score,
-- tier and admin flag change only through admin_review_member().
revoke update on public.members from authenticated;
grant  update (full_name, company, title, phone, website) on public.members to authenticated;

-- Create the member row from the application sent at sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare a jsonb := coalesce(new.raw_user_meta_data -> 'application', '{}'::jsonb);
begin
  insert into public.members (id, email, full_name, company, title, phone, website, side, answers, score, tier)
  values (
    new.id, new.email,
    a ->> 'name', a ->> 'company', a ->> 'title', a ->> 'phone', a ->> 'website',
    coalesce(nullif(a ->> 'side', ''), 'buyer'),
    a,
    coalesce((a ->> 'score')::int, 0),
    a ->> 'tier'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.admin_review_member(member uuid, new_status text, make_admin boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.members
     set status = new_status,
         approved_at = case when new_status = 'approved' then now() else approved_at end,
         is_admin = coalesce(make_admin, is_admin)
   where id = member;
end $$;

-- ---------------------------------------------------------------------
-- Listings (supply)
-- ---------------------------------------------------------------------
create sequence if not exists public.listing_ref_seq start 401;

create table if not exists public.listings (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique,
  seller_id    uuid references public.members(id) on delete set null default auth.uid(),
  kind         text not null check (kind in ('hardware','gpuaas')),
  model        text not null,
  config       text,                 -- HGX 8-GPU, NVL72, SXM5 ...
  gpu_count    int  not null check (gpu_count > 0),
  condition    text,                 -- hardware only
  region       text,
  available    text,                 -- "Immediate", "Q1 2027"
  price        numeric,              -- members only
  price_unit   text,                 -- "per GPU", "per GPU-hr"
  term_months  int,
  deposit_pct  int,
  min_commit   int,                  -- minimum GPUs per order
  notes        text,                 -- members only
  status       text not null default 'review'
               check (status in ('review','live','reserved','closed','declined')),
  featured     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create or replace function public.listings_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref is null then
    new.ref := 'TCN-' || upper(regexp_replace(new.model, '[^A-Za-z0-9]', '', 'g'))
               || '-' || lpad(nextval('public.listing_ref_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  -- Sellers can submit and edit, but only TCN puts a listing on the floor.
  if not public.is_admin() then
    new.seller_id := coalesce(old.seller_id, auth.uid());
    new.featured  := coalesce(old.featured, false);
    if tg_op = 'INSERT' or new.status not in ('closed') then new.status := 'review'; end if;
  end if;
  return new;
end $$;

drop trigger if exists listings_guard on public.listings;
create trigger listings_guard before insert or update on public.listings
  for each row execute function public.listings_guard();

alter table public.listings enable row level security;
drop policy if exists listings_owner_read   on public.listings;
drop policy if exists listings_owner_insert on public.listings;
drop policy if exists listings_owner_update on public.listings;
drop policy if exists listings_admin        on public.listings;
create policy listings_owner_read   on public.listings for select using (seller_id = auth.uid() or public.is_admin());
create policy listings_owner_insert on public.listings for insert with check (public.is_member() and seller_id = auth.uid());
create policy listings_owner_update on public.listings for update using (seller_id = auth.uid());
create policy listings_admin        on public.listings for all using (public.is_admin()) with check (public.is_admin());

-- The floor: what everyone sees. Terms only resolve for approved members.
-- Seller identity is never in this view.
create or replace view public.floor as
  select id, ref, kind, model, config, gpu_count, condition, region, available,
         term_months, min_commit, featured, status, created_at, updated_at,
         case when public.is_member() then price       end as price,
         case when public.is_member() then price_unit  end as price_unit,
         case when public.is_member() then deposit_pct end as deposit_pct,
         case when public.is_member() then notes       end as notes,
         (price is not null) as has_price
    from public.listings
   where status in ('live','reserved');
grant select on public.floor to anon, authenticated;

-- ---------------------------------------------------------------------
-- Requirements (demand) — buyers post what they need; sellers see it
-- anonymised and can offer to fill it.
-- ---------------------------------------------------------------------
create table if not exists public.requirements (
  id          uuid primary key default gen_random_uuid(),
  buyer_id    uuid references public.members(id) on delete cascade default auth.uid(),
  kind        text not null check (kind in ('hardware','gpuaas','either')),
  model       text not null,
  gpu_count   int  not null,
  region      text,
  timeline    text,
  budget      text,
  notes       text,
  status      text not null default 'open' check (status in ('open','matched','closed')),
  created_at  timestamptz not null default now()
);
alter table public.requirements enable row level security;
drop policy if exists req_own    on public.requirements;
drop policy if exists req_insert on public.requirements;
drop policy if exists req_admin  on public.requirements;
create policy req_own    on public.requirements for select using (buyer_id = auth.uid() or public.is_admin());
create policy req_insert on public.requirements for insert with check (public.is_member() and buyer_id = auth.uid());
create policy req_admin  on public.requirements for update using (public.is_admin());

create or replace view public.demand as
  select id, kind, model, gpu_count, region, timeline, created_at
    from public.requirements
   where status = 'open' and public.is_member();
grant select on public.demand to authenticated;

-- ---------------------------------------------------------------------
-- Introductions — every deal starts here and TCN runs it.
-- ---------------------------------------------------------------------
create table if not exists public.intros (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid references public.members(id) on delete cascade default auth.uid(),
  direction      text not null check (direction in ('buy','supply')),
  listing_id     uuid references public.listings(id) on delete set null,
  requirement_id uuid references public.requirements(id) on delete set null,
  gpu_count      int,
  timeline       text,
  message        text,
  phone          text,
  status         text not null default 'new'
                 check (status in ('new','call_booked','ncnda','terms','closed_won','closed_lost')),
  admin_note     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.intros enable row level security;
drop policy if exists intros_own    on public.intros;
drop policy if exists intros_insert on public.intros;
drop policy if exists intros_admin  on public.intros;
create policy intros_own    on public.intros for select using (member_id = auth.uid() or public.is_admin());
create policy intros_insert on public.intros for insert with check (public.is_member() and member_id = auth.uid() and status = 'new');
create policy intros_admin  on public.intros for update using (public.is_admin());

-- Members see their own requests with the listing ref attached.
create or replace view public.my_intros as
  select i.id, i.direction, i.gpu_count, i.timeline, i.status, i.created_at,
         l.ref as listing_ref, l.model as listing_model,
         r.model as requirement_model, r.gpu_count as requirement_gpus
    from public.intros i
    left join public.listings l on l.id = i.listing_id
    left join public.requirements r on r.id = i.requirement_id
   where i.member_id = auth.uid();
grant select on public.my_intros to authenticated;

-- ---------------------------------------------------------------------
-- Bootstrap your admin (after you sign in once with this email):
--   update public.members set is_admin = true, status = 'approved'
--    where email = 'sales@thechiefnegotiators.com';
-- ---------------------------------------------------------------------
