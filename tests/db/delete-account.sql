-- Deleting an account on a real database: only the caller goes, with everything keyed to them.
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');
insert into public.pokeflip_snapshots (user_id, payload) select id, '{}'::jsonb from auth.users;
insert into public.push_subscriptions (user_id, kind, endpoint) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'fcm', 'fcm:aaaaaaaaaaaaaaaaaaaaaaaa'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'fcm', 'fcm:bbbbbbbbbbbbbbbbbbbbbbbb');
insert into public.push_deliveries (subscription_id, dedupe_key) select id, 'k' from public.push_subscriptions;
insert into public.discord_links (user_id, discord_user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '111'), ('bbbbbbbb-0000-0000-0000-000000000002', '222');
insert into public.discord_link_codes (code, discord_user_id, expires_at) values ('ABCD2345', '111', now() + interval '1 hour');
insert into public.discord_reporters (discord_user_id) values ('111'), ('222');
insert into public.discord_posts (id, key, channel_id, message_id, state, posted_at, last_seen_at, first_seen_at, store_name, reporter_id, event)
values ('11111111-1111-1111-1111-111111111111', 'p1', 'c', 'm', 'live', now(), now(), now(), 'Shop', '111', '{"reporter_id":"111","store_name":"Shop"}');
insert into public.discord_wasnt_there (post_id, discord_user_id) values
  ('11111111-1111-1111-1111-111111111111', '111'), ('11111111-1111-1111-1111-111111111111', '222');
insert into public.discord_reports (id, reporter_id, product_key, product_name, product_lang, product_kind, store_key, store_name, region, status, created_at, expires_at, confirmer_id)
values ('22222222-2222-2222-2222-222222222221', '111', 'k', 'n', 'EN', 'etb', 's', 'Shop', 'bc', 'confirmed', now(), now(), '222'),
       ('22222222-2222-2222-2222-222222222222', '222', 'k', 'n', 'EN', 'etb', 's', 'Shop', 'bc', 'confirmed', now(), now(), '111');
insert into public.drop_events (product_key, product_name, product_lang, product_kind, store_key, store_name, region, source, confidence, first_seen_at, reporter_id)
values ('k', 'n', 'EN', 'etb', 's', 'Shop', 'bc', 'member_report', 'medium', now(), '111');

-- A visitor without an account may not call it.
set role anon;
do $$ begin
  perform public.pokeflip_delete_account();
  raise exception 'anon was allowed to call the deletion';
exception when insufficient_privilege then null;
end $$;
reset role;

-- The role of a signed-in member but no identity: refused.
set role authenticated;
do $$ begin
  begin
    perform public.pokeflip_delete_account();
  exception when raise_exception then
    if sqlerrm = 'Sign in first' then return; end if;
    raise;
  end;
  raise exception 'deletion ran without an identity';
end $$;
reset role;
do $$ begin assert (select count(*) from auth.users) = 2, 'nothing deleted yet'; end $$;

-- Member A deletes their account.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
do $$ begin assert public.pokeflip_delete_account(), 'deletion returns true'; end $$;
reset role;

do $$ begin
  assert (select array_agg(email) from auth.users) = array['b@example.test'], 'only A is deleted';
  assert (select count(*) from public.pokeflip_snapshots) = 1, 'cloud backup of A gone, B kept';
  assert (select count(*) from public.push_subscriptions) = 1, 'push subscription of A gone';
  assert (select count(*) from public.push_deliveries) = 1, 'delivery log of A gone';
  assert (select array_agg(discord_user_id) from public.discord_links) = array['222'], 'link of A gone';
  assert not exists (select 1 from public.discord_link_codes where discord_user_id = '111'), 'codes gone';
  assert (select array_agg(discord_user_id) from public.discord_reporters) = array['222'], 'reporter score of A gone';
  assert (select array_agg(discord_user_id) from public.discord_wasnt_there) = array['222'], 'taps of A gone';
  assert (select array_agg(reporter_id) from public.discord_reports) = array['222'], 'reports of A gone, B kept';
  assert (select confirmer_id from public.discord_reports) is null, 'A removed as confirmer';
  assert (select reporter_id is null and not (event ? 'reporter_id') and event->>'store_name' = 'Shop' from public.discord_posts), 'post kept without A';
  assert (select count(*) = 1 and bool_and(reporter_id is null) from public.drop_events), 'drop kept without A';
end $$;

-- Member B, without a Discord link, can delete too.
delete from public.discord_links;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000002', false);
set role authenticated;
do $$ begin assert public.pokeflip_delete_account(), 'deletion without Discord'; end $$;
reset role;
do $$ begin
  assert (select count(*) from auth.users) = 0 and (select count(*) from public.pokeflip_snapshots) = 0, 'B gone';
  assert (select count(*) from public.discord_reporters where discord_user_id = '222') = 1, 'unlinked Discord rows are not touched';
end $$;
select 'PASS account deletion' as result;
