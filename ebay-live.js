/* Cardstead eBay live prices: what an exact card is listed for on ebay.ca right now.
 * - Source: the official eBay Browse API through /api/ebay-search?mode=value (up to 200 fixed-price listings that
 *   deliver to Canada, cheapest first). Asking prices, never sales.
 * - Only listings of the exact card count: name and collector number, printing (reverse holo or not), edition,
 *   raw vs the exact grade, the card's language; junk (proxies, lots, keychains...) is dropped (ebay-watch.js rules).
 *   Raw cards: listings that say they are played are left out of the median.
 * - Value: the median after dropping the cheapest and dearest 20%, in CA$ including shipping (USD at the Bank of
 *   Canada rate of the price snapshot). Needs 3 listings. Confidence: medium with 5+ listings close together, else low;
 *   low too when eBay had more matches than it returned.
 * - Cheapest real listing: the lowest price + shipping among the matching listings from sellers with feedback, never
 *   one more than 50% under the median (almost never the real card).
 * - Calls: cached 6 hours on this device and at the host's edge; at most 150 lookups a day per device. eBay allows
 *   5,000 calls a day for the whole app.
 */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const TTL=6*60*60*1000,BUDGET=150,KEY='cardstead-ebay-live-v1',COUNT='cardstead-ebay-live-count-v1',MAX_CACHE=600;

/** What to search on eBay for a card. Pure. */
function queryFor(card){
 if(card.ebayQuery)return String(card.ebayQuery).slice(0,120);
 const num=String(card.number||'').split('/')[0];
 return [card.name,num,card.set,card.grade&&card.grade!=='raw'?card.grade:'',card.lang==='fr'?'french':''].filter(Boolean).join(' ').replace(/\s+/g,' ').trim().slice(0,120);
}
/** Cache key: the query plus what decides which listings count. Pure. */
function keyFor(card){return [queryFor(card),card.grade||'raw',card.printing||'',card.lang||'en'].join('|').toLowerCase()}
/** Live eBay value of a card from one search answer. W: the eBay deals rules (ebay-watch.js). Pure. */
function liveFrom(res,card,fx,W){
 const graded=!!(card.grade&&card.grade!=='raw'),items=res?.items||[];
 const rows=[];
 for(const it of items){const m=W.matches(it.title,card,it);if(!m.ok)continue;if(!graded&&m.condition&&m.condition!=='NM')continue;const t=W.total(it,fx);if(!t)continue;rows.push({it,t})}
 const v=W.listingValue(items,card,fx,{nmOnly:!graded});
 const truncated=isNum(res?.total)&&res.total>items.length;
 const confidence=v?(truncated?'low':v.confidence):null;
 const ok=rows.filter(r=>r.it.url&&r.it.feedback>0&&(!v||r.t.cad>=v.cad*0.5)).sort((a,b)=>a.t.cad-b.t.cad);
 const c=ok[0];
 return {cad:v?v.cad:null,n:rows.length,confidence,spread:v?v.spread:null,truncated,fetchedAt:res?.fetchedAt||null,
  cheapest:c?{cad:Math.round(c.t.cad*100)/100,shippingKnown:c.t.shippingKnown,url:c.it.url,title:c.it.title,seller:c.it.seller,feedback:c.it.feedback}:null};
}
/** Lookups left today on this device. Pure. */
function budgetLeft(count,today){return count&&count.day===today?Math.max(0,BUDGET-count.n):BUDGET}
const core={queryFor,keyFor,liveFrom,budgetLeft,TTL,BUDGET};
root.CardsteadEbayLive=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root.document)return;

