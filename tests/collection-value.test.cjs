const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../collection-value.js');const MR=require('../market-reference.js');
const fx={usdToCad:1.4325,eurToCad:1.5727,date:'2026-11-20',eurDate:'2026-11-20'};
const at='2026-11-24T10:00:00Z';
const data={lots:[{id:'l1',name:'Lot',cost:500}],sales:[{itemId:'b',qty:1}],items:[
 {id:'a',lotId:'l1',name:'Umbreon VMAX',idCode:'swsh7-215',lang:'en',qty:1,unitCost:2000,unitPrice:null,market:{cad:2846,confidence:'high',at,sources:[]}},
 {id:'b',lotId:'l1',name:'Pikachu',idCode:'sv08-238',lang:'fr',qty:2,unitCost:100,unitPrice:250,market:null},
 {id:'c',lotId:'l1',name:'Charizard ex PSA 10',idCode:'sv03.5-199',lang:'en',qty:1,grade:'PSA 10',unitCost:1200,unitPrice:1647},
 {id:'d',lotId:'l1',name:'Unknown card',lang:'en',qty:3,unitCost:null,unitPrice:null}]};
test('the value-over-time graph and gain/loss summary are gone; the daily price check stays',()=>{
 assert.equal(C.summary,undefined);assert.equal(C.addPoint,undefined);
 assert.equal(typeof C.due,'function');assert.equal(typeof C.marketFor,'function');
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../collection-value.js'),'utf8');
 assert.doesNotMatch(src,/cardstead-collection-history-v1|collectionSummary/,'no history written, no graph panel');
 assert.match(src,/'cardstead:prices'/,'tells My cards when prices changed');
});
test('refresh list: raw cards with a catalogue id whose value is missing or older than 20 hours, at most 60',()=>{
 const now=Date.parse(at)+21*3600000;
 assert.deepEqual(C.due(data.items,now).map(i=>i.id),['a','b']);
 assert.deepEqual(C.due(data.items,Date.parse(at)+3600000).map(i=>i.id),['b'],'fresh value is not fetched again');
 assert.equal(C.due(Array.from({length:100},(_, k)=>({id:'x'+k,idCode:'sv1-1'})),now).length,60);
 assert.deepEqual(C.due([{id:'h',idCode:'sv1-1',archived:true}],now),[],'cards removed from My cards are not re-priced');
});
test('market value from catalogue prices: edition, finish and condition applied; never an asking price',()=>{
 const umbreon={tcgplayer:{unit:'USD',updated:'2026-11-23',holofoil:{marketPrice:2149.1,midPrice:2275}},cardmarket:{unit:'EUR',updated:'2026-11-23',trend:1661.09}};
 const m=C.marketFor({finish:'Holo',condition:'Near Mint'},umbreon,fx,MR,Date.parse(at));
 assert.equal(Math.round(m.cad),2846);assert.equal(m.confidence,'high');assert.deepEqual(m.sources.map(s=>s.name),['TCGplayer','Cardmarket']);
 const mp=C.marketFor({finish:'Holo',condition:'Moderately Played'},umbreon,fx,MR,Date.parse(at));assert.equal(Math.round(mp.cad),Math.round(2846*0.65));
 const lugia={tcgplayer:{unit:'USD',updated:'2026-11-23','1st-edition-holofoil':{marketPrice:1300},'unlimited-holofoil':{marketPrice:513.49}}};
 assert.equal(C.marketFor({finish:'Holo'},lugia,fx,MR,Date.parse(at)).note,'edition','asks for the edition first');
 assert.equal(Math.round(C.marketFor({finish:'Holo',edition:'1st'},lugia,fx,MR,Date.parse(at)).cad),1862);
 const shining={tcgplayer:{unit:'USD',updated:'2026-11-23','unlimited-holofoil':{midPrice:4799.99,marketPrice:null}}};
 assert.equal(C.marketFor({finish:'Holo',edition:'unlimited'},shining,fx,MR,Date.parse(at)).cad,null,'listing price is not a value');
});
