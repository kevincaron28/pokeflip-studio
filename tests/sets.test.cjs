const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const S=require('../sets.js');const idx=require('../data/sets/index.json');
test('every set in the index has a card file, a series, a date and a set value',()=>{
 assert.ok(idx.sets.length>=200,String(idx.sets.length));
 for(const s of idx.sets){assert.ok(fs.existsSync(path.join(__dirname,'..','data/sets',s.id+'.json')),s.name);assert.ok(s.series&&/^\d{4}-\d{2}-\d{2}$/.test(s.released),s.name);assert.ok(s.setValueUsd>=0,s.name)}
 const names=idx.sets.map(s=>s.name);for(const n of ['Base Set','Neo Genesis','Skyridge','Evolving Skies','Prismatic Evolutions','Delta Reign'])assert.ok(names.includes(n),n);
});
test('series: newest first, promos last; vintage sets in their era',()=>{
 const g=S.bySeries(idx);assert.equal(g[0].id,'mega-evolution');assert.equal(g[g.length-1].id,'other');
 const of=n=>idx.sets.find(s=>s.name===n).series;
 assert.equal(of('Neo Destiny'),'neo');assert.equal(of('Skyridge'),'e-card');assert.equal(of('Evolving Skies'),'sword-shield');assert.equal(of('Base Set'),'wotc');assert.equal(of('Prismatic Evolutions'),'scarlet-violet');
});
test('set value and chase cards come from the card file',()=>{
 const s=idx.sets.find(x=>x.name==='Delta Reign');const d=require('../data/sets/'+s.id+'.json');
 const base=d.cards.map(c=>Object.values(c[4])).filter(v=>v.length).map(v=>Math.min(...v));
 assert.ok(Math.abs(base.reduce((a,b)=>a+b,0)-s.setValueUsd)<0.05);
 assert.ok(s.chase.length===5&&s.chase[0][4]>=s.chase[4][4]);
});
test('owned cards: same name and number from the collection, sold copies excluded',()=>{
 const own=S.owned({items:[{id:'a',name:'Mega Rayquaza ex',idCode:'me06-138',qty:1},{id:'b',name:'Pikachu',idCode:'sv8-25',qty:1}],sales:[{itemId:'b',qty:1}]});
 assert.ok(own.has(S.cardKey('Mega Rayquaza ex - 138/103','138/103')));assert.ok(!own.has(S.cardKey('Pikachu','025/191')));
 assert.equal(S.cardKey('Charizard','004/102'),S.cardKey('Charizard','4'));
});
