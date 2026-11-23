/* Cardstead price graphs: real TCGplayer market history (price-history.js, tcgcsv daily archives) drawn in CAD
 * with each day's Bank of Canada rate, a dashed MSRP line and the store prices you recorded as dots.
 * Fewer than 2 points in the chosen range -> "Not enough history yet (N days)". No smoothing, no invented points. */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const DAY=86400000;
const RANGES={d7:7,d30:30,y1:365};

/** Points [{date, cad}] for one product key within the last `days` days of the history. Pure. */
function points(history,key,days){
 const s=history?.series?.[key];if(!s)return [];
 const dates=history.dates,last=Date.parse(dates[dates.length-1]+'T00:00:00Z'),from=last-days*DAY;
 const out=[];
 for(let i=0;i<dates.length;i++){const t=Date.parse(dates[i]+'T00:00:00Z');const fx=history.fx?.[i];
  if(t<from||!isNum(s[i])||!isNum(fx))continue;out.push({date:dates[i],t,cad:Math.round(s[i]*fx*100)/100})}
 return out;
}
/** Change over the range: first -> last point. */
function change(pts){if(pts.length<2)return null;const a=pts[0].cad,b=pts[pts.length-1].cad;return {from:a,to:b,abs:b-a,rel:a>0?(b-a)/a:null}}
function daysCovered(history,key){const s=history?.series?.[key];return s?s.filter(isNum).length:0}
/** Product key in price-history.js: sealed products by TCGplayer product id, cards by "id|printing". */
function keyFor(item){if(!item)return null;return item.printing?item.id+'|'+item.printing:String(item.id)}

