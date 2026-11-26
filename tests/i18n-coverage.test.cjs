const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const FR=require('../i18n-fr.js');
const {makeTranslator,createDomTranslator}=require('../dom-i18n.js');

test('every English text of the older screens has a French entry (or is kept on purpose)',async()=>{
 const {allStrings}=await import('../tools/extract-ui-strings.mjs');
 const a=allStrings();const keys=[...a.static,...a.runtime];
 // About 800 since the scanner, lots, sales and dashboard pages were removed (25 Nov 2026); far fewer means the extractor broke.
 assert.ok(keys.length>600,'extractor found the UI text');
 const missing=keys.filter(k=>!(k in FR));
 assert.deepEqual(missing,[],'run node tools/extract-ui-strings.mjs and add these to i18n-fr.js');
});

test('French uses tu, never vous, and keeps every {n} placeholder',()=>{
 for(const [en,fr] of Object.entries(FR)){
  if(fr==null)continue;
  assert.ok(!/\bvous\b|\bvotre\b|\bvos\b/i.test(fr),`vous in: ${fr}`);
  const ph=s=>(s.match(/\{\d+\}/g)||[]).sort().join();
  assert.equal(ph(fr),ph(en),`placeholders differ for: ${en}`);
 }
});

test('translator: exact text, patterns with values, trailing punctuation and phrases inside sentences',()=>{
 const tr=makeTranslator({'Delete':'Supprimer','{0} cards need sorting.':'{0} cartes à trier.','Not verified':'Non vérifié','Collector number':'Numéro de collection','Found in':'Trouvée dans','Pokémon Center Canada':null});
 assert.equal(tr('  Delete '),'Supprimer');
 assert.equal(tr('12 cards need sorting.'),'12 cartes à trier.');
 assert.equal(tr('Not verified:'),'Non vérifié:');
 assert.equal(tr('Found in English · Not verified'),'Trouvée dans English · Non vérifié');
 assert.equal(tr('Pokémon Center Canada'),null,'brand names stay');
 assert.equal(tr('Charizard ex 4/102'),null,'card names stay');
 assert.equal(tr('1 234,56 $'),null);
});

test('DOM translator translates text, placeholders and buttons, follows new text and restores English',async(t0)=>{
 let JSDOM;try{({JSDOM}=require('jsdom'))}catch{t0.skip('jsdom not installed: tests/i18n-fr-browser.py covers this in a real browser');return}
 const dom=new JSDOM('<body><h2>Purchase lot</h2><input placeholder="Search a card"><input type="button" value="Delete"><p data-i18n="x">Delete</p><div id="out"></div></body>');
 const doc=dom.window.document;
 const t=createDomTranslator(doc,{'Purchase lot':"Lot d’achat",'Search a card':'Cherche une carte','Delete':'Supprimer','{0} cards':'{0} cartes'},{dialogs:false});
 t.enable();
 assert.equal(doc.querySelector('h2').textContent,"Lot d’achat");
 assert.equal(doc.querySelector('input').placeholder,'Cherche une carte');
 assert.equal(doc.querySelector('input[type=button]').value,'Supprimer');
 assert.equal(doc.querySelector('p').textContent,'Delete','ui-i18n elements are left to ui-i18n');
 doc.getElementById('out').textContent='3 cards';
 await new Promise(r=>setTimeout(r,0));
 assert.equal(doc.getElementById('out').textContent,'3 cartes');
 t.disable();
 assert.equal(doc.querySelector('h2').textContent,'Purchase lot');
 assert.equal(doc.querySelector('input').placeholder,'Search a card');
 assert.equal(doc.getElementById('out').textContent,'3 cards');
});

