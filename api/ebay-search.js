/* Cardstead eBay listing search (Vercel serverless function).
 * Official eBay Browse API only (item_summary/search), ebay.ca marketplace, items that deliver to Canada.
 * The eBay keys are read from Vercel environment variables and never reach the browser:
 *   EBAY_CLIENT_ID      = the production keyset's App ID (Client ID)
 *   EBAY_CLIENT_SECRET  = the production keyset's Cert ID (Client Secret)
 * Without them the endpoint answers 503 {configured:false} and the app shows the setup steps (docs/EBAY-SETUP.md).
 * Abuse limits: query length, 50 results, 10-minute cache per query, 60 requests per minute per IP (per instance).
 */
'use strict';
const TOKEN_URL='https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL='https://api.ebay.com/buy/browse/v1/item_summary/search';
const SCOPE='https://api.ebay.com/oauth/api_scope';
const CARDS_CATEGORY='183454'; // CCG Individual Cards
const ALLOWED_ORIGINS=new Set(['https://pokeflip-studio.vercel.app','https://localhost','capacitor://localhost','http://localhost']);
const CACHE_MS=10*60*1000,RATE=60;
let token=null;const cache=new Map(),hits=new Map();

function configured(env=process.env){return !!(env.EBAY_CLIENT_ID&&env.EBAY_CLIENT_SECRET)}
async function getToken(env=process.env,fetchImpl=fetch,now=Date.now()){
 if(token&&token.expires>now+60000)return token.value;
 const basic=Buffer.from(env.EBAY_CLIENT_ID+':'+env.EBAY_CLIENT_SECRET).toString('base64');
 const res=await fetchImpl(TOKEN_URL,{method:'POST',headers:{Authorization:'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope='+encodeURIComponent(SCOPE)});
 if(!res.ok)throw Object.assign(Error('eBay token request failed ('+res.status+')'),{status:502});
 const j=await res.json();token={value:j.access_token,expires:now+Number(j.expires_in||7200)*1000};return token.value;
}
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
/** Keep only what the app shows. */
function slim(it){
 const ship=(it.shippingOptions||[]).map(s=>s.shippingCost).find(Boolean);
 const price=num(it.price?.value),shipping=ship?num(ship.value):null;
 return {id:String(it.itemId||'').slice(0,80),title:String(it.title||'').slice(0,200),price,currency:it.price?.currency||null,
  shipping,shippingCurrency:ship?.currency||null,url:/^https:\/\/www\.ebay\.(ca|com)\//.test(it.itemWebUrl||'')?it.itemWebUrl:null,
  image:/^https:\/\/i\.ebayimg\.com\//.test(it.image?.imageUrl||'')?it.image.imageUrl:null,condition:it.condition||null,
  country:it.itemLocation?.country||null,seller:it.seller?.username||null,feedback:num(it.seller?.feedbackPercentage),
  buyingOptions:it.buyingOptions||[]};
}
async function search(q,{env=process.env,fetchImpl=fetch,now=Date.now()}={}){
 const key=q.toLowerCase();const hit=cache.get(key);if(hit&&now-hit.at<CACHE_MS)return hit.body;
 const t=await getToken(env,fetchImpl,now);
 const params=new URLSearchParams({q,limit:'50',category_ids:CARDS_CATEGORY,filter:'buyingOptions:{FIXED_PRICE},deliveryCountry:CA',sort:'price'});
 const res=await fetchImpl(SEARCH_URL+'?'+params,{headers:{Authorization:'Bearer '+t,'X-EBAY-C-MARKETPLACE-ID':'EBAY_CA','X-EBAY-C-ENDUSERCTX':'contextualLocation=country%3DCA','Accept-Language':'en-CA'}});
 if(res.status===401)token=null;
 if(!res.ok)throw Object.assign(Error('eBay search failed ('+res.status+')'),{status:502});
 const j=await res.json();
 const body={configured:true,marketplace:'EBAY_CA',fetchedAt:new Date(now).toISOString(),total:num(j.total),items:(j.itemSummaries||[]).map(slim)};
 cache.set(key,{at:now,body});if(cache.size>500)cache.delete(cache.keys().next().value);
 return body;
}
function limited(ip,now=Date.now()){const w=hits.get(ip)||[];const recent=w.filter(t=>now-t<60000);recent.push(now);hits.set(ip,recent);if(hits.size>5000)hits.clear();return recent.length>RATE}

async function handler(req,res){
 const origin=req.headers.origin;if(origin&&ALLOWED_ORIGINS.has(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
 res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.statusCode=204;return res.end()}
 if(req.method!=='GET'){res.statusCode=405;return res.end()}
 const send=(code,obj)=>{res.statusCode=code;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(obj))};
 if(!configured())return send(503,{configured:false,message:'eBay search is not set up yet: add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in Vercel (see docs/EBAY-SETUP.md).'});
 const url=new URL(req.url,'https://x');
 if(url.searchParams.get('status')==='1')return send(200,{configured:true});
 const q=(url.searchParams.get('q')||'').trim();
 if(q.length<3||q.length>120||/[<>{}]/.test(q))return send(400,{error:'Query must be 3 to 120 characters.'});
 const ip=String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||'unknown';
 if(limited(ip))return send(429,{error:'Too many searches; wait a minute.'});
 try{send(200,await search(q))}catch(e){send(e.status||500,{error:e.message})}
}
module.exports=handler;
module.exports._test={slim,search,getToken,configured,limited,reset:()=>{token=null;cache.clear();hits.clear()}};
