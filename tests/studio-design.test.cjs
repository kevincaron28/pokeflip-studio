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
test('all ten original routes and controls remain in redesigned navigation',()=>{
  for(const id of ['dashboard','scan','deal','lots','inventory','sales','ebay','sealed','restock','settings']){
    assert.match(html,new RegExp('data-tab="'+id+'"'));
    assert.match(html,new RegExp('<section id="'+id+'"'));
  }
  assert.equal((html.match(/class="tab(?: on)?" data-tab="/g)||[]).length,10);
  for(const id of ['lotForm','bulkForm','inventorySearch','saleDate','backupTop','cloudConfigure','alertsRows']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
});
test('offline shell caches visual assets, not personal data',()=>{
  for(const file of ['studio-theme.css','studio-mark.svg','studio-horizon.svg'])assert.ok(sw.includes("'./"+file+"'"));
  assert.match(sw,/const CACHE='pokeflip-shell-v4\.1'/);
  assert.doesNotMatch(sw,/supabase\.co/);
  assert.equal(manifest.theme_color,'#111a2e');
});
test('redesign does not embed demo inventory or fictional market values',()=>{
  assert.doesNotMatch(html,/Stormpeak Vistas|Emberlisk ex|14,892\.36|287,640\.18/);
  assert.match(html,/Always verify card identity and prices/);
});
