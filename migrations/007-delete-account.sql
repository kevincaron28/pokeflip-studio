-- A signed-in member deletes their own account from the app (Google Play's account deletion requirement).
-- Run once in Supabase > SQL Editor, after 002-discord-drops.sql and 004-push.sql.
-- Deleting the auth user removes everything keyed to it by "on delete cascade": the cloud backup
-- (pokeflip_snapshots), drop-alert subscriptions and their delivery log, and the Discord link.
-- Rows kept under the linked Discord ID are removed or anonymised first, because nothing links them afterwards.
-- No user id is accepted from the client: the only account that can be deleted is the caller's.
create schema if not exists pokeflip_private;
grant usage on schema pokeflip_private to authenticated;

create or replace function pokeflip_private.delete_account() returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid; discord text;
begin
  actor := auth.uid();
  if actor is null then raise exception 'Sign in first'; end if;
  select l.discord_user_id into discord from public.discord_links l where l.user_id = actor;
  if discord is not null then
    delete from public.discord_link_codes where discord_user_id = discord;
    delete from public.discord_wasnt_there where discord_user_id = discord;
    delete from public.discord_reporters where discord_user_id = discord;
    delete from public.discord_reports where reporter_id = discord;
    update public.discord_reports set confirmer_id = null where confirmer_id = discord;
    update public.discord_posts set reporter_id = null, event = event - 'reporter_id' - 'reporterId' where reporter_id = discord;
    update public.drop_events set reporter_id = null where reporter_id = discord;
  end if;
  delete from auth.users where id = actor;
  return true;
end $$;
revoke all on function pokeflip_private.delete_account() from public, anon;
grant execute on function pokeflip_private.delete_account() to authenticated;

-- The public function is deliberately unprivileged: it only calls the function above.
create or replace function public.pokeflip_delete_account() returns boolean
language sql security invoker set search_path = '' as $$ select pokeflip_private.delete_account(); $$;
revoke all on function public.pokeflip_delete_account() from public, anon;
grant execute on function public.pokeflip_delete_account() to authenticated;
