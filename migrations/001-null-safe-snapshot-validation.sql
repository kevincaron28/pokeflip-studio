-- 001: make snapshot validation NULL-safe (found in finish-line audit, 2026-11-22).
-- BEFORE: a payload such as '{}' passed validation because NULL <> '5' is NULL, not true.
-- Run ONLY in the dedicated PokéFlip Supabase project, after owner review.
-- Safe to re-run; CREATE OR REPLACE keeps the existing owner and grants, which are re-stated below.
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
