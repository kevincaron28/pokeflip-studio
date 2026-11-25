// eBay live prices: the exact card only, raw vs grade, CA$ with shipping, median with confidence, the cheapest real
// listing, the daily budget, and the search modes and cache headers of /api/ebay-search.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
global.window=global;
const W=require('../ebay-watch.js'),E=require('../ebay-live.js'),core=require('../api/_ebay-core.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const L=(title,price,o={})=>({id:title+price,title,price,currency:'CAD',shipping:o.ship??5,shippingCurrency:'CAD',url:'https://www.ebay.ca/itm/'+Math.round(price),feedback:o.fb??99.5,seller:'s',condition:o.cond||'Used',...o});
const umbreon={name:'Umbreon VMAX',number:'215/203',set:'Evolving Skies',printing:'Holofoil',grade:'raw',lang:'en'};

test('query: name, number, set, grade, French; cache key separates grade, printing and language',()=>{
 assert.equal(E.queryFor(umbreon),'Umbreon VMAX 215 Evolving Skies');
 assert.equal(E.queryFor({...umbreon,grade:'PSA 10'}),'Umbreon VMAX 215 Evolving Skies PSA 10');
 assert.equal(E.queryFor({...umbreon,lang:'fr'}),'Umbreon VMAX 215 Evolving Skies french');
 assert.equal(E.queryFor({...umbreon,ebayQuery:'custom words'}),'custom words');
 assert.notEqual(E.keyFor(umbreon),E.keyFor({...umbreon,grade:'PSA 10'}));assert.notEqual(E.keyFor(umbreon),E.keyFor({...umbreon,printing:'Reverse Holofoil'}));
});

test('raw card: only the exact raw card counts; median in CA$ with shipping; played, graded, junk and other cards left out',()=>{
 const items=[L('Umbreon VMAX 215/203 Evolving Skies NM',2000),L('Umbreon VMAX 215/203 Moonbreon',2100),L('Umbreon VMAX 215/203 alt art',2200),
  L('Umbreon VMAX 215/203 Evolving Skies',2300),L('Umbreon VMAX 215/203 pack fresh',2400),
  L('Umbreon VMAX 215/203 PSA 10',7000),L('Umbreon VMAX 215/203 LP',1500),L('Umbreon VMAX 215/203 proxy',20),L('Umbreon VMAX 95/203',90),L('Umbreon VMAX 215/203 Japanese',900)];
 const r=E.liveFrom({items,total:items.length,fetchedAt:'2026-11-25T14:00:00Z'},umbreon,1.4,W);
 assert.equal(r.n,5,'the five Near Mint or unstated raw copies');assert.equal(r.cad,2205,'trimmed median 2200 + 5 shipping');
 assert.equal(r.confidence,'medium');assert.equal(r.truncated,false);
 assert.equal(r.cheapest.cad,2005);assert.equal(r.cheapest.url,'https://www.ebay.ca/itm/2000');
});

test('graded card: only that grade; fewer than 3 listings gives no median; more listings than returned lowers confidence',()=>{
 const psa={...umbreon,grade:'PSA 10'};
 const items=[L('Umbreon VMAX 215/203 PSA 10',6900),L('Umbreon VMAX 215/203 PSA 10 gem',7100),L('Umbreon VMAX 215/203 PSA 9',3500),L('Umbreon VMAX 215/203 CGC 10',5000),L('Umbreon VMAX 215/203 raw NM',2100)];
 const r=E.liveFrom({items,total:5},psa,1.4,W);assert.equal(r.n,2);assert.equal(r.cad,null,'needs 3 listings');assert.equal(r.cheapest.cad,6905);
 const more=[...items,L('Umbreon VMAX 215/203 PSA 10 mint',7000)];
 const r2=E.liveFrom({items:more,total:150},psa,1.4,W);assert.equal(r2.n,3);assert.equal(r2.truncated,true);assert.equal(r2.confidence,'low');
});

test('cheapest real listing: a seller with feedback, never more than 50% under the median; USD at the snapshot rate',()=>{
 const items=[L('Umbreon VMAX 215/203',900,{fb:100}),L('Umbreon VMAX 215/203',1900,{fb:0}),L('Umbreon VMAX 215/203',2000),L('Umbreon VMAX 215/203',2100),L('Umbreon VMAX 215/203',2200),L('Umbreon VMAX 215/203',2300),
  L('Umbreon VMAX 215/203',1500,{currency:'USD',shipping:null})];
 const r=E.liveFrom({items,total:items.length},umbreon,1.4,W);
 assert.ok(r.cheapest.cad>=r.cad*0.5,'the 900 listing is too cheap to be real');assert.equal(r.cheapest.cad,2005,'the 0-feedback seller is skipped');
 const usd=E.liveFrom({items:[L('Umbreon VMAX 215/203',1500,{currency:'USD',shipping:null})],total:1},umbreon,1.4,W);assert.equal(usd.cheapest.cad,2100);assert.equal(usd.cheapest.shippingKnown,false);
});

test('daily budget per device: 150 lookups, a new day starts again',()=>{
 assert.equal(E.BUDGET,150);assert.equal(E.budgetLeft(null,'2026-11-25'),150);
 assert.equal(E.budgetLeft({day:'2026-11-25',n:149},'2026-11-25'),1);assert.equal(E.budgetLeft({day:'2026-11-25',n:150},'2026-11-25'),0);
 assert.equal(E.budgetLeft({day:'2026-11-24',n:150},'2026-11-25'),150);
});

test('API: value mode asks for 200 listings in best-match order, deals keep the 50 cheapest; answers carry an edge-cache header',async()=>{
 core.reset();const env={EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret'};const calls=[];
 const fetchImpl=async(url)=>{calls.push(url);if(url.includes('oauth2'))return {ok:true,json:async()=>({access_token:'t',expires_in:7200})};return {ok:true,status:200,json:async()=>({total:0,itemSummaries:[]})}};
 const v=await core.handle({url:'/api/ebay-search?mode=value&q=umbreon%20vmax%20215',env,fetchImpl,now:1e12});
 assert.equal(v.status,200);assert.equal(v.headers['Cache-Control'],'public, max-age=0, s-maxage=21600');
 const vu=new URL(calls.at(-1));assert.equal(vu.searchParams.get('limit'),'200');assert.equal(vu.searchParams.get('sort'),null);
 const d=await core.handle({url:'/api/ebay-search?q=umbreon%20vmax%20215',env,fetchImpl,now:1e12});
 assert.equal(d.headers['Cache-Control'],'public, max-age=0, s-maxage=600');
 const du=new URL(calls.at(-1));assert.equal(du.searchParams.get('limit'),'50');assert.equal(du.searchParams.get('sort'),'price');
 assert.equal(JSON.parse(v.body).mode,'value');assert.equal(JSON.parse(d.body).mode,'deals');
 const bad=await core.handle({url:'/api/ebay-search?q=x',env,fetchImpl,now:1e12});assert.equal(bad.headers['Cache-Control'],'no-store','errors are never cached');
 core.reset();
});

test('wired in: card page, My cards, Prices search, daily check; the app asks with its own URL (CDN and CORS)',()=>{
 assert.match(read('index.html'),/<script src="\.\/ebay-watch\.js" defer><\/script><script src="\.\/ebay-live\.js" defer><\/script>/);
 assert.match(read('product.js'),/CardsteadEbayLive\?\.render\(\$\('productEbay'\),it\.card\)/);
 const mc=read('mycards.js');assert.match(mc,/data-mc-ebay=/);assert.match(mc,/slice\(0,30\)/,'at most 30 automatic lookups per visit');
 assert.match(read('collection-value.js'),/slice\(0,20\)/,'at most 20 eBay lookups per daily check');
 for(const f of ['ebay-live.js','ebay-watch.js'])assert.match(read(f),/'&src=app'/,f);
 assert.match(read('functions/api/ebay-search.js'),/internal\/' \+ mode \+ '\/'/,'Cloudflare edge cache keyed by mode');
 global.window=global;const I=require('../ui-i18n.js');for(const k of Object.keys(I.S.en).filter(k=>k.startsWith('el.')))assert.ok(k in I.S.fr,k);
});
