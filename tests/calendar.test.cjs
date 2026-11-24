// Drops > Coming drops: upcoming releases from TCGplayer presale dates plus hand-kept official announcements.
const {test}=require('node:test');const assert=require('node:assert/strict');
const C=require('../calendar.js');const cal=require('../data/release-calendar.json');const off=require('../data/official-releases.json');
test('the daily file lists upcoming sealed products with a date, never cases or multi-packs',()=>{
 assert.ok(Array.isArray(cal.items));
 for(const i of cal.items){assert.match(i.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(i.set&&i.name&&i.productId,i.name);assert.ok(!/\bcase\b|code card|set of \d/i.test(i.name),i.name)}
});
test('official entries carry a date, a status and at least one source link',()=>{
 for(const r of off.releases){assert.match(r.date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(['announced','confirmed'].includes(r.status),r.set);assert.ok(r.sources.length&&r.sources.every(s=>/^https:\/\//.test(s.url)),r.set)}
});
test('grouped by set, soonest first; the official date leads and a different TCGplayer date is flagged',()=>{
 const items=[{date:'2027-02-06',set:'Flowing Fists',code:'FLO',productId:1,name:'Flowing Fists Booster Box',kind:'box',marketUsd:180},
  {date:'2027-02-06',set:'Flowing Fists',code:'FLO',productId:2,name:'Flowing Fists Elite Trainer Box',kind:'etb',marketUsd:60},
  {date:'2026-12-04',set:'30th Celebration',code:'30C',productId:3,name:'30th Celebration Binder Collection',kind:'collection',marketUsd:null},
  {date:'2026-11-01',set:'Old',code:'',productId:4,name:'Old pack',kind:'pack',marketUsd:5}];
 const r=C.releases({items},{releases:[{set:'Flowing Fists',date:'2027-02-05',status:'announced',sources:[]},{set:'Future Set',date:'2027-05-01',status:'announced',sources:[]}]},'2026-11-24');
 assert.deepEqual(r.map(x=>x.set),['30th Celebration','Flowing Fists','Future Set'],'past items dropped, soonest first');
 const ff=r[1];assert.equal(ff.date,'2027-02-05');assert.equal(ff.tcgDate,'2027-02-06');assert.equal(ff.dateDiffers,true);assert.equal(ff.products.length,2);
 assert.equal(r[2].products.length,0,'an announced set with no products yet still shows');
 assert.equal(r[0].official,undefined);
});
