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
 assert.deepEqual(R.parseShopifyProduct({title:'ETB',variants:[{available:false,price:6999},{available:true,price:5499}]}),{status:'in',price:54.99,title:'ETB'});
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
