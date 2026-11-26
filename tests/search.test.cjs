const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..'),json=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const P=require('../product.js');require('../card-lookup.js');const L=globalThis.PokeFlipCardLookup;
const data=require('../pack-ev-data.js'),index=json('data/sets/cards.json'),sets=json('data/sets/index.json');
const box={};vm.runInNewContext(fs.readFileSync(path.join(ROOT,'sought-cards.js'),'utf8'),{window:box,globalThis:box});
const items=P.catalog(data,box.CardsteadSoughtCards,index,sets);
const top=(q,n=1)=>P.search(items,q).slice(0,n);

test('the card index lists every card of every listed set, once, without the number in the name',()=>{
 const total=sets.sets.reduce((n,s)=>n+s.cards,0);
 assert.equal(index.cards.length,total);
 assert.equal(new Set(index.cards.map(c=>c[0])).size,total);
 assert.deepEqual(index.cards.filter(c=>/\s-\s\d+\/\d+/.test(c[1])).slice(0,3),[]);
});

test('any card is found by name or number, not only the watched ones',()=>{
 assert.ok(items.length>25000);
 const base=P.search(items,'charizard 4/102').find(x=>x.set==='Base Set');assert.ok(base,'the 1999 Charizard');
 assert.equal(base.kind,'card');assert.ok(base.card.marketUsd>0);assert.equal(P.find(items,P.refOf(base)),base);
 assert.equal(top('charizard')[0].kind,'card','a card name shows cards first');
 assert.ok(!top('charizard')[0].promo,'numbered sets before promos');
 const watched=box.CardsteadSoughtCards.cards.find(c=>c.grade==='raw');
 assert.equal(items.filter(x=>x.kind==='card'&&x.id===watched.tcgplayerProductId&&x.grade==='raw').length,1,'a watched card is not listed twice');
});

test('a set or product search shows sealed products first, packs and boxes before the rest, unpriced last',()=>{
 assert.deepEqual(top('surging sparks',3).map(x=>x.type),['pack','etb','box']);
 assert.equal(top('surging etb')[0].name,'Surging Sparks Elite Trainer Box');
 const all=P.search(items,'charizard',Infinity),priced=x=>x.kind==='sealed'?x.marketUsd!==null:x.grade==='raw'&&x.card.marketUsd!==null;
 const first=all.findIndex(x=>!priced(x));assert.ok(first<0||all.slice(first).every(x=>!priced(x)),'no price comes last');
});

test('French words for sealed products work without any request',()=>{
 for(const q of ['coffret dresseur','Coffret dresseur d’élite','ETB'])assert.equal(P.search(items,q+' surging sparks')[0].name,'Surging Sparks Elite Trainer Box',q);
 assert.equal(P.search(items,'display surging sparks')[0].name,'Surging Sparks Booster Box');
 assert.equal(P.search(items,'boîte de boosters surging sparks')[0].name,'Surging Sparks Booster Box');
});

test('French card and set names are translated by the card database, asking only for the searched words',async()=>{
 const asked=[];const db={'fr/sets':[{id:'sv08',name:'Étincelles Déferlantes'}],'en/sets':[{id:'sv08',name:'Surging Sparks'}],
  'fr/cards?name=dracaufeu':[{id:'base5-4',name:'Dracaufeu obscur'},{id:'base1-4',name:'Dracaufeu'}],'en/cards/base1-4':{name:'Charizard'},
  'fr/cards?name=%C3%A9voli':[{id:'x-1',name:'Évoli'}],'en/cards/x-1':{name:'Eevee'}};
 const get=async p=>{asked.push(p);return db[p]||null},known=w=>items.some(i=>i.search.includes(w));
 assert.equal(await P.toEnglish('dracaufeu',known,get),'charizard');
 assert.equal(await P.toEnglish('étincelles déferlantes',known,get),'surging sparks');
 assert.equal(await P.toEnglish('évoli',known,get),'eevee');
 assert.equal(await P.toEnglish('zzzz',known,get),null);
 asked.length=0;assert.equal(await P.toEnglish('charizard 4/102',known,get),null);
 assert.deepEqual(asked,['fr/sets','en/sets'],'English words are not sent');
 assert.equal(await P.toEnglish('dracaufeu',known,async()=>{throw Error('offline')}),null);
});

test('phone-game cards are left out of Add a card, and results can name their set',async()=>{
 for(const id of ['A1-036','A1a-001','B1a-12','P-A-005'])assert.ok(L.pocket({id}),id);
 for(const id of ['base1-4','sv08-057','swsh3-20','ex1-1','2021swsh-1','30th-c-001'])assert.ok(!L.pocket({id}),id);
 const list=[{id:'A1-036',localId:'036',name:'Charizard'},{id:'base1-4',localId:'4',name:'Charizard'}];
 const found=await L.lookup('charizard','en','',async()=>({ok:true,status:200,json:async()=>list}));
 assert.deepEqual(found.map(c=>c.id),['base1-4']);
 assert.equal(L.setOf({id:'30th-c-001',localId:'001'}),'30th-c');
 const names=await L.setNames('fr',async()=>({ok:true,json:async()=>[{id:'base1',name:'Set de Base'}]}));
 assert.equal(names[L.setOf(list[1])],'Set de Base');
});
