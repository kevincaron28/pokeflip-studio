const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const M=require('../market-reference.js');const D=require('../pack-ev-data.js');

test('scanner quotes get a CAD equivalent at the Bank of Canada rate stored with the snapshot',()=>{
 assert.ok(D.fx.usdToCad>1&&D.fx.eurToCad>1,'both Bank of Canada rates in the snapshot');
 assert.equal(D.fx.eurDate,D.fx.date);
 assert.deepEqual({...M.toCad({unit:'USD',price:10},D.fx)},{cad:Math.round(10*D.fx.usdToCad*100)/100,rate:D.fx.usdToCad,date:D.fx.date});
 assert.equal(M.toCad({unit:'EUR',price:10},D.fx).rate,D.fx.eurToCad);
 assert.equal(M.toCad({unit:'GBP',price:10},D.fx),null,'no rate, no conversion');
 assert.match(read('tools/build-pack-ev.mjs'),/FXEURCAD/);
});
test('dead and duplicate controls are gone',()=>{
 const html=read('index.html');
 assert.ok(!/id="marketPanel"|id="fxUSD"|id="fxEUR"|id="quoteVerified"/.test(html),'manual FX fields nothing read');
 assert.equal((html.match(/<h2>Getting started<\/h2>/g)||[]).length,0,'duplicate of "Start here"');
 assert.match(html,/Start here · First collection/);
 for(const id of ['scanMarketQuotes','conditionScreen','triageSummary','lotPerformance'])assert.match(html,new RegExp('id="'+id+'"'),id);
});
test('Business page: headline numbers and today\'s priorities first, the rest under "More business details"',()=>{
 const p=read('portfolio.js');
 const today=p.indexOf("<h3>Today's priorities"),more=p.indexOf('<details class="portfolio-more">');
 assert.ok(today>0&&more>today);
 for(const h of ['Portfolio value over time','Pricing confidence','Physical sorting plan','Highest-value inventory','Purchase lot recovery','portfolio-disclaimer'])assert.ok(p.indexOf(h)>more,h);
 assert.ok(p.indexOf('</details>')>p.indexOf('portfolio-disclaimer'));
});
test('weekly price refresh opens a pull request and never pushes to main',()=>{
 const w=read('.github/workflows/refresh-prices.yml');
 assert.match(w,/schedule:\s*\n\s*- cron:/);assert.match(w,/workflow_dispatch/);
 for(const u of w.match(/uses: [^\n]+/g))assert.match(u,/@[0-9a-f]{40} #/,'actions pinned to a commit: '+u);
 assert.match(w,/node tools\/build-pack-ev\.mjs/);assert.match(w,/python tools\/build-price-history\.py/);assert.match(w,/npm run check/);
 assert.match(w,/gh pr create --base main/);assert.ok(!/git push origin (main|HEAD:main)/.test(w));
 assert.match(w,/py7zr==\d+\.\d+\.\d+/);
});
test('settings help and watch-form options fold; new labels exist in both languages',()=>{
 const n=read('nav.js');
 assert.match(n,/Beginner\.s physical sorting system/);assert.match(n,/Fast checkout tips/);
 for(const id of ['restockFormat','restockLanguage','restockArea','restockQuantity','restockLimit','restockAutoUrl'])assert.match(n,new RegExp("'"+id+"'"),id);
 const I=require('../ui-i18n.js');for(const k of ['w.more','s.help'])assert.ok(I.S.en[k]&&I.S.fr[k],k);
 assert.match(read('restock-watch.js'),/format:detectFormat\(\$\('restockFormat'\)\.value,\$\('restockProduct'\)\.value\)/);
});
