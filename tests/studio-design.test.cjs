const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('studio-theme.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
test('new design assets have a real identity, with no external theme dependency',()=>{
  assert.match(html,/studio-theme\.css/);
  assert.match(html,/studio-mark\.svg/);
  assert.match(css,/collector/i);
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.ok(fs.readFileSync('studio-mark.svg','utf8').includes('<svg'));
  assert.ok(fs.readFileSync('studio-horizon.svg','utf8').includes('<svg'));
});
test('four main tabs (Prices, Drops, My cards, Settings); the scanner and portfolio pages are gone',()=>{
  for(const id of ['prices','product','sets','packs','restock','calendar','deals','mycards','settings','deal','ebay','sealed'])assert.match(html,new RegExp('<section id="'+id+'"'),id);
  for(const id of ['home','dashboard','scan','lots','inventory','sales'])assert.doesNotMatch(html,new RegExp('<section id="'+id+'"|data-tab="'+id+'"'),id+' is gone');
  assert.deepEqual((html.match(/class="tab(?: on)?" data-tab="(\w+)"/g)||[]).map(x=>x.match(/data-tab="(\w+)"/)[1]),['prices','restock','mycards','settings']);
  assert.match(html,/class="tab on" data-tab="prices"/,'Prices opens first');assert.match(html,/<section id="prices">/);
  assert.deepEqual((html.match(/data-dock="(\w+)"/g)||[]).map(x=>x.slice(11,-1)),['prices','restock','mycards','settings']);
  assert.match(html,/id="addCardFab"[^>]*data-page-link="mycards" data-mc-add="1"/,'Add card opens My cards');
  for(const id of ['myCards','backupTop','exportJson','importJson','exportInventory','exportSales','importCsv','cloudConfigure','alertsRows'])assert.match(html,new RegExp('id="'+id+'"'),id);
  assert.doesNotMatch(html,/capture="environment"|tesseract|Scanner studio|OCR/i,'no camera scanner');
});
test('offline shell caches visual assets, not personal data',()=>{
  for(const file of ['studio-theme.css','studio-mark.svg','studio-horizon.svg','mycards.js','collection-value.js','app.js'])assert.ok(sw.includes("'./"+file+"'"),file);
  for(const file of ['card-detect.js','art-rank.js','scan-pipeline.js','scan-tray.js','continuous-scan.js','portfolio.js','home.js'])assert.ok(!sw.includes("'./"+file+"'"),file+' removed');
  assert.match(sw,/const CACHE='pokeflip-shell-v4\.16\.0'/);
  assert.doesNotMatch(sw,/supabase\.co/);
  assert.equal(manifest.theme_color,'#111a2e');
});
test('redesign does not embed demo inventory or fictional market values',()=>{
  assert.doesNotMatch(html,/Stormpeak Vistas|Emberlisk ex|14,892\.36|287,640\.18/);
  assert.match(html,/Always verify card identity and prices/);
});

test('third-party CDN scripts are version-pinned with Subresource Integrity',()=>{
 const html=fs.readFileSync(__dirname+'/../index.html','utf8');
 const tags=[...html.matchAll(/<script src="(https:\/\/[^"]+)"[^>]*>/g)];
 assert.ok(tags.length>=1);
 for(const m of tags){assert.match(m[1],/@\d+\.\d+\.\d+\//,m[1]);assert.match(m[0],/integrity="sha384-[A-Za-z0-9+/=]{64}"/,m[1]);assert.match(m[0],/crossorigin="anonymous"/)}
});