/* ---------- SVG ---------- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function svg(pts,{msrpCad=null,dots=[],w=640,h=220,spark=false}={}){
 const I=root.CardsteadI18n;
 const vals=pts.map(p=>p.cad).concat(isNum(msrpCad)&&!spark?[msrpCad]:[]).concat(spark?[]:dots.map(d=>d.price));
 let lo=Math.min(...vals),hi=Math.max(...vals);if(lo===hi){lo*=0.95;hi*=1.05}const pad=(hi-lo)*0.08;lo=Math.max(0,lo-pad);hi+=pad;
 const t0=pts[0].t,t1=pts[pts.length-1].t,L=spark?2:56,R=spark?2:12,T=spark?2:12,B=spark?2:26;
 const x=t=>L+(t1===t0?0.5:(t-t0)/(t1-t0))*(w-L-R),y=v=>T+(1-(v-lo)/(hi-lo))*(h-T-B);
 const line=pts.map((p,i)=>(i?'L':'M')+x(p.t).toFixed(1)+' '+y(p.cad).toFixed(1)).join(' ');
 const up=pts[pts.length-1].cad>=pts[0].cad;
 if(spark)return `<svg class="spark ${up?'spark-up':'spark-down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${line}" fill="none" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
 const area=line+` L${x(t1).toFixed(1)} ${h-B} L${x(t0).toFixed(1)} ${h-B} Z`;
 const ticks=[lo+(hi-lo)*0.1,(lo+hi)/2,hi-(hi-lo)*0.1].map(v=>`<line class="g-grid" x1="${L}" x2="${w-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="g-ylab" x="${L-6}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${esc(I?I.money(v):v.toFixed(0)).replace(/\.\d\d|,\d\d/,'')}</text>`).join('');
 const msrp=isNum(msrpCad)?`<line class="g-msrp" x1="${L}" x2="${w-R}" y1="${y(msrpCad).toFixed(1)}" y2="${y(msrpCad).toFixed(1)}"/>`:'';
 const dot=dots.filter(d=>d.t>=t0&&d.t<=t1+3*DAY).map(d=>`<circle class="g-dot" cx="${x(Math.min(d.t,t1)).toFixed(1)}" cy="${y(d.price).toFixed(1)}" r="4"><title>${esc(d.store)}: ${esc(I?I.money(d.price):d.price)}</title></circle>`).join('');
 const last=pts[pts.length-1];
 return `<svg class="g-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(summary(pts))}">${ticks}<path class="g-area" d="${area}"/>${msrp}<path class="g-line" d="${line}" fill="none"/>${dot}<circle class="g-last" cx="${x(last.t).toFixed(1)}" cy="${y(last.cad).toFixed(1)}" r="4"/>
 <text class="g-xlab" x="${L}" y="${h-6}">${esc(I?I.date(pts[0].date,{month:'short',day:'numeric'}):pts[0].date)}</text><text class="g-xlab" x="${w-R}" y="${h-6}" text-anchor="end">${esc(I?I.date(last.date,{month:'short',day:'numeric'}):last.date)}</text></svg>`;
}
function summary(pts){const I=root.CardsteadI18n,c=change(pts);if(!c||!I)return '';return I.t('g.summary',I.money(c.from),I.money(c.to),I.pct(c.rel))}
function sparkline(history,key,days=30){const pts=points(history,key,days);return pts.length<2?'':svg(pts,{w:120,h:36,spark:true})}

/** Full chart widget with range chips. opts: {msrpCad, dots:[{date|t, price, store}]} */
function render(host,history,key,opts={}){
 if(!host)return;const I=root.CardsteadI18n,t=k=>I?I.t(k):k;
 const range=host.dataset.range||'d30';
 const pts=points(history,key,RANGES[range]);
 const dots=(opts.dots||[]).map(d=>({...d,t:d.t??Date.parse(d.date)})).filter(d=>isNum(d.price)&&isNum(d.t));
 const c=change(pts);
 const chips=Object.keys(RANGES).map(r=>`<button type="button" class="chip${r===range?' on':''}" data-range="${r}" aria-pressed="${r===range}">${esc(t('g.'+r))}</button>`).join('');
 const body=pts.length<2?`<p class="g-empty">${esc(I?I.t('g.notEnough',daysCovered(history,key)):'Not enough history yet.')}</p>`:svg(pts,{msrpCad:opts.msrpCad,dots});
 host.innerHTML=`<div class="g-head"><h3>${esc(t('g.title'))}</h3><div class="chips" role="group" aria-label="${esc(t('g.title'))}">${chips}</div></div>
 ${c?`<p class="g-change ${c.abs>=0?'g-up':'g-down'}"><strong>${esc(I.money(c.to))}</strong> <span>${esc(I.pct(c.rel))} · ${esc(t('g.'+range))}</span></p>`:''}
 ${body}
 <ul class="g-legend"><li><span class="lg lg-market"></span>${esc(t('g.market'))}</li>${isNum(opts.msrpCad)?`<li><span class="lg lg-msrp"></span>${esc(t('g.msrp'))}</li>`:''}${dots.length?`<li><span class="lg lg-dot"></span>${esc(t('g.stores'))}</li>`:''}</ul>
 <p class="note g-source">${esc(t('g.source'))}${history?.dates?.length?' · '+esc(I.date(history.dates[history.dates.length-1])):''}</p>`;
 host.querySelectorAll('[data-range]').forEach(b=>b.onclick=()=>{host.dataset.range=b.dataset.range;render(host,history,key,opts)});
}
let loading=null;
function load(){
 if(root.CardsteadPriceHistory)return Promise.resolve(root.CardsteadPriceHistory);
 if(loading)return loading;
 loading=new Promise(res=>{const d=root.document;if(!d)return res(null);const s=d.createElement('script');s.src='./price-history.js';s.onload=()=>res(root.CardsteadPriceHistory||null);s.onerror=()=>{loading=null;res(null)};d.head.appendChild(s)});
 return loading;
}
const api={RANGES,points,change,daysCovered,keyFor,svg,sparkline,render,load};
root.CardsteadChart=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
