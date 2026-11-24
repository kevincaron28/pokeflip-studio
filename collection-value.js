/* Cardstead portfolio (redesign brief, standout feature 2): what the collection is worth, what it cost, and how that moved.
 * - Each card keeps a market value (item.market) taken at scan time from its catalogue prices (market-reference.js estimate:
 *   sold-based only, edition, finish and condition applied, with confidence). It never overwrites the price you typed
 *   (item.unitPrice), which still counts when there is no market value.
 * - Refresh: once a day, while the Portfolio is open, cards whose market value is older than 20 hours are re-priced from
 *   TCGdex (the same source as the scan screen), at most 60 cards per visit and about one request a second.
 * - History: one point per day (value and cost) kept on this device, from the first day the Portfolio is opened.
 *   Values before that day are not invented.
 * - Raw and graded copies are totalled apart. Graded copies have no sold source here: their value is the one you typed,
 *   or unknown (the scan screen shows the eBay.ca asking median for a grade).
 */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const HKEY='cardstead-collection-history-v1',DAY=86400000,STALE_MS=20*60*60*1000,MAX_REFRESH=60;
const CONF=['high','medium','low'];

/** Totals for the unsold cards. Pure. */
function summary(d){
 const sold=new Map();for(const s of d?.sales||[])sold.set(s.itemId,(sold.get(s.itemId)||0)+s.qty);
 const out={value:0,cost:0,costKnownValue:0,units:0,valued:0,unvalued:0,noCost:0,raw:{value:0,units:0},graded:{value:0,units:0},byConf:{high:0,medium:0,low:0,yours:0},top:[]};
 for(const i of d?.items||[]){
  const n=Math.max(0,(i.qty||0)-(sold.get(i.id)||0));if(!n)continue;out.units+=n;
  const m=i.market&&isNum(i.market.cad)?i.market:null,unit=m?m.cad:isNum(i.unitPrice)?i.unitPrice:null;
  const grade=i.grade&&i.grade!=='raw'?'graded':'raw';
  if(unit===null){out.unvalued+=n;out[grade].units+=n;continue}
  const v=unit*n;out.value+=v;out.valued+=n;out[grade].value+=v;out[grade].units+=n;
  out.byConf[m?(CONF.includes(m.confidence)?m.confidence:'low'):'yours']+=v;
  if(isNum(i.unitCost)){out.cost+=i.unitCost*n;out.costKnownValue+=v}else out.noCost+=n;
  out.top.push({id:i.id,name:i.name,idCode:i.idCode,grade:i.grade||'raw',lang:i.lang,qty:n,unit,value:v,market:m,cost:isNum(i.unitCost)?i.unitCost*n:null});
 }
 out.top.sort((a,b)=>b.value-a.value);out.top=out.top.slice(0,8);
 out.gain=out.costKnownValue-out.cost;out.gainPct=out.cost>0?out.gain/out.cost:null;
 return out;
}
/** Add today's point (value, cost); one point per day, newest replaces today's. Pure. */
function addPoint(hist,date,s){const h=(Array.isArray(hist)?hist:[]).filter(p=>p&&p.date!==date&&isNum(p.value));h.push({date,value:Math.round(s.value*100)/100,cost:Math.round(s.cost*100)/100});h.sort((a,b)=>a.date<b.date?-1:1);return h.slice(-730)}
/** Cards to re-price now: catalogue id known, raw, market value missing or older than 20 h. Pure. */
function due(items,now=Date.now()){return (items||[]).filter(i=>i&&typeof i.idCode==='string'&&/^[a-z0-9.\-]+$/i.test(i.idCode)&&(!i.grade||i.grade==='raw')&&(!i.market||!Number.isFinite(Date.parse(i.market.at||i.market.date))||now-Date.parse(i.market.at||i.market.date)>STALE_MS)).slice(0,MAX_REFRESH)}
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
const core={summary,addPoint,due,marketFor,HKEY,STALE_MS,MAX_REFRESH};
root.CardsteadCollection=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const $=id=>doc.getElementById(id);
const I=()=>root.CardsteadI18n,t=(k,...a)=>I()?I().t(k,...a):k,M=v=>I()?I().money(v):'$'+v.toFixed(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jget=(k,d)=>{try{const v=JSON.parse(root.localStorage.getItem(k)||'null');return v??d}catch{return d}};
const jset=(k,v)=>{try{root.localStorage.setItem(k,JSON.stringify(v))}catch{}};
const today=()=>new Date().toLocaleDateString('en-CA');
let refreshing=false,range=30;

function chart(hist){
 const pts=hist.filter(p=>Date.parse(p.date)>=Date.now()-range*DAY);
 if(pts.length<2)return `<p class="note">${esc(t('cv.historyStarts',pts.length))}</p>`;
 const W=600,H=150,P=8,max=Math.max(...pts.map(p=>Math.max(p.value,p.cost))),min=Math.min(...pts.map(p=>Math.min(p.value,p.cost))),span=Math.max(max-min,1);
 const x=i=>P+i*(W-2*P)/(pts.length-1),y=v=>H-P-(v-min)/span*(H-2*P);
 const line=k=>pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p[k]).toFixed(1)).join(' ');
 return `<svg class="cv-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(t('cv.chartLabel',pts.length))}"><path d="${line('value')} L${x(pts.length-1)} ${H-P} L${P} ${H-P}Z" fill="#6ddbaf" fill-opacity=".12"/><path d="${line('cost')}" fill="none" stroke="#a8b5cc" stroke-width="1.5" stroke-dasharray="5 5"/><path d="${line('value')}" fill="none" stroke="#6ddbaf" stroke-width="2.5"/><circle cx="${x(pts.length-1)}" cy="${y(pts[pts.length-1].value)}" r="4" fill="#6ddbaf"/></svg>
 <div class="cv-legend"><span><i class="cv-dot cv-val"></i>${esc(t('cv.value'))}</span><span><i class="cv-dot cv-cost"></i>${esc(t('cv.paid'))}</span></div>`;
}
function render(){
 const host=$('collectionSummary');const L=root.pokeflipLedger;if(!host||!L)return;
 const d=L.getData(),s=summary(d);
 let hist=jget(HKEY,[]);if(s.units){hist=addPoint(hist,today(),s);jset(HKEY,hist)}
 if(!s.units){host.innerHTML=`<div class="panel cv"><h2>${esc(t('cv.title'))}</h2><p class="empty">${esc(t('cv.empty'))}</p></div>`;return}
 const PL=root.CardsteadPriceLine,conf=s.value>0?CONF.concat('yours').map(k=>[k,s.byConf[k]/s.value]):[];
 const gainCls=s.gain>=0?'g-up':'g-down',sign=v=>(v>=0?'+':'−')+M(Math.abs(v));
 host.innerHTML=`<div class="panel cv">
 <div class="cv-head"><div><p class="ac-kind">${esc(t('cv.title'))}</p><div class="cv-total">${esc(M(s.value))}</div>
  <p class="note">${s.cost>0?`<span class="${gainCls}">${esc(sign(s.gain))}${s.gainPct!==null?' ('+esc(I()?I().pct(s.gainPct):'')+')':''}</span> ${esc(t('cv.vsPaid',M(s.cost)))}`:esc(t('cv.noCostYet'))}</p></div>
  <div class="cv-range" role="group">${[30,90,365,3650].map(r=>`<button type="button" class="chip${r===range?' on':''}" data-cv-range="${r}">${esc(t('cv.r'+r))}</button>`).join('')}</div></div>
 ${chart(hist)}
 <div class="cv-conf" aria-label="${esc(t('cv.confLabel'))}">${conf.filter(c=>c[1]>0).map(([k,f])=>`<i class="cv-${k}" style="flex:${f.toFixed(4)}" title="${esc(t('cv.conf.'+k))}: ${Math.round(f*100)}%"></i>`).join('')}</div>
 <p class="note">${conf.filter(c=>c[1]>0).map(([k,f])=>`${Math.round(f*100)}% ${esc(t('cv.conf.'+k))}`).join(' · ')}</p>
 <div class="cv-split"><div><span class="note">${esc(t('cv.raw'))}</span><strong>${esc(M(s.raw.value))}</strong><span class="note">${esc(t('cv.cards',s.raw.units))}</span></div><div><span class="note">${esc(t('cv.graded'))}</span><strong>${esc(M(s.graded.value))}</strong><span class="note">${esc(t('cv.cards',s.graded.units))}</span></div></div>
 ${s.unvalued?`<p class="note">${esc(t('cv.unvalued',s.unvalued))} <a href="#" data-page-link="inventory">${esc(t('cv.review'))}</a></p>`:''}
 ${s.noCost?`<p class="note">${esc(t('cv.noCost',s.noCost))}</p>`:''}
 <h3>${esc(t('cv.top'))}</h3><ul class="prod-list">${s.top.map(r=>`<li><div class="prod-row"><span class="prod-main"><strong>${esc(r.name)}</strong><span class="note">${esc(r.idCode||'')} · ${esc(String(r.lang||'').toUpperCase())}${r.grade!=='raw'?' · '+esc(r.grade):''} · ×${r.qty}</span></span><span class="prod-val">${r.market&&PL?PL.html({cad:r.value,sources:Array.isArray(r.market.sources)?r.market.sources:[],confidence:r.market.confidence},{compact:true}):esc(M(r.value))}</span></div></li>`).join('')}</ul>
 <p class="note" id="cvStatus">${esc(t('cv.how'))}</p></div>`;
 host.querySelectorAll('[data-cv-range]').forEach(b=>b.onclick=()=>{range=Number(b.dataset.cvRange);render()});
}
async function refresh(){
 const L=root.pokeflipLedger,MR=root.PokeFlipMarketReferences;if(refreshing||!L?.updateMarkets||!MR||doc.hidden||root.navigator?.onLine===false)return;
 const list=due(L.getData().items);if(!list.length)return;refreshing=true;
 try{const data=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData():root.CardsteadPackData;const fx=data?.fx;const updates=[];
  for(const i of list){if(doc.hidden)break;
   try{const r=await fetch('https://api.tcgdex.net/v2/en/cards/'+encodeURIComponent(i.idCode),{cache:'no-store'});if(r.ok){const j=await r.json();const m=marketFor(i,j.pricing,fx,MR);if(m)updates.push([i.id,m])}}catch{}
   const st=$('cvStatus');if(st)st.textContent=t('cv.refreshing',updates.length,list.length);
   await new Promise(r=>setTimeout(r,1100))}
  if(updates.length)L.updateMarkets(updates);
 }finally{refreshing=false;render()}
}
root.addEventListener('cardstead:show',e=>{if(e.detail==='home'){render();setTimeout(refresh,1500)}});
root.addEventListener('pokeflip:saved',()=>{if(root.CardsteadNav?.current?.()==='home')render()});
root.addEventListener('cardstead:lang',()=>{if(root.CardsteadNav?.current?.()==='home')render()});
core.render=render;core.refresh=refresh;
})(typeof window!=='undefined'?window:globalThis);
