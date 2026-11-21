-- PokéFlip cloud v2: deploy ONLY to a dedicated new Supabase project.
-- Authenticated users can SELECT only their own snapshot. All writes are an atomic RPC.
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

-- SECURITY DEFINER is intentionally used ONLY for this narrow, guarded atomic write.
-- No dynamic SQL; fixed qualified table; authenticated ownership from auth.uid().
create or replace function public.pokeflip_save_snapshot(expected_revision bigint, next_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare new_rev bigint; actor uuid;
begin
 actor := auth.uid();
 if actor is null then raise exception 'Sign in first'; end if;
 if expected_revision is null or expected_revision < 0 or
    next_payload is null or jsonb_typeof(next_payload) <> 'object' or
    octet_length(next_payload::text) > 4000000 or
    next_payload->>'schema' <> '5' or
    jsonb_typeof(next_payload->'ledger') <> 'object' or
    jsonb_typeof(next_payload->'portfolioHistory') <> 'array' or
    jsonb_typeof(next_payload->'ebayComparables') <> 'array' or
    jsonb_typeof(next_payload->'sealedObservations') <> 'array' or
    jsonb_typeof(next_payload->'alertHub') <> 'array' or
    jsonb_typeof(next_payload->'restockWatch') <> 'object'
 then raise exception 'Invalid snapshot'; end if;
 if expected_revision = 0 then
  insert into public.pokeflip_snapshots(user_id, revision, payload)
  values (actor, 1, next_payload)
  on conflict (user_id) do nothing
  returning revision into new_rev;
 else
  update public.pokeflip_snapshots
  set revision = revision + 1, payload = next_payload, updated_at = now()
  where user_id = actor and revision = expected_revision
  returning revision into new_rev;
 end if;
 if new_rev is null then raise exception 'SYNC_CONFLICT: cloud changed; download and reconcile first'; end if;
 return new_rev;
end;$$;
revoke all on function public.pokeflip_save_snapshot(bigint,jsonb) from public,anon;
grant execute on function public.pokeflip_save_snapshot(bigint,jsonb) to authenticated;