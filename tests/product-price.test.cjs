const {test}=require('node:test');const assert=require('node:assert/strict');
const P=require('../product.js'),C=require('../price-chart.js');
const sought={cards:[
 {tcgplayerProductId:246723,printing:'Holofoil',grade:'PSA 10',name:'Umbreon VMAX',number:'215/203',set:'Evolving Skies'},
 {tcgplayerProductId:246723,printing:'Holofoil',grade:'raw',name:'Umbreon VMAX',number:'215/203',set:'Evolving Skies'},
 {tcgplayerProductId:7,printing:'Holofoil',grade:'PSA 9',name:'Only Graded',number:'1',set:'X'}]};
const data={sets:[{name:'Surging Sparks',code:'SSP',released:'2024-11-08',sealed:[[565606,'Surging Sparks Booster Box','box',150]]}]};
const items=P.catalog(data,sought);

test('a raw card and its graded copy have different addresses, and each opens itself',()=>{
 const refs=items.map(P.refOf);assert.equal(new Set(refs).size,items.length,'every result has its own address');
 for(const it of items)assert.equal(P.find(items,P.refOf(it)),it);
 assert.equal(P.find(items,'card:246723:Holofoil').grade,'raw','no grade means the raw card, although the graded one is listed first');
 assert.equal(P.find(items,'card:246723:Holofoil:PSA 10').grade,'PSA 10');
 assert.equal(P.find(items,'card:7:Holofoil'),undefined,'a graded card never answers for a raw one');
 assert.equal(P.find(items,'sealed:565606').name,'Surging Sparks Booster Box');
});

test('graded cards borrow no raw price history',()=>{
 const history={dates:['2026-11-24','2026-11-25'],fx:[1.4,1.4],series:{'246723|Holofoil':[2000,1900]}};
 const [graded,raw]=items.filter(x=>x.kind==='card');
 assert.equal(C.keyFor(raw),'246723|Holofoil');assert.equal(C.keyFor(graded),null);
 assert.equal(C.points(history,C.keyFor(graded),30).length,0);assert.equal(C.sparkline(history,C.keyFor(graded),30),'');
 assert.equal(C.points(history,C.keyFor(raw),30).length,2);
});

const squash=s=>s.replace(/[\u00a0\u202f]/g,' ');
test('graph scale shows the real amount above CA$1,000, in both languages',()=>{
 assert.equal(squash(C.axisMoney(3513.4,'en')),'$3,513');
 assert.equal(squash(C.axisMoney(3513.4,'fr')),'3 513 $');
 assert.equal(squash(C.axisMoney(33.4,'en')),'$33');
 assert.equal(squash(C.axisMoney(12345.6,'en')),'$12,346');
 assert.equal(squash(C.axisMoney(1.5,'en',true)),'$1.50');
});

test('the drawn graph carries those labels and widens its margin for them',()=>{
 const pts=[{date:'2026-11-01',t:Date.parse('2026-11-01'),cad:3000},{date:'2026-11-25',t:Date.parse('2026-11-25'),cad:3600}];
 const svg=C.svg(pts),labels=[...svg.matchAll(/class="g-ylab" x="(\d+)"[^>]*>([^<]+)</g)];
 assert.equal(labels.length,3);
 for(const [,x,text] of labels){assert.match(squash(text),/^\$3,\d{3}$/);assert.ok(Number(x)>=text.length*7,'label fits left of the plot')}
});
