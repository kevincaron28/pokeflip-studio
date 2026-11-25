// My cards: printings from the catalogue, price states, target alerts (trusted prices only), eBay deals hand-off
// (own target and alert level, French cards need "French"), Prices search, and the strings in both languages.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const MC=require('../mycards.js');const W=require('../ebay-watch.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const at='2026-11-24T10:00:00.000Z';
const item=(o={})=>({id:'i1',lotId:'L',name:'Umbreon VMAX',idCode:'swsh7-215',setName:'Evolving Skies',number:'215/203',lang:'en',finish:'Holo',edition:'',grade:'raw',condition:'Near Mint',qty:1,
 market:{cad:2846,confidence:'high',sources:[{name:'TCGplayer',kind:'sold',date:'2026-11-23'}],at},...o});

test('printings come from the catalogue variants; 1st Edition cards offer 1st and Unlimited; unknown variants: the usual three',()=>{
 assert.deepEqual(MC.printings({variants:{normal:false,holo:true,reverse:false}}),[{finish:'Holo',edition:''}]);
 assert.deepEqual(MC.printings({variants:{normal:true,holo:false,reverse:true}}).map(p=>p.finish),['Normal','Reverse Holo']);
 assert.deepEqual(MC.printings({variants:{holo:true,firstEdition:true}}),[{finish:'Holo',edition:'1st'},{finish:'Holo',edition:'unlimited'}]);
 assert.equal(MC.printings(null).length,3);
 const f=MC.fromTcgdex({id:'swsh7-215',localId:'215',name:'Umbreon VMAX',set:{name:'Evolving Skies',cardCount:{official:203}},image:'https://assets.tcgdex.net/en/swsh/swsh7/215'},'en');
 assert.deepEqual(f,{name:'Umbreon VMAX',idCode:'swsh7-215',setName:'Evolving Skies',number:'215/203',lang:'en',image:'https://assets.tcgdex.net/en/swsh/swsh7/215/low.webp'});
 assert.equal(MC.fromTcgdex({id:'x',image:'https://evil.example/x'},'fr').image,'','only TCGdex images');
});

test('price state: market value, graded (no sold source), pending, or why there is none',()=>{
 assert.equal(MC.priceOf(item()).cad,2846);
 assert.equal(MC.priceOf(item({grade:'PSA 10'})).state,'graded');
 assert.equal(MC.priceOf(item({market:undefined})).state,'pending');
 assert.deepEqual(MC.priceOf(item({market:{cad:null,confidence:'low',note:'edition',at}})),{state:'none',why:'edition',at});
 assert.equal(MC.priceOf(item({market:undefined,idCode:''})).why,'no-id');
});

test('target alert: at or under the target, on a medium or high confidence price only',()=>{
 assert.equal(MC.atTarget(item({target:3000})),true);assert.equal(MC.atTarget(item({target:2846})),true,'at the target counts');
 assert.equal(MC.atTarget(item({target:2000})),false);
 assert.equal(MC.atTarget(item({target:3000,market:{cad:2846,confidence:'low',sources:[],at}})),false,'low confidence never alerts');
 assert.equal(MC.atTarget(item({target:3000,grade:'PSA 9'})),false,'graded: no sold price to compare');
 assert.equal(MC.atTarget(item({target:3000,archived:true})),false);
 assert.equal(MC.atTarget(item()),false,'no target, no alert');
});

