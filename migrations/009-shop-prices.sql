-- Cardstead typical asking price at Canadian shops. Run once after 008-restock-feed.sql. Safe to run again.
-- Anyone can read, per product, the middle asking price among shops that have it in stock, from Cardstead's own shop
-- checks, only when at least 3 shops do. These are asking prices, not sales. The tables stay closed.

create or replace function public.shop_prices()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(p.product_key,
           jsonb_build_object('shops', p.shops, 'typical', p.typical, 'low', p.low, 'high', p.high)), '{}'::jsonb)
  from (
    select product_key, count(*) as shops,
      round((percentile_cont(0.5) within group (order by price))::numeric, 2) as typical, min(price) as low, max(price) as high
    from (
      -- One price per shop and product: its cheapest listing in stock at the shop's last full read, and only from a
      -- shop that answered in the last day.
      select s.product_key, s.store_key, min(s.price_cad) as price
      from public.shop_stock s
      join public.shop_check_state c on c.host = s.store_key
      where s.in_stock and s.price_cad > 0
        and c.last_status in (200, 304) and c.last_checked_at > now() - interval '24 hours'
        and s.seen_at >= c.last_ok_at - interval '1 minute'
      group by s.product_key, s.store_key
    ) per_shop
    group by product_key
    having count(*) >= 3
  ) p
$$;
revoke all on function public.shop_prices() from public;
grant execute on function public.shop_prices() to anon, authenticated;
