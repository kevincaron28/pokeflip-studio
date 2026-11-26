/* Cardstead daily price check for My cards.
 * - Each card keeps a market value (item.market) from its TCGdex catalogue prices (market-reference.js estimate:
 *   sold-based only, edition, finish and condition applied, with confidence). It never overwrites a price typed by hand.
 * - Once a day (when Cardstead opens, and when My cards opens), cards whose market value is missing or older than 20 hours
 *   are re-priced, at most 60 cards per check and about one request a second, while the page is visible and online.
 * - Graded cards are not re-priced here: there is no sold-price source for grades (eBay deals uses asking prices).
 * - The same check refreshes the eBay.ca asking price (ebay-live.js) of graded cards and cards with a target, at most
 *   20 a day (graded cards have no sold-price source; targets are also checked against eBay listings).
 * - After a check, 'cardstead:prices' is sent with the ids that changed; My cards then looks at targets and alerts.
 */
(function(root){'use strict';
const STALE_MS=20*60*60*1000,MAX_REFRESH=60;

/** Cards to re-price now: catalogue id known, raw, not removed, market value missing or older than 20 h. Pure. */
function due(items,now=Date.now()){return (items||[]).filter(i=>i&&!i.archived&&typeof i.idCode==='string'&&/^[a-z0-9.\-]+$/i.test(i.idCode)&&(!i.grade||i.grade==='raw')&&(!i.market||!Number.isFinite(Date.parse(i.market.at||i.market.date))||now-Date.parse(i.market.at||i.market.date)>STALE_MS)).slice(0,MAX_REFRESH)}
/** Market value for one card from its TCGdex pricing, as stored on the item. Pure (given the estimator). */
function marketFor(item,pricing,fx,MR,now=Date.now()){
 if(!MR||!pricing)return null;
 const finish=item.finish==='Holo'||item.finish==='Reverse Holo'||item.finish==='Normal'?item.finish:'Holo';
 if(!item.edition&&MR.hasFirstEdition(pricing)&&finish!=='Reverse Holo')return {cad:null,confidence:'low',note:'edition',at:new Date(now).toISOString()};
 const quotes=MR.getQuotes(pricing,finish,now,item.edition||''),e=MR.estimate(quotes,fx,item.condition||'Near Mint');
 if(!e||e.cad===null)return {cad:null,confidence:'low',note:e?'unconfirmed':'no-sale',at:new Date(now).toISOString()};
 const sources=quotes.filter(q=>q.sold&&!(e.dropped&&q.provider===e.dropped.provider)).map(q=>({name:q.provider,kind:'sold',date:q.date}));
 return {cad:e.cad,confidence:e.confidence,sources,at:new Date(now).toISOString(),from:'TCGdex'};
}
/** Market value of a card from the daily set data (TCGplayer): its printing's sold price (medium), else listing mid (low). Pure. */
function tcgMarket(card,printing,usdToCad,now=Date.now()){if(!(usdToCad>0))return null;const sold=card[4]?.[printing],mid=card[5]?.[printing];const usd=Number.isFinite(sold)?sold:Number.isFinite(mid)?mid:null;if(usd===null)return null;
 return {cad:Math.round(usd*usdToCad*100)/100,confidence:Number.isFinite(sold)?'medium':'low',sources:[{name:'TCGplayer',kind:Number.isFinite(sold)?'sold':'asking'}],at:new Date(now).toISOString(),from:'TCGplayer'}}
const core={due,marketFor,tcgMarket,STALE_MS,MAX_REFRESH};
root.CardsteadCollection=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

let refreshing=false,progress=null;
async function refresh(){
 const L=root.pokeflipLedger,MR=root.PokeFlipMarketReferences;if(refreshing||!L?.updateMarkets||!MR||doc.hidden||root.navigator?.onLine===false)return 0;
 const list=due(L.getData().items),E=root.CardsteadEbayLive,MC=root.CardsteadMyCards;
 // Graded cards and cards with a target whose eBay.ca asking price is not cached: at most 20 lookups a check.
 const ebayDue=()=>E&&MC?L.getData().items.filter(i=>!i.archived&&i.category!=='review'&&i.name&&((i.grade&&i.grade!=='raw')||typeof i.target==='number')).map(MC.ebayCard).filter(c=>!E.cached(c)).slice(0,20):[];
 // Cards added from a set page: priced from that set's daily TCGplayer data (no API call).
 const tcgDue=L.getData().items.filter(i=>!i.archived&&!i.idCode&&i.tcgplayerId&&i.tcgGroup&&(!i.market||Date.now()-Date.parse(i.market.at||'')>STALE_MS));
 if(!list.length&&!tcgDue.length&&!ebayDue().length)return 0;refreshing=true;let changed=[];
 try{const data=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData():root.CardsteadPackData;const fx=data?.fx;const updates=[],images=[];
  for(const [n,i] of list.entries()){if(doc.hidden)break;
   progress={done:n,total:list.length};root.dispatchEvent(new CustomEvent('cardstead:prices-progress',{detail:progress}));
   for(let attempt=0;attempt<2;attempt++){try{const r=await fetch('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(i.idCode),{cache:'no-store'});if(r.ok){const j=await r.json();const m=marketFor(i,j.pricing,fx,MR);if(m)updates.push([i.id,m]);if(!i.image&&typeof j.image==='string')images.push([i.id,j.image+'/low.webp']);break}if(r.status===404)break}catch{}await new Promise(r=>setTimeout(r,1500))}
   await new Promise(r=>setTimeout(r,1100))}
  if(tcgDue.length&&fx){const BASE=root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'.',sets=new Map();
   for(const i of tcgDue){try{if(!sets.has(i.tcgGroup)){const r=await fetch(`${BASE}/data/sets/${i.tcgGroup}.json`);sets.set(i.tcgGroup,r.ok?await r.json():null)}const d=sets.get(i.tcgGroup);const card=d?.cards?.find(c=>c[0]===i.tcgplayerId);const m=card&&tcgMarket(card,i.tcgPrint,fx.usdToCad);if(m)updates.push([i.id,m])}catch{}}}
  if(images.length&&L.updateImages)L.updateImages(images);
  if(updates.length){L.updateMarkets(updates);changed=updates.map(u=>u[0])}
  {const want=ebayDue();
   for(const c of want){if(doc.hidden)break;const r=await E.get(c);if(r.state!=='ok')break;changed.push(c.itemId);await new Promise(r=>setTimeout(r,800))}}
 }catch{/* offline or the price snapshot did not load: the next check tries again */}
 finally{refreshing=false;progress=null;root.dispatchEvent(new CustomEvent('cardstead:prices',{detail:{changed}}))}
 return changed.length;
}
root.addEventListener('cardstead:show',e=>{if(e.detail==='mycards')setTimeout(refresh,1500)});
root.addEventListener('load',()=>setTimeout(refresh,4000));
core.refresh=refresh;core.progress=()=>progress;core.busy=()=>refreshing;
})(typeof window!=='undefined'?window:globalThis);
