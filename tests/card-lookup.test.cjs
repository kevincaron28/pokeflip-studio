const {test}=require('node:test'),assert=require('node:assert/strict');require('../card-lookup.js');const {lookup}=globalThis.PokeFlipCardLookup;
const request=(map)=>async url=>({ok:!!map[url],status:map[url]?200:404,json:async()=>map[url]});
test('exact set and collector number uses direct card endpoint',async()=>{
 let path='https://api.tcgdex.net/v2/fr/sets/base1/4',expected={id:'base1-4',localId:'4',name:'Dracaufeu'};
 assert.deepEqual(await lookup('4','fr','base1',request({[path]:expected})),[expected]);
});
test('wrong expansion is rejected even with identical art',async()=>{
 let p='https://api.tcgdex.net/v2/fr/sets/base1/4';assert.deepEqual(await lookup('4','fr','base1',request({[p]:{id:'base2-4',localId:'4'}})),[]);
});
test('card IDs cannot override a confirmed different set',async()=>{
 await assert.rejects(lookup('base2-4','fr','base1',request({})),/conflicts/);
});
test('named lookup within confirmed set does not depend on global 60-card cutoff',async()=>{
 let p='https://api.tcgdex.net/v2/en/sets/base1',list={cards:[{id:'base1-4',name:'Charizard'},{id:'base1-10',name:'Mewtwo'},{id:'base2-4',name:'Charizard'}]};
 assert.deepEqual(await lookup('charizard','en','base1',request({[p]:list})),[list.cards[0]]);
});
test('set lookup preserves French accents',async()=>{
 let p='https://api.tcgdex.net/v2/fr/sets/base1',list={cards:[{id:'base1-1',name:'Électhor'}]};
 assert.equal((await lookup('electhor','fr','base1',request({[p]:list}))).length,1);
});