const jget=(k,d)=>{try{const v=JSON.parse(root.localStorage.getItem(k)||'null');return v??d}catch{return d}};
const jset=(k,v)=>{try{root.localStorage.setItem(k,JSON.stringify(v))}catch{}};
const API=()=>(root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'')+'/api/ebay-search';
const SRC=()=>root.PokeFlipNative&&root.PokeFlipNative.isNative?'&src=app':'';
const today=()=>new Date().toISOString().slice(0,10);
const inflight=new Map();
async function fx(){try{const d=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData():root.CardsteadPackData;return d?.fx?.usdToCad??null}catch{return null}}
/** Cached value if fresh (no call). */
function cached(card,now=Date.now()){const c=jget(KEY,{})[keyFor(card)];return c&&now-Date.parse(c.at)<TTL?c.live:null}
/** Live value: cached, or one search (within today's budget). {state:'ok'|'off'|'limit'|'error', live?} */
async function get(card,{force=false}={}){
 const W=root.CardsteadEbayWatch;if(!W)return {state:'error',error:'eBay rules not loaded'};
 if(!force){const c=cached(card);if(c)return {state:'ok',live:c,cached:true}}
 const k=keyFor(card);if(inflight.has(k))return inflight.get(k);
 const p=(async()=>{
  const count=jget(COUNT,null);if(budgetLeft(count,today())<=0)return {state:'limit'};
  try{
   const r=await fetch(API()+'?mode=value&q='+encodeURIComponent(queryFor(card))+SRC());
   jset(COUNT,{day:today(),n:(count&&count.day===today()?count.n:0)+1});
   const j=await r.json().catch(()=>({}));
   if(r.status===503)return {state:'off'};
   if(!r.ok)return {state:'error',error:j.error||String(r.status)};
   const live=liveFrom(j,card,await fx(),W);
   const all=jget(KEY,{});all[k]={at:new Date().toISOString(),live};
   const keys=Object.keys(all);if(keys.length>MAX_CACHE)keys.sort((a,b)=>Date.parse(all[a].at)-Date.parse(all[b].at)).slice(0,keys.length-MAX_CACHE).forEach(x=>delete all[x]);
   jset(KEY,all);return {state:'ok',live};
  }catch(e){return {state:'error',error:e.message}}
  finally{inflight.delete(k)}
 })();
 inflight.set(k,p);return p;
}
const I=()=>root.CardsteadI18n,t=(k,...a)=>I()?I().t(k,...a):k,M=v=>I()?I().money(v):'CA$'+Number(v).toFixed(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PILL={medium:'gold',low:'red'};
function when(iso){const d=Date.parse(iso||'');if(!Number.isFinite(d))return '';const lang=I()?.lang?.()==='fr'?'fr-CA':'en-CA';
 return new Date(d).toLocaleString(lang,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
/** One block of HTML for a lookup result: "CA$x · eBay asking, N listings, time · confidence" and the cheapest listing. */
function html(r,{compact=false}={}){
 if(!r)return '';
 if(r.state==='off')return `<span class="note">${esc(t('el.off'))}</span>`;
 if(r.state==='limit')return `<span class="note">${esc(t('el.limit'))}</span>`;
 if(r.state==='error')return `<span class="note">${esc(t('el.error'))}</span>`;
 const l=r.live;if(!l)return '';
 const src=t('el.source',l.n,when(l.fetchedAt));
 const head=isNum(l.cad)?`<strong>${esc(M(l.cad))}</strong> <span class="pill ${PILL[l.confidence]||'red'} pl-conf" title="${esc(t('el.why'))}">${esc(t('pl.'+(l.confidence||'low')))}</span>`:`<span class="note">${esc(t('el.few',l.n))}</span>`;
 const cheap=l.cheapest?`<a class="el-cheap" href="${esc(l.cheapest.url)}" target="_blank" rel="noopener noreferrer">${esc(t('el.cheapest',M(l.cheapest.cad)))}${l.cheapest.shippingKnown?'':' '+esc(t('el.plusShip'))}</a>`:'';
 return compact?`<span class="price-line el-line">${head} <span class="pl-src">${esc(src)}</span>${cheap?' · '+cheap:''}</span>`
  :`<span class="price-line el-line">${head}<span class="pl-src">${esc(src)}${l.truncated?' · '+esc(t('el.truncated')):''}</span>${cheap?`<span class="el-cheap-row">${cheap}</span>`:''}</span>`;
}
/** Fill a placeholder element with the live price of a card (cached first, then one lookup). */
async function render(el,card,{compact=false,force=false}={}){
 if(!el)return;const c=!force&&cached(card);
 if(c){el.innerHTML=html({state:'ok',live:c},{compact});return}
 el.innerHTML=`<span class="note">${esc(t('el.loading'))}</span>`;
 const r=await get(card,{force});if(el.isConnected)el.innerHTML=html(r,{compact});
 return r;
}
Object.assign(core,{get,cached,html,render});
})(typeof window!=='undefined'?window:globalThis);
