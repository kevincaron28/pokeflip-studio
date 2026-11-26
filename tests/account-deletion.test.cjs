const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
require('../cloud-sync.js');const core=globalThis.PokeFlipCloudCore;
const sql=read('migrations/007-delete-account.sql');

test('the app shows the privacy policy and an account deletion button (Google Play requirements)',()=>{
 const html=read('index.html');
 assert.match(html,/id="accountDelete"/);assert.match(html,/href="https:\/\/pokeflip-studio\.vercel\.app\/privacy\.html" data-privacy=""/);
 assert.match(html,/class="footer-link"[^>]*data-privacy/);
 const page=read('privacy.html');for(const id of ['delete','supprimer','fr'])assert.ok(page.includes('id="'+id+'"'),id);
});

test('privacy links follow the language and the deletion section',()=>{
 assert.equal(core.privacyUrl('en',''),'https://pokeflip-studio.vercel.app/privacy.html');
 assert.equal(core.privacyUrl('fr',''),'https://pokeflip-studio.vercel.app/privacy.html#fr');
 assert.equal(core.privacyUrl('en','delete'),'https://pokeflip-studio.vercel.app/privacy.html#delete');
 assert.equal(core.privacyUrl('fr','delete'),'https://pokeflip-studio.vercel.app/privacy.html#supprimer');
});

test('a database without the deletion function is recognised, other errors are not',()=>{
 assert.ok(core.deletionMissing({code:'PGRST202',message:'x'}));
 assert.ok(core.deletionMissing({message:'Could not find the function public.pokeflip_delete_account'}));
 assert.ok(!core.deletionMissing({message:'Sign in first'}));assert.ok(!core.deletionMissing(null));
});

test('only the signed-in caller can be deleted, and only through the private definer function',()=>{
 assert.match(sql,/function pokeflip_private\.delete_account\(\) returns boolean\s+language plpgsql security definer set search_path = ''/);
 assert.match(sql,/actor := auth\.uid\(\);\s+if actor is null then raise exception 'Sign in first'/);
 assert.match(sql,/delete from auth\.users where id = actor;/);
 assert.equal(sql.match(/delete from auth\.users/g).length,1);
 assert.match(sql,/function public\.pokeflip_delete_account\(\) returns boolean\s+language sql security invoker set search_path = ''/);
 for(const f of ['pokeflip_private.delete_account()','public.pokeflip_delete_account()']){
  assert.ok(sql.includes('revoke all on function '+f+' from public, anon;'),f);
  assert.ok(sql.includes('grant execute on function '+f+' to authenticated;'),f);
 }
 assert.doesNotMatch(sql,/disable row level security/i);
});

test('every table keyed to a member is removed with the account',()=>{
 const all=['cloud-schema.sql',...fs.readdirSync(path.join(__dirname,'..','migrations')).map(f=>'migrations/'+f)].map(read).join('\n');
 const refs=all.match(/references auth\.users\(id\)[^,\n]*/g);assert.ok(refs.length>=3);
 for(const r of refs)assert.match(r,/on delete cascade/);
});
