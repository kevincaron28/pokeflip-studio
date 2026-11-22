-- PokéFlip Studio: dedicated Supabase project only. NEVER run in another app's project.
-- Authoritative schema as deployed 2026-11-21. Authenticated clients can SELECT their
-- own snapshot and invoke a minimal SECURITY INVOKER wrapper; guarded privileged writes
-- reside in a non-exposed internal schema, never in the public API schema.
create table if not exists public.pokeflip_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint pokeflip_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint pokeflip_payload_limit check (octet_length(payload::text) <= 4000000)
);
alter table public.pokeflip_snapshots enable row level security;
revoke all on public.pokeflip_snapshots from public, anon, authenticated;
grant select on public.pokeflip_snapshots to authenticated;
drop policy if exists pokeflip_owner_select on public.pokeflip_snapshots;
drop policy if exists pokeflip_owner_insert on public.pokeflip_snapshots;
drop policy if exists pokeflip_owner_update on public.pokeflip_snapshots;
create policy pokeflip_owner_select on public.pokeflip_snapshots
 for select to authenticated using (user_id = (select auth.uid()));

create schema if not exists pokeflip_private;
revoke all on schema pokeflip_private from public, anon;
grant usage on schema pokeflip_private to authenticated;
-- Internal writer is not exposed via PostgREST; no dynamic SQL or user-controlled owner.
create or replace function pokeflip_private.save_snapshot(expected_revision bigint,next_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare new_rev bigint; actor uuid;
begin
 actor := auth.uid();
 if actor is null then raise exception 'Sign in first'; end if;
 -- Every check is NULL-safe: a missing key must fail validation, never skip it
 -- (e.g. NULL <> '5' is NULL, which would let '{}' through an OR chain).
 if expected_revision is null or expected_revision < 0 or next_payload is null or
    not (
      jsonb_typeof(next_payload) = 'object' and
      octet_length(next_payload::text) <= 4000000 and
      coalesce(next_payload->>'schema','') = '5' and
      coalesce(jsonb_typeof(next_payload->'ledger'),'') = 'object' and
      coalesce(jsonb_typeof(next_payload->'portfolioHistory'),'') = 'array' and
      coalesce(jsonb_typeof(next_payload->'ebayComparables'),'') = 'array' and
      coalesce(jsonb_typeof(next_payload->'sealedObservations'),'') = 'array' and
      coalesce(jsonb_typeof(next_payload->'alertHub'),'') = 'array' and
      coalesce(jsonb_typeof(next_payload->'restockWatch'),'') = 'object'
    )
 then raise exception 'Invalid snapshot'; end if;
 if expected_revision = 0 then
  insert into public.pokeflip_snapshots(user_id,revision,payload)
  values(actor,1,next_payload)
  on conflict(user_id) do nothing
  returning revision into new_rev;
 else
  update public.pokeflip_snapshots
  set revision = revision + 1, payload=next_payload, updated_at=now()
  where user_id = actor and revision = expected_revision
  returning revision into new_rev;
 end if;
 if new_rev is null then raise exception 'SYNC_CONFLICT: cloud changed; download and reconcile first'; end if;
 return new_rev;
end; $$;
revoke all on function pokeflip_private.save_snapshot(bigint,jsonb) from public,anon;
grant execute on function pokeflip_private.save_snapshot(bigint,jsonb) to authenticated;

-- Public RPC is deliberately unprivileged. Its sole operation is calling the internal
-- writer; it cannot bypass table permissions or accept a user_id from the client.
create or replace function public.pokeflip_save_snapshot(expected_revision bigint,next_payload jsonb)
returns bigint language sql security invoker set search_path = '' as $$
 select pokeflip_private.save_snapshot(expected_revision,next_payload);
$$;
revoke all on function public.pokeflip_save_snapshot(bigint,jsonb) from public,anon;
grant execute on function public.pokeflip_save_snapshot(bigint,jsonb) to authenticated;
