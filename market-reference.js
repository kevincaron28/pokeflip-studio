/* Non-CAD, potentially stale marketplace context from the catalog response.
   Never use these quotes as a verified Canadian resale value. */
(function(root){'use strict';
const positive=v=>Number.isFinite(v)&&v>0&&v<10000000?v:null;
function dateInfo(value,now=Date.now()){
 let time=typeof value==='number'?(value>100000000000?value:value*1000):Date.parse(value||'');
 if(!Number.isFinite(time)||time<=0||time>now+86400000)return {date:'Unknown',days:null};
 return {date:new Date(time).toISOString().slice(0,10),days:Math.max(0,Math.floor((now-time)/86400000))};
}
function matchingKeys(finish){if(finish==='Normal')return ['normal','unlimited'];if(finish==='Holo')return ['holofoil','holo','unlimited-holofoil'];if(finish==='Reverse Holo')return ['reverse-holofoil','reverse'];return []}
function getQuotes(pricing,finish,now=Date.now()){
 const quotes=[],tg=pricing?.tcgplayer,cm=pricing?.cardmarket;
 if(tg&&typeof tg==='object'&&(!tg.unit||tg.unit==='USD')){
  for(const key of matchingKeys(finish)){
   const o=tg[key];if(!o||typeof o!=='object')continue;
   const price=positive(o.marketPrice??o.midPrice);if(price===null)continue;
   const info=dateInfo(tg.updated,now);
   quotes.push({provider:'TCGplayer',variant:key,price,unit:'USD',date:info.date,ageDays:info.days,stale:info.days===null||info.days>14});
   break;
  }
 }
 if(cm&&typeof cm==='object'&&(!cm.unit||cm.unit==='EUR')&&finish!=='Reverse Holo'){
  const holo=finish==='Holo';
  if(finish==='Holo'||finish==='Normal'){
   const price=positive(holo?(cm['trend-holo']??cm['avg-holo']):(cm.trend??cm.avg));
   if(price!==null){const info=dateInfo(cm.updated,now);quotes.push({provider:'Cardmarket',variant:holo?'holo':'normal',price,unit:'EUR',date:info.date,ageDays:info.days,stale:info.days===null||info.days>30})}
  }
 }
 return quotes;
}
const core={positive,dateInfo,matchingKeys,getQuotes};
root.PokeFlipMarketReferences=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root?.document)return;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
core.render=(pricing,finish,lang)=>{
 const box=root.document.getElementById('scanMarketQuotes');if(!box)return;
 const quotes=getQuotes(pricing,finish);
 const scope=lang==='fr'?'French-card pricing is NOT confirmed by these marketplaces.':'Language/edition may differ from the listed offer.';
 box.innerHTML=quotes.length?quotes.map(q=>`<div class="row spread" style="border-bottom:1px solid #29384e;padding:9px 0"><span><strong>${esc(q.provider)}</strong> <span class="pill">${esc(q.variant)}</span><span class="small muted"> · ${esc(q.date)}${q.stale?' · Stale or undated':''}</span></span><strong>${new Intl.NumberFormat('en-CA',{style:'currency',currency:q.unit}).format(q.price)}</strong></div>`).join(''):`<p class="note">No finish-matched market reference is available for this selection. Do not infer a price.</p>`;
 const warning=root.document.createElement('p');warning.className='note';warning.textContent='Market context only, not a Canadian sold price or guaranteed French-language valuation. '+scope+' Use matched eBay sold evidence before pricing inventory.';box.appendChild(warning);
};
})(typeof window!=='undefined'?window:globalThis);
