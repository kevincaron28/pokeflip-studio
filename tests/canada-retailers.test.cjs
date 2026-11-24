const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');const R=require('../canada-retailers.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('catalogue covers the requested Canadian retailers, each with a usable search link',()=>{
 const names=R.RETAILERS.map(r=>r.name).join('|');
 for(const n of ['Costco','EB Games','Walmart','Best Buy','Toys','Amazon.ca','Indigo','London Drugs','Canadian Tire','Superstore','The Source','Shoppers'])assert.match(names,new RegExp(n.replace('"','.'),'i'),n);
 for(const r of R.RETAILERS){const u=new URL(R.searchUrl(r,'Prismatic Évolutions ETB & more'));assert.equal(u.protocol,'https:',r.id);assert.ok(!R.searchUrl(r,'x').includes('{q}'),r.id);assert.ok(['verified-2026-11-23','unverified','fallback'].includes(r.confidence),r.id)}
 assert.match(R.searchUrl(R.RETAILERS[0],'a b&c'),/a%20b%26c/);
});
test('only independent Shopify shops are automatic; every big chain is manual',()=>{
 for(const id of ['costco','ebgames','walmart','bestbuy','toysrus','amazon','indigo','londondrugs','canadiantire','superstore','thesource','shoppers','pokemoncenter'])assert.equal(R.RETAILERS.find(r=>r.id===id).auto,'manual',id);
 assert.ok(R.AUTO_HOSTS.length>=3);
});
test('shopifyJsUrl accepts allow-listed product URLs only',()=>{
 assert.equal(R.shopifyJsUrl('https://tistaminis.com/products/some-etb?variant=1'),'https://tistaminis.com/products/some-etb.js');
 assert.equal(R.shopifyJsUrl('https://doescards.ca/fr/products/boite.json'),'https://doescards.ca/products/boite.js');
 for(const bad of ['http://tistaminis.com/products/x','https://evil.example/products/x','https://tistaminis.com@evil.example/products/x','https://tistaminis.com/collections/pokemon','https://www.walmart.ca/en/ip/x','javascript:alert(1)','nonsense',''])assert.equal(R.shopifyJsUrl(bad),null,bad);
});
test('parseShopifyProduct reports availability and price honestly',()=>{
 assert.deepEqual(R.parseShopifyProduct({title:'ETB',variants:[{available:false,price:6999},{available:true,price:5499}]}),{status:'in',price:54.99,title:'ETB',variantId:null});
 assert.equal(R.parseShopifyProduct({title:'ETB',variants:[{available:false,price:6999}]}).status,'out');
 assert.equal(R.parseShopifyProduct({title:'x',variants:[{available:true,price:'54.99'}]}).price,54.99);
 for(const bad of [null,{},{variants:[]},{variants:[{available:true,price:'abc'}]}])assert.equal(R.parseShopifyProduct(bad),null);
});
test('polling interval is modest and CSP allows exactly the automatic hosts',()=>{
 assert.ok(R.MIN_POLL_MS>=15*60*1000);
 const csp=JSON.parse(read('vercel.json')).headers.flatMap(h=>h.headers).find(h=>h.key==='Content-Security-Policy').value;
 const connect=csp.match(/connect-src ([^;]+)/)[1].split(' ');
 for(const h of R.AUTO_HOSTS)assert.ok(connect.includes('https://'+h),h);
});
test('module is packaged, loaded before restock-watch, and polls only with safe fetch options',()=>{
 assert.ok(read('sw.js').includes("'./canada-retailers.js'"));
 const html=read('index.html');assert.ok(html.indexOf('canada-retailers.js')>0&&html.indexOf('canada-retailers.js')<html.indexOf('restock-watch.js'));
 const w=read('restock-watch.js');assert.match(w,/credentials:'omit'/);assert.match(w,/redirect:'error'/);assert.match(w,/document\.hidden/);
 assert.doesNotMatch(w,/captcha|proxy|rotate/i);
});
test('manual list includes Well.ca, Mastermind Toys and Pokémon Center merch',()=>{
 const ids=R.RETAILERS.map(r=>r.id);for(const id of ['wellca','mastermind','pokemoncenter-merch'])assert.ok(ids.includes(id),id);
 for(const id of ['wellca','mastermind','pokemoncenter-merch'])assert.equal(R.RETAILERS.find(r=>r.id===id).auto,'manual');
});
test('shop catalogue: valid hosts, unique, every region populated, Québec regions present',()=>{
 const S=require('../canada-shops.js');
 assert.ok(S.SHOPS.length>=3);const hosts=S.SHOPS.map(s=>s.host);assert.equal(new Set(hosts).size,hosts.length);
 for(const s of S.SHOPS){assert.match(s.host,/^[a-z0-9.-]+\.[a-z]{2,}$/);assert.ok(s.name&&s.city&&s.region,s.host);assert.ok(S.REGIONS.some(r=>r.id===s.region),s.host);assert.ok(R.AUTO_HOSTS.includes(s.host))}
 for(const r of S.REGIONS)assert.ok(S.inRegions([r.id]).length>=1,r.id);
 assert.ok(S.REGIONS.filter(r=>r.province==='QC').length>=2);
 assert.deepEqual(S.inRegions(['nope']),[]);
});
test('matchCatalog needs every distinctive word, never matches vague names, reports availability',()=>{
 const data={products:[
  {title:'Pokemon - Mega Evolution - Flowing Fist - Booster Bundle',handle:'a',variants:[{available:true,price:'54.99'}]},
  {title:'Pokémon Mega Evolution Flowing Fist Elite Trainer Box',handle:'b é',variants:[{available:false,price:'69.99'}]},
  {title:'Mega Evolution Phantasmal Flames Bundle',handle:'c',variants:[{available:true,price:'40.00'}]},
  {title:null,handle:'d',variants:[]}]};
 const m=R.matchCatalog('Mega Evolution Flowing Fist ETB bundle'.replace('ETB ',''),data,'shop.ca');
 assert.deepEqual(m.map(x=>x.handle),['a']);assert.equal(m[0].available,true);assert.equal(m[0].price,54.99);assert.equal(m[0].url,'https://shop.ca/products/a');
 assert.equal(R.matchCatalog('Mega Evolution Flowing Fist Elite Trainer',data,'shop.ca')[0].handle,'b é');
 assert.equal(R.matchCatalog('Pokemon TCG',data,'shop.ca').length,0);assert.equal(R.matchCatalog('Mega Evolution',null,'x').length,0);
});
test('regional polling is opt-in, throttled and never writes observations',()=>{
 const w=read('restock-watch.js');assert.match(w,/REGION_MIN_MS=30\*60\*1000/);assert.match(w,/REGION_MAX_SHOPS=30/);assert.match(w,/saveData/);
 const body=w.slice(w.indexOf('async function pollRegions'),w.indexOf('function init'));assert.doesNotMatch(body,/state\.observations/);assert.match(body,/credentials:'omit'/);
});
test('buyUrl builds checkout links without submitting anything and refuses unsafe targets',()=>{
 const H=R.AUTO_HOSTS[0];
 assert.equal(R.buyUrl({host:H,variantId:123,qty:2}),'https://'+H+'/cart/123:2');
 assert.equal(R.buyUrl({url:'https://'+H+'/products/x',variantId:123,qty:1}),'https://'+H+'/cart/123:1');
 assert.equal(R.buyUrl({host:'evil.example',variantId:123,qty:1}),null);                      // never builds cart links for non-allow-listed hosts
 assert.equal(R.buyUrl({url:'https://www.amazon.ca/Name/dp/B0ABCDEFGH/ref=x?tag=aff',qty:3}),'https://www.amazon.ca/gp/aws/cart/add.html?ASIN.1=B0ABCDEFGH&Quantity.1=3'); // no affiliate tag carried over
 assert.equal(R.buyUrl({url:'https://www.amazon.ca/s?k=pokemon',qty:1}),'https://www.amazon.ca/s?k=pokemon');
 assert.equal(R.buyUrl({url:'https://www.costco.ca/p.html',qty:1}),'https://www.costco.ca/p.html');
 for(const bad of [{url:'http://x.ca/p'},{url:'javascript:alert(1)'},{},null])assert.equal(R.buyUrl(bad),null);
 assert.equal(R.buyUrl({host:H,variantId:1.5,qty:1}),null);
});
test('quantity honours the shop limit and sane bounds',()=>{
 assert.equal(R.qtyFor({quantity:5,limit:2}),2);assert.equal(R.qtyFor({quantity:3}),3);assert.equal(R.qtyFor({}),1);assert.equal(R.qtyFor({quantity:500}),99);assert.equal(R.qtyFor({quantity:-4}),1);
});
test('parse and match carry the variant id of the cheapest available variant',()=>{
 assert.equal(R.parseShopifyProduct({title:'x',variants:[{id:1,available:false,price:100},{id:2,available:true,price:900},{id:3,available:true,price:500}]}).variantId,3);
 assert.equal(R.parseShopifyProduct({title:'x',variants:[{id:1,available:false,price:100}]}).variantId,null);
 assert.equal(R.matchCatalog('Mega Evolution Flowing Fist',{products:[{title:'Mega Evolution Flowing Fist Bundle',handle:'h',variants:[{id:77,available:true,price:'10.00'}]}]},'a.ca')[0].variantId,77);
});
test('no payment data is collected or stored; checkout stays on the shop page',()=>{
 const w=read('restock-watch.js'),h=read('index.html');
 assert.doesNotMatch(w,/card.?number|cvv|cvc|expiry|autocomplete=.cc-/i);assert.doesNotMatch(h.match(/<section id="restock"[\s\S]*?<\/section>/)[0],/cc-number|cardnumber|cvv/i);
 assert.match(h,/id="checkoutTips"/);assert.match(h,/never stores card numbers and never buys for you/);
 assert.doesNotMatch(w,/method\s*:\s*['"]POST['"]/);                                         // nothing submits an order
});
test('watch validation accepts quantity/limit/variantId only as sane integers',()=>{
 const fs2=require('node:fs'),vm=require('node:vm');const ctx={Intl,Date,JSON,Number,Array,Set,Error,URL};vm.runInNewContext(read('restock-watch.js'),ctx);
 const P=ctx.PokeFlipRestock;const w={id:'w',product:'Test product',format:'etb',language:'any',region:'Canada',ceiling:50,enabled:true};
 assert.equal(P.validateWatch({...w,quantity:2,limit:2}),true);
 for(const bad of [{quantity:0},{quantity:1.5},{quantity:100},{limit:0},{limit:'2'}])assert.throws(()=>P.validateWatch({...w,...bad}),Error);
 const o={id:'o',watchId:'w',status:'in',price:5,store:'s',source:'auto',checkedAt:new Date().toISOString()};
 assert.equal(P.validateObservation({...o,variantId:123}),true);assert.throws(()=>P.validateObservation({...o,variantId:-1}));assert.throws(()=>P.validateObservation({...o,variantId:'1'}));
});
// Real titles from Canadian Shopify shops, 24 Nov 2026. Before this change 13 of 22 matches were the wrong product.
test('matchCatalog: same set, same size, same language; ETB titles count; Pokémon Center ETB and cases are different products',()=>{
 const v=(price,extra={})=>[{id:1,available:true,price,...extra}];
 const data={products:[
  {title:'Pokémon Mega Evolution - Delta Reign Booster Bundle',handle:'dr-bundle',variants:v('54.99')},
  {title:'Pokemon - Mega Evolution - Pitch Black - Booster Bundle',handle:'pb-bundle',variants:v('47.99')},
  {title:'Pokemon Mega Evolution Booster Bundle',handle:'me-bundle',variants:v('44.99')},
  {title:'Pokémon - Mega Evolutions - Ascended Heroes - Booster Bundle Case (25 Ct)',handle:'asc-case',variants:v('3349.99')},
  {title:'Pokemon Ascended Heroes Booster Bundle',handle:'asc-bundle',variants:v('59.99')},
  {title:'ME06 - Delta Reign - Booster Box FRENCH',handle:'dr-box-fr',variants:v('239.18')},
  {title:'Pokemon Mega Evolution Delta Reign Booster Box',handle:'dr-box',variants:[{id:11,title:'Box',available:true,price:'289.99'},{id:12,title:'Pack',available:true,price:'7.99'},{id:13,title:'Case',available:false,price:'1739.99'}]},
  {title:'Pokémon - Mega Evolution - Delta Reign - ETB LIMIT OF 2',handle:'dr-etb',variants:v('109.99')},
  {title:'Pokemon Perfect Order - Pokémon Center Elite Trainer Box',handle:'po-pc',variants:v('179.99')},
  {title:'Pokémon - Mega Evolution - Perfect Order - Elite Trainer Box',handle:'po-etb',variants:v('99.99')}]};
 const h=w=>R.matchCatalog(w,data,'shop.ca').map(m=>m.handle);
 assert.deepEqual(h('Mega Evolution Booster Bundle'),['me-bundle'],'another set under the Mega Evolution era is not the Mega Evolution set');
 assert.deepEqual(h('Ascended Heroes Booster Bundle'),['asc-bundle'],'a case of 25 is not a bundle');
 assert.deepEqual(h('Delta Reign Booster Box'),['dr-box'],'French box left out for an English watch');
 assert.equal(R.matchCatalog('Delta Reign Booster Box',data,'shop.ca')[0].price,289.99,'the Box option, not the single pack');
 assert.deepEqual(h({product:'Delta Reign Booster Box',language:'fr'}),['dr-box-fr']);
 assert.deepEqual(h({product:'Delta Reign Booster Box',language:'any'}).sort(),['dr-box','dr-box-fr']);
 assert.deepEqual(h('Delta Reign Elite Trainer Box'),['dr-etb'],'ETB in the title');
 assert.deepEqual(h('Perfect Order Elite Trainer Box'),['po-etb'],'Pokémon Center ETB is another product');
 assert.deepEqual(h('Perfect Order Pokemon Center Elite Trainer Box'),['po-pc']);
});
test('matchCatalog: a barcode on the watch matches exactly, and a different barcode rejects',()=>{
 const data={products:[{title:'Delta Reign Booster Box',handle:'a',variants:[{id:5,available:true,price:'280.00',sku:'0196214165854'}]},
  {title:'Delta Reign Booster Box (display)',handle:'b',variants:[{id:6,available:true,price:'99.00',sku:'0196214000000'}]},
  {title:'Pokemon DR BB 36ct',handle:'c',variants:[{id:7,available:true,price:'275.00',barcode:'196214165854'}]}]};
 const m=R.matchCatalog({product:'Delta Reign Booster Box',upc:'196214165854'},data,'s.ca');
 assert.deepEqual(m.map(x=>[x.handle,x.matchedBy]),[['a','barcode'],['c','barcode']]);
});
test('every set in the price snapshot is known to the matcher',()=>{
 const D=require('../pack-ev-data.js');for(const s of D.sets)assert.ok(R.SETS.includes(s.name),s.name);
 assert.equal(R.kindOf('Pokemon - Scarlet Violet - 151 ETB'),'etb');assert.equal(R.kindOf('Booster Box (36 Packs)'),'box');assert.equal(R.kindOf('Ascended Heroes Tin - Bundle of 3'),'tin');
 assert.deepEqual(R.setsIn('Pokemon Scarlet & Violet SV8.5 Prismatic Evolutions - Elite Trainer Box'),['prismatic evolutions']);
 assert.equal(R.langOf('ME06 - Delta Reign - Elite Trainer Box - FRENCH'),'fr');assert.equal(R.langOf('Delta Reign Elite Trainer Box'),null);
});
