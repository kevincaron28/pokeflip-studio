/* Cardstead eBay listing search: the logic shared by both hosts.
 *   Vercel:            api/ebay-search.js            (Node serverless function)
 *   Cloudflare Pages:  functions/api/ebay-search.js  (Pages Function, a Worker)
 * Official eBay Browse API only (item_summary/search), ebay.ca marketplace, items that deliver to Canada.
 * The eBay keys come from the host's environment variables and never reach the browser:
 *   EBAY_CLIENT_ID      = the production keyset's App ID (Client ID)
 *   EBAY_CLIENT_SECRET  = the production keyset's Cert ID (Client Secret)
 *   CARDSTEAD_ORIGINS   = optional, comma-separated extra origins allowed by CORS (e.g. a Cloudflare preview URL)
 * Without the keys the endpoint answers 503 {configured:false} and the app shows the setup steps (docs/EBAY-SETUP.md).
 * Two modes: deals (default: the 50 cheapest listings, cached 10 minutes) and value (mode=value: up to 200 listings,
 * the most eBay returns, in eBay's best match order, for the asking median of a card; cached 6 hours). Successful answers carry a CDN cache header
 * (s-maxage) so the host's edge serves repeats without spending eBay calls (5,000 a day for the whole app).
 * Abuse limits: query length, 60 requests per minute per IP (per instance).
 * Files starting with "_" in api/ are not routes on Vercel.
 */
'use strict';
const TOKEN_URL='https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL='https://api.ebay.com/buy/browse/v1/item_summary/search';
const SCOPE='https://api.ebay.com/oauth/api_scope';
const CARDS_CATEGORY='183454'; // CCG Individual Cards
const BASE_ORIGINS=['https://pokeflip-studio.vercel.app','https://localhost','capacitor://localhost','http://localhost'];
const CACHE_MS=10*60*1000,VALUE_CACHE_MS=6*60*60*1000,RATE=60;
// deals: the cheapest listings first (a deal is a low price). value: eBay's best match order, not sorted by price, so
// the asking median is not pulled down when more listings exist than one answer holds (measured 25 Nov 2026).
const MODES={deals:{limit:'50',sort:'price',cacheMs:CACHE_MS},value:{limit:'200',sort:null,cacheMs:VALUE_CACHE_MS}};
let token=null;const cache=new Map(),hits=new Map();

function origins(env={}){return new Set([...BASE_ORIGINS,...String(env.CARDSTEAD_ORIGINS||'').split(',').map(s=>s.trim()).filter(s=>/^https:\/\/[\w.-]+$/.test(s))])}
function configured(env={}){return !!(env.EBAY_CLIENT_ID&&env.EBAY_CLIENT_SECRET)}
async function getToken(env={},fetchImpl=fetch,now=Date.now()){
 if(token&&token.expires>now+60000)return token.value;
 const basic=btoa(env.EBAY_CLIENT_ID+':'+env.EBAY_CLIENT_SECRET);
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
async function search(q,{env={},fetchImpl=fetch,now=Date.now(),mode='deals'}={}){
 const M=MODES[mode]||MODES.deals;
 const key=mode+'|'+q.toLowerCase();const hit=cache.get(key);if(hit&&now-hit.at<M.cacheMs)return hit.body;
 const t=await getToken(env,fetchImpl,now);
 const params=new URLSearchParams({q,limit:M.limit,category_ids:CARDS_CATEGORY,filter:'buyingOptions:{FIXED_PRICE},deliveryCountry:CA'});if(M.sort)params.set('sort',M.sort);
 const res=await fetchImpl(SEARCH_URL+'?'+params,{headers:{Authorization:'Bearer '+t,'X-EBAY-C-MARKETPLACE-ID':'EBAY_CA','X-EBAY-C-ENDUSERCTX':'contextualLocation=country%3DCA','Accept-Language':'en-CA'}});
 if(res.status===401)token=null;
 if(!res.ok)throw Object.assign(Error('eBay search failed ('+res.status+')'),{status:502});
 const j=await res.json();
 const body={configured:true,marketplace:'EBAY_CA',mode,fetchedAt:new Date(now).toISOString(),total:num(j.total),items:(j.itemSummaries||[]).map(slim)};
 cache.set(key,{at:now,body});if(cache.size>500)cache.delete(cache.keys().next().value);
 return body;
}
function limited(ip,now=Date.now()){const w=hits.get(ip)||[];const recent=w.filter(t=>now-t<60000);recent.push(now);hits.set(ip,recent);if(hits.size>5000)hits.clear();return recent.length>RATE}

/** One request, host-neutral: returns {status, headers, body (string or null)}. */
async function handle({method='GET',url,origin,ip='unknown',env={},fetchImpl=fetch,now=Date.now()}){
 const headers={'Cache-Control':'no-store'};
 if(origin&&origins(env).has(origin)){headers['Access-Control-Allow-Origin']=origin;headers.Vary='Origin'}
 if(method==='OPTIONS')return {status:204,headers,body:null};
 if(method!=='GET')return {status:405,headers,body:null};
 const send=(status,obj)=>({status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(obj)});
 if(!configured(env))return send(503,{configured:false,message:'eBay not connected yet: add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in the host\'s environment variables (Vercel or Cloudflare Pages; see docs/EBAY-SETUP.md).'});
 const u=new URL(url,'https://x');
 if(u.searchParams.get('status')==='1')return send(200,{configured:true});
 const q=(u.searchParams.get('q')||'').trim();
 if(q.length<3||q.length>120||/[<>{}]/.test(q))return send(400,{error:'Query must be 3 to 120 characters.'});
 const mode=u.searchParams.get('mode')==='value'?'value':'deals';
 if(limited(ip||'unknown',now))return send(429,{error:'Too many searches; wait a minute.'});
 try{const r=send(200,await search(q,{env,fetchImpl,now,mode}));
  // Let the host's CDN keep the answer (per query and mode): repeats cost no eBay call.
  r.headers['Cache-Control']='public, max-age=0, s-maxage='+Math.round(MODES[mode].cacheMs/1000);return r}
 catch(e){return send(e.status||500,{error:e.message})}
}
module.exports={handle,slim,search,getToken,configured,limited,origins,MODES,reset:()=>{token=null;cache.clear();hits.clear()}};
