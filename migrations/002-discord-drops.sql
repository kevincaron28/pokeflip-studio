-- Cardstead Drops (Discord). Run once in the Supabase SQL editor.
-- Every table has Row Level Security on and no policies: only the service role (the Supabase functions) reads or writes them.
-- Signed-in Cardstead users reach their own Discord link only through the four functions at the end.

-- Confirmed sightings from the alert pipeline (shop checker, retailer emails, Amazon API) and confirmed member reports.
create table if not exists public.drop_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_key text not null,
  product_name text not null,
  product_lang text not null check (product_lang in ('EN','FR','JP')),
  product_kind text not null check (product_kind in ('booster_box','etb','etb_pc','pack','bundle','blister','build_battle','collection','tin','other')), -- cases of boxes are never inserted
  product_upc text check (product_upc is null or product_upc ~ '^[0-9]{8,14}$'),
  matched_by text check (matched_by in ('barcode','title')),
  store_key text not null,
  store_name text not null,
  chain_key text check (chain_key in ('pokemon-center','walmart','bestbuy-ebgames','costco','amazon-ca','indigo-mastermind','pharmacies-grocery')),
  region text check (region in ('qc-montreal','qc-quebec-regions','on-gta','on-ottawa-other','bc','prairies','atlantic','online-canada')),
  city text,
  url text check (url is null or url like 'https://%'),
  price_cad numeric(10,2) check (price_cad is null or price_cad > 0),
  msrp_cad numeric(10,2),
  seller text not null default 'store' check (seller in ('store','marketplace')),
  in_stock boolean not null default true,
  limit_per_order int,
  source text not null check (source in ('shop_check','retailer_email','amazon_api','member_report')),
  confidence text not null check (confidence in ('high','medium','low')),
  event_key text unique, -- store_key|product_key|in_stock|UTC date-hour: producers insert idempotently
  first_seen_at timestamptz not null,
  market_cad numeric(10,2),
  market_source text,
  market_as_of date,
  image_url text check (image_url is null or image_url like 'https://%'),
  cardstead_url text check (cardstead_url is null or cardstead_url like 'https://%'),
  reporter_id text,
  processed_at timestamptz,
  discord_outcome text,
  check (chain_key is not null or region is not null),
  check (not (matched_by = 'title' and confidence = 'high')) -- a title match is Medium at most
);
create index if not exists drop_events_unprocessed on public.drop_events (created_at) where processed_at is null;

-- One row per product at a store: the Discord message that represents it.
create table if not exists public.discord_posts (
  id uuid primary key,
  key text not null unique,
  channel_id text not null,
  message_id text not null,
  state text not null check (state in ('live','sold_out','stale')),
  posted_at timestamptz not null,
  last_seen_at timestamptz not null,
  pinged_at timestamptz,
  first_seen_at timestamptz not null,
  store_name text not null,
  wasnt_there int not null default 0,
  reporter_id text,
  event jsonb not null
);
create index if not exists discord_posts_posted on public.discord_posts (posted_at);

create table if not exists public.discord_wasnt_there (
  post_id uuid not null references public.discord_posts(id) on delete cascade,
  discord_user_id text not null,
  at timestamptz not null default now(),
  primary key (post_id, discord_user_id)
);

create table if not exists public.discord_reports (
  id uuid primary key,
  reporter_id text not null,
  product_key text not null, product_name text not null, product_lang text not null, product_kind text not null,
  store_key text not null, store_name text not null, region text not null, chain_key text, city text,
  price_cad numeric(10,2), link text, photo text,
  status text not null check (status in ('pending','confirmed','expired','posted')),
  created_at timestamptz not null, expires_at timestamptz not null,
  thread_id text, message_id text,
  confirmer_id text, confirmed_at timestamptz,
  check (confirmer_id is null or confirmer_id <> reporter_id)
);
create index if not exists discord_reports_pending on public.discord_reports (expires_at) where status = 'pending';

create table if not exists public.discord_reporters (
  discord_user_id text primary key,
  good int not null default 0,
  bad int not null default 0,
  trusted boolean not null default false
);

