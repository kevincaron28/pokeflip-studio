const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ctx={Date,URL,Number,Math,Intl,JSON,Promise};for(const f of ['pack-ev.js','pack-ev-rates.js','pack-ev-data.js','alert-value.js'])vm.runInNewContext(read(f),ctx);
const V=ctx.CardsteadAlertValue,E=ctx.CardsteadPackEv,D=ctx.CardsteadPackData,R=ctx.CardsteadPackRates;
const C={data:D,rates:R,evRows:E.rows(D,R.sets,R.msrp)};
const fx=D.fx.usdToCad;const ss=D.sets.find(s=>s.name==='Surging Sparks');const mk=type=>ss.sealed.filter(r=>r[2]===type).map(r=>r[3]*fx);

test('product kind from English and French shop wording',()=>{
 assert.equal(V.kindOf('Pokémon TCG: Surging Sparks Elite Trainer Box'),'etb');
 assert.equal(V.kindOf('Surging Sparks Pokemon Center Elite Trainer Box'),'etb-pc');
 assert.equal(V.kindOf('Étincelles Déferlantes coffret Dresseur d’élite'),'etb');
 assert.equal(V.kindOf('Surging Sparks Booster Box (36 packs)'),'box');
 assert.equal(V.kindOf('Surging Sparks Booster Bundle'),'bundle');
 assert.equal(V.kindOf('Surging Sparks 3-Pack Blister Zapdos'),'blister3');
 assert.equal(V.kindOf('Surging Sparks Sleeved Booster'),'sleeved');
 assert.equal(V.kindOf('Surging Sparks booster pack'),'pack');
 assert.equal(V.kindOf('Pikachu plush'),null);
});
test('matches the set and the TCGplayer sealed product; unknown set stays unknown',()=>{
 const m=V.match('Pokemon Surging Sparks Elite Trainer Box',D);assert.equal(m.status,'ok');assert.equal(m.set.name,'Surging Sparks');assert.equal(m.candidates.length,1);
 assert.equal(V.match('Surging Sparks 3 Pack Blister [Zapdos]',D).candidates.length,1,'a named variant narrows the match');
 assert.equal(V.match('Mystery Box of Cards',D).status,'no-set');
 assert.equal(V.match('Surging Sparks',D,'etb').kind,'etb','watch format is a hint when the text has no product kind');
});
test('verdicts: under is green, near market is fair, above is over, scalper flagged against MSRP',()=>{
 const etb=mk('etb')[0];
 assert.equal(V.assess({product:'Surging Sparks Elite Trainer Box',price:etb*0.8},C).verdict.code,'under');
 assert.match(V.assess({product:'Surging Sparks Elite Trainer Box',price:etb*0.8},C).verdict.label,/^Under value by \$[\d.,]+ \(20%\)$/);
 assert.equal(V.assess({product:'Surging Sparks Elite Trainer Box',price:etb},C).verdict.code,'fair');
 assert.equal(V.assess({product:'Surging Sparks Elite Trainer Box',price:etb*1.3},C).verdict.code,'over');
 const box=V.assess({product:'Surging Sparks Booster Box',price:mk('box')[0]*1.2},C);assert.equal(box.verdict.code,'over');assert.match(box.verdict.label,/scalper price/);
 assert.equal(V.assess({product:'Some unknown thing',price:50},C).verdict.code,'unknown');
});
test('several listings of one product compare against the whole range',()=>{
 const [a,b]=mk('bundle');const lo=Math.min(a,b),hi=Math.max(a,b);
 const r=V.assess({product:'Surging Sparks Booster Bundle',price:(lo+hi)/2},C);
 assert.equal(r.market.count,2);assert.equal(r.verdict.code,'fair');
 assert.equal(V.assess({product:'Surging Sparks Booster Bundle',price:lo*0.8},C).verdict.code,'under');
});
test('contents EV for fixed-count products; ETB pack count stays unknown; MSRP from the cited rule',()=>{
 const ev=C.evRows.find(r=>r.set.name==='Surging Sparks').evUsd;
 const box=V.assess({product:'Surging Sparks Booster Box',price:300},C);
 assert.equal(box.contents.packs,36);assert.ok(Math.abs(box.contents.evCad-36*ev*fx)<1e-9);assert.equal(box.msrp.usd,161.64);
 const etb=V.assess({product:'Surging Sparks Elite Trainer Box',price:100},C);
 assert.equal(etb.contents.evCad,null);assert.equal(etb.msrp,null,'no cited ETB MSRP');
 assert.equal(V.assess({product:'Shrouded Fable Booster Bundle',price:60},C).contents.evCad,null,'no pull rates, no EV');
});
test('price drop line and notification text; cards escape shop-supplied text',()=>{
 const a=V.assess({product:'Surging Sparks Elite Trainer Box',price:149.99,prevPrice:179.99},C);
 assert.ok(Math.abs(a.drop.diff-30)<1e-9);assert.equal(Math.round(a.drop.pct*100),17);
 const html=V.cardHtml(a,{store:'Shop <b>',status:'in',url:'https://example.ca/p',at:'2026-11-23T12:00:00Z'});
 assert.match(html,/Price drop/);assert.match(html,/\$179\.99 → \$149\.99 CAD \(17% off, \$30\.00 lower\)/);assert.ok(!html.includes('<b>'));
 assert.match(html,/Market value \(sealed\)/);assert.match(html,/as of/);assert.match(html,/Buy now: checkout at Shop &lt;b&gt;/);
 assert.match(V.text(a,{store:'EB Games',status:'in'}),/down from \$179\.99 \(17% off\).*MSRP: unknown.*Market:/);
 assert.ok(!V.cardHtml(a,{url:'javascript:alert(1)'}).includes('javascript:'),'only https links');
});
