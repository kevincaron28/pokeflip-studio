// Set completion: Set vs Master progress, secret rares apart, owned/missing value and cost to complete, one-tap and
// per-printing ticks, validation, sorting, price coverage of the daily set data, offline cache, backup and cloud sync.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
global.window=global;
const SC=require('../set-completion.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
// [productId, name, number, rarity, {printing: soldUsd}, {printing: listingMidUsd}?]
const CARDS=[
 [1,'Bulbasaur - 001/003','001/003','Common',{'Normal':0.2,'Reverse Holofoil':0.5}],
 [2,'Ivysaur - 002/003','002/003','Uncommon',{'Normal':0.3,'Reverse Holofoil':0.6}],
 [3,'Venusaur ex - 003/003','003/003','Double Rare',{'Holofoil':4}],
 [4,'Venusaur ex - 004/003','004/003','Special Illustration Rare',{'Holofoil':100}],
 [5,'Promo Pikachu','SVP001','Promo',{},{'Normal':10}],
];
const G=24000,fx=1.4;

test('printings, usual printing, secret rares and prices per printing (sold medium, listing low)',()=>{
 assert.deepEqual(SC.printings(CARDS[0]),['Normal','Reverse Holofoil']);
 assert.equal(SC.defaultPrinting(CARDS[2]),'Holofoil');assert.deepEqual(SC.printings([9,'x','1/2','',{}]),['Normal'],'no price data: one printing');
 assert.deepEqual(SC.printings([9,'x','1/2','',{'Reverse Holofoil':1,'1st Edition Holofoil':2,'Unlimited Holofoil':3}]),['Unlimited Holofoil','1st Edition Holofoil','Reverse Holofoil']);
 assert.equal(SC.isSecret('004/003'),true);assert.equal(SC.isSecret('003/003'),false);assert.equal(SC.isSecret('SVP001'),false);assert.equal(SC.isSecret('TG23/TG30'),false);
 assert.deepEqual(SC.priceOf(CARDS[0],'Normal'),{usd:0.2,kind:'sold',confidence:'medium'});
 assert.deepEqual(SC.priceOf(CARDS[4],'Normal'),{usd:10,kind:'listing',confidence:'low'});
 assert.equal(SC.priceOf(CARDS[0],'Holofoil'),null);assert.equal(SC.cheapest(CARDS[0]).printing,'Normal');
});

test('Set mode: one of each card up to the printed total, any printing counts; secret rares counted apart',()=>{
 let st={v:1,sets:{}};
 st=SC.toggle(st,G,CARDS[0]);st=SC.setQty(st,G,2,'Reverse Holofoil',2);st=SC.toggle(st,G,CARDS[3]);
 const s=SC.summary(CARDS,st,G,'set',fx);
 assert.equal(s.total,4,'three numbered + the promo (no printed total)');assert.equal(s.owned,2);assert.equal(s.pct,50);
 assert.equal(s.secretTotal,1);assert.equal(s.secretOwned,1);
 // Owned: Bulbasaur Normal 0.2 + 2 x Ivysaur Reverse 0.6 + secret Venusaur 100 -> 101.4 USD
 assert.equal(s.ownedValue,Math.round(101.4*fx*100)/100);
 // Missing: Venusaur ex Holofoil 4 + promo listing 10 -> 14 USD at their cheapest printing
 assert.equal(s.missingValue,Math.round(14*fx*100)/100);assert.equal(s.costToComplete,s.missingValue);assert.equal(s.missingUnpriced,0);
 assert.deepEqual(s.missing.map(m=>m.card[0]),[3,5]);
});

test('Master mode: every printing of every card, secret rares included; switching modes never changes what is owned',()=>{
 let st=SC.setQty({v:1,sets:{}},G,1,'Normal',1);st=SC.setQty(st,G,1,'Reverse Holofoil',1);
 const m=SC.summary(CARDS,st,G,'master',fx);
 assert.equal(m.total,2+2+1+1+1);assert.equal(m.owned,2);
 assert.equal(m.missingValue,Math.round((0.3+0.6+4+100+10)*fx*100)/100);
 assert.deepEqual(SC.get?SC.get():st,SC.get?SC.get():st);
 assert.equal(SC.summary(CARDS,st,G,'set',fx).owned,1,'same ticks, Set mode');
});

test('one tap ticks the usual printing, a second tap clears the card; quantities per printing; nothing mutated',()=>{
 const empty={v:1,sets:{}};const a=SC.toggle(empty,G,CARDS[0]);
 assert.deepEqual(a.sets[G][1],{'Normal':1});assert.deepEqual(empty,{v:1,sets:{}},'the old state is unchanged (undo keeps it)');
 const b=SC.setQty(a,G,1,'Reverse Holofoil',3);assert.deepEqual(b.sets[G][1],{'Normal':1,'Reverse Holofoil':3});
 const c=SC.toggle(b,G,CARDS[0]);assert.equal(c.sets[G],undefined,'clearing the last card removes the set');
 assert.equal(SC.setQty(a,G,1,'Normal',5000).sets[G][1].Normal,999,'capped');
 assert.deepEqual(SC.ownedCounts(b),{[G]:1});
});

test('validation: what is restored or synced must be well formed',()=>{
 assert.equal(SC.validate(null),true);assert.equal(SC.validate({v:1,sets:{[G]:{1:{'Normal':2}}}}),true);
 for(const bad of [{v:2,sets:{}},{v:1,sets:[]},{v:1,sets:{'x':{}}},{v:1,sets:{[G]:{'abc':{}}}},{v:1,sets:{[G]:{1:{'Normal':0}}}},{v:1,sets:{[G]:{1:{'Normal':1.5}}}},{v:1,sets:{[G]:{1:{'Normal':1000}}}}])
  assert.throws(()=>SC.validate(bad),/set completion/i,JSON.stringify(bad));
});

test('sorting: number, price high first, missing priciest first',()=>{
 const st=SC.toggle({v:1,sets:{}},G,CARDS[3]);
 assert.deepEqual(SC.sortCards(CARDS,'number',st,G).map(c=>c[0]),[1,2,3,4,5]);
 assert.deepEqual(SC.sortCards(CARDS,'price',st,G).map(c=>c[0]),[4,5,3,2,1]);
 assert.deepEqual(SC.sortCards(CARDS,'missing-price',st,G).map(c=>c[0]),[5,3,2,1,4],'owned cards last');
});

test('every card has a value: TCGplayer sold or listing price for at least 98.5% of all cards, 95% in every main-series set but one',()=>{
 const idx=JSON.parse(read('data/sets/index.json'));let tot=0,ok=0;const low=[];
 for(const s of idx.sets){const d=JSON.parse(read('data/sets/'+s.id+'.json'));const n=d.cards.length,p=d.cards.filter(c=>Object.keys(c[4]||{}).length||c[5]).length;tot+=n;ok+=p;if(s.series!=='other'&&p/n<0.95)low.push(s.name)}
 assert.ok(ok/tot>=0.985,(ok/tot*100).toFixed(2)+'%');
 assert.ok(low.length<=1,'main-series sets under 95%: '+low.join(', '));
 assert.ok(read('tools/build-sets.mjs').includes('row.push(mids.get(p.productId))'),'listing mid prices kept only where there is no sale');
});

test('offline, backup, cloud and Watchlist wiring',()=>{
 const sw=read('sw.js');assert.ok(sw.includes("'./set-completion.js'"));assert.ok(sw.includes("const DATA='pokeflip-sets-data-v1'"),'set files kept for offline use');
 const app=read('app.js');assert.ok(app.includes('setCompletion:window.CardsteadSetCompletion?.get?.()||null'),'in the JSON backup');assert.ok(app.includes('window.CardsteadSetCompletion?.validate(data.setCompletion)'));
 const cs=read('cloud-sync.js');assert.ok(cs.includes('if(sc)s.setCompletion=sc'),'in the cloud snapshot (revision-checked save)');assert.ok(cs.includes('root.CardsteadSetCompletion?.setData(remote.payload.setCompletion)'));
 assert.ok(cs.includes('root.CardsteadSetCompletion?.validate(s.setCompletion)'));
 assert.ok(read('collection-value.js').includes('function tcgMarket('),'Watchlist cards from a set are priced from the set data');
 const CV=require('../collection-value.js');const m=CV.tcgMarket(CARDS[0],'Reverse Holofoil',1.4,Date.parse('2026-11-26T10:00:00Z'));
 assert.deepEqual({cad:m.cad,confidence:m.confidence,kind:m.sources[0].kind},{cad:0.7,confidence:'medium',kind:'sold'});
 assert.equal(CV.tcgMarket(CARDS[4],'Normal',1.4).confidence,'low');assert.equal(CV.tcgMarket(CARDS[0],'Holofoil',1.4),null);
 const sets=read('sets.js');for(const k of ['data-sc-watch','data-sc-undo','data-sc-filter','data-sc-rarity','data-sc-mode','IntersectionObserver','pointerdown'])assert.ok(sets.includes(k),k);
 assert.match(read('index.html'),/<script src="\.\/set-completion\.js" defer><\/script><script src="\.\/sets\.js" defer><\/script>/);
});

test('Watchlist rename (EN and FR); every set-completion string in both languages, French in tu',()=>{
 const I=require('../ui-i18n.js');
 assert.equal(I.S.en['nav.mycards'],'Watchlist');assert.equal(I.S.fr['nav.mycards'],'Liste de suivi');
 assert.ok(!JSON.stringify(Object.values(I.S.en).map(v=>typeof v==='function'?v(1,'a'):v)).includes('My cards'));
 const en=Object.keys(I.S.en).filter(k=>k.startsWith('sc.')),fr=Object.keys(I.S.fr).filter(k=>k.startsWith('sc.'));assert.deepEqual(en.sort(),fr.sort());
 const frText=fr.map(k=>I.S.fr[k]).map(v=>typeof v==='function'?v(2,'a'):v).join(' ');assert.ok(!/\bvous\b|\bvotre\b|\bvos\b/i.test(frText));
 assert.doesNotMatch(read('index.html'),/>My cards</);
});