create table if not exists public.discord_link_codes (
  code text primary key check (code ~ '^[A-Z2-9]{8}$'),
  discord_user_id text not null,
  expires_at timestamptz not null
);

-- A Cardstead account linked to a Discord account. DMs are opt-in and can be switched off or unlinked at any time.
create table if not exists public.discord_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_user_id text not null unique,
  dms_enabled boolean not null default false,
  linked_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['drop_events','discord_posts','discord_wasnt_there','discord_reports','discord_reporters','discord_link_codes','discord_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- "Wasn't there": one tap per member per alert; returns the new total.
create or replace function public.discord_add_wasnt_there(p_post uuid, p_user text) returns int
language sql security invoker set search_path = public as $$
  insert into public.discord_wasnt_there(post_id, discord_user_id) values (p_post, p_user) on conflict do nothing;
  select count(*)::int from public.discord_wasnt_there where post_id = p_post;
$$;

create or replace function public.discord_bump_reporter(p_user text, p_good int, p_bad int) returns public.discord_reporters
language plpgsql security invoker set search_path = public as $$
declare r public.discord_reporters;
begin
  insert into public.discord_reporters(discord_user_id, good, bad) values (p_user, greatest(p_good,0), greatest(p_bad,0))
  on conflict (discord_user_id) do update set good = discord_reporters.good + greatest(p_good,0), bad = discord_reporters.bad + greatest(p_bad,0)
  returning * into r;
  if not r.trusted and r.good >= 10 and r.bad * 3 < r.good then
    update public.discord_reporters set trusted = true where discord_user_id = p_user returning * into r;
    r.trusted := false; -- tell the caller this is the moment to give the role
  end if;
  return r;
end $$;

-- Linked members with DMs on, with the restock watches from their own Cardstead cloud backup (enabled ones only).
create or replace function public.discord_dm_targets() returns table(discord_user_id text, watches jsonb)
language sql security invoker set search_path = public as $$
  select l.discord_user_id,
         coalesce((select jsonb_agg(w) from jsonb_array_elements(s.payload->'restockWatch'->'watches') w where (w->>'enabled')::boolean), '[]'::jsonb)
  from public.discord_links l
  join public.pokeflip_snapshots s on s.user_id = l.user_id
  where l.dms_enabled;
$$;

do $$ declare f text; begin
  foreach f in array array['discord_add_wasnt_there(uuid,text)','discord_bump_reporter(text,int,int)','discord_dm_targets()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- For signed-in Cardstead users (Settings -> Discord alerts).
create or replace function public.discord_link_account(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare d text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from public.discord_link_codes where expires_at < now();
  delete from public.discord_link_codes where code = upper(trim(p_code)) returning discord_user_id into d;
  if d is null then raise exception 'Code not found or expired. Type /link in the Discord server for a new one.'; end if;
  delete from public.discord_links where discord_user_id = d and user_id <> auth.uid();
  insert into public.discord_links(user_id, discord_user_id, dms_enabled) values (auth.uid(), d, true)
  on conflict (user_id) do update set discord_user_id = excluded.discord_user_id, dms_enabled = true, linked_at = now();
  return 'linked';
end $$;

create or replace function public.discord_set_dms(p_enabled boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update public.discord_links set dms_enabled = p_enabled where user_id = auth.uid();
  if not found then raise exception 'No Discord account linked'; end if;
  return p_enabled;
end $$;

create or replace function public.discord_unlink() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  delete from public.discord_links where user_id = auth.uid();
  return true;
end $$;

create or replace function public.discord_link_status() returns table(linked boolean, dms_enabled boolean)
language sql security definer set search_path = public as $$
  select true, l.dms_enabled from public.discord_links l where l.user_id = auth.uid()
  union all select false, false where not exists (select 1 from public.discord_links where user_id = auth.uid())
$$;

do $$ declare f text; begin
  foreach f in array array['discord_link_account(text)','discord_set_dms(boolean)','discord_unlink()','discord_link_status()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