test('the translator ships with the app and only changes the screen, never saved data',()=>{
 const html=read('index.html'),sw=read('sw.js'),src=read('dom-i18n.js');
 assert.ok(html.indexOf('i18n-fr.js')<html.indexOf('dom-i18n.js'));
 assert.match(sw,/'\.\/i18n-fr\.js','\.\/dom-i18n\.js'/);
 assert.ok(!/localStorage\.setItem|indexedDB|\bsave\(/.test(src),'dom-i18n writes no data');
});

/* A new page or script must not ship in English only. */
// Scripts that write no text of the older screens: they carry their own EN/FR text (ui-i18n.js or an inline pair) or only data.
const OWN_LANGUAGE=['pictures.js','card-lookup.js','canada-shops.js','affiliate.js','canada-retailers.js','ui-i18n.js','price-chart.js','pack-ev-rates.js','store-prefs.js','ebay-live.js','compare-stores.js','routes.js','price-line.js','set-completion.js','sets.js','calendar.js','product.js','collection-value.js','mycards.js','nav.js','i18n-fr.js','dom-i18n.js'];

test('every script of the page is either checked for French or listed as bilingual or data',async()=>{
 const {RUNTIME_FILES}=await import('../tools/extract-ui-strings.mjs');
 const scripts=[...read('index.html').matchAll(/<script[^>]*\ssrc="\.\/([^"]+)"/g)].map(m=>m[1]);
 assert.ok(scripts.length>20);
 assert.deepEqual(scripts.filter(f=>!RUNTIME_FILES.includes(f)&&!OWN_LANGUAGE.includes(f)),[],'add the script to RUNTIME_FILES (tools/extract-ui-strings.mjs) or, if it is bilingual itself, to OWN_LANGUAGE here');
});

/** Text in a piece of markup that no data-i18n or data-no-translate element covers. */
function uncovered(markup){
 const out=[],stack=[];const VOID=/^(area|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
 for(const m of markup.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/g)){
  if(m[4]!==undefined){const text=m[4].replace(/&[a-z]+;|&#\d+;/gi,' ').trim();if(/[A-Za-z]{2}/.test(text)&&!stack.some(e=>e.covered))out.push(text);continue}
  if(!m[2])continue;
  if(m[1]){const at=stack.map(e=>e.tag).lastIndexOf(m[2]);if(at>=0)stack.length=at;continue}
  if(!VOID.test(m[2])&&!/\/\s*$/.test(m[3]))stack.push({tag:m[2],covered:/\sdata-(i18n|no-translate)\b/.test(m[3])||m[2]==='svg'});
 }
 return out;
}
function element(html,id){
 const open=new RegExp('<([a-z]+)\\b[^>]*\\sid="'+id+'"[^>]*>').exec(html);if(!open)return null;
 const rx=new RegExp('<(/?)'+open[1]+'\\b[^>]*>','g');rx.lastIndex=open.index;let depth=0;
 for(let m=rx.exec(html);m;m=rx.exec(html)){depth+=m[1]?-1:1;if(!depth)return html.slice(open.index,rx.lastIndex)}
 return null;
}

test('a page the translator skips has no text of its own without a French key',()=>{
 const ids=[.../const OWN='([^']+)'/.exec(read('dom-i18n.js'))[1].matchAll(/#([\w-]+)/g)].map(m=>m[1]);
 assert.ok(ids.includes('prices'));assert.ok(!ids.includes('packs')&&!ids.includes('deals'),'Pack value and eBay deals are translated');
 const html=read('index.html');
 // Some listed pages are built by their script, so index.html has no markup for them.
 for(const id of ids){const el=element(html,id);if(!el)continue;assert.deepEqual(uncovered(el),[],`#${id}: give this text a data-i18n key, or remove #${id} from OWN so i18n-fr.js translates it`)}
 assert.ok(element(html,'prices'),'the Prices page is checked');
 assert.deepEqual(uncovered('<section id="x"><h1>New page</h1></section>'),['New page'],'the check itself catches English');
});

test('sentences stored in data files have French',()=>{
 global.window=global;require('../pack-ev-rates.js');
 const missing=[];
 (function walk(o,key){
  if(typeof o==='string'){if((key==='note'||key==='caveats'||key==='notes')&&!(o in FR))missing.push(o);return}
  if(o&&typeof o==='object')for(const [k,v] of Object.entries(o))walk(v,key==='notes'?'notes':k);
 })(global.CardsteadPackRates,'');
 delete global.window;
 assert.deepEqual(missing,[],'add these pack-ev-rates.js sentences to i18n-fr.js');
 for(const r of JSON.parse(read('data/official-releases.json')).releases)if(r.note)assert.ok(r.noteFr,r.set+': write noteFr beside note');
});
