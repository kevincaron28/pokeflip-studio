/* Cardstead price line: every price shown the same way, in CA$, with where it comes from, how old it is and how much
 * to trust it (redesign brief, standout feature 1).
 *   value(...) -> {cad, sources:[{name, kind:'sold'|'asking', date}], confidence:'high'|'medium'|'low'}
 *   html(value) -> "CA$165.47 · TCGplayer sold average · 22 Nov · Medium"
 * Confidence rules (same as the scan screen and eBay deals):
 *   two sold sources within 25% -> high, within 40% -> medium, further apart -> low;
 *   one sold source -> medium, low when older than 14 days; asking prices only -> low.
 * Text comes from ui-i18n.js (pl.* keys), so French follows the app language. */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const DAY=86400000;
const t=(k,...a)=>root.CardsteadI18n?root.CardsteadI18n.t(k,...a):k;
const lang=()=>root.CardsteadI18n?.lang?.()||'en';
function ageDays(date,now=Date.now()){const d=Date.parse(date||'');return Number.isFinite(d)?Math.max(0,Math.floor((now-d)/DAY)):null}
/** Confidence from the sources. Pure. */
function confidence(sources,now=Date.now()){
 const sold=(sources||[]).filter(s=>s.kind==='sold'&&isNum(s.cad));
 if(sold.length>=2){const xs=sold.map(s=>s.cad).sort((a,b)=>a-b),d=(xs[xs.length-1]-xs[0])/xs[0];return d<=0.25?'high':d<=0.40?'medium':'low'}
 if(sold.length===1){const a=ageDays(sold[0].date,now);return a===null||a>14?'low':'medium'}
 return (sources||[]).length?'low':null;
}
/** Sealed product: the TCGplayer market price (sold average) from the daily snapshot, in CA$. Pure. */
function sealed(marketUsd,data,now=Date.now()){
 const fx=data?.fx?.usdToCad;if(!isNum(marketUsd)||!isNum(fx))return null;
 const cad=Math.round(marketUsd*fx*100)/100,sources=[{name:'TCGplayer',kind:'sold',date:data?.prices?.asOf||null,cad}];
 return {cad,sources,confidence:confidence(sources,now),fx:{rate:fx,date:data.fx.date||null}};
}
/** A watched card: its sold value (ebay-watch.js valueOf) plus the eBay.ca asking second opinion when one is known. Pure. */
function card(c,data,check=null,now=Date.now()){
 const W=root.CardsteadEbayWatch,v=W?.valueOf?W.valueOf(c,data):null;if(!v||!isNum(v.cad))return null;
 const name=/PriceCharting/.test(v.source)?'PriceCharting':/TCGplayer/.test(v.source)?'TCGplayer':v.mine?t('pl.yours'):v.source;
 const sources=[{name,kind:v.mine?'yours':'sold',date:v.date||null,cad:v.cad}];
 if(check&&isNum(check.cad))sources.push({name:'eBay.ca',kind:'asking',date:null,cad:check.cad,n:check.n});
 let conf=v.mine?'medium':confidence(sources,now);
 if(!v.mine&&check&&isNum(check.cad)){const d=Math.abs(v.cad-check.cad)/Math.min(v.cad,check.cad);conf=d<=0.25?(conf==='low'?'medium':'high'):d<=0.40?'medium':'low'}
 return {cad:v.cad,sources,confidence:conf};
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function day(date){const d=Date.parse(date||'');return Number.isFinite(d)?new Date(d).toLocaleDateString(lang()==='fr'?'fr-CA':'en-CA',{month:'short',day:'numeric',timeZone:'UTC'}):null}
const PILL={high:'green',medium:'gold',low:'red'};
/** One line of HTML: value, sources with kind and date, confidence. compact: value + pill only, details in the tooltip. */
function html(p,{compact=false}={}){
 if(!p||!isNum(p.cad))return `<span class="price-line pl-unknown">${esc(t('pl.unknown'))}</span>`;
 const money=root.CardsteadI18n?.money?root.CardsteadI18n.money(p.cad):'CA$'+p.cad.toFixed(2);
 const src=p.sources.map(s=>{const k=s.kind==='sold'?t('pl.sold'):s.kind==='asking'?t('pl.asking',s.n||''):t('pl.yours');const d=day(s.date);return `${s.name} ${k}${d?' · '+d:''}`}).join(' + ');
 const pill=p.confidence?`<span class="pill ${PILL[p.confidence]} pl-conf" title="${esc(t('pl.why'))}">${esc(t('pl.'+p.confidence))}</span>`:'';
 return compact?`<span class="price-line pl-compact" title="${esc(src)}"><strong>${esc(money)}</strong> ${pill}</span>`
  :`<span class="price-line"><strong>${esc(money)}</strong> ${pill}<span class="pl-src">${esc(src)}</span></span>`;
}
const core={confidence,sealed,card,html,ageDays};
root.CardsteadPriceLine=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
})(typeof window!=='undefined'?window:globalThis);
