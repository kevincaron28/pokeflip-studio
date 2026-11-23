const {test,beforeEach}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..');const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const vercel=JSON.parse(read('vercel.json'));const VH=vercel.headers.find(h=>h.source==='/(.*)').headers;
const core=require('../api/_ebay-core.js');
beforeEach(()=>core.reset());

test('Pages build: same files as Vercel, short headers in _headers, Functions only where a CSP matters',async()=>{
 const b=await import('../tools/build-pages.mjs');
 const out=b.build();
 const has=f=>fs.existsSync(path.join(out,f));
 for(const f of ['index.html','privacy.html','sw.js','app.js','dom-i18n.js','price-history.js','manifest.webmanifest','icon-512.png'])assert.ok(has(f),f);
 for(const f of ['mobile','functions','api','.git','.github','wrangler.toml'])assert.ok(!has(f),'not served: '+f);
 // every shell file the service worker caches is published
 const shell=[...read('sw.js').matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]).filter(Boolean);
 for(const f of shell)assert.ok(has(f),'service worker file missing on Pages: '+f);
 const h=fs.readFileSync(path.join(out,'_headers'),'utf8');
 for(const {key,value} of VH)if(key!=='Content-Security-Policy')assert.ok(h.includes(`  ${key}: ${value}`),key);
 assert.ok(h.split('\n').every(l=>l.length<=2000),'Pages limit: 2,000 characters per _headers line');
 assert.ok(VH.find(x=>x.key==='Content-Security-Policy').value.length>2000,'the CSP is why a middleware is needed');
 const routes=JSON.parse(fs.readFileSync(path.join(out,'_routes.json'),'utf8'));
 assert.deepEqual(routes.include,['/','/index.html','/privacy','/privacy.html','/sw.js','/api/*']);
});

test('middleware sends every vercel.json header, including the full CSP',async()=>{
 const m=await import('../functions/_middleware.js');
 const res=await m.onRequest({next:async()=>new Response('<!doctype html>',{headers:{'Content-Type':'text/html'}})});
 for(const {key,value} of VH)assert.equal(res.headers.get(key),value,key);
 assert.equal(res.headers.get('Content-Type'),'text/html');
});

function ctx(url,{env={},origin,ip='1.1.1.1',method='GET'}={}){
 const headers=new Headers({'CF-Connecting-IP':ip});if(origin)headers.set('Origin',origin);
 return {request:new Request('https://cardstead.pages.dev'+url,{method,headers}),env};
}
test('eBay Pages Function answers like the Vercel one, CORS for the app and extra preview origins',async()=>{
 const f=await import('../functions/api/ebay-search.js');
 let r=await f.onRequest(ctx('/api/ebay-search?q=umbreon'));
 assert.equal(r.status,503);assert.equal((await r.json()).configured,false);
 r=await f.onRequest(ctx('/api/ebay-search?status=1',{env:{EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'s'},origin:'https://localhost'}));
 assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://localhost');
 r=await f.onRequest(ctx('/api/ebay-search?q=ab',{env:{EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'s'},origin:'https://evil.example'}));
 assert.equal(r.status,400);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
 r=await f.onRequest(ctx('/api/ebay-search?status=1',{env:{EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'s',CARDSTEAD_ORIGINS:'https://cardstead.pages.dev, javascript:x'},origin:'https://cardstead.pages.dev'}));
 assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://cardstead.pages.dev');
 assert.equal(core.origins({CARDSTEAD_ORIGINS:'javascript:x,http://plain.example'}).has('http://plain.example'),false,'only https origins can be added');
});

test('a successful search is shared through the edge cache for 10 minutes',async()=>{
 const store=new Map();
 globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(),put:async(k,v)=>{store.set(k.url,v)}}};
 const realFetch=globalThis.fetch;let ebay=0;
 globalThis.fetch=async url=>{ebay++;if(String(url).includes('oauth2'))return new Response(JSON.stringify({access_token:'t',expires_in:7200}));
  return new Response(JSON.stringify({total:1,itemSummaries:[{itemId:'1',title:'Umbreon VMAX',price:{value:'10',currency:'CAD'}}]}))};
 try{
  const f=await import('../functions/api/ebay-search.js');const env={EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'s'};
  const a=await f.onRequest(ctx('/api/ebay-search?q=Umbreon%20VMAX',{env}));assert.equal(a.status,200);
  core.reset();
  const b=await f.onRequest(ctx('/api/ebay-search?q=umbreon%20vmax',{env,origin:'https://localhost'}));
  assert.equal(b.status,200);assert.equal((await b.json()).items[0].title,'Umbreon VMAX');
  assert.equal(b.headers.get('Access-Control-Allow-Origin'),'https://localhost');
  assert.equal(ebay,2,'second search came from the edge cache, not eBay');
  assert.match(store.values().next().value.headers.get('Cache-Control'),/max-age=600/);
 }finally{globalThis.fetch=realFetch;delete globalThis.caches}
});

test('no secret in the Cloudflare config; keys documented as dashboard secrets',()=>{
 const w=read('wrangler.toml');assert.match(w,/pages_build_output_dir = "dist"/);
 assert.ok(!/EBAY_CLIENT_SECRET\s*=|api[_-]?key\s*=|token\s*=/i.test(w));
 assert.match(read('.gitignore'),/^\.dev\.vars$/m);assert.match(read('.gitignore'),/^dist\/$/m);
});
