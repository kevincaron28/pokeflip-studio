const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ctx={Date,URL,Number,Math,Intl,JSON};vm.runInNewContext(read('pack-ev.js'),ctx);vm.runInNewContext(read('pack-ev-rates.js'),ctx);vm.runInNewContext(read('pack-ev-data.js'),ctx);
const E=ctx.CardsteadPackEv,R=ctx.CardsteadPackRates,D=ctx.CardsteadPackData;
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

const set={groupId:1,name:'Test Set',eraCode:'sv',era:'Scarlet & Violet',released:'2026-01-01',pack:{id:9,market:5},
 pools:{Common:{count:4,priced:4,mean:0.1},Uncommon:{count:3,priced:3,mean:0.2},Rare:{count:2,priced:2,mean:0.3},
  'Double Rare':{count:2,priced:2,mean:2},'Special Illustration Rare':{count:2,priced:2,mean:100},'Hyper Rare':{count:1,priced:0,mean:null}},
 reverseHolo:{priced:10,mean:0.25},top:[]};
const table={source:{title:'t',url:'https://example.com/rates'},structure:{commons:4,uncommons:3,reverse:2},
 rates:[{pool:'Double Rare',oneIn:5},{pool:'Special Illustration Rare',oneIn:50}],replacesReverse:['Special Illustration Rare'],rareSlot:['Double Rare']};

