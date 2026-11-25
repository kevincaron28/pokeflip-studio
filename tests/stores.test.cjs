const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const store={};const ctx={Date,URL,Number,Math,Intl,JSON,Object,Array,String,RegExp,Promise,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},navigator:{language:'en-CA'}};ctx.window=ctx;
for(const f of ['canada-shops.js','canada-retailers.js','store-prefs.js','compare-stores.js'])vm.runInNewContext(read(f),ctx);
const C=ctx.CardsteadCompare,P=ctx.CardsteadStorePrefs;

test('store list shows where each store is, with a short badge',()=>{
 const cat=P.catalogue();
 const eb=C.storeInfo('EB Games',null,P,cat);assert.equal(eb.kind,'chain');assert.equal(eb.badge,'EG');
 const ce=C.storeInfo('Collect-Edition','collect-edition.com',P,cat);assert.equal(ce.kind,'local');assert.equal(ce.city,'Candiac');
 assert.equal(C.storeInfo('HappyTCG',null,P,cat).kind,'online');
 const unknown=C.storeInfo('Ma boutique du coin',null,P,cat);assert.equal(unknown.store,null);assert.equal(unknown.badge,'MB');
});
test('purchase limits come from the watch when the owner set one',()=>{
 const restock={watches:[{id:'w',product:'Surging Sparks Elite Trainer Box',format:'etb',limit:2}],observations:[{watchId:'w',store:'EB Games',price:149.99,status:'in',checkedAt:'2026-11-23T10:00:00Z'}]};
 const rows=C.collect({product:'Surging Sparks Elite Trainer Box',format:'etb'},{restock,matches:[],hub:[],data:null});
 assert.equal(rows[0].limit,2);
 assert.equal(C.collect({product:'x',format:null},{restock:{watches:[{id:'w',product:'x'}],observations:[{watchId:'w',store:'S',price:1,status:'in',checkedAt:'2026-11-23T10:00:00Z'}]},matches:[],hub:[],data:null})[0].limit,null);
});
test('store list: info first, links as small secondary buttons; watch rows open it; retailer list shows recorded stock',()=>{
 const src=read('compare-stores.js');
 assert.match(src,/<ul class="cmp-list">/);assert.ok(!/<table class="cmp-table">/.test(src),'no link table');
 assert.match(src,/class="cmp-link"/);assert.ok(!/btn smallbtn\$\{r\.status==='in'\?' primary'/.test(src),'Buy is no longer the main button');
 for(const k of ['online','chain','limit','noCheck'])assert.ok(k in C.T.en&&k in C.T.fr,k);
 const rw=read('restock-watch.js');
 assert.match(rw,/stores\.dataset\.compare=w\.product/);assert.match(rw,/No check recorded for this product yet/);
 assert.doesNotMatch(read('index.html'),/scan-tray\.js/,'the camera scanner and its tray are gone');
});
