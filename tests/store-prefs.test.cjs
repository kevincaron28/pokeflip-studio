const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function load(){const store={};const ctx={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},JSON,Object,Array,String};ctx.window=ctx;
 for(const f of ['canada-shops.js','canada-retailers.js','store-prefs.js'])vm.runInNewContext(read(f),ctx);return ctx}

test('a new user follows every Québec shop, every online shop and every chain, and no other province\'s local shops',()=>{
 const {CardsteadStorePrefs:P}=load();const p=P.get(),cat=P.catalogue();
 assert.deepEqual([p.province,p.region,p.city],['QC','',''],'no city or region is guessed');
 const qcLocal=cat.filter(s=>s.kind==='local'&&s.province==='QC');
 assert.ok(qcLocal.length>=35,'Québec local shops: '+qcLocal.length);
 for(const s of cat)assert.equal(P.isOn(s,p),s.kind!=='local'||s.province==='QC',s.name);
 assert.ok(P.defaultRegions(p).includes('montreal')&&P.defaultRegions(p).includes('national')&&!P.defaultRegions(p).includes('gta'));
});
test('toggling stores and switching province',()=>{
 const {CardsteadStorePrefs:P}=load();const cat=P.catalogue();
 const shop=cat.find(s=>s.kind==='local'&&s.province==='QC'),gta=cat.find(s=>s.region==='gta');
 P.toggle(shop,false);assert.equal(P.isOn(shop),false);P.toggle(shop,true);assert.equal(P.isOn(shop),true);assert.deepEqual(P.get().on,[]);
 P.toggle(gta,true);assert.equal(P.isOn(gta),true);
 P.save({...P.get(),province:'ON'});assert.equal(P.isOn(cat.find(s=>s.region==='ottawa')),true);assert.equal(P.isOn(shop),false);
});
test('Gatineau shops are in Outaouais (Québec), not Ottawa; every Québec shop has a Québec region',()=>{
 const {PokeFlipShops:S}=load();
 for(const s of S.SHOPS.filter(s=>/gatineau/i.test(s.city)))assert.equal(s.region,'outaouais',s.name);
 const qc=new Set(S.REGIONS.filter(r=>r.province==='QC').map(r=>r.id));
 assert.ok(S.SHOPS.filter(s=>qc.has(s.region)).length>=27);
});
test('alert retailer names map to stores',()=>{
 const {CardsteadStorePrefs:P}=load();
 assert.equal(P.storeFor('Walmart').key,'retailer:walmart');
 assert.equal(P.storeFor('EB Games Ste-Foy').key,'retailer:ebgames');
 assert.equal(P.storeFor('Costco.ca').key,'retailer:costco');
 assert.equal(P.storeFor('Collect-Edition').host,'collect-edition.com');
 assert.equal(P.storeFor('Some unknown shop'),null);
});
test('new Québec and online stores are sourced, and Toys"R"Us points at Staples',()=>{
 const {PokeFlipRetailers:R}=load();const ids=R.RETAILERS.map(r=>r.id);
 for(const id of ['lemaitredujeu','cartamagica','godsarena','monnaiecanada','pokemaths','happytcg','pokemarket','canadacomputers'])assert.ok(ids.includes(id),id);
 assert.equal(R.RETAILERS.find(r=>r.id==='toysrus').host,'www.staples.ca');
 for(const r of R.RETAILERS)assert.ok(/^https:\/\//.test(r.search),r.id);
 assert.ok(read('vercel.json').includes('https://collect-edition.com'),'new automatic shops are in the CSP');
 assert.ok(!read('vercel.json').includes('vapeland'),'vape shop left out');
});
