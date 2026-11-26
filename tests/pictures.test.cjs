// Pictures: allowed image hosts only, lazy images with a placeholder, sealed products found by name, set logos
// matched by name (never the 1999 Base Set for "Scarlet & Violet Base Set"), and the pages that show them.
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
global.window=global;
const P=require('../pictures.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('images: only TCGdex, TCGplayer catalogue and eBay listing hosts; lazy; a placeholder when there is none',()=>{
 assert.equal(P.tcgSrc(704169),'https://tcgplayer-cdn.tcgplayer.com/product/704169_200w.jpg');
 assert.equal(P.tcgSrc('704169'),'https://tcgplayer-cdn.tcgplayer.com/product/704169_200w.jpg','the CDN serves 200 px only (100 px is a 403)');
 assert.equal(P.tcgSrc(null),'');assert.equal(P.tcgSrc('abc'),'');assert.equal(P.tcgSrc(-3),'');
 const im=P.img('https://assets.tcgdex.net/en/swsh/swsh7/215/low.webp');
 assert.match(im,/^<img class="pic" loading="lazy" decoding="async" alt="" src="https:\/\/assets\.tcgdex\.net\//);
 assert.equal(P.img('https://evil.example/x.png'),'','other hosts are never shown');
 assert.equal(P.img('javascript:alert(1)'),'');
 assert.match(P.imgOr('',{cls:'pic prod-pic'}),/^<span class="pic prod-pic pic-ph" aria-hidden="true"><\/span>$/);
 assert.match(P.img('https://i.ebayimg.com/images/g/x/s-l225.jpg"onerror="x'),/src="https:\/\/i\.ebayimg\.com\/images\/g\/x\/s-l225\.jpg&quot;onerror=&quot;x"/,'attributes stay escaped');
 const csp=JSON.parse(read('vercel.json')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
 for(const h of ['https://assets.tcgdex.net','https://tcgplayer-cdn.tcgplayer.com','https://i.ebayimg.com'])assert.ok(csp.includes(h),'img-src allows '+h);
});

test('a watch finds its product picture by name (accents, case and punctuation ignored)',()=>{
 const items=[{kind:'sealed',id:704169,name:'30th Celebration Binder Collection'},{kind:'card',id:5,name:'Pikachu'},{kind:'sealed',id:9,name:'Pokémon 151 Booster Bundle'}];
 assert.equal(P.sealedId('30th celebration binder collection',items),704169);
 assert.equal(P.sealedId('Pokemon 151 Booster-Bundle',items),9);
 assert.equal(P.sealedId('Pikachu',items),null,'only sealed products');assert.equal(P.sealedId('',items),null);
});

test('set logos from TCGdex, matched by name; sets without one keep their pack picture',async()=>{
 const {logoMap}=await import('../tools/build-sets.mjs');
 const l=logoMap([{name:'Scarlet & Violet',logo:'https://assets.tcgdex.net/en/sv/sv01/logo'},{name:'151',logo:'https://assets.tcgdex.net/en/sv/sv03.5/logo'},{name:'Base Set',logo:'https://assets.tcgdex.net/en/base/base1/logo'},{name:'Bad',logo:'https://evil.example/logo'}]);
 assert.equal(l('Scarlet & Violet Base Set'),'https://assets.tcgdex.net/en/sv/sv01/logo.webp');
 assert.equal(l('Scarlet & Violet 151'),'https://assets.tcgdex.net/en/sv/sv03.5/logo.webp');
 assert.equal(l('Base Set'),'https://assets.tcgdex.net/en/base/base1/logo.webp');
 assert.equal(l('Bad'),null,'only TCGdex images');assert.equal(l('Unknown set'),null);
 const idx=require('../data/sets/index.json');assert.ok(idx.sets.filter(s=>s.logo).length>=100,'logos in the daily set data');
 assert.ok(idx.sets.every(s=>!s.logo||/^https:\/\/assets\.tcgdex\.net\/.+\/logo\.webp$/.test(s.logo)));
});

test('pictures on every page that lists products or cards',()=>{
 assert.match(read('index.html'),/<script src="\.\/pictures\.js" defer><\/script><script src="\.\/card-lookup\.js" defer><\/script>/);
 assert.ok(read('sw.js').includes("'./pictures.js'"));
 assert.ok(read('product.js').includes("class=\"prod-row has-pic\""),'Prices results');
 assert.ok(read('product.js').includes("root.CardsteadPics.img(root.CardsteadPics.tcgSrc(it.id),{cls:'pic prod-img'})"),'card and product page');
 assert.ok(read('calendar.js').includes('tcgSrc(p.productId)'),'Coming drops');
 assert.ok(read('restock-watch.js').includes('P.sealedId(w.product,root.CardsteadProduct?.items?.())'),'Drops watches');
 assert.ok(read('sets.js').includes("s.logo?P.img(s.logo,{cls:'pic sets-logo'})"),'All sets: logo, else the pack');
 assert.ok(read('mycards.js').includes("imgOr(i.image,{cls:'pic prod-pic'})"),'My cards in Prices search');
 assert.ok(read('ebay-live.js').includes("image:c.it.image||null"),'the cheapest eBay listing keeps its picture');
 assert.ok(read('collection-value.js').includes("images.push([i.id,j.image+'/low.webp'])"),'older My cards entries get their TCGdex picture');
});

test('older cards get a picture only from TCGdex and only when they have none',()=>{
 const src=read('app.js');assert.ok(src.includes('updateImages:list=>'));
 assert.ok(src.includes("if(!i||i.image||typeof url!=='string'||!/^https:\\/\\/assets\\.tcgdex\\.net\\/[\\w\\/.-]+$/.test(url))continue"));
});
