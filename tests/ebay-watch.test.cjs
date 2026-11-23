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
