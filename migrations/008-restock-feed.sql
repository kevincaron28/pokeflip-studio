-- Cardstead public restock feed. Run once after 003-shop-checker.sql. Safe to run again.
-- Anyone (no account) can read, through this one function, what Cardstead's own shop checks saw in the last 7 days:
-- shop, product, price, link and time, and when a shop was last read. The tables stay closed (Row Level Security,
-- no policies). Member reports, accounts and Discord data are never returned.

create index if not exists drop_events_shop_feed on public.drop_events (first_seen_at desc) where source = 'shop_check';

create or replace function public.restock_feed()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    -- A shop that answers "unchanged" (304) was checked too; a refusal or an error was not.
    'checked_at', (select max(last_checked_at) from public.shop_check_state where last_status in (200, 304)),
    'shops_checked', (select count(*) from public.shop_check_state
      where last_status in (200, 304) and last_checked_at > now() - interval '1 hour'),
    'items', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.seen_at desc)
      from (
        select * from (
          -- The newest sighting of each product page: in stock, or sold out since.
          select distinct on (e.store_key, e.product_key, e.url)
            e.product_key as product, e.product_name as name, e.product_lang as lang, e.store_key as store, e.store_name, e.city, e.url,
            e.price_cad, e.in_stock, e.first_seen_at as seen_at, e.market_cad, e.market_as_of, e.image_url as image
          from public.drop_events e
          where e.source = 'shop_check' and e.seller = 'store' and e.first_seen_at > now() - interval '7 days'
          order by e.store_key, e.product_key, e.url, e.first_seen_at desc, e.created_at desc
        ) newest
        order by newest.seen_at desc
        limit 120
      ) f), '[]'::jsonb))
$$;
revoke all on function public.restock_feed() from public;
grant execute on function public.restock_feed() to anon, authenticated;