test('eBay deals reads My cards: only cards with a target or alert level, with their own rules',()=>{
 const items=[item({target:2500,alertPct:20}),item({id:'i2',name:'Pikachu',target:null,alertPct:null}),item({id:'i3',name:'Mew',lang:'fr',finish:'Reverse Holo',number:'151/165',target:40,market:undefined,grade:'raw'}),item({id:'i4',archived:true,target:1})];
 const cards=MC.ebayCards(items);assert.deepEqual(cards.map(c=>c.id),['my-i1','my-i3']);
 const [u,m]=cards;
 assert.equal(u.mine,true);assert.equal(u.printing,'Holofoil');assert.equal(u.number,'215/203');assert.equal(u.value.cad,2846);assert.equal(u.value.confidence,'high');
 assert.equal(u.target,2500);assert.equal(u.threshold,0.2);assert.equal(u.ebayQuery,'Umbreon VMAX 215 Evolving Skies');
 assert.equal(m.value,null,'no price yet: no value');assert.equal(m.printing,'Reverse Holofoil');assert.match(m.ebayQuery,/ french$/);
 const p={threshold:0.1,targets:{'my-i1':1}};
 assert.deepEqual(W.ruleFor(u,p),{threshold:0.2,target:2500},'My cards rules win');
 assert.deepEqual(W.ruleFor({id:'x'},{threshold:0.1,targets:{x:99}}),{threshold:0.1,target:99},'preloaded cards keep the eBay deals settings');
 assert.equal(W.valueOf(u,null).confidence,'high','confidence carried, so a low one is never alerted');
 assert.equal(W.doubt({value:{...W.valueOf(u,null),confidence:'low'},item:{feedback:99}}),'value uncertain');
});

test('French cards need "French" in the listing; English cards still refuse other languages',()=>{
 const fr={name:'Mew',number:'151/165',grade:'raw',lang:'fr',printing:'Reverse Holofoil'};
 assert.equal(W.matches('Mew 151/165 Reverse Holo French Pokemon 151 NM',fr).ok,true);
 assert.equal(W.matches('Mew 151/165 Reverse Holo Pokemon 151 NM',fr).why,'French not stated');
 assert.equal(W.matches('Mew 151/165 Reverse Holo French Japanese lot',fr).ok,false);
 const en={name:'Mew',number:'151/165',grade:'raw',printing:'Reverse Holofoil'};
 assert.equal(W.matches('Mew 151/165 Reverse Holo French',en).why,'other language');
 assert.equal(W.matches('Mew 151/165 Reverse Holo NM',en).ok,true);
});

test('Prices search finds My cards by every word of the name, set or number',()=>{
 const items=[item(),item({id:'i2',name:'Pikachu ex',setName:'Surging Sparks',number:'238/191'}),item({id:'i3',name:'Pikachu',archived:true})];
 assert.deepEqual(MC.searchMine(items,'pikachu').map(i=>i.id),['i2']);
 assert.deepEqual(MC.searchMine(items,'umbreon skies').map(i=>i.id),['i1']);
 assert.deepEqual(MC.searchMine(items,'238/191').map(i=>i.id),['i2']);
 assert.equal(MC.searchMine(items,'').length,0);
});

test('every My cards string exists in English and French, French in tu; the page is wired in',()=>{
 global.window=global;const I=require('../ui-i18n.js');
 const en=Object.keys(I.S.en).filter(k=>/^(mc|nav)\./.test(k)),fr=Object.keys(I.S.fr).filter(k=>/^(mc|nav)\./.test(k));
 assert.deepEqual(en.sort(),fr.sort());
 const used=[...read('mycards.js').matchAll(/t\('((?:mc|nav)\.[A-Za-z]+(?:\.[A-Za-z-]+)?)'/g)].map(m=>m[1]).filter(k=>!k.endsWith('.'));
 for(const k of used)assert.ok(k in I.S.en&&k in I.S.fr,k);
 const frText=fr.map(k=>I.S.fr[k]).map(v=>typeof v==='function'?v(2,'a','b'):v).join(' ');assert.ok(!/\bvous\b|\bvotre\b|\bvos\b/i.test(frText),'tu, not vous');
 const html=read('index.html');assert.match(html,/<script src="\.\/collection-value\.js" defer><\/script><script src="\.\/mycards\.js" defer><\/script>/);
 assert.match(html,/<section id="mycards" class="hidden"><h1 data-i18n="nav\.mycards">My cards<\/h1><div id="myCards"/);
 assert.match(read('product.js'),/CardsteadMyCards\?\.findHtml\?\.\(q\)/);
});
