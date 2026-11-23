const {test,beforeEach}=require('node:test');const assert=require('node:assert/strict');
const handler=require('../api/ebay-search.js');const T=handler._test;
function call(url,{origin,env={},method='GET',ip='1.1.1.1'}={}){
 const saved={id:process.env.EBAY_CLIENT_ID,secret:process.env.EBAY_CLIENT_SECRET};
 if('EBAY_CLIENT_ID' in env)process.env.EBAY_CLIENT_ID=env.EBAY_CLIENT_ID;else delete process.env.EBAY_CLIENT_ID;
 if('EBAY_CLIENT_SECRET' in env)process.env.EBAY_CLIENT_SECRET=env.EBAY_CLIENT_SECRET;else delete process.env.EBAY_CLIENT_SECRET;
 const res={headers:{},statusCode:200,body:'',setHeader(k,v){this.headers[k.toLowerCase()]=v},end(b=''){this.body=b}};
 return Promise.resolve(handler({method,url,headers:{origin,'x-forwarded-for':ip}},res)).then(()=>{
  if(saved.id===undefined)delete process.env.EBAY_CLIENT_ID;else process.env.EBAY_CLIENT_ID=saved.id;
  if(saved.secret===undefined)delete process.env.EBAY_CLIENT_SECRET;else process.env.EBAY_CLIENT_SECRET=saved.secret;
  return {...res,json:res.body?JSON.parse(res.body):null}});
}
beforeEach(()=>T.reset());

test('without keys it says so and never calls eBay',async()=>{
 const r=await call('/api/ebay-search?q=umbreon');assert.equal(r.statusCode,503);assert.equal(r.json.configured,false);assert.match(r.json.message,/EBAY_CLIENT_ID/);
});
test('CORS only for the app\'s own origins',async()=>{
 assert.equal((await call('/api/ebay-search?q=x',{origin:'https://localhost'})).headers['access-control-allow-origin'],'https://localhost');
 assert.equal((await call('/api/ebay-search?q=x',{origin:'https://evil.example'})).headers['access-control-allow-origin'],undefined);
});
test('query validation and status check',async()=>{
 const env={EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret'};
 assert.equal((await call('/api/ebay-search?q=ab',{env})).statusCode,400);
 assert.equal((await call('/api/ebay-search?q='+'a'.repeat(121),{env})).statusCode,400);
 assert.deepEqual((await call('/api/ebay-search?status=1',{env})).json,{configured:true});
});
test('Browse API call: client-credentials token reused, ebay.ca marketplace, Canada delivery, results slimmed and cached',async()=>{
 const calls=[];const fetchImpl=async(url,opts)=>{calls.push({url,opts});
  if(url.includes('oauth2'))return {ok:true,status:200,json:async()=>({access_token:'tok',expires_in:7200})};
  return {ok:true,status:200,json:async()=>({total:2,itemSummaries:[
   {itemId:'v1|1|0',title:'Umbreon VMAX 215/203',price:{value:'1200.00',currency:'CAD'},shippingOptions:[{shippingCost:{value:'15.00',currency:'CAD'}}],itemWebUrl:'https://www.ebay.ca/itm/1',image:{imageUrl:'https://i.ebayimg.com/x.jpg'},seller:{username:'s',feedbackPercentage:'99.5'},itemLocation:{country:'CA'},condition:'Ungraded'},
   {itemId:'v1|2|0',title:'x',price:{value:'5',currency:'USD'},itemWebUrl:'javascript:alert(1)',image:{imageUrl:'http://evil/x.png'}}]})};
 };
 const env={EBAY_CLIENT_ID:'id',EBAY_CLIENT_SECRET:'secret'};
 const a=await T.search('umbreon vmax 215/203',{env,fetchImpl,now:1e12});
 await T.search('umbreon vmax 215/203',{env,fetchImpl,now:1e12+1000});
 await T.search('charizard 4/102',{env,fetchImpl,now:1e12+2000});
 assert.equal(calls.filter(c=>c.url.includes('oauth2')).length,1,'token reused');
 assert.equal(calls.filter(c=>c.url.includes('item_summary')).length,2,'same query served from cache');
 const s=calls.find(c=>c.url.includes('item_summary'));
 assert.equal(s.opts.headers['X-EBAY-C-MARKETPLACE-ID'],'EBAY_CA');assert.match(s.url,/deliveryCountry%3ACA/);assert.match(s.url,/category_ids=183454/);
 assert.equal(calls[0].opts.headers.Authorization,'Basic '+Buffer.from('id:secret').toString('base64'));
 assert.deepEqual([a.items[0].price,a.items[0].shipping,a.items[0].feedback],[1200,15,99.5]);
 assert.equal(a.items[1].url,null);assert.equal(a.items[1].image,null);
});
test('rate limit per IP',()=>{for(let i=0;i<60;i++)assert.equal(T.limited('9.9.9.9',1000+i),false);assert.equal(T.limited('9.9.9.9',1100),true)});
