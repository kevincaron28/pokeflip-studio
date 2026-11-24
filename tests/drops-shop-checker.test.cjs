// Server shop checker (supabase/functions/shop-checker): matching, change detection, confirmation, politeness.
const {test}=require('node:test');const assert=require('node:assert/strict');
const load=async()=>({M:await import('../supabase/functions/_shared/drop-match.mjs'),C:await import('../supabase/functions/_shared/shop-checker.mjs'),B:await import('../tools/build-drop-sources.mjs')});
const R=require('../canada-retailers.js');

test('titles from Canadian shops: one set, one size, one language, or nothing',async()=>{
 const {M,B}=await load();const SETP=M.setPhrases(B.catalogueFile().sets.map(s=>s.name).concat(R.SETS));
 const p=t=>{const x=M.parseTitle(t,SETP);return x&&[x.setPhrase,x.kind,x.lang,x.variant].filter(Boolean).join('|')};
 assert.equal(p('Pokémon - Mega Evolution - Delta Reign - ETB LIMIT OF 2'),'delta reign|etb|EN');
 assert.equal(p('ME06 - Delta Reign - Booster Box FRENCH'),'delta reign|box|FR');
 assert.equal(p('Pokemon Perfect Order - Pokémon Center Elite Trainer Box'),'perfect order|etb-pc|EN');
 assert.equal(p('Pokemon - Mega Evolution - Pitch Black - Booster Bundle'),'pitch black|bundle|EN','era name dropped when a set is named');
 assert.equal(p('Pokemon Mega Evolution Booster Bundle'),'mega evolution|bundle|EN','the Mega Evolution set itself');
 for(const t of ['Pokémon - Mega Evolutions - Ascended Heroes - Booster Bundle Case (25 Ct)','Pokemon Flowing Fists - Sleeved Booster Pack Bundle of 24 (Pre-Order)',
  'Pokemon Ascended Heroes Tin - Bundle of 3','2024 POKEMON SVP EN-SV BLACK STAR PROMO #159 MAGNETON SURGING SPARKS ETB','Pokemon Scarlet & Violet Charizard ex Special Collection',
  'Pokemon 30th Celebration Ultra-Premium Collection - Playmat (Day)','Pokemon 30th Celebration - Mini Tin Display (Day & Night)'])assert.equal(M.parseTitle(t,SETP),null,t);
 assert.equal(p('Delta Reign 3 Pack Blister'),'delta reign|blister|EN|3-pack');
 assert.equal(p('Pokemon Vivid Voltage - Checklane Blister (Grookey)'),'vivid voltage|blister|EN|checklane-grookey');
});
test('the server matcher reads titles like the app matcher',async()=>{
 const {M}=await load();const SETP=M.setPhrases(R.SETS);
 for(const t of ['Pokémon - Mega Evolution - Delta Reign - ETB LIMIT OF 2','Pokemon Perfect Order - Pokémon Center Elite Trainer Box','ME06 - Delta Reign - Booster Box FRENCH','Pokemon Scarlet & Violet SV8.5 Prismatic Evolutions - Elite Trainer Box','Booster Box (36 Packs)','Ascended Heroes Tin - Bundle of 3']){
  assert.equal(M.kindOf(t),R.kindOf(t),t);assert.equal(String(M.langOf(t)),String(R.langOf(t)),t);assert.equal(JSON.stringify(M.setsIn(t,SETP)),JSON.stringify(R.setsIn(t)),t)}
});
const catalogue={asOf:'2026-11-23',fx:{usdToCad:1.4325},extraSets:[],sets:[{name:'Delta Reign',slug:'delta-reign',asOf:'2026-11-23',products:[{kind:'box',id:712094,marketCad:277.91,image:'https://tcgplayer-cdn.tcgplayer.com/product/712094_200w.jpg'},{kind:'etb',id:712102,marketCad:107.05}]}]};
const prod=(handle,title,available,price)=>({handle,title,updated_at:'2026-11-24T14:00:00-05:00',variants:[{id:1,title:'Default Title',available,price:String(price),sku:'0196214165854',updated_at:'2026-11-24T14:00:00-05:00'}]});
function fakeStore(){const s={states:new Map(),stock:new Map(),events:[]};return {s,
 shopStates:async()=>[...s.states.values()],saveShopState:async r=>{s.states.set(r.host,{...(s.states.get(r.host)||{}),...r})},
 shopStock:async h=>[...s.stock.values()].filter(r=>r.store_key===h),saveShopStock:async rows=>{for(const r of rows)s.stock.set(r.store_key+'|'+r.product_key+'|'+r.handle,r)},
 insertEvent:async e=>{if(!s.events.some(x=>x.event_key===e.event_key))s.events.push(e)}}}
