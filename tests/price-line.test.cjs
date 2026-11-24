const {test}=require('node:test');const assert=require('node:assert/strict');
const PL=require('../price-line.js');const D=require('../pack-ev-data.js');
const now=Date.parse('2026-11-24T12:00:00Z');
test('confidence: two sold sources by agreement, one fresh source medium, stale or asking-only low',()=>{
 assert.equal(PL.confidence([{kind:'sold',cad:100,date:'2026-11-23'},{kind:'sold',cad:120,date:'2026-11-23'}],now),'high');
 assert.equal(PL.confidence([{kind:'sold',cad:100},{kind:'sold',cad:135}],now),'medium');
 assert.equal(PL.confidence([{kind:'sold',cad:100},{kind:'sold',cad:200}],now),'low');
 assert.equal(PL.confidence([{kind:'sold',cad:100,date:'2026-11-22'}],now),'medium');
 assert.equal(PL.confidence([{kind:'sold',cad:100,date:'2026-10-01'}],now),'low','older than 14 days');
 assert.equal(PL.confidence([{kind:'asking',cad:100}],now),'low');
 assert.equal(PL.confidence([],now),null);
});
test('sealed products: TCGplayer sold average in CA$ at the stored Bank of Canada rate, with its date',()=>{
 const p=PL.sealed(115.51,D,Date.parse(D.prices.asOf)+86400000);
 assert.equal(p.cad,Math.round(115.51*D.fx.usdToCad*100)/100);
 assert.equal(p.sources[0].name,'TCGplayer');assert.equal(p.sources[0].kind,'sold');assert.equal(p.sources[0].date,D.prices.asOf);
 assert.equal(p.confidence,'medium');assert.equal(PL.sealed(null,D),null);
});
test('the line always shows value, confidence and sources; unknown says so',()=>{
 const h=PL.html({cad:165.47,sources:[{name:'TCGplayer',kind:'sold',date:'2026-11-22T20:05:55+0000',cad:165.47}],confidence:'medium'});
 assert.match(h,/165\.47/);assert.match(h,/pl\.medium|Medium/);assert.match(h,/TCGplayer/);assert.match(h,/pill gold/);
 assert.match(PL.html(null),/pl-unknown/);
 assert.match(PL.html({cad:10,sources:[{name:'TCGplayer',kind:'sold',date:null,cad:10}],confidence:'low'},{compact:true}),/pl-compact[^>]*title="TCGplayer/);
});
