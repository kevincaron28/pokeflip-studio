// Drop alerts by Web Push: who gets a drop, what it says, cooldown, dead subscriptions, keys and the public config.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const P=()=>import('../supabase/functions/_shared/push-core.mjs');
const ev=(o={})=>({id:'e1',product_key:'delta-reign|box|EN',product_name:'Delta Reign Booster Box',product_lang:'EN',product_kind:'booster_box',store_key:'hastycards.com',store_name:'Hasty Cards',city:'Toronto',region:'on-gta',chain_key:null,url:'https://hastycards.com/products/dr-box',price_cad:279.99,market_cad:277.91,seller:'store',in_stock:true,confidence:'medium',...o});

test('who gets a drop: in stock, not low confidence, not marketplace, in your area, at a good price',async()=>{
 const {matches}=await P();
 assert.equal(matches(ev(),{regions:['on-gta','online-canada']}),true);
 assert.equal(matches(ev(),{regions:['qc-montreal']}),false,'other region');
 assert.equal(matches(ev({chain_key:'walmart',region:null}),{regions:['qc-montreal']}),true,'chains follow the chains switch, not regions');
 assert.equal(matches(ev({chain_key:'walmart',region:null}),{chains:false}),false);
 assert.equal(matches(ev({in_stock:false}),{}),false);assert.equal(matches(ev({confidence:'low'}),{}),false);assert.equal(matches(ev({seller:'marketplace'}),{}),false);
 assert.equal(matches(ev({price_cad:320}),{}),false,'over market + 10% by default');
 assert.equal(matches(ev({price_cad:320}),{goodPriceOnly:false}),true);
 assert.equal(matches(ev(),{kinds:['etb']}),false);assert.equal(matches(ev(),{langs:['FR']}),false);
});
test('the notification says what, where, price and verdict, in the member\'s language',async()=>{
 const {message}=await P();
 const en=message(ev({price_cad:249.99}),'en');assert.match(en.title,/^In stock: Delta Reign Booster Box/);assert.match(en.body,/Hasty Cards, Toronto · \$249\.99 · 10% under market · check before you go/);
 assert.equal(en.url,'https://hastycards.com/products/dr-box');assert.equal(en.tag,'hastycards.com|delta-reign|box|EN');
 const fr=message(ev(),'fr');assert.match(fr.title,/^En stock : /);assert.match(fr.body,/prix du marché/);
});
test('one push per member per product at a store per 30 minutes; dead subscriptions are removed',async()=>{
 const {runPush}=await P();let t=Date.parse('2026-11-24T20:00:00Z');
 const subs=[{id:'s1',prefs:{regions:['on-gta']},lang:'en'},{id:'s2',prefs:{regions:['qc-montreal']},lang:'fr'},{id:'s3',prefs:{},lang:'en'}];
 const del=new Map(),marked=[],removed=[],sent=[];let pending=[ev()];
 const store={pendingEvents:async()=>pending,subscriptions:async()=>subs.filter(s=>!removed.includes(s.id)),lastDelivery:async(id,k)=>del.get(id+k)||null,
  recordDelivery:async(id,k,at)=>del.set(id+k,at),markEvent:async(id)=>marked.push(id),removeSubscription:async id=>removed.push(id)};
 const send=async(sub,payload)=>{sent.push([sub.id,payload.title]);return sub.id==='s3'?{ok:false,gone:true}:{ok:true}};
 let r=await runPush({store,send,now:()=>t});assert.equal(r.sent,1);assert.deepEqual(sent.map(x=>x[0]),['s1','s3']);assert.deepEqual(removed,['s3']);assert.deepEqual(marked,['e1']);
 pending=[ev({id:'e2'})];t+=10*60000;r=await runPush({store,send,now:()=>t});assert.equal(r.sent,0);assert.equal(r.skipped,1,'cooldown');
 pending=[ev({id:'e3'})];t+=25*60000;r=await runPush({store,send,now:()=>t});assert.equal(r.sent,1,'after 30 minutes');
});
test('VAPID keys: the public key is a 65-byte P-256 point; /api/config gives the public key only',async()=>{
 const {vapidKeys}=await import('../tools/make-vapid-keys.mjs');const k=vapidKeys();
 assert.equal(Buffer.from(k.publicKey,'base64url').length,65);assert.equal(Buffer.from(k.privateKey,'base64url').length,32);
 const C=require('../api/_config-core.js');assert.equal(C.config({VAPID_PUBLIC_KEY:k.publicKey}).vapidPublicKey,k.publicKey);assert.equal(C.config({VAPID_PUBLIC_KEY:'nope'}).vapidPublicKey,null);
 assert.ok(!JSON.stringify(C.config({VAPID_PUBLIC_KEY:k.publicKey,VAPID_PRIVATE_KEY:k.privateKey})).includes(k.privateKey),'private key never served');
 const W=require('../push-link.js');assert.equal(W.keyBytes(k.publicKey).length,65);
 assert.equal(JSON.stringify(W.prefsFor('QC')),JSON.stringify({regions:['qc-montreal','qc-quebec-regions','online-canada'],chains:true,goodPriceOnly:true,kinds:[],langs:[]}));
});
test('the service worker shows the drop and opens the store page; members reach their rows only through the RPCs',()=>{
 const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');assert.match(sw,/addEventListener\('push'/);assert.match(sw,/notificationclick[\s\S]*openWindow/);
 const sql=fs.readFileSync(path.join(__dirname,'..','migrations/004-push.sql'),'utf8');
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public\.%I from public, anon, authenticated/);
 assert.match(sql,/push_subscribe[\s\S]*auth\.uid\(\)/);assert.match(sql,/grant execute on function public\.%s to authenticated/);
});
