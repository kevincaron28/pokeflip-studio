-- Cardstead shop checker running outside Supabase (the owner's Oracle VM, deploy/shop-checker/). Run once after 005.
-- Shopify refuses (429) most requests from Supabase's shared outbound address, so the checker can run on a machine with
-- its own address. That machine holds no Supabase secret key: it calls the five functions below with the public
-- (publishable) key plus its own checker key. Only the SHA-256 of that key is stored here, and each function does only
-- what the checker needs: read and save shop check state and stock, and add shop-check drop events.
-- Safe to run again. Making a key (owner, SQL Editor only):  select public.checker_new_key('oracle-guilded-db');
-- It shows the key once; paste it into the VM's /etc/cardstead-checker/checker.env (docs/SHOP-CHECKER-VM.md).

create table if not exists public.checker_keys (
  id bigint generated always as identity primary key,
  label text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.checker_keys enable row level security;
revoke all on public.checker_keys from public, anon, authenticated;

create or replace function public.checker_auth(p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or length(p_key) < 32 or not exists (
    select 1 from public.checker_keys where token_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')) then
    raise exception 'checker key not accepted' using errcode = '42501';
  end if;
  update public.checker_keys set last_used_at = now()
   where token_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex') and (last_used_at is null or last_used_at < now() - interval '10 minutes');
end $$;

-- A new checker key for one machine: 64 hex characters from two random UUIDs (244 random bits), shown once and stored
-- only as its SHA-256. Making a key again for the same label replaces the old one (the old key stops working).
-- Not callable through the API: only from the SQL Editor (database owner).
create or replace function public.checker_new_key(p_label text)
returns text language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if p_label is null or p_label !~ '^[a-z0-9-]{3,40}$' then raise exception 'label: 3-40 lowercase letters, digits or dashes'; end if;
  k := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  delete from public.checker_keys where label = p_label;
  insert into public.checker_keys (label, token_hash) values (p_label, encode(sha256(convert_to(k, 'UTF8')), 'hex'));
  return k;
end $$;

create or replace function public.checker_states(p_key text)
returns setof public.shop_check_state language plpgsql security definer set search_path = '' as $$
begin
  perform public.checker_auth(p_key);
  return query select * from public.shop_check_state limit 1000;
end $$;

create or replace function public.checker_save_state(p_key text, p_row jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.shop_check_state;
begin
  perform public.checker_auth(p_key);
  r := jsonb_populate_record(null::public.shop_check_state, p_row);
  insert into public.shop_check_state as s (host, etag, last_checked_at, last_ok_at, last_status, fails, backoff_until)
  values (r.host, r.etag, r.last_checked_at, r.last_ok_at, r.last_status, coalesce(r.fails, 0), r.backoff_until)
  on conflict (host) do update set
    etag = case when p_row ? 'etag' then excluded.etag else s.etag end,
    last_checked_at = coalesce(excluded.last_checked_at, s.last_checked_at),
    last_ok_at = case when p_row ? 'last_ok_at' then excluded.last_ok_at else s.last_ok_at end,
    last_status = coalesce(excluded.last_status, s.last_status),
    fails = case when p_row ? 'fails' then excluded.fails else s.fails end,
    backoff_until = case when p_row ? 'backoff_until' then excluded.backoff_until else s.backoff_until end;
end $$;

create or replace function public.checker_stock(p_key text, p_host text)
returns setof public.shop_stock language plpgsql security definer set search_path = '' as $$
begin
  perform public.checker_auth(p_key);
  return query select * from public.shop_stock where store_key = p_host limit 2000;
end $$;

create or replace function public.checker_save_stock(p_key text, p_rows jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.checker_auth(p_key);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then raise exception 'rows must be an array of at most 2000'; end if;
  insert into public.shop_stock as s (store_key, product_key, handle, title, in_stock, price_cad, seen_at, changed_at)
  select r.store_key, r.product_key, r.handle, r.title, r.in_stock, r.price_cad, r.seen_at, r.changed_at
    from jsonb_populate_recordset(null::public.shop_stock, p_rows) r
  on conflict (store_key, product_key, handle) do update set title = excluded.title, in_stock = excluded.in_stock,
    price_cad = excluded.price_cad, seen_at = excluded.seen_at, changed_at = excluded.changed_at;
end $$;

-- Only shop-check events from a store (never member reports, other sources or marketplace sellers), title matches at
-- Medium confidence at most, inserted once per event_key.
create or replace function public.checker_add_event(p_key text, p_event jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.drop_events;
begin
  perform public.checker_auth(p_key);
  e := jsonb_populate_record(null::public.drop_events, p_event);
  if e.source is distinct from 'shop_check' or e.seller is distinct from 'store' or e.confidence = 'high' or e.event_key is null then
    raise exception 'only shop_check store events at medium or low confidence';
  end if;
  insert into public.drop_events (product_key, product_name, product_lang, product_kind, product_upc, matched_by, store_key, store_name,
    chain_key, region, city, url, price_cad, msrp_cad, seller, in_stock, limit_per_order, source, confidence, event_key, first_seen_at,
    market_cad, market_source, market_as_of, image_url, source_updated_at)
  values (e.product_key, e.product_name, e.product_lang, e.product_kind, e.product_upc, e.matched_by, e.store_key, e.store_name,
    e.chain_key, e.region, e.city, e.url, e.price_cad, e.msrp_cad, 'store', coalesce(e.in_stock, true), e.limit_per_order, 'shop_check', e.confidence, e.event_key, e.first_seen_at,
    e.market_cad, e.market_source, e.market_as_of, e.image_url, e.source_updated_at)
  on conflict (event_key) do nothing;
end $$;

do $$
declare f text;
begin
  execute 'revoke all on function public.checker_auth(text) from public, anon, authenticated';
  execute 'revoke all on function public.checker_new_key(text) from public, anon, authenticated';
  foreach f in array array['checker_states(text)','checker_save_state(text,jsonb)','checker_stock(text,text)','checker_save_stock(text,jsonb)','checker_add_event(text,jsonb)'] loop
    execute format('revoke all on function public.%s from public, authenticated', f);
    execute format('grant execute on function public.%s to anon', f);
  end loop;
end $$;
