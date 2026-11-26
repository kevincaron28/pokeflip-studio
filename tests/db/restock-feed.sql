-- The public restock feed on a real database: a visitor reads only recent shop checks, newest state per product page.
delete from public.drop_events;
delete from public.shop_check_state;
insert into public.shop_check_state (host, last_checked_at, last_ok_at, last_status) values
  ('a.example.ca', now() - interval '5 minutes', now() - interval '3 hours', 304), -- unchanged: still checked
  ('b.example.ca', now(), now() - interval '3 hours', 429),                        -- refused: not checked
  ('c.example.ca', now() - interval '2 hours', now() - interval '2 hours', 200);
insert into public.drop_events (product_key, product_name, product_lang, product_kind, store_key, store_name, region, url, price_cad, in_stock, source, confidence, first_seen_at, reporter_id) values
  ('k1', 'Box', 'EN', 'booster_box', 'a.example.ca', 'Shop A', 'bc', 'https://a.example.ca/products/box', 200, true,  'shop_check', 'medium', now() - interval '2 days', null),
  ('k1', 'Box', 'EN', 'booster_box', 'a.example.ca', 'Shop A', 'bc', 'https://a.example.ca/products/box', 210, false, 'shop_check', 'medium', now() - interval '1 day', null),
  ('k2', 'Tin', 'FR', 'tin',         'b.example.ca', 'Shop B', 'bc', 'https://b.example.ca/products/tin', 30,  true,  'shop_check', 'medium', now() - interval '1 hour', null),
  ('k3', 'Old', 'EN', 'tin',         'b.example.ca', 'Shop B', 'bc', 'https://b.example.ca/products/old', 30,  true,  'shop_check', 'medium', now() - interval '8 days', null),
  ('k4', 'Reported', 'EN', 'etb',    'c.example.ca', 'Shop C', 'bc', 'https://c.example.ca/products/etb', 60,  true,  'member_report', 'medium', now(), '111');

set role anon;
do $$
declare f jsonb := public.restock_feed();
begin
  if jsonb_array_length(f->'items') <> 2 then raise exception 'expected 2 items: %', f; end if;
  if f->'items'->0->>'name' <> 'Tin' or f->'items'->1->>'name' <> 'Box' then raise exception 'wrong order: %', f; end if;
  if f->'items'->1->>'product' <> 'k1' then raise exception 'missing product key: %', f; end if;
  if (f->'items'->1->>'in_stock')::boolean or (f->'items'->1->>'price_cad')::numeric <> 210 then raise exception 'not the newest sighting: %', f; end if;
  if f->>'shops_checked' <> '1' or (f->>'checked_at')::timestamptz < now() - interval '6 minutes'
     or (f->>'checked_at')::timestamptz > now() - interval '4 minutes' then raise exception 'wrong check status: %', f; end if;
  if f::text ~ '(reporter|111|member_report|Reported)' then raise exception 'private data returned: %', f; end if;
end $$;
-- The function is the only way in.
do $$ begin
  if exists (select 1 from public.drop_events) then raise exception 'anon can read the events table'; end if;
exception when insufficient_privilege then null;
end $$;
reset role;
select 'PASS public restock feed' as result;
