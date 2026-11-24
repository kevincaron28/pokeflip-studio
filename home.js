/* Cardstead Home: "what should I buy or watch now?" from real recorded data only.
 * 1. Good buys: watched products with a recorded in-stock price at or under market value (best discount first).
 * 2. Watchlist at a glance: best recorded price, stock, verdict and a 30-day market sparkline.
 * 3. Market movers: booster packs, ETBs and booster boxes with the biggest 30-day change in the price history.
 * 4. Best eBay deals from the last eBay scan. Empty blocks say what to do; nothing is invented. */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);

/** Movers from price-history for the given sealed items (each with a `key`). Pure. */
function movers(history,items,C,n=6){
 const out=[];
 for(const it of items){const pts=C.points(history,it.key,30);if(pts.length<3)continue;const c=C.change(pts);if(!c||!isNum(c.rel)||c.from<5)continue;out.push({...it,change:c})}
 return out.sort((a,b)=>Math.abs(b.change.rel)-Math.abs(a.change.rel)).slice(0,n);
}
/** One line per watch: best in-stock recorded price (followed stores) and its verdict. Pure given its inputs. */
function watchRows(watches,stored,data,Cmp,V,ctx,P){
 return watches.filter(w=>w.enabled!==false).map(w=>{
  const raw=Cmp.collect({product:w.product,format:w.format},{...stored,data});
  const rows=Cmp.sort(P?Cmp.inArea(raw,P,P.get(),P.catalogue()):raw);
  const best=rows.find(r=>r.status==='in'&&isNum(r.price))||null;
  const a=V&&ctx?V.assess({product:w.product,price:best?.price??null,format:w.format},ctx):null;
  return {watch:w,best,assess:a,good:!!best&&a?.verdict&&['under','fair'].includes(a.verdict.code)&&best.price<=w.ceiling};
 });
}
const core={movers,watchRows};
root.CardsteadHome=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const $=id=>doc.getElementById(id);
const I=()=>root.CardsteadI18n,t=(k,...a)=>I().t(k,...a),M=v=>I().money(v);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
function ago(s){const m=Math.max(0,Math.round((Date.now()-Date.parse(s))/60000));return I().lang()==='fr'?(m<60?`il y a ${m} min`:m<1440?`il y a ${Math.round(m/60)} h`:`il y a ${Math.round(m/1440)} j`):(m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} d ago`)}
async function render(){
 const host=$('homeBody');if(!host)return;
 const V=root.CardsteadAlertValue,Cmp=root.CardsteadCompare,Ch=root.CardsteadChart,P=root.CardsteadStorePrefs,Prod=root.CardsteadProduct;
 const ctx=V?await V.context():null,data=ctx?.data,history=Ch?await Ch.load():null,PL=root.CardsteadPriceLine;
 try{await Prod?.ensure?.()}catch{}
 const items=Prod?.items?.()||[];
 const stored={restock:read(Cmp.KEYS.restock),matches:read(Cmp.KEYS.matches),hub:read(Cmp.KEYS.hub)};
 const watches=stored.restock?.watches||[];
 const rows=watchRows(watches,stored,data,Cmp,V,ctx,P);
 // Match each watch to one TCGplayer product for its sparkline and product view.
 const itemFor=w=>{const m=V&&data?V.match(w.product,data,w.format):null;const c=m?.candidates?.length===1?m.candidates[0]:null;return c?items.find(x=>x.kind==='sealed'&&x.id===c.id):null};
 const good=rows.filter(r=>r.good).sort((a,b)=>(a.best.price/(a.assess.market?.low||a.best.price))-(b.best.price/(b.assess.market?.low||b.best.price)));
 const verdict=r=>{const v=Cmp.verdictText(I().lang(),r.best?.price,r.assess);return r.best?`<span class="cmp-pill cmp-pill-${esc(v.code)}">${esc(v.text)}</span>`:''};
 const watchLine=r=>{const it=itemFor(r.watch),sp=it&&history?Ch.sparkline(history,Ch.keyFor(it),30):'';
  return `<li><button type="button" class="prod-row" ${it?`data-item="sealed:${esc(it.id)}"`:`data-home-watch`}><span class="prod-main"><strong>${esc(r.watch.product)}</strong><span class="note">${r.best?`${esc(M(r.best.price))} · ${esc(r.best.store)} · ${esc(ago(r.best.at))}`:esc(t('home.noStock'))}</span>${verdict(r)}</span><span class="prod-spark">${sp}</span><span class="prod-val">${r.assess?.market?(PL&&it?PL.html({...PL.sealed(it.marketUsd,data),cad:r.assess.market.low},{compact:true}):esc(M(r.assess.market.low))):''}</span></button></li>`};
 const sealed=items.filter(x=>x.kind==='sealed'&&['pack','etb','box'].includes(x.type)).map(x=>({...x,key:String(x.id)}));
 const mv=history?movers(history,sealed,Ch,6):[];
 // eBay: only if a scan has stored results.
 let deals=[];const res=read('cardstead-ebay-results-v1');
 if(res?.byCard&&root.CardsteadEbayWatch&&root.CardsteadSoughtCards){const W=root.CardsteadEbayWatch;deals=W.assess(res.byCard,W.watched(),data).filter(r=>r.verdict.code==='under').slice(0,3)}
 host.innerHTML=`<div class="home-actions"><button type="button" class="btn primary" data-home-go="prices">🔎 ${esc(t('home.find'))}</button><button type="button" class="btn" data-home-go="scan">⌗ ${esc(t('home.scan'))}</button></div>
 <div class="panel"><h2>${esc(t('home.good'))}</h2>${good.length?`<ul class="prod-list">${good.map(watchLine).join('')}</ul>`:`<p class="empty">${esc(t('home.goodEmpty'))}</p>`}</div>
 <div class="panel"><h2>${esc(t('home.watch'))}</h2>${rows.length?`<ul class="prod-list">${rows.map(watchLine).join('')}</ul>`:`<p class="empty">${esc(t('home.watchEmpty'))}</p>`}</div>
 <div class="panel"><h2>${esc(t('home.movers'))}</h2>${mv.length?`<ul class="prod-list">${mv.map(m=>`<li><button type="button" class="prod-row" data-item="sealed:${esc(m.id)}"><span class="prod-main"><strong>${esc(m.name)}</strong><span class="note ${m.change.rel>=0?'g-up':'g-down'}">${esc(I().pct(m.change.rel))} · ${esc(M(m.change.from))} → ${esc(M(m.change.to))}</span></span><span class="prod-spark">${Ch.sparkline(history,m.key,30)}</span><span class="prod-val">${PL?PL.html(PL.sealed(m.marketUsd,data),{compact:true}):esc(M(m.change.to))}</span></button></li>`).join('')}</ul>`:`<p class="empty">${esc(t('home.moversEmpty'))}</p>`}</div>
 ${deals.length?`<div class="panel"><h2>${esc(t('home.ebay'))}</h2><ul class="prod-list">${deals.map(d=>`<li><a class="prod-row" href="${esc(d.item.url)}" target="_blank" rel="noopener noreferrer"><span class="prod-main"><strong>${esc(d.card.name)} ${esc(d.card.number||'')}</strong><span class="note">${esc(M(d.total.cad))} · eBay</span><span class="cmp-pill cmp-pill-under">${esc(d.verdict.label)}</span></span></a></li>`).join('')}</ul></div>`:''}`;
 host.querySelectorAll('[data-home-go]').forEach(b=>b.onclick=()=>{root.CardsteadNav?.show(b.dataset.homeGo);if(b.dataset.homeGo==='prices')setTimeout(()=>$('pricesSearch')?.focus(),50)});
 host.querySelectorAll('[data-home-watch]').forEach(b=>b.onclick=()=>root.CardsteadNav?.show('restock'));
}
root.addEventListener('cardstead:show',e=>{if(e.detail==='home')render()});
root.addEventListener('cardstead:lang',()=>{if(root.CardsteadNav?.current?.()==='home')render()});
root.addEventListener('pokeflip:saved',()=>{if(root.CardsteadNav?.current?.()==='home')render()});
core.render=render;
})(typeof window!=='undefined'?window:globalThis);
