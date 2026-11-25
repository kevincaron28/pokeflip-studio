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
const core={due,marketFor,STALE_MS,MAX_REFRESH};
root.CardsteadCollection=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

let refreshing=false,progress=null;
async function refresh(){
 const L=root.pokeflipLedger,MR=root.PokeFlipMarketReferences;if(refreshing||!L?.updateMarkets||!MR||doc.hidden||root.navigator?.onLine===false)return 0;
 const list=due(L.getData().items),E=root.CardsteadEbayLive,MC=root.CardsteadMyCards;
 // Graded cards and cards with a target whose eBay.ca asking price is not cached: at most 20 lookups a check.
 const ebayDue=()=>E&&MC?L.getData().items.filter(i=>!i.archived&&i.category!=='review'&&i.name&&((i.grade&&i.grade!=='raw')||typeof i.target==='number')).map(MC.ebayCard).filter(c=>!E.cached(c)).slice(0,20):[];
 if(!list.length&&!ebayDue().length)return 0;refreshing=true;let changed=[];
 try{const data=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData():root.CardsteadPackData;const fx=data?.fx;const updates=[];
  for(const [n,i] of list.entries()){if(doc.hidden)break;
   progress={done:n,total:list.length};root.dispatchEvent(new CustomEvent('cardstead:prices-progress',{detail:progress}));
   try{const r=await fetch('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(i.idCode),{cache:'no-store'});if(r.ok){const j=await r.json();const m=marketFor(i,j.pricing,fx,MR);if(m)updates.push([i.id,m])}}catch{}
   await new Promise(r=>setTimeout(r,1100))}
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
