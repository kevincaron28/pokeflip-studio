const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const store={};const ctx={Date,URL,Number,Math,Intl,JSON,Object,Array,String,RegExp,Promise,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},navigator:{language:'fr-CA'}};ctx.window=ctx;
for(const f of ['pack-ev.js','pack-ev-rates.js','pack-ev-data.js','alert-value.js','canada-shops.js','canada-retailers.js','store-prefs.js','compare-stores.js'])vm.runInNewContext(read(f),ctx);
const C=ctx.CardsteadCompare,D=ctx.CardsteadPackData,P=ctx.CardsteadStorePrefs;
const target={product:'Surging Sparks Elite Trainer Box',format:'etb'};
const restock={watches:[{id:'w1',product:'Pokemon Surging Sparks ETB',format:'etb'},{id:'w2',product:'Prismatic Evolutions Booster Bundle',format:'bundle'}],
 observations:[
  {watchId:'w1',store:'EB Games',price:79.99,status:'out',checkedAt:'2026-11-23T10:00:00Z',url:'https://www.ebgames.ca/x'},
  {watchId:'w1',store:'EB Games',price:69.99,status:'in',checkedAt:'2026-11-23T12:00:00Z',url:'https://www.ebgames.ca/x'},
  {watchId:'w1',store:'Walmart.ca',price:64.99,status:'out',checkedAt:'2026-11-23T11:00:00Z',url:'https://www.walmart.ca/x'},
  {watchId:'w2',store:'Costco.ca',price:39.99,status:'in',checkedAt:'2026-11-23T11:00:00Z'}]};
const matches=[{watchId:'w1',host:'collect-edition.com',shop:'Collect-Edition',title:'Surging Sparks Elite Trainer Box',url:'https://collect-edition.com/products/ss-etb',available:true,price:74.99,checkedAt:'2026-11-23T11:30:00Z'},
 {watchId:'w1',host:'store.401games.ca',shop:'401 Games',title:'Surging Sparks Elite Trainer Box',url:'https://store.401games.ca/x',available:true,price:59.99,checkedAt:'2026-11-23T11:40:00Z'}];
const hub=[{product:'Pokémon Surging Sparks Elite Trainer Box',retailer:'Best Buy Canada',price:null,status:'unknown',observedAt:'2026-11-23T09:00:00Z',url:'https://www.bestbuy.ca/x'},
 {product:'Surging Sparks Booster Box',retailer:'Amazon.ca',price:249,status:'in',observedAt:'2026-11-23T09:00:00Z'}];

test('collects only records for the same product (set and kind), latest per store',()=>{
 const rows=C.collect(target,{restock,matches,hub,data:D});
 const names=rows.map(r=>r.store).sort().join(',');
 assert.equal(names,'401 Games,Best Buy Canada,Collect-Edition,EB Games,Walmart.ca');
 const eb=rows.find(r=>r.store==='EB Games');assert.equal(eb.price,69.99);assert.equal(eb.status,'in');
 assert.equal(rows.find(r=>r.store==='Best Buy Canada').price,null,'no price recorded stays unknown');
});
test('sort: in stock first, then cheapest, unknown prices after known',()=>{
 const rows=C.sort(C.collect(target,{restock,matches,hub,data:D}));
 assert.equal(rows.map(r=>r.store).join(','),'401 Games,EB Games,Collect-Edition,Best Buy Canada,Walmart.ca');
});
test('area: Québec first by default (Ontario shop hidden), show-all brings it back; untracked followed stores are listed, never priced',()=>{
 const raw=C.collect(target,{restock,matches,hub,data:D}),prefs=P.get(),cat=P.catalogue();
 const mine=C.inArea(raw,P,prefs,cat).map(r=>r.store);
 assert.ok(mine.includes('Collect-Edition')&&mine.includes('EB Games'));
 const ontario=cat.find(s=>s.host==='store.401games.ca');
 if(ontario)assert.ok(!mine.includes('401 Games'),'Ontario shop outside the Québec default');
 const none=C.untracked(raw,P,prefs,cat,false);
 assert.ok(none.length>50,String(none.length));assert.ok(!none.some(s=>s.name==='EB Games / GameStop Canada'),'stores with a record are not "untracked"');
 assert.ok(none.every(s=>!('price' in s)));
 assert.ok(C.untracked(raw,P,prefs,cat,true).length>none.length);
});
test('verdict in English and French, same bands as the alert cards',()=>{
 const a={market:{low:100,high:100,count:1},msrp:{usd:49.99,cadAtRate:71.6}};
 assert.deepEqual({...C.verdictText('en',80,a)},{code:'under',text:'Under value by $20.00 (20%)'});
 const fr=C.verdictText('fr',80,a);assert.equal(fr.code,'under');assert.match(fr.text,/^Sous la valeur de 20,00\s\$ \(20\s%\)$/);
 assert.equal(C.verdictText('en',101,a).code,'fair');
 assert.equal(C.verdictText('en',130,a).text,'Over value by $30.00 (30%) · scalper price (1.8× US MSRP)');
 assert.equal(C.verdictText('en',103,a).code,'fair');assert.equal(C.verdictText('en',106,{market:{low:100,high:100}}).text,'Over value by $6.00 (6%)');
 assert.match(C.verdictText('fr',90,{market:null,msrp:{cadAtRate:71.6}}).text,/^Au-dessus du PDSF de 26\s%/);
 assert.match(C.verdictText('fr',140,{market:null,msrp:{cadAtRate:71.6}}).text,/^Prix de revendeur \(2\.0× le PDSF/);
 assert.equal(C.verdictText('en',null,a).code,'unknown');assert.equal(C.verdictText('en',50,null).code,'unknown');
});
test('every string exists in both languages; French uses tu',()=>{
 assert.deepEqual(Object.keys(C.T.en).sort(),Object.keys(C.T.fr).sort());
 assert.match(C.T.fr.none,/\bNote\b.*\bimporte\b/);assert.ok(!/\bvous\b/i.test(JSON.stringify(Object.values(C.T.fr).map(String))));
 assert.equal(C.lang(),'fr','follows a French browser by default');
});
test('wired into the pack detail, every alert card, the page and the offline cache',()=>{
 assert.match(read('pack-ev.js'),/CardsteadCompare\?\.render\(\$\('packCompare'\)/);
 assert.match(read('alert-value.js'),/data-compare="\$\{esc\(a\.product\)\}"/);
 const html=read('index.html');assert.match(html,/id="compareDialog"/);assert.match(html,/compare-stores\.js/);
 assert.match(read('sw.js'),/'\.\/compare-stores\.js'/);
});
