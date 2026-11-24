const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..');
const Af=require('../affiliate.js');const C=require('../api/_config-core.js');

test('the Associates tag comes only from the AMAZON_ASSOCIATES_TAG setting, never from the code',()=>{
 assert.deepEqual(C.config({}),{amazonTag:null});
 assert.deepEqual(C.config({AMAZON_ASSOCIATES_TAG:' cardstead-20 '}),{amazonTag:'cardstead-20'});
 assert.deepEqual(C.config({AMAZON_ASSOCIATES_TAG:'bad tag"><script>'}),{amazonTag:null},'only a real .ca tracking id');
 const r=C.handle({method:'GET',origin:'capacitor://localhost',env:{AMAZON_ASSOCIATES_TAG:'cardstead-20'}});
 assert.equal(r.status,200);assert.equal(JSON.parse(r.body).amazonTag,'cardstead-20');assert.equal(r.headers['Access-Control-Allow-Origin'],'capacitor://localhost');
 assert.equal(C.handle({method:'POST'}).status,405);
 for(const f of ['affiliate.js','canada-retailers.js','alert-value.js','restock-watch.js','index.html','api/_config-core.js'])
  assert.ok(!/[a-z0-9]-20['"&]/.test(fs.readFileSync(path.join(root,f),'utf8').replace(/cardstead-20/g,'')),f+' must not contain a tag');
});
test('amazon.ca links get the tag; other links and missing tags leave them alone',()=>{
 assert.equal(Af.amazon('https://www.amazon.ca/dp/B0TEST0001','cardstead-20'),'https://www.amazon.ca/dp/B0TEST0001?tag=cardstead-20');
 assert.equal(Af.amazon('https://www.amazon.ca/s?k=pokemon+etb&tag=other-20','cardstead-20'),'https://www.amazon.ca/s?k=pokemon+etb&tag=cardstead-20');
 assert.equal(Af.amazon('https://www.amazon.ca/gp/aws/cart/add.html?ASIN.1=B0TEST0001&Quantity.1=2','cardstead-20'),'https://www.amazon.ca/gp/aws/cart/add.html?ASIN.1=B0TEST0001&Quantity.1=2&AssociateTag=cardstead-20');
 assert.equal(Af.amazon('https://www.amazon.com/dp/B0TEST0001','cardstead-20'),'https://www.amazon.com/dp/B0TEST0001','amazon.com is not the Canadian program');
 assert.equal(Af.amazon('https://www.walmart.ca/en/ip/x/1','cardstead-20'),'https://www.walmart.ca/en/ip/x/1');
 assert.equal(Af.amazon('https://www.amazon.ca/dp/B0TEST0001',null),'https://www.amazon.ca/dp/B0TEST0001');
 assert.equal(Af.setTag('nope'),null);
});
test('retailer links: Buy now, Amazon search and product links are tagged once the setting is loaded',()=>{
 globalThis.CardsteadAffiliate=Af;Af.setTag('cardstead-20');
 delete require.cache[require.resolve('../canada-retailers.js')];const R=require('../canada-retailers.js');
 assert.match(R.buyUrl({url:'https://www.amazon.ca/dp/B0TEST0001',qty:2}),/cart\/add\.html\?ASIN\.1=B0TEST0001&Quantity\.1=2&AssociateTag=cardstead-20$/);
 assert.match(R.searchUrl(R.RETAILERS.find(r=>r.id==='amazon'),'Delta Reign ETB'),/tag=cardstead-20$/);
 assert.equal(R.buyUrl({url:'https://shop.example/products/a'}),'https://shop.example/products/a');
 Af.setTag(null);delete globalThis.CardsteadAffiliate;
});
test('the disclosure is on the site footer and in Settings, shown only when a tag is set',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const n=(html.match(/data-affiliate-disclosure hidden/g)||[]).length;assert.equal(n,2);
 assert.ok(html.includes('As an Amazon Associate Cardstead earns from qualifying purchases.'));
 assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'./affiliate.js'"),'in the app shell, so the Android app has it too');
});
