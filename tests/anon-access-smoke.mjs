// Regression check: a public visitor must not read or write another user's cloud data.
// Uses the FRONTEND PUBLISHABLE key only. Does not log in or create records.
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../cloud-sync.js',import.meta.url),'utf8');
const match=js.match(/const DEFAULT_CONFIG=\{url:'([^']+)',key:'([^']+)'\}/);
if(!match)throw Error('Cloud public configuration missing');
const [,base,key]=match;
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)||!key.startsWith('sb_publishable_'))throw Error('Unsafe cloud configuration');
async function probe(path,init={}){
  const res=await fetch(base+path,{...init,signal:AbortSignal.timeout(20000),headers:{apikey:key,...init.headers}});
  let body=await res.text();
  if(![401,403].includes(res.status))throw Error('Anonymous access was not rejected: '+path+' HTTP '+res.status+' '+body.slice(0,220));
  return res.status;
}
const select=await probe('/rest/v1/pokeflip_snapshots?select=user_id&limit=1');
const rpc=await probe('/rest/v1/rpc/pokeflip_save_snapshot',{
 method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({expected_revision:0,next_payload:{}})
});
console.log('PASS: anonymous SELECT denied (HTTP '+select+') and snapshot-save RPC denied (HTTP '+rpc+')');
