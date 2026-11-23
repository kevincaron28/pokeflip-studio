const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');const R=require('../canada-retailers.js');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('catalogue covers the requested Canadian retailers, each with a usable search link',()=>{
 const names=R.RETAILERS.map(r=>r.name).join('|');
 for(const n of ['Costco','EB Games','Walmart','Best Buy','Toys','Amazon.ca','Indigo','London Drugs','Canadian Tire','Superstore','The Source','Shoppers'])assert.match(names,new RegExp(n.replace('"','.'),'i'),n);
 for(const r of R.RETAILERS){const u=new URL(R.searchUrl(r,'Prismatic Évolutions ETB & more'));assert.equal(u.protocol,'https:',r.id);assert.ok(!R.searchUrl(r,'x').includes('{q}'),r.id);assert.ok(['verified-2026-11-23','unverified','fallback'].includes(r.confidence),r.id)}
 assert.match(R.searchUrl(R.RETAILERS[0],'a b&c'),/a%20b%26c/);
});
test('only independent Shopify shops are automatic; every big chain is manual',()=>{
 for(const id of ['costco','ebgames','walmart','bestbuy','toysrus','amazon','indigo','londondrugs','canadiantire','superstore','thesource','shoppers','pokemoncenter'])assert.equal(R.RETAILERS.find(r=>r.id===id).auto,'manual',id);
 assert.ok(R.AUTO_HOSTS.length>=3);
});
test('shopifyJsUrl accepts allow-listed product URLs only',()=>{
 assert.equal(R.shopifyJsUrl('https://tistaminis.com/products/some-etb?variant=1'),'https://tistaminis.com/products/some-etb.js');
 assert.equal(R.shopifyJsUrl('https://doescards.ca/fr/products/boite.json'),'https://doescards.ca/products/boite.js');
 for(const bad of ['http://tistaminis.com/products/x','https://evil.example/products/x','https://tistaminis.com@evil.example/products/x','https://tistaminis.com/collections/pokemon','https://www.walmart.ca/en/ip/x','javascript:alert(1)','nonsense',''])assert.equal(R.shopifyJsUrl(bad),null,bad);
});
test('parseShopifyProduct reports availability and price honestly',()=>{
 assert.deepEqual(R.parseShopifyProduct({title:'ETB',variants:[{available:false,price:6999},{available:true,price:5499}]}),{status:'in',price:54.99,title:'ETB'});
 assert.equal(R.parseShopifyProduct({title:'ETB',variants:[{available:false,price:6999}]}).status,'out');
 assert.equal(R.parseShopifyProduct({title:'x',variants:[{available:true,price:'54.99'}]}).price,54.99);
 for(const bad of [null,{},{variants:[]},{variants:[{available:true,price:'abc'}]}])assert.equal(R.parseShopifyProduct(bad),null);
});
test('polling interval is modest and CSP allows exactly the automatic hosts',()=>{
 assert.ok(R.MIN_POLL_MS>=15*60*1000);
 const csp=JSON.parse(read('vercel.json')).headers.flatMap(h=>h.headers).find(h=>h.key==='Content-Security-Policy').value;
 const connect=csp.match(/connect-src ([^;]+)/)[1].split(' ');
 for(const h of R.AUTO_HOSTS)assert.ok(connect.includes('https://'+h),h);
});
test('module is packaged, loaded before restock-watch, and polls only with safe fetch options',()=>{
 assert.ok(read('sw.js').includes("'./canada-retailers.js'"));
 const html=read('index.html');assert.ok(html.indexOf('canada-retailers.js')>0&&html.indexOf('canada-retailers.js')<html.indexOf('restock-watch.js'));
 const w=read('restock-watch.js');assert.match(w,/credentials:'omit'/);assert.match(w,/redirect:'error'/);assert.match(w,/document\.hidden/);
 assert.doesNotMatch(w,/captcha|proxy|rotate/i);
});
