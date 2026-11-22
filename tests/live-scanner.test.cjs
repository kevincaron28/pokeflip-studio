const test=require('node:test'),assert=require('node:assert/strict');
require('../live-scan-gate.js');require('../scan-heuristics.js');require('../card-lookup.js');
const gate=globalThis.PokeFlipLiveGate;
test('stable card captures once, never repeats while stationary',()=>{
 const g=gate.makeGate(),a=Uint8Array.from({length:320},(_,i)=>i%2?210:35);
 assert.equal(g.inspect(a,100).capture,false);
 assert.equal(g.inspect(a,500).capture,false);
 assert.equal(g.inspect(a,900).capture,true);
 for(let i=1;i<=8;i++)assert.equal(g.inspect(a,900+500*i).capture,false);
 assert.equal(g.captures,1);
});
test('new visually distinct card captures automatically after stable replacement',()=>{
 const g=gate.makeGate(),a=Uint8Array.from({length:320},(_,i)=>i%2?210:35),b=Uint8Array.from({length:320},(_,i)=>i%2?25:235);
 g.inspect(a,100);g.inspect(a,500);assert.equal(g.inspect(a,900).capture,true);
 g.inspect(b,1600);g.inspect(b,2100);
 const r=g.inspect(b,2900);
 assert.equal(r.capture,true);assert.equal(g.captures,2);
});
test('removal or poor light resets stability, not phantom capture',()=>{
 const g=gate.makeGate(),a=new Uint8Array(320).fill(140);
 g.inspect(a,10);g.inspect(a,50);g.inspect(a,100);
 for(let i=0;i<5;i++)assert.equal(g.inspect(a,200+i*100,false).capture,false);
 assert.equal(g.inspect(a,1000).capture,false);
 assert.equal(g.inspect(a,1400).capture,false);
 assert.equal(g.inspect(a,1800).capture,false); // same card, ignored after removal
});
test('OCR ignores attack boilerplate and recognizes Seedot header',()=>{
 const find=globalThis.PokeFlipScanHeuristics.candidates;
 const raw='BASIC Seedot\nHP 40\nTackle\n10 damage\nSearch your deck for 1 card\nillus. Artist';
 const list=find(raw);assert.equal(list[0],'Seedot');
 assert.ok(!list.some(x=>x==='Search your deck for 1 card'));
});
test('French card name is recognized without English substitutions',()=>{
 const list=globalThis.PokeFlipScanHeuristics.candidates('DE BASE Grainipiot\nPV 40\nCharge\n10 dégâts');
 assert.equal(list[0],'Grainipiot');
});
test('Seedot English fallback when French lookup returns no results',async()=>{
 const seen=[],reply=async url=>{seen.push(url);return {ok:true,status:200,json:async()=>url.includes('/fr/')?[]:[{id:'ex3-67',localId:'67',name:'Seedot',image:'https://assets.tcgdex.net/en/ex/ex3/67'}]}};
 const list=await globalThis.PokeFlipCardLookup.lookup('Seedot','fr','',reply);
 assert.equal(list.length,1);assert.equal(list[0].name,'Seedot');assert.equal(list[0].lookupLanguage,'en');
 assert.equal(seen.length,2);
});

test('stacked cards are detected without removing previous card',()=>{
 const g=gate.makeGate({cooldownMs:0}),a=Uint8Array.from({length:320},(_,i)=>i%2?210:35),b=Uint8Array.from({length:320},(_,i)=>i%2?25:235);
 g.inspect(a,100);g.inspect(a,500);assert.equal(g.inspect(a,900).capture,true);
 g.inspect(b,1300);g.inspect(b,1700);
 assert.equal(g.inspect(b,2100).capture,true);
 assert.equal(g.captures,2);
 for(let i=0;i<6;i++)assert.equal(g.inspect(b,2400+i*500).capture,false);
});
test('manual one-at-a-time capture suppresses automatic duplicate for same visible card',()=>{
 const g=gate.makeGate({cooldownMs:0}),card=Uint8Array.from({length:320},(_,i)=>i%2?210:35);
 assert.equal(g.markManual(card,100),true);
 for(let i=0;i<7;i++)assert.equal(g.inspect(card,200+i*500).capture,false);
 assert.equal(g.captures,1);
});
