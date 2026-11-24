-- Cardstead drops pipeline: the server shop checker (supabase/functions/shop-checker).
-- Run once in Supabase > SQL Editor, after 002-discord-drops.sql.
-- Every table has Row Level Security on and no policies: only the service role (the Supabase functions) reads or writes them.

-- One row per shop: when it was last read, its ETag (unchanged catalogues cost almost nothing), and back-off after refusals.
create table if not exists public.shop_check_state (
  host text primary key check (host ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  etag text,
  last_checked_at timestamptz,
  last_ok_at timestamptz,
  last_status int,
  fails int not null default 0,
  backoff_until timestamptz
);

-- One row per product at a shop: the last stock state seen, so only changes become drop events.
create table if not exists public.shop_stock (
  store_key text not null,
  product_key text not null,
  handle text not null,
  title text not null,
  in_stock boolean not null,
  price_cad numeric(10,2),
  seen_at timestamptz not null,
  changed_at timestamptz not null,
  primary key (store_key, product_key, handle)
);
create index if not exists shop_stock_store on public.shop_stock (store_key);

-- Detection lag for the weekly speed log: the shop's own "updated" time for the product, when it gives one.
alter table public.drop_events add column if not exists source_updated_at timestamptz;

do $$
declare t text;
begin
  foreach t in array array['shop_check_state','shop_stock'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
