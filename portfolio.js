'use strict';
// Portfolio analytics only: never fetches or invents market prices.
(function(){
const PKEY='pokeflip-portfolio-v2';
let history=[];
const now=()=>new Date().toISOString();
const fmt=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
const number=n=>Number.isFinite(Number(n))?Number(n):0;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function records(){const lots=window.pokeflipLedger?.getData?.();return lots&&Array.isArray(lots.items)?lots:null}
function readHistory(){try{const h=JSON.parse(localStorage.getItem(PKEY)||'[]');return Array.isArray(h)?h.filter(x=>x&&Number.isFinite(x.value)&&typeof x.date==='string').slice(-366):[]}catch{return []}}
function persistHistory(){try{localStorage.setItem(PKEY,JSON.stringify(history))}catch(e){console.warn('Portfolio history not saved',e)}}
function metrics(d){
 const sold=new Map();for(const s of d.sales)sold.set(s.itemId,(sold.get(s.itemId)||0)+s.qty);
 const active=d.items.map(i=>({...i,remaining:Math.max(0,i.qty-(sold.get(i.id)||0))})).filter(i=>i.remaining>0);
 const valued=active.filter(i=>i.unitPrice!=null&&Number.isFinite(Number(i.unitPrice))&&Number(i.unitPrice)>=0);
 const unknown=active.filter(i=>i.unitPrice==null);
 const value=valued.reduce((n,i)=>n+i.remaining*number(i.unitPrice),0);
 const pricedUnits=valued.reduce((n,i)=>n+i.remaining,0),unpricedUnits=unknown.reduce((n,i)=>n+i.remaining,0);
 const knownCost=active.filter(i=>i.unitCost!=null).reduce((n,i)=>n+i.remaining*number(i.unitCost),0);
 const costUnknown=active.filter(i=>i.unitCost==null).reduce((n,i)=>n+i.remaining,0);
 const invested=d.lots.reduce((n,l)=>n+number(l.cost),0);
 const netSales=d.sales.reduce((n,s)=>n+number(s.gross)-number(s.fees)-number(s.ship),0);
 const soldCost=d.sales.reduce((n,s)=>{if(s.costSnapshot!=null)return n+number(s.costSnapshot);const item=d.items.find(i=>i.id===s.itemId);return n+number(item?.unitCost)*number(s.qty)},0);
 const unknownSold=d.sales.some(s=>s.costSnapshot==null&&d.items.find(i=>i.id===s.itemId)?.unitCost==null);
 const totalUnits=active.reduce((n,i)=>n+i.remaining,0);
 const fr=active.filter(i=>i.lang==='fr').reduce((n,i)=>n+i.remaining,0);
 const byCategory=Object.fromEntries(['protect','single','bundle','bulk','review'].map(k=>[k,active.filter(i=>i.category===k).reduce((n,i)=>n+i.remaining,0)]));
 const top=valued.filter(i=>i.unitPrice>0).sort((a,b)=>b.remaining*b.unitPrice-a.remaining*a.unitPrice).slice(0,6);
 const lotStats=d.lots.map(l=>{const items=d.items.filter(i=>i.lotId===l.id),ids=new Set(items.map(i=>i.id)),soldHere=d.sales.filter(s=>ids.has(s.itemId)),recovered=soldHere.reduce((n,s)=>n+number(s.gross)-number(s.fees)-number(s.ship),0);return {...l,recovered,percentage:l.cost>0?recovered/l.cost*100:null,remainingValue:items.reduce((n,i)=>n+Math.max(0,i.qty-(sold.get(i.id)||0))*number(i.unitPrice),0)}});
 return {active,value,knownCost,costUnknown,invested,netSales,soldCost,unknownSold,pricedUnits,unpricedUnits,totalUnits,fr,byCategory,top,lotStats,unknownEntries:unknown.length};
}
function lineChart(samples){if(samples.length<2)return '<div class="empty">Portfolio history begins after your first valued inventory entry. The chart will grow as you update prices.</div>';
 const xs=samples.slice(-45),w=760,h=188,min=Math.min(...xs.map(x=>x.value)),max=Math.max(...xs.map(x=>x.value)),range=Math.max(max-min,1);
 const pts=xs.map((x,j)=>[26+j*(w-52)/Math.max(1,xs.length-1),h-27-(x.value-min)/range*(h-55)]);
 const path=pts.map((p,j)=>(j?'L':'M')+p.map(n=>n.toFixed(1)).join(' ')).join(' ');
 return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Estimated portfolio value history, ${xs.length} observations" style="width:100%;height:auto;overflow:visible"><g stroke="#344760" stroke-dasharray="4 7"><path d="M26 20H736 M26 92H736 M26 161H736"/></g><path d="${path} L${pts.at(-1)[0]} ${h-27} L26 ${h-27} Z" fill="#40d9b0" opacity=".12"/><path d="${path}" fill="none" stroke="#50ddaf" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="5" fill="#b9ffda"/><g fill="#a8bacf" font-size="11"><text x="26" y="12">${safe(fmt(max))}</text><text x="26" y="184">${safe(new Date(xs[0].date+'T12:00:00').toLocaleDateString('en-CA'))}</text><text x="736" y="184" text-anchor="end">${safe(new Date(xs.at(-1).date+'T12:00:00').toLocaleDateString('en-CA'))}</text></g></svg>`;
}
function draw(){const d=records();if(!d)return;const m=metrics(d);history=readHistory();const day=new Date().toLocaleDateString('en-CA');if(m.pricedUnits>0&&(history.at(-1)?.date!==day||Math.abs(history.at(-1).value-m.value)>0.009)){history.push({date:day,value:m.value});history=history.slice(-366);persistHistory();}
 const el=document.getElementById('portfolioStudio');if(!el)return;
 const coverage=m.totalUnits?m.pricedUnits/m.totalUnits*100:0;
 const saleProfit=m.unknownSold?'Needs cost allocation':fmt(m.netSales-m.soldCost);
 const breakdown=Object.entries(m.byCategory).filter(x=>x[1]);
 const colors={protect:'#e8b86d',single:'#50dcb0',bundle:'#8aa9ed',bulk:'#8195af',review:'#df92a0'};
 const label={protect:'Protect',single:'Singles',bundle:'Bundles',bulk:'Bulk',review:'Review'};
 el.innerHTML=`<div class="portfolio-heading"><div><span class="eyebrow">THE RESELLER'S COMMAND CENTER</span><h2 style="font-size:23px;margin:6px 0">Your collection portfolio</h2><p class="note" style="margin:0">All values in CAD · Based only on prices you enter · No fabricated live quotes</p></div><button class="btn smallbtn" id="valueNote">Valuation rules</button></div>
 <div class="portfolio-stats"><div class="portfolio-stat lead"><span>Estimated unsold value</span><strong>${fmt(m.value)}</strong><small>${m.unpricedUnits.toLocaleString()} cards still unpriced</small></div><div class="portfolio-stat"><span>Acquisition capital</span><strong>${fmt(m.invested)}</strong><small>Across ${d.lots.length} purchase lots</small></div><div class="portfolio-stat"><span>Net sales received</span><strong>${fmt(m.netSales)}</strong><small>After recorded selling expenses</small></div><div class="portfolio-stat"><span>Realized item profit</span><strong class="${!m.unknownSold&&m.netSales-m.soldCost>=0?'green':''}">${saleProfit}</strong><small>Before taxes and your labour</small></div></div>
 <div class="portfolio-card"><h3>Today's priorities</h3><div class="priority-row"><div class="priority-icon">01</div><div><b>${m.byCategory.review.toLocaleString()} cards in review</b><p>Verify identity, condition and language before assigning prices.</p></div></div><div class="priority-row"><div class="priority-icon">02</div><div><b>${m.unpricedUnits.toLocaleString()} cards need prices</b><p>Check recent sold comps. Don't assume US English equals Québec French.</p></div></div><div class="priority-row"><div class="priority-icon">03</div><div><b>${m.costUnknown.toLocaleString()} cards need cost basis</b><p>Allocate purchase-lot cost to avoid misleading profit calculations.</p></div></div><div class="row"><button class="btn primary smallbtn" id="priorityScan">Scan & sort</button><button class="btn smallbtn" id="priorityInventory">Inventory</button></div></div>
 <details class="portfolio-more"><summary>More business details</summary><div class="portfolio-two"><div class="portfolio-card"><div class="row spread"><h3>Portfolio value over time</h3><span class="pill">Manual price observations</span></div>${lineChart(history)}<div class="row spread"><span class="note">Historical values are snapshots, not reconstructed daily market prices.</span><button class="btn smallbtn" id="snapshotValue">Save snapshot</button></div></div>
 <div class="portfolio-card"><h3>Pricing confidence</h3><div class="confidence-number">${coverage.toFixed(0)}% <small>of cards priced</small></div><div class="bar" style="height:12px;margin:12px 0"><div style="width:${coverage.toFixed(2)}%"></div></div><p class="note">${m.pricedUnits.toLocaleString()} priced / ${m.totalUnits.toLocaleString()} unsold cards · ${m.unknownEntries} entries with unknown value</p><div class="safety">Prices are self-entered estimates. Validate language, condition, finish and recent sold comparisons before buying or listing.</div><div class="row"><button class="btn smallbtn" id="findUnpriced">Review unpriced cards</button></div></div></div>
 <div class="portfolio-two"><div class="portfolio-card"><h3>Physical sorting plan</h3>${breakdown.length?`<div class="portfolio-segments">${breakdown.map(([k,n])=>`<div style="flex:${n};background:${colors[k]}" title="${label[k]}: ${n}"></div>`).join('')}</div>${breakdown.map(([k,n])=>`<div class="portfolio-legend"><span><i style="background:${colors[k]}"></i>${label[k]}</span><b>${n.toLocaleString()} <small>cards</small></b></div>`).join('')}`:'<div class="empty">No cards yet. Your first purchase lot will populate this panel.</div>'}<div class="note" style="margin-top:10px">French cards: ${m.fr.toLocaleString()} · English cards: ${(m.totalUnits-m.fr).toLocaleString()}</div></div>
 </div>
 <div class="portfolio-two"><div class="portfolio-card"><h3>Highest-value inventory</h3>${m.top.length?`<div class="scroll"><table><thead><tr><th>Card / entry</th><th>Qty</th><th>Total estimate</th></tr></thead><tbody>${m.top.map(i=>`<tr><td><b>${safe(i.name)}</b><div class="small muted">${safe(i.lang.toUpperCase())} · ${safe(i.condition)} · ${safe(i.idCode||'Unidentified')}</div></td><td>${i.remaining}</td><td>${fmt(i.remaining*i.unitPrice)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Identify and price cards to see your largest positions.</div>'}</div>
 <div class="portfolio-card"><h3>Purchase lot recovery</h3>${m.lotStats.length?m.lotStats.slice(-6).reverse().map(l=>`<div class="lot-recovery"><div class="row spread"><b>${safe(l.name)}</b><span class="note">${l.percentage==null?'No cost':`${l.percentage.toFixed(0)}% recovered`}</span></div><div class="bar"><div style="width:${Math.min(100,Math.max(0,l.percentage||0))}%"></div></div><div class="note">${fmt(l.recovered)} received after fees / ${fmt(l.cost)} spent · ${fmt(l.remainingValue)} unsold estimate</div></div>`).join(''):'<div class="empty">Create a purchase lot to track recovery.</div>'}</div></div>
 <p class="portfolio-disclaimer">Portfolio estimate excludes unpriced cards. A recovered lot is not necessarily fully sold. Realized profit requires cost basis for every sold card. This is operational reporting, not tax accounting or guaranteed resale value.</p></details>`;
 const on=(id,fn)=>{const x=document.getElementById(id);if(x)x.onclick=fn};
 on('valueNote',()=>alert('Portfolio value = remaining quantity × manually recorded estimated price in CAD.\n\nNo live data source is connected. Values can be stale. Do not interpret growth caused by new purchases as investment returns. Realized profit is shown only if sold-card cost basis is available.'));
 on('snapshotValue',()=>{history.push({date:new Date().toLocaleDateString('en-CA'),value:m.value});history=history.slice(-366);persistHistory();draw()});
 on('priorityScan',()=>go('scan'));on('priorityInventory',()=>go('inventory'));on('findUnpriced',()=>go('inventory'));
}
window.pokeflipPortfolio={draw,metrics,readHistory};
window.addEventListener('pokeflip:saved',draw);
draw();
})();
