const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const FR=require('../i18n-fr.js');
const {makeTranslator,createDomTranslator}=require('../dom-i18n.js');

test('every English text of the older screens has a French entry (or is kept on purpose)',async()=>{
 const {allStrings}=await import('../tools/extract-ui-strings.mjs');
 const a=allStrings();const keys=[...a.static,...a.runtime];
 assert.ok(keys.length>900,'extractor found the UI text');
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
