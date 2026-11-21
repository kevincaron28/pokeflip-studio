const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const sql=fs.readFileSync(__dirname+'/../cloud-schema.sql','utf8');
test('cloud SQL excludes direct browser write grants',()=>{
 assert.match(sql,/grant select on public\.pokeflip_snapshots to authenticated/i);
 assert.doesNotMatch(sql,/grant\s+(?:select,)?insert(?:,update)? on public\.pokeflip_snapshots to authenticated/i);
 assert.match(sql,/revoke all on public\.pokeflip_snapshots from public, anon, authenticated/i);
});
test('atomic writer is private and the public RPC is invoker-only',()=>{
 assert.match(sql,/function pokeflip_private\.save_snapshot\(expected_revision bigint,next_payload jsonb\)[\s\S]*?security definer set search_path = ''/i);
 assert.match(sql,/create or replace function public\.pokeflip_save_snapshot\(expected_revision bigint,next_payload jsonb\)[\s\S]*?security invoker set search_path = ''/i);
 assert.match(sql,/revoke all on function pokeflip_private\.save_snapshot\(bigint,jsonb\) from public,anon/i);
 assert.match(sql,/revoke all on function public\.pokeflip_save_snapshot\(bigint,jsonb\) from public,anon/i);
 assert.match(sql,/grant execute on function public\.pokeflip_save_snapshot\(bigint,jsonb\) to authenticated/i);
});
test('internal snapshot writer only modifies authenticated owner at exact revision',()=>{
 assert.match(sql,/actor := auth\.uid\(\)/i);
 assert.match(sql,/where user_id = actor and revision = expected_revision/i);
 assert.match(sql,/new_rev is null then raise exception 'SYNC_CONFLICT/i);
 assert.doesNotMatch(sql,/next_payload->>'user_id'/i);
});