const ETAG='W/"e1"';
function fakeShop(products,{status=200,confirm=true}={}){const calls=[];return {calls,fetch:async(url,opts)=>{calls.push([url,(opts&&opts.headers)||{}]);
 if(/\.js$/.test(url))return {ok:true,status:200,json:async()=>({variants:[{available:confirm}]})};
 return {ok:status===200,status,headers:{get:k=>k==='etag'?ETAG:null},json:async()=>({products:products()})}}}}
const shop={host:'hastycards.com',name:'Hasty Cards',city:'Toronto',region:'gta'};
test('first read is quiet; a confirmed restock becomes one drop event with detection lag data',async()=>{
 const {C}=await load();const store=fakeStore();let inStock=false,t=Date.parse('2026-11-24T19:00:00Z');
 const products=()=>[prod('dr-box','Pokémon - Mega Evolution - Delta Reign - Booster Box LIMIT OF 2',inStock,279.99),prod('dr-etb','Pokémon - Mega Evolution - Delta Reign - ETB',true,109.99)];
 const f=fakeShop(products);const run=()=>C.runPass({store,fetch:f.fetch,now:()=>t,shops:[shop],catalogue});
 let r=await run();assert.equal(r.read,1);assert.equal(store.s.events.length,0,'first read records stock, no alerts');
 assert.match(f.calls[0][1]['user-agent'],/^Cardstead-stock-check\/1\.0 \(\+https:/);
 inStock=true;t+=5*60000;r=await run();
 assert.equal(store.s.events.length,1);const e=store.s.events[0];
 assert.equal(e.product_key,'delta-reign|box|EN');assert.equal(e.product_kind,'booster_box');assert.equal(e.store_key,'hastycards.com');assert.equal(e.region,'on-gta');
 assert.equal(e.in_stock,true);assert.equal(e.price_cad,279.99);assert.equal(e.market_cad,277.91);assert.equal(e.confidence,'medium');assert.equal(e.matched_by,'title');
 assert.equal(e.source,'shop_check');assert.equal(e.product_upc,'196214165854');assert.equal(e.source_updated_at,'2026-11-24T19:00:00.000Z');
 assert.match(e.event_key,/^hastycards\.com\|delta-reign\|box\|EN\|true\|2026-11-24T19$/);
 assert.ok(f.calls.some(c=>/\/products\/dr-box\.js$/.test(c[0])),'confirmed on the product page');
 assert.equal(f.calls.filter(c=>/products\.json/.test(c[0]))[1][1]['if-none-match'],ETAG,'ETag sent');
 t+=60000;r=await run();assert.equal(r.shops,0,'not read again within 4 minutes');
 inStock=false;t+=5*60000;await run();assert.equal(store.s.events.length,2);assert.equal(store.s.events[1].in_stock,false,'sold out is reported too');
});
test('an unconfirmed restock is not reported and is looked at again next pass',async()=>{
 const {C}=await load();const store=fakeStore();let inStock=false,t=Date.parse('2026-11-24T19:00:00Z');
 const f=fakeShop(()=>[prod('dr-box','Delta Reign Booster Box',inStock,279.99)],{confirm:false});
 await C.runPass({store,fetch:f.fetch,now:()=>t,shops:[shop],catalogue});inStock=true;t+=5*60000;
 await C.runPass({store,fetch:f.fetch,now:()=>t,shops:[shop],catalogue});assert.equal(store.s.events.length,0);
 assert.equal([...store.s.stock.values()][0].in_stock,false,'old state kept');
});
test('prices far from the market value are another product; refusals back off',async()=>{
 const {C}=await load();const store=fakeStore();const t=Date.parse('2026-11-24T19:00:00Z');
 const {changes}=C.diffShop({shop,products:[prod('x','Delta Reign Booster Box',true,7.99),prod('y','Delta Reign Booster Box',true,1999.99)],before:new Map(),index:C.catalogueIndex(catalogue),now:t});
 assert.equal(changes.length,0);
 const f=fakeShop(()=>[],{status:429});const r=await C.runPass({store,fetch:f.fetch,now:()=>t,shops:[shop],catalogue});
 assert.equal(r.refused,1);assert.ok(Date.parse(store.s.states.get('hastycards.com').backoff_until)>=t+30*60000);
});
test('shop list: every host is an allow-listed Shopify shop or a checked chain; catalogue in CAD',async()=>{
 const {B}=await load();const sh=B.shopsFile();const S=require('../canada-shops.js');
 assert.ok(sh.shops.length>=S.SHOPS.length+2);
 for(const s of sh.shops)assert.ok(R.AUTO_HOSTS.includes(s.host)||['www.mastermindtoys.com','www.indigo.ca'].includes(s.host),s.host);
 const c=B.catalogueFile();const dr=c.sets.find(s=>s.name==='Delta Reign');assert.ok(dr.products.find(p=>p.kind==='box').marketCad>100);
 const committed=require('../supabase/functions/_shared/drop-shops.json');assert.equal(committed.shops.length,sh.shops.length,'drop-shops.json is up to date: run node tools/build-drop-sources.mjs');
});
