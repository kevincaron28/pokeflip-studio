const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const store={};const ctx={Date,URL,Number,Math,Intl,JSON,Object,Array,String,RegExp,Promise,localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}},navigator:{language:'en-CA'}};ctx.window=ctx;
for(const f of ['ui-i18n.js','price-chart.js','pack-ev.js','pack-ev-rates.js','pack-ev-data.js','alert-value.js','canada-shops.js','canada-retailers.js','store-prefs.js','compare-stores.js','sought-cards.js','price-history.js','product.js','nav.js'])vm.runInNewContext(read(f),ctx);
const I=ctx.CardsteadI18n,C=ctx.CardsteadChart,H=ctx.CardsteadPriceHistory,D=ctx.CardsteadPackData,P=ctx.CardsteadProduct,Nav=ctx.CardsteadNav;

test('every new string exists in English and French; French uses tu',()=>{
 assert.deepEqual(Object.keys(I.S.en).sort(),Object.keys(I.S.fr).sort());
 const fr=Object.values(I.S.fr).map(v=>typeof v==='function'?v(2,'a','b','c'):v).join(' ');
 assert.ok(!/\bvous\b|\bvotre\b|\bvos\b/i.test(fr),'tu, not vous');
 store['cardstead-lang-v1']='"fr"';assert.equal(I.t('nav.watch'),'Surveiller');assert.equal(I.t('g.notEnough',0),'Pas encore assez d’historique (0 jour de prix).');
 store['cardstead-lang-v1']='"en"';assert.equal(I.t('g.notEnough',1),'Not enough history yet (1 day of prices).');
});
test('four main tabs (Prices, Drops, My cards, Settings), and every page belongs to exactly one',()=>{
 assert.equal(Nav.GROUPS.length,4);
 assert.equal(Nav.GROUPS.map(g=>g.id).join(),'prices,watch,mycards,settings');
 assert.equal(Nav.GROUPS.find(g=>g.id==='mycards').pages.join(),'mycards');
 for(const gone of ['home','scan','inventory','lots','sales','dashboard'])assert.ok(!Nav.GROUPS.some(g=>g.pages.includes(gone)),gone+' is gone');
 const html=read('index.html');const sections=[...html.matchAll(/<section id="(\w+)"/g)].map(m=>m[1]);
 for(const s of sections){const n=Nav.GROUPS.filter(g=>g.pages.includes(s)).length;assert.equal(n,1,s)}
 assert.equal(Nav.groupOf('deals').id,'watch');assert.equal(Nav.groupOf('mycards').id,'mycards');assert.equal(Nav.groupOf('ebay').id,'settings');assert.equal(Nav.groupOf('sets').id,'prices');
});
test('real price history: dated, daily for 35 days then weekly, each point in CAD at that day\'s rate',()=>{
 assert.ok(H.dates.length>=60&&Object.keys(H.series).length>=500,H.dates.length+' '+Object.keys(H.series).length);
 assert.equal(JSON.stringify([...H.dates].sort()),JSON.stringify(H.dates));
 const gaps=H.dates.slice(1).map((d,i)=>(Date.parse(d)-Date.parse(H.dates[i]))/86400000);
 assert.ok(gaps.slice(-30).every(g=>g===1),'last 30 days are daily');assert.ok(gaps.every(g=>g>=1&&g<=7));
 assert.ok(H.fx.every(r=>r>1.2&&r<1.6),'Bank of Canada USD/CAD');
 assert.equal(H.dates.at(-1),D.prices.asOf.slice(0,10),'history ends on the snapshot date');
 const pack=D.sets.find(s=>s.name==='Surging Sparks').pack;const pts=C.points(H,String(pack.id),30);
 assert.ok(pts.length>=25);const last=pts.at(-1);assert.equal(last.cad,Math.round(H.series[pack.id].at(-1)*H.fx.at(-1)*100)/100);
});
test('graph helpers: ranges, change, not-enough-history',()=>{
 const h={dates:['2026-11-01','2026-11-20','2026-11-21','2026-11-22'],fx:[1.4,1.4,1.4,1.4],series:{a:[10,null,11,12],b:[null,null,null,5]}};
 assert.equal(C.points(h,'a',7).length,2);assert.equal(C.points(h,'a',365).length,3);
 const ch=C.change(C.points(h,'a',365));assert.equal(Math.round(ch.rel*100),20);
 assert.equal(C.points(h,'b',30).length,1);assert.equal(C.change(C.points(h,'b',30)),null);assert.equal(C.daysCovered(h,'b'),1);
 assert.equal(C.keyFor({id:5}),'5');assert.equal(C.keyFor({id:5,printing:'Holofoil'}),'5|Holofoil');
 assert.match(C.svg(C.points(h,'a',365),{msrpCad:14}),/class="g-msrp"/);
});
test('search finds products from short words; ETB/BB aliases; watch defaults come from the product',()=>{
 const items=P.catalog(D,ctx.CardsteadSoughtCards);assert.ok(items.length>800);
 const r=P.search(items,'surging etb');assert.equal(r[0].name,'Surging Sparks Elite Trainer Box');
 assert.ok(P.search(items,'umbreon vmax').some(x=>x.kind==='card'));
 assert.equal(P.search(items,'zzzz nothing').length,0);
 const d=P.watchDefaults(r[0],1.4,'Longueuil');assert.equal(d.format,'etb');assert.equal(d.ceiling,Math.floor(r[0].marketUsd*1.4));assert.equal(d.region,'Longueuil');assert.equal(d.product,r[0].name);
 assert.equal(P.watchDefaults({name:'x',type:'pack',marketUsd:null},1.4).ceiling,null,'no market value: no default price');
});
test('old saved data keeps its format: nothing new is written to existing keys',()=>{
 const src=['nav.js','product.js','price-chart.js','ui-i18n.js','mycards.js'].map(read).join('\n');
 for(const k of ['pokeflip-restock-v1','pokeflip-alert-hub-v1','cardstead-ebay-watch-v1','cardstead-area-v1'])assert.ok(!new RegExp("setItem\\(['\"]"+k).test(src),k+' is only read by the new screens');
 assert.match(read('restock-watch.js'),/API\.addWatch=w=>\{const x=\{id:id\(\),enabled:true,language:'en',region:'',format:'any',\.\.\.w\};validateWatch\(x\)/,'one-tap watches use the same validation as the form');
});
