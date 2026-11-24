const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ctx={Date,URL,Number,Math,Intl,JSON,Object,Array,String,RegExp};for(const f of ['ebay-watch.js','sought-cards.js','pack-ev-data.js'])vm.runInNewContext(read(f),ctx);
const W=ctx.CardsteadEbayWatch,S=ctx.CardsteadSoughtCards,D=ctx.CardsteadPackData;
const umbreon={id:'u',name:'Umbreon VMAX',number:'215/203',set:'Evolving Skies',grade:'raw',exclude:['proxy']};
const psa={...umbreon,id:'u10',grade:'PSA 10'};

test('listing filters drop proxies, empty boxes, lots, other languages, wrong grades and wrong numbers',()=>{
 assert.equal(W.matches('Umbreon VMAX 215/203 Evolving Skies Alt Art NM',umbreon).ok,true);
 for(const bad of ['Umbreon VMAX 215/203 PROXY custom card','Umbreon VMAX 215/203 read description','Umbreon VMAX 215/203 EMPTY BOX','Lot of 10 Umbreon VMAX 215/203',
  'Umbreon VMAX 215/203 Japanese','Umbreon VMAX 215/203 PSA 10 Gem Mint','Umbreon VMAX 214/203 Evolving Skies','Espeon VMAX 215/203'])assert.equal(W.matches(bad,umbreon).ok,false,bad);
 assert.equal(W.matches('PSA 10 Umbreon VMAX 215/203 Evolving Skies',psa).ok,true);
 assert.equal(W.matches('PSA 9 Umbreon VMAX 215/203',psa).ok,false);
 assert.equal(W.matches('Umbreon VMAX 215/203 raw',psa).ok,false);
 assert.equal(W.matches('CGC 10 Umbreon VMAX 215/203',psa).ok,false);
 assert.equal(W.matches('Mew & Mewtwo GX TAG TEAM 222/236 Unified Minds',{name:'Mew & Mewtwo GX',number:'222/236',grade:'raw'}).ok,true,'TAG TEAM is not a grading company');
});
test('price including shipping in CAD; USD converted; unknown shipping flagged',()=>{
 assert.deepEqual({...W.total({price:100,currency:'CAD',shipping:5,shippingCurrency:'CAD'},1.4)},{cad:105,shippingKnown:true,converted:false});
 const u=W.total({price:100,currency:'USD',shipping:null},1.4);assert.equal(u.cad,140);assert.equal(u.shippingKnown,false);assert.equal(u.converted,true);
 assert.equal(W.total({price:100,currency:'EUR'},1.4),null);
});
test('verdict bands and deal rule',()=>{
 assert.equal(W.verdict(80,100).code,'under');assert.equal(W.verdict(80,100).label,'Under value by $20.00 (20%)');
 assert.equal(W.verdict(98,100).code,'fair');assert.equal(W.verdict(130,100).code,'over');assert.equal(W.verdict(50,null).code,'unknown');
 const row=(cad,known,d)=>({total:{cad,shippingKnown:known},verdict:{discount:d}});
 assert.equal(W.isDeal(row(85,true,0.15),0.10),true);assert.equal(W.isDeal(row(95,true,0.05),0.10),false);
 assert.equal(W.isDeal(row(85,false,0.15),0.10),false,'no alert until shipping is known');
 assert.equal(W.isDeal(row(95,true,0.05),0.10,96),true,'at or under the target price');
});
test('assess keeps matching listings and sorts the biggest discount first',()=>{
 const card={...umbreon,marketUsd:1000,marketSource:'PriceCharting',marketDate:'2026-11-23'};
 const rows=W.assess({u:{fetchedAt:'2026-11-23T12:00:00Z',items:[
  {id:'1',title:'Umbreon VMAX 215/203 Evolving Skies',price:1300,currency:'CAD',shipping:0,shippingCurrency:'CAD',url:'https://www.ebay.ca/itm/1'},
  {id:'2',title:'Umbreon VMAX 215/203 Evolving Skies NM',price:1100,currency:'CAD',shipping:20,shippingCurrency:'CAD',url:'https://www.ebay.ca/itm/2'},
  {id:'3',title:'Umbreon VMAX 215/203 proxy',price:10,currency:'CAD',shipping:0,url:'https://www.ebay.ca/itm/3'}]}},[card],{fx:{usdToCad:1.4}});
 assert.equal(rows.map(r=>r.item.id).join(','),'2,1');assert.equal(rows[0].verdict.code,'under');assert.equal(rows[0].value.source,'PriceCharting ungraded value');
});
test('preloaded watchlist: at least 100 cited cards, modern and vintage, raw and graded, unique ids, usable queries',()=>{
 assert.ok(S.cards.length>=100,String(S.cards.length));
 const ids=new Set(S.cards.map(c=>c.id));assert.equal(ids.size,S.cards.length);
 assert.ok(S.cards.some(c=>c.era==='vintage')&&S.cards.some(c=>c.era==='modern'));
 assert.ok(S.cards.some(c=>c.grade==='PSA 10')&&S.cards.some(c=>c.grade==='raw'));
 for(const c of S.cards){
  assert.ok(/^https:\/\//.test(c.demandSourceUrl),c.id+' needs a demand source');
  assert.ok(c.ebayQuery.length>=3&&c.ebayQuery.length<=120,c.id);
  if(c.grade!=='raw')assert.equal(c.marketUsd,null,c.id+': no dated graded price, so no value');
  else assert.ok(c.marketUsd===null||c.marketUsd>0&&c.marketDate,c.id);
 }
 const priced=S.cards.filter(c=>W.valueOf(c,D));assert.ok(priced.length>=110,String(priced.length));
});
test('every TCGplayer-priced card gets today\'s price from the snapshot',()=>{
 const c=S.cards.find(c=>c.marketSource==='TCGplayer via tcgcsv'&&D.cardPrices[c.tcgplayerProductId+'|'+c.printing]);
 const v=W.valueOf(c,D);assert.equal(v.source,'TCGplayer market price');assert.equal(v.date,D.prices.asOf);
});
// Measured on ebay.ca on 24 Nov 2026: 77 of 137 flagged "deals" were these kinds of listings.
test('junk measured on ebay.ca is never the card',()=>{
 for(const bad of ['Umbreon VMax Moonbreon Pokemon Card TCG 215/203 Evolving Skies Novelty Keychain','POKEMON TCG EXTENDED ART CASE CARD UMBREON VMAX SR 215/203',
  'Pokemon Card TCG / Metal Umbreon VMAX Evolving Skies 215/203 Pokemon Gold Metal','MYSTERY PACK - Umbreon VMAX 215/203 Evolving Skies','Umbreon VMAX 215/203 Gold Foil Collectible',
  'Umbreon VMAX 215/203 Extended Art Print A4 Card Display Mount','Umbreon VMAX 215/203 Fridge Magnet'])assert.equal(W.matches(bad,umbreon).ok,false,bad);
 assert.equal(W.matches('Umbreon VMAX 215/203 Evolving Skies ACE 10',umbreon).ok,false,'ACE grade is graded');
 assert.equal(W.matches('Umbreon VMAX 215/203 Evolving Skies',umbreon,{condition:'Graded'}).ok,false,'eBay says graded');
 assert.equal(W.matches('Umbreon VMAX 215/203 SWSH07: Evolving Skies NOT PSA 10',psa).ok,false);
});
test('editions: 1st Edition, Shadowless and Unlimited must be stated the right way',()=>{
 const first={id:'c1',name:'Charizard',number:'004/102',set:'Base Set',printing:'1st Edition Holofoil',grade:'raw'};
 const shadow={id:'c2',name:'Charizard',number:'004/102',set:'Base Set (Shadowless)',printing:'Shadowless Holofoil',grade:'raw'};
 const unl={id:'charizard-004-base-set-unlimited',name:'Charizard',number:'004/102',set:'Base Set (Unlimited)',printing:'Holofoil',grade:'raw'};
 assert.equal(W.edition(first),'1st');assert.equal(W.edition(shadow),'shadowless');assert.equal(W.edition(unl),'unlimited');
 assert.equal(W.matches('Charizard 4/102 Base Set 1st Edition Holo',first).ok,true);
 assert.equal(W.matches('Charizard 4/102 Base Set Holo English Vintage (Not 1st edition) LP',first).ok,false);
 assert.equal(W.matches('Charizard From Base Set 4/102 Holo Rare',first).ok,false);
 assert.equal(W.matches('Charizard 4/102 Shadowless Holo',shadow).ok,true);
 assert.equal(W.matches('Charizard 4/102 1st Edition Shadowless',shadow).ok,false);
 assert.equal(W.matches('Charizard 4/102 Base Set Holo',unl).ok,true);
 assert.equal(W.matches('Charizard 4/102 Base Set Shadowless',unl).ok,false);
});
test('condition from the title, never hit points',()=>{
 assert.equal(W.condition('Gengar 5/62 1st Edition Holo Fossil Heavy Play'),'HP');
 assert.equal(W.condition('Charizard 4/102 Holo Rare Base Set Shadowless HP/DMG'),'DMG');
 assert.equal(W.condition('Umbreon VMAX 215/203 MP "MOONBREON"'),'MP');
 assert.equal(W.condition('Lugia V 186/195 LP'),'LP');
 assert.equal(W.condition('Umbreon VMAX 215/203 NM!!'),'NM');
 assert.equal(W.condition('Shining Charizard 107/105 Secret Rare 100HP'),null);
 assert.equal(W.condition('Charizard GX SV49 Full Art HP 250'),null);
});
test('too cheap to trust is not a deal; a played copy is compared with its share of the value',()=>{
 assert.equal(W.verdict(10,3104).code,'suspect');
 assert.equal(W.isDeal({total:{cad:10,shippingKnown:true},verdict:W.verdict(10,3104)},0.10),false);
 assert.equal(W.isDeal({total:{cad:10,shippingKnown:true},verdict:W.verdict(10,3104)},0.10,50),false,'not even under a target price');
 const card={...umbreon,marketUsd:1000,marketSource:'PriceCharting',marketDate:'2026-11-23'};
 const rows=W.assess({u:{fetchedAt:'2026-11-23T12:00:00Z',items:[{id:'9',title:'Umbreon VMAX 215/203 Evolving Skies MP',price:800,currency:'CAD',shipping:0,shippingCurrency:'CAD',url:'https://www.ebay.ca/itm/9'}]}},[card],{fx:{usdToCad:1.4}});
 assert.equal(rows[0].condition,'MP');assert.equal(Math.round(rows[0].valueForCondition),910);assert.equal(rows[0].verdict.code,'under');
});
test('graded cards: never a raw price; value is the trimmed median of matching eBay.ca listings, labelled as asking prices',()=>{
 const c=S.cards.find(c=>c.grade==='PSA 10'&&D.cardPrices[c.tcgplayerProductId+'|'+c.printing]);
 assert.equal(W.valueOf(c,D),null,'a PSA 10 must not get the raw TCGplayer price');
 const it=(id,p,t='PSA 10 Umbreon VMAX 215/203 Evolving Skies')=>({id,title:t,price:p,currency:'CAD',shipping:0,shippingCurrency:'CAD',url:'https://www.ebay.ca/itm/'+id});
 const items=[it('a',4000),it('b',5000),it('c',5200),it('d',5400),it('e',9000),it('f',20,'PSA 10 Umbreon VMAX 215/203 keychain')];
 const v=W.listingValue(items,psa,1.4);assert.equal(v.n,5);assert.equal(v.cad,5200);assert.equal(v.asking,true);assert.match(v.source,/5 eBay\.ca listings \(asking prices\)/);
 assert.ok(['low','medium'].includes(v.confidence));
 assert.equal(W.listingValue(items.slice(0,2),psa,1.4),null,'fewer than 3 listings: unknown');
 const rows=W.assess({u10:{fetchedAt:'2026-11-24T12:00:00Z',items}},[psa],{fx:{usdToCad:1.4}});
 assert.equal(rows[0].value.cad,5200);assert.equal(rows[0].item.id,'a');assert.equal(rows[0].verdict.code,'under');
});
test('raw cards get a second opinion from eBay.ca asking prices and a confidence level',()=>{
 assert.equal(W.agreement(100,120),'high');assert.equal(W.agreement(100,135),'medium');assert.equal(W.agreement(100,200),'low');
 const card={...umbreon,marketUsd:1000,marketSource:'PriceCharting',marketDate:'2026-11-23'};
 const it=(id,p)=>({id,title:'Umbreon VMAX 215/203 Evolving Skies',price:p,currency:'CAD',shipping:0,shippingCurrency:'CAD',url:'https://www.ebay.ca/itm/'+id});
 const rows=W.assess({u:{fetchedAt:'x',items:[it('1',1300),it('2',1400),it('3',1450)]}},[card],{fx:{usdToCad:1.4}});
 assert.equal(rows[0].value.check.cad,1400);assert.equal(rows[0].value.confidence,'high');
});
// Second pass, 24 Nov 2026: on the same ebay.ca listings these rules took flagged deals from 47 (53% real deals) to 8 (all real).
test('signed or altered copies and the wrong holo printing are not the card',()=>{
 const holo={id:'s',name:'Charizard',number:'146/144',set:'Skyridge',printing:'Holofoil',grade:'raw'};
 assert.equal(W.matches('Charizard - 146/144 - Pokemon Skyridge Reverse Holo Crystal',holo).ok,false);
 assert.equal(W.matches('Charizard 146/144 Skyridge Holo Crystal',holo).ok,true);
 const rev={id:'p',name:'Pikachu',number:'086/110',set:'Legendary Collection',printing:'Reverse Holofoil',grade:'raw'};
 assert.equal(W.matches('Pikachu 86/110 Legendary Collection Reverse Holo',rev).ok,true);
 assert.equal(W.matches('Pikachu 86/110 Legendary Collection',rev).ok,false);
 assert.equal(W.matches('Umbreon VMAX 215/203 Evolving Skies SIGNED by the artist',umbreon).ok,false);
});
test('a deal needs a trusted value and a seller with feedback; graded asks for 20% under the asking median',()=>{
 const row=(o)=>({total:{cad:80,shippingKnown:true},verdict:{code:'under',discount:0.2},item:{feedback:99.5},value:{cad:100,confidence:'high'},...o});
 assert.equal(W.isDeal(row({}),0.10),true);
 assert.equal(W.isDeal(row({value:{cad:100,confidence:'low'}}),0.10),false);assert.equal(W.doubt(row({value:{cad:100,confidence:'low'}})),'value uncertain');
 assert.equal(W.isDeal(row({item:{feedback:0}}),0.10),false);assert.equal(W.doubt(row({item:{feedback:0}})),'seller with no feedback');
 assert.equal(W.isDeal(row({value:{cad:100,confidence:'medium',asking:true},verdict:{code:'under',discount:0.15}}),0.10),false,'graded: 15% under an asking median is not enough');
 assert.equal(W.isDeal(row({value:{cad:100,confidence:'medium',asking:true},verdict:{code:'under',discount:0.22}}),0.10),true);
});
test('a raw deal is measured against the lower of the sold value and the eBay.ca asking median',()=>{
 const card={...umbreon,marketUsd:1000,marketSource:'PriceCharting',marketDate:'2026-11-23'};
 const it=(id,p)=>({id,title:'Umbreon VMAX 215/203 Evolving Skies',price:p,currency:'CAD',shipping:0,shippingCurrency:'CAD',url:'https://www.ebay.ca/itm/'+id,seller:'s',feedback:99});
 const rows=W.assess({u:{fetchedAt:'x',items:[it('1',1200),it('2',1250),it('3',1300),it('4',1100)]}},[card],{fx:{usdToCad:1.4}});
 const r=rows.find(x=>x.item.id==='4');assert.equal(r.dealRef,1225,'median of the asks, under the 1,400 sold value');assert.equal(r.verdict.code,'under');assert.equal(Math.round(r.verdict.discount*100),10);
});
