-- Cardstead drop alerts by push notification (Web Push). Run once in Supabase > SQL Editor, after 003-shop-checker.sql.
-- A signed-in member stores their browser's push subscription and alert preferences through the RPCs below;
-- the push-sender function (service role) reads drop_events and sends one notification per drop to matching members.
-- Tables: Row Level Security on and no policies; members only reach them through the security-definer RPCs.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) < 1000),
  p256dh text not null check (length(p256dh) between 40 and 200),
  auth text not null check (length(auth) between 10 and 100),
  prefs jsonb not null default '{}'::jsonb check (pg_column_size(prefs) < 4000),
  lang text not null default 'en' check (lang in ('en','fr')),
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fails int not null default 0
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

-- One push per member per product at a store per 30 minutes (the sender checks the time).
create table if not exists public.push_deliveries (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, dedupe_key)
);

alter table public.drop_events add column if not exists push_processed_at timestamptz;
create index if not exists drop_events_push_pending on public.drop_events (created_at) where push_processed_at is null;

do $$
declare t text;
begin
  foreach t in array array['push_subscriptions','push_deliveries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- Save (or move to this account) the browser's subscription with the member's preferences.
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_prefs jsonb, p_lang text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, prefs, lang)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, coalesce(p_prefs, '{}'::jsonb), coalesce(nullif(p_lang, ''), 'en'))
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth,
    prefs = excluded.prefs, lang = excluded.lang, fails = 0;
  return true;
end $$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  return found;
end $$;

-- How many devices this member has turned alerts on for.
create or replace function public.push_status()
returns int language sql security definer set search_path = '' as $$
  select count(*)::int from public.push_subscriptions where user_id = auth.uid();
$$;

do $$
declare f text;
begin
  foreach f in array array['push_subscribe(text,text,text,jsonb,text)','push_unsubscribe(text)','push_status()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