test('EV adds fixed slots, reverse holos, published odds and the rare-slot remainder',()=>{
 const ev=E.computeEv(set,table);
 assert.equal(ev.status,'complete');assert.equal(ev.complete,true);
 // 4×0.1 + 3×0.2 + (2−1/50)×0.25 + 0.8×0.3 + 0.2×2 + 0.02×100
 near(ev.totalUsd,0.4+0.6+1.98*0.25+0.8*0.3+0.4+2);
 near(ev.hitsUsd,2.4);
 assert.equal(ev.lines.find(l=>l.kind==='remainder').pool,'Rare');
});
test('a hit without a price makes the EV partial, never filled in',()=>{
 const ev=E.computeEv(set,{...table,rates:[...table.rates,{pool:'Hyper Rare',oneIn:100}]});
 assert.equal(ev.status,'partial');assert.equal(ev.complete,false);
 assert.equal(ev.lines.find(l=>l.pool==='Hyper Rare').missing,'price');
});
test('no sourced table means unknown EV; hit odds without a pack layout are hits-only',()=>{
 assert.equal(E.computeEv(set,null).totalUsd,null);
 const ev=E.computeEv(set,{...table,structure:null});
 assert.equal(ev.status,'hits-only');assert.equal(ev.complete,false);near(ev.totalUsd,2.4);
});
test('verdicts: open, keep sealed, skip at retail and unknown',()=>{
 assert.equal(E.verdict({ev:6,sealed:5,msrp:4.49}).code,'open');
 assert.equal(E.verdict({ev:3,sealed:5,msrp:4.49}).code,'sealed');
 assert.equal(E.verdict({ev:3,sealed:4,msrp:4.49}).code,'skip');
 assert.equal(E.verdict({ev:3,sealed:4,msrp:null}).code,'sealed');
 assert.equal(E.verdict({ev:null,sealed:4,msrp:4.49}).code,'unknown');
});
test('rows convert to CAD with the snapshot rate, apply fees to both sides, and only judge complete EVs',()=>{
 const data={fx:{usdToCad:1.4},sets:[set,{...set,groupId:2,name:'Unrated'}]};
 const msrp={rules:[{groupIds:[1,2],usd:4.49,cad:null}]};
 const [a,b]=E.rows(data,{1:table},msrp);
 near(a.sealedCad,7);near(a.evCad,a.evUsd*1.4);near(a.gapUsd,a.evUsd-5);assert.equal(a.msrpCad,null);assert.equal(a.msrpUsd,4.49);
 assert.equal(b.evCad,null);assert.equal(b.verdict.code,'unknown');
 const [f]=E.rows(data,{1:table},msrp,{fee:0.1325});
 near(f.sealedUsd,5*0.8675);near(f.evUsd,a.evUsd*0.8675);near(f.ratio,a.ratio);
});
test('filters by era, text and rated sets; sorts by gap with unknowns last',()=>{
 const list=[{set:{name:'A',eraCode:'sv',released:'2025-01-01'},ev:{complete:true},gapCad:-1,ratio:0.8},{set:{name:'B',eraCode:'me',released:'2026-01-01'},ev:{complete:false},gapCad:null,ratio:null},{set:{name:'C',eraCode:'sv',released:'2024-01-01'},ev:{complete:true},gapCad:2,ratio:1.3}];
 assert.deepEqual(E.filterSort(list,{sort:'gap'}).map(r=>r.set.name),['C','A','B']);
 assert.deepEqual(E.filterSort(list,{era:'sv',sort:'newest'}).map(r=>r.set.name),['A','C']);
 assert.deepEqual(E.filterSort(list,{onlyRated:true,query:'c'}).map(r=>r.set.name),['C']);
});
test('price snapshot is dated, plausible and has a sealed pack for every set',()=>{
 assert.ok(Date.parse(D.prices.asOf));assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(D.fx.date));
 assert.ok(D.fx.usdToCad>1&&D.fx.usdToCad<2);assert.ok(D.sets.length>=20);
 for(const s of D.sets){assert.ok(s.pack&&Number.isInteger(s.pack.id),s.name);assert.ok(['sv','me','swsh'].includes(s.eraCode),s.name);
  for(const [k,p] of Object.entries(s.pools)){assert.ok(p.priced<=p.count,s.name+' '+k);if(p.mean!==null)assert.ok(p.mean>0&&p.mean<100000,s.name+' '+k)}}
});
test('every pull-rate table is cited and points at pools that exist in the snapshot',()=>{
 for(const [id,t] of Object.entries(R.sets)){
  const s=D.sets.find(x=>String(x.groupId)===id);assert.ok(s,'unknown set '+id);
  assert.ok(/^https:\/\//.test(t.source?.url||''),id+' needs a source URL');assert.ok(t.source.title,id);
  assert.ok(t.rates.length,id);
  for(const r of t.rates){assert.ok(s.pools[r.pool],`${s.name}: no pool ${r.pool}`);assert.ok(r.asPrinted,`${s.name} ${r.pool} needs the printed odds`);
   if(r.perPack!==undefined)assert.ok(r.perPack>0&&r.perPack<=1,`${s.name} ${r.pool}`);else if(r.oneIn!==undefined)assert.ok(r.oneIn>=1);else assert.match(r.asPrinted,/Unknown/i,`${s.name} ${r.pool}: a rate without a number must say Unknown`)}
  for(const k of [...(t.replacesReverse||[]),...(t.rareSlot||[])])assert.ok(t.rates.some(r=>r.pool===k),`${s.name}: ${k} has no rate`);
  if(t.structure)assert.ok(t.structure.source?.url||t.source.url,id);
 }
 for(const rule of R.msrp.rules){assert.ok(/^https:\/\//.test(rule.sourceUrl),'MSRP rule needs a source');assert.equal(rule.cad,null,'no official CAD MSRP was found; do not add one without a source')}
});
test('tab, scripts and offline cache are wired',()=>{
 const html=read('index.html'),sw=read('sw.js');
 for(const s of ['data-tab="packs"','id="packs"','id="packList"','id="packDetail"','./pack-ev.js','./pack-ev-rates.js'])assert.ok(html.includes(s),s);
 for(const f of ['./pack-ev.js','./pack-ev-rates.js','./pack-ev-data.js'])assert.ok(sw.includes(`'${f}'`),f);
 assert.ok(!html.includes('pack-ev-data.js'),'the snapshot loads lazily when the tab opens');
});
test('snapshot builder groups pattern prints, skips code cards and finds the single booster pack',async()=>{
 const B=await import(pathToFileURL(path.join(root,'tools/build-pack-ev.mjs')).href);
 const rar=v=>[{name:'Rarity',value:v}];
 const products=[{productId:1,name:'Set Booster Pack'},{productId:2,name:'Set Sleeved Booster Pack'},{productId:3,name:'Pikachu ex - 057/191',extendedData:rar('Double Rare')},
  {productId:4,name:'Oddish (Master Ball Pattern)',extendedData:rar('Common')},{productId:5,name:'Code Card - Set',extendedData:rar('Code Card')},
  {productId:6,name:'Bulbasaur',extendedData:rar('Common')},{productId:7,name:'Charizard V (Full Art)',extendedData:rar('Ultra Rare')},{productId:8,name:'Mew (Exclusive)',extendedData:rar('Rare')}];
 const prices=[{productId:1,subTypeName:'Normal',marketPrice:5.5},{productId:2,subTypeName:'Normal',marketPrice:9},{productId:3,subTypeName:'Holofoil',marketPrice:2},
  {productId:4,subTypeName:'Reverse Holofoil',marketPrice:8},{productId:5,subTypeName:'Normal',marketPrice:1},{productId:6,subTypeName:'Normal',marketPrice:0.1},{productId:6,subTypeName:'Reverse Holofoil',marketPrice:0.3},
  {productId:7,subTypeName:'Holofoil',marketPrice:40},{productId:8,subTypeName:'Holofoil',marketPrice:99}];
 const s=B.summariseSet(products,prices);
 assert.equal(s.pack.id,1);assert.equal(s.pack.market,5.5);
 assert.deepEqual(Object.keys(s.pools).sort(),['Common','Double Rare','Master Ball Pattern','Ultra Rare']);
 assert.equal(s.pools['Master Ball Pattern'].mean,8);assert.equal(s.pools.Common.mean,0.1);assert.equal(s.reverseHolo.mean,0.3);
 assert.equal(s.top[0].name,'Charizard V (Full Art)');
 assert.deepEqual(B.eraOf('SV08: Surging Sparks'),{era:'Scarlet & Violet',eraCode:'sv',name:'Surging Sparks'});
 assert.equal(B.eraOf('ME: Ascended Heroes').name,'Ascended Heroes');
});

test('real tables: main SV and ME sets get a complete EV; Shrouded Fable and Sword & Shield stay unknown with a reason',()=>{
 const list=E.rows(D,R.sets,R.msrp);const by=n=>list.find(r=>r.set.name===n);
 for(const n of ['Surging Sparks','Scarlet & Violet 151','Prismatic Evolutions','Mega Evolution','Phantasmal Flames']){const r=by(n);assert.ok(r.ev.complete,n);assert.ok(r.evCad>0&&r.evCad<200,n+' '+r.evCad);assert.notEqual(r.verdict.code,'unknown',n)}
 for(const n of ['Black Bolt','White Flare']){assert.equal(by(n).ev.status,'partial',n);assert.equal(by(n).verdict.code,'unknown',n)}
 assert.equal(by('30th Celebration').ev.status,'hits-only');
 for(const n of ['Shrouded Fable','Evolving Skies']){assert.equal(by(n).evCad,null,n);assert.ok(R.notes[by(n).set.groupId],n)}
 assert.equal(R.sets[by('Delta Reign').set.groupId].confidence,'low');
});
