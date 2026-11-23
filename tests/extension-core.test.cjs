const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');const A=require('../extension/lib/core.js');
const fx=f=>fs.readFileSync(path.join(root,'tests/fixtures/extension',f),'utf8');
const amazon={id:'amazon:B0TEST0001',store:'amazon',name:'ETB',maxPrice:70,maxQty:2,enabled:true,amazonOnly:true};

test('product links: Amazon.ca ASIN or URL, Pokémon Center Canada only',()=>{
 assert.equal(A.productFromInput('b0test0001').url,'https://www.amazon.ca/dp/B0TEST0001');
 assert.equal(A.productFromInput('https://www.amazon.ca/Pokemon-Surging/dp/B0TEST0001/ref=sr_1_1?x=1').id,'amazon:B0TEST0001');
 assert.equal(A.productFromInput('https://www.amazon.com/dp/B0TEST0001'),null,'Amazon.com is not Amazon.ca');
 assert.equal(A.productFromInput('https://www.pokemoncenter.com/en-ca/product/10-10037-118/surging-sparks-etb').store,'pokemoncenter');
 assert.equal(A.productFromInput('https://www.pokemoncenter.com/en-us/product/10-10037-118/x'),null,'US store is not supported');
 assert.equal(A.productFromInput('http://www.amazon.ca/dp/B0TEST0001'),null);
});
test('Amazon parser: stock, price, seller, quantity and the robot check',()=>{
 assert.deepEqual({...A.parseAmazon(fx('amazon-in-stock.html'))},{robotCheck:false,inStock:true,price:64.99,seller:'amazon',maxQty:3,title:'Pokémon TCG: Surging Sparks Elite Trainer Box'});
 assert.equal(A.parseAmazon(fx('amazon-third-party.html')).seller,'third-party');
 assert.equal(A.parseAmazon(fx('amazon-unavailable.html')).inStock,false);
 assert.equal(A.parseAmazon(fx('amazon-robot.html')).robotCheck,true);
 assert.equal(A.money('54,99 $'),54.99);assert.equal(A.money('CDN$ 1,234.50'),1234.5);
});
test('Pokémon Center parser: stock, price, limit and the waiting room',()=>{
 const o=A.parsePokemonCenter(fx('pc-in-stock.html'));assert.deepEqual([o.queue,o.inStock,o.price,o.limit],[false,true,74.99,2]);
 assert.equal(A.parsePokemonCenter(fx('pc-sold-out.html')).inStock,false);
 assert.equal(A.parsePokemonCenter(fx('pc-queue.html')).queue,true);
});
test('drop decision: max price, Amazon.ca as seller, robot check backoff, queue, cooldown, paused',()=>{
 const ok=A.parseAmazon(fx('amazon-in-stock.html'));
 assert.equal(A.decide(amazon,ok).action,'drop');
 assert.equal(A.decide({...amazon,maxPrice:60},ok).action,'none');
 assert.equal(A.decide(amazon,A.parseAmazon(fx('amazon-third-party.html'))).action,'none');
 assert.equal(A.decide({...amazon,amazonOnly:false},A.parseAmazon(fx('amazon-third-party.html'))).action,'drop');
 const b=A.decide(amazon,A.parseAmazon(fx('amazon-robot.html')),{},1000);assert.equal(b.action,'backoff');assert.equal(b.until,1000+30*60000);
 assert.equal(A.decide({...amazon,store:'pokemoncenter'},A.parsePokemonCenter(fx('pc-queue.html'))).action,'queue');
 assert.equal(A.decide(amazon,ok,{lastDropAt:Date.now()-60000}).action,'none');
 assert.equal(A.decide({...amazon,enabled:false},ok).action,'none');
 assert.equal(A.decide(amazon,{...ok,price:null}).action,'none','never act without a price');
});
test('quantity respects the owner max, the page and the store limit',()=>{
 assert.equal(A.quantity({maxQty:5},3,null),3);assert.equal(A.quantity({maxQty:5},null,2),2);assert.equal(A.quantity({maxQty:1},10,4),1);assert.equal(A.quantity({maxQty:0},null,null),1);
});
test('polite schedule: at least 2 minutes with jitter, backing off after failures',()=>{
 assert.ok(A.nextDelayMs(1,0,0)>=2*60000*0.8);assert.equal(A.nextDelayMs(3,0,0.5),180000);assert.equal(A.nextDelayMs(3,2,0.5),720000);assert.equal(A.nextDelayMs(3,9,0.5),180000*8);
});
test('never presses a final purchase control',()=>{
 for(const t of ['Place your order','Place Order','Passer la commande','Buy Now','Buy now with 1-Click','Pay now','Submit order','Complete purchase','Confirm and pay','Acheter maintenant'])assert.equal(A.isFinalPurchaseControl(t),true,t);
 for(const t of ['Add to Cart','Proceed to checkout','Checkout','Ajouter au panier'])assert.equal(A.isFinalPurchaseControl(t),false,t);
});
test('Cardstead alerts trigger checks only for watched products',()=>{
 assert.deepEqual(A.signalsFromCardstead([{url:'https://www.amazon.ca/dp/B0TEST0001?tag=x'},{url:'https://www.amazon.ca/dp/B0OTHER001'},{url:'https://walmart.ca/x'}],[amazon]),['amazon:B0TEST0001']);
});
test('manifest: MV3, narrow permissions, no secrets collected',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));
 assert.equal(m.manifest_version,3);
 assert.deepEqual(m.host_permissions.sort(),['https://ntfy.sh/*','https://www.amazon.ca/*','https://www.pokemoncenter.com/*']);
 for(const bad of ['<all_urls>','cookies','webRequest','debugger','scripting'])assert.ok(!JSON.stringify(m).includes(bad),bad);
 const ui=fs.readFileSync(path.join(root,'extension/options.html'),'utf8');
 for(const input of ui.match(/<input[^>]*>/gi)||[])assert.ok(!/password|\bcard\b|card.?number|cvv|cvc|expir|iban|\baccount\b/i.test(input),'no password or card fields: '+input);
 for(const f of ['background.js','content/assist.js','options.js'])assert.ok(!/\.click\(\)/.test(fs.readFileSync(path.join(root,'extension',f),'utf8').replace(/function safeClick[\s\S]*?el\.click\(\);return true;\n\}/,'')),f+': every click goes through safeClick');
});
