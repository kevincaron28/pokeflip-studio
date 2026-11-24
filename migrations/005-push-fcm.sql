-- Cardstead drop alerts in the Android app (Firebase Cloud Messaging). Run once after 004-push.sql.
-- An app device is stored in push_subscriptions with kind 'fcm' and endpoint 'fcm:<device token>' (no Web Push keys).

alter table public.push_subscriptions add column if not exists kind text not null default 'webpush';
alter table public.push_subscriptions drop constraint if exists push_subscriptions_kind_check;
alter table public.push_subscriptions add constraint push_subscriptions_kind_check check (kind in ('webpush','fcm'));
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_check;
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_check
  check (length(endpoint) < 1000 and ((kind = 'webpush' and endpoint like 'https://%') or (kind = 'fcm' and endpoint like 'fcm:%')));
alter table public.push_subscriptions alter column p256dh drop not null, alter column auth drop not null;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_p256dh_check;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_auth_check;
alter table public.push_subscriptions add constraint push_subscriptions_keys_check
  check ((kind = 'fcm') or (length(p256dh) between 40 and 200 and length(auth) between 10 and 100));

-- Save (or move to this account) the app's device token with the member's preferences.
create or replace function public.push_subscribe_fcm(p_token text, p_prefs jsonb, p_lang text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_token is null or length(p_token) not between 20 and 500 or p_token !~ '^[A-Za-z0-9_:\-]+$' then raise exception 'invalid device token'; end if;
  insert into public.push_subscriptions (user_id, kind, endpoint, prefs, lang)
  values (auth.uid(), 'fcm', 'fcm:' || p_token, coalesce(p_prefs, '{}'::jsonb), coalesce(nullif(p_lang, ''), 'en'))
  on conflict (endpoint) do update set user_id = auth.uid(), prefs = excluded.prefs, lang = excluded.lang, fails = 0;
  return true;
end $$;
revoke all on function public.push_subscribe_fcm(text,jsonb,text) from public, anon;
grant execute on function public.push_subscribe_fcm(text,jsonb,text) to authenticated;
