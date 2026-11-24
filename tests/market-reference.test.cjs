const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../market-reference.js'),{getQuotes,dateInfo,estimate}=M;
const now=Date.parse('2026-11-21T10:00:00Z');
const fx={usdToCad:1.4325,date:'2026-11-20',eurToCad:1.5727,eurDate:'2026-11-20'};
const sample={tcgplayer:{unit:'USD',updated:'2026-11-20T10:00:00Z',normal:{marketPrice:4},holofoil:{marketPrice:18},'reverse-holofoil':{marketPrice:9}},cardmarket:{unit:'EUR',updated:'2026-11-19T10:00:00Z',trend:3,'trend-holo':11}};
test('market references keep USD/EUR; CAD only through the stored Bank of Canada rate',()=>{const quotes=getQuotes(sample,'Normal',now);assert.deepEqual(quotes.map(x=>x.unit),['USD','EUR']);assert.deepEqual(quotes.map(x=>x.price),[4,3]);assert.equal(M.toCad(quotes[0],fx).cad,5.73)});
test('holofoil prices never use the normal printing; Cardmarket "-holo" is the reverse holo',()=>{assert.deepEqual(getQuotes(sample,'Holo',now).map(x=>x.price),[18,3]);assert.deepEqual(getQuotes(sample,'Reverse Holo',now).map(x=>x.price),[9,11])});
test('unsupported finish and missing prices produce no guesses',()=>{assert.deepEqual(getQuotes(sample,'Other / special',now),[]);assert.deepEqual(getQuotes({},'Holo',now),[])});
test('stale or unknown timestamps are flagged',()=>{const p={tcgplayer:{unit:'USD',updated:'2026-10-01T00:00:00Z',normal:{marketPrice:10}}};assert.equal(getQuotes(p,'Normal',now)[0].stale,true);assert.equal(dateInfo('nonsense',now).date,'Unknown')});
test('reject NaN, nonpositive and absurd values',()=>{const p={tcgplayer:{unit:'USD',updated:'2026-11-20',normal:{marketPrice:-5}},cardmarket:{unit:'EUR',updated:'2026-11-20',avg:0}};assert.equal(getQuotes(p,'Normal',now).length,0)});

// Real TCGdex pricing measured 23 Nov 2026 (accuracy audit).
const shining={tcgplayer:{unit:'USD',updated:'2026-11-23T22:16:20Z','1st-edition-holofoil':{lowPrice:6165.99,midPrice:6832.5,marketPrice:null},'unlimited-holofoil':{lowPrice:4499.94,midPrice:4799.99,marketPrice:null}},cardmarket:{unit:'EUR',updated:'2026-11-23T22:16:19Z',trend:1213.12,avg30:1486.44,'trend-holo':627.3}};
const charizard={tcgplayer:{unit:'USD',updated:'2026-11-23T22:16:20Z',holofoil:{marketPrice:1001.05,midPrice:1100}},cardmarket:{unit:'EUR',updated:'2026-11-23T22:16:19Z',trend:284,avg30:578}};
const lugia={tcgplayer:{unit:'USD',updated:'2026-11-23T22:16:20Z','1st-edition-holofoil':{marketPrice:1300},'unlimited-holofoil':{marketPrice:513.49}},cardmarket:{unit:'EUR',updated:'2026-11-23',trend:322.5}};
const umbreon={tcgplayer:{unit:'USD',updated:'2026-11-23T22:16:32Z',holofoil:{lowPrice:1626.04,midPrice:2275,marketPrice:2149.1}},cardmarket:{unit:'EUR',updated:'2026-11-23T22:16:19Z',trend:1661.09,avg30:1802.29,'trend-holo':0}};
const at=Date.parse('2026-11-24T10:00:00Z');
test('a listing price is never the value (Shining Charizard showed +289%)',()=>{
 const q=getQuotes(shining,'Holo',at,'unlimited');assert.equal(q[0].asking,true);assert.equal(q[0].provider,'TCGplayer listings');
 const e=estimate(q,fx);assert.ok(e,'Cardmarket sold trend still gives a value');assert.equal(e.sources,1);assert.equal(e.confidence,'low');
 assert.ok(e.cad<2000,'not the CA$6,876 asking price');
});
test('1st Edition never gets the Unlimited price (Lugia 1st showed -65%), and Cardmarket is left out for it',()=>{
 const q=getQuotes(lugia,'Holo',at,'1st');assert.deepEqual(q.map(x=>[x.provider,x.price]),[['TCGplayer',1300]]);
 assert.equal(Math.round(estimate(q,fx).cad),1862);
 assert.equal(M.hasFirstEdition(lugia),true);assert.equal(M.hasFirstEdition(umbreon),false);
 assert.deepEqual(getQuotes(charizard,'Holo',at,'1st'),[],'no 1st Edition price listed: unknown, not the Unlimited price');
});
test('Cardmarket more than 3x away is dropped as a different product; agreement sets the confidence',()=>{
 const e=estimate(getQuotes(charizard,'Holo',at,'unlimited'),fx);assert.equal(e.sources,1);assert.equal(e.dropped.provider,'Cardmarket');
 const u=estimate(getQuotes(umbreon,'Holo',at),fx);assert.equal(u.sources,2);assert.equal(u.confidence,'high');
 assert.equal(Math.round(u.low),2612);assert.equal(Math.round(u.high),3079);
});
test('condition is a stated share of Near Mint',()=>{
 const nm=estimate(getQuotes(umbreon,'Holo',at),fx),mp=estimate(getQuotes(umbreon,'Holo',at),fx,'Moderately Played');
 assert.equal(mp.estimate,true);assert.equal(Math.round(mp.cad),Math.round(nm.cad*0.65));assert.equal(mp.nearMint,nm.nearMint);
});
test('Cardmarket alone is not a value; sources far apart use TCGplayer with the range',()=>{
 const rq={tcgplayer:null,cardmarket:{unit:'EUR',updated:'2026-11-23',trend:99.91,avg30:87.22}};
 const e=estimate(getQuotes(rq,'Holo',at),fx);assert.equal(e.cad,null);assert.ok(e.unconfirmed>0);
 const ub={tcgplayer:{unit:'USD',updated:'2026-11-23',holofoil:{marketPrice:1130.37}},cardmarket:{unit:'EUR',updated:'2026-11-23',trend:1430}};
 const u=estimate(getQuotes(ub,'Holo',at),fx);assert.equal(Math.round(u.cad),1619,'39% apart: the TCGplayer figure');assert.equal(u.confidence,'medium');
});
