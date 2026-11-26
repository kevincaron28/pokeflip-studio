-- Typical asking price on a real database: in stock, fresh, one price per shop, three shops or more.
delete from public.shop_stock;
delete from public.shop_check_state;
insert into public.shop_check_state (host, last_checked_at, last_ok_at, last_status)
select h, now() - interval '5 minutes', now() - interval '2 hours', 304
from unnest(array['a.example.ca','b.example.ca','c.example.ca','d.example.ca']) h;
insert into public.shop_check_state (host, last_checked_at, last_ok_at, last_status) values
  ('quiet.example.ca', now() - interval '3 days', now() - interval '3 days', 200);
insert into public.shop_stock (store_key, product_key, handle, title, in_stock, price_cad, seen_at, changed_at)
select store, product, handle, 't', stock, price, now() - interval '2 hours' + extra, now()
from (values
  ('a.example.ca', 'box|EN', 'one',  true,  200, interval '0'),
  ('a.example.ca', 'box|EN', 'two',  true,  260, interval '0'),          -- dearer listing at the same shop: ignored
  ('b.example.ca', 'box|EN', 'one',  true,  220, interval '0'),
  ('c.example.ca', 'box|EN', 'one',  true,  300, interval '0'),
  ('d.example.ca', 'box|EN', 'gone', true,  1,   interval '-1 day'),     -- no longer in the shop's catalogue
  ('d.example.ca', 'box|EN', 'out',  false, 1,   interval '0'),          -- sold out
  ('quiet.example.ca', 'box|EN', 'one', true, 1, interval '-3 days'),    -- shop not reached for days
  ('a.example.ca', 'tin|EN', 'one',  true,  30,  interval '0'),
  ('b.example.ca', 'tin|EN', 'one',  true,  31,  interval '0')           -- only two shops: no typical price
) v(store, product, handle, stock, price, extra);

set role anon;
do $$
declare p jsonb := public.shop_prices();
begin
  if p ? 'tin|EN' then raise exception 'two shops are not enough: %', p; end if;
  if (p->'box|EN'->>'shops')::int <> 3 or (p->'box|EN'->>'typical')::numeric <> 220
     or (p->'box|EN'->>'low')::numeric <> 200 or (p->'box|EN'->>'high')::numeric <> 300 then raise exception 'wrong typical price: %', p; end if;
end $$;
reset role;
select 'PASS typical shop price' as result;
