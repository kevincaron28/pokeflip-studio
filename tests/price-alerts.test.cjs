'use strict';
// Price alerts while the app is closed: which saved cards can be priced, when a member is told, and only once.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const M=()=>import('../supabase/functions/_shared/price-alerts.mjs');
const card=(o={})=>({id:'i1',name:'Bagon',number:'1/10',lang:'en',grade:'raw',condition:'Near Mint',tcgplayerId:83694,tcgGroup:7,tcgPrint:'Holofoil',target:5,...o});

test('only exactly matched cards are priced: ungraded, English, Near Mint, from a set page, with a target',async()=>{
  const {eligible,priceCad}=await M();
  assert.equal(eligible(card()),true);
  for(const o of [{lang:'fr'},{grade:'PSA 10'},{condition:'Damaged'},{archived:true},{category:'review'},{idCode:'sv1-1'},{tcgplayerId:undefined},{tcgGroup:'7'},{tcgPrint:undefined},{target:null},{target:0},{id:5}])assert.equal(eligible(card(o)),false,JSON.stringify(o));
  const set={cards:[[83694,'Bagon','1/10','Common',{Holofoil:3},{Holofoil:1,Normal:1}]]};
  assert.equal(priceCad(set,card(),1.4),4.2);
  assert.equal(priceCad(set,card({tcgPrint:'Normal'}),1.4),null,'asking price only: no alert');
  assert.equal(priceCad(set,card({tcgplayerId:1}),1.4),null);assert.equal(priceCad(null,card(),1.4),null);assert.equal(priceCad(set,card(),0),null);
});

test('the notification names the cards, prices, targets and the date, in the member\'s language',async()=>{
  const {priceMessage}=await M(),site='https://example.test/';
  const hit=(n,cad)=>({item:card({name:n}),cad});
  const one=priceMessage([hit('Bagon',4.2)],'en',Date.parse('2026-11-26T13:00:00Z'),site);
  assert.equal(one.title,'Target price reached: Bagon 1/10');
  assert.equal(one.body,'Bagon 1/10: $4.20 (target $5.00) · TCGplayer market price, Nov 26');
  assert.equal(one.url,site+'#/watchlist');
  const many=priceMessage([1,2,3,4,5].map(n=>hit('C'+n,1)),'fr',Date.parse('2026-11-26T13:00:00Z'),site);
  assert.equal(many.title,'5 cartes à ton prix cible');assert.match(many.body,/et 2 de plus · prix du marché TCGplayer du 26 nov\./);
});

test('a member who asked is told once per card and target, again only after the price went back up',async()=>{
  const {runPriceAlerts}=await M(),site='https://example.test/';
  let usd=3,t=Date.parse('2026-11-26T15:00:00Z'),asOf='2026-11-26T13:00:00Z';
  const subs=[{id:'s1',user_id:'u1',prefs:{priceAlerts:true},lang:'en'},{id:'s2',user_id:'u1',prefs:{},lang:'en'},{id:'s3',user_id:'u2',prefs:{priceAlerts:true},lang:'fr'}];
  const del=new Map(),sent=[],asked=[],removed=[];
  const store={subscriptions:async()=>subs.filter(s=>!removed.includes(s.id)),watchlists:async ids=>{asked.push(ids);return [{user_id:'u1',items:[card(),card({id:'i2',lang:'fr'})]},{user_id:'u2',items:[card({target:1})]}]},
    lastDelivery:async(s,k)=>del.get(s+k)||null,recordDelivery:async(s,k,at)=>del.set(s+k,at),removeDelivery:async(s,k)=>del.delete(s+k),removeSubscription:async s=>removed.push(s)};
  const getJson=async u=>u.endsWith('index.json')?{asOf}:u.endsWith('drop-catalogue.json')?{fx:{usdToCad:1.4}}:{cards:[[83694,'Bagon','1/10','Common',{Holofoil:usd}]]};
  const run=()=>runPriceAlerts({store,getJson,now:()=>t,site,send:async(s,p)=>{sent.push([s.id,p.title]);return {ok:true}}});
  let r=await run();
  assert.deepEqual(sent,[['s1','Target price reached: Bagon 1/10']]);assert.deepEqual(asked[0],['u1','u2']);assert.equal(r.sent,1);
  r=await run();assert.equal(r.sent,0,'not twice');
  usd=9;await run();assert.equal(del.size,0,'back above the target: forgotten');
  usd=3;r=await run();assert.equal(r.sent,1,'told again');
  asOf='2026-11-20T13:00:00Z';usd=0.5;r=await run();assert.equal(r.stale,true);assert.equal(r.sent,0,'old prices wake nobody');
  asOf='2026-11-26T13:00:00Z';
  r=await runPriceAlerts({store,getJson,now:()=>t,site,send:async()=>({ok:false,gone:true})});assert.equal(r.removed,1);assert.deepEqual(removed,['s3']);
  subs.length=0;asked.length=0;r=await run();assert.equal(asked.length,0,'nobody asked: no backup is read');
});

test('the sender runs it as its own daily task, and only server callers get that far',()=>{
  const src=fs.readFileSync('supabase/functions/push-sender/index.ts','utf8');
  assert.ok(src.indexOf('isServiceRole(')<src.indexOf("'prices'"));
  assert.match(src,/runPriceAlerts/);
});
