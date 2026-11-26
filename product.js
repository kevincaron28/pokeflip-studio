/* Cardstead Prices tab and product view.
 * Search: every sealed TCGplayer product in the price snapshot (pack-ev-data.js) and every watchlist card
 * (sought-cards.js). Product view: market value (+30-day change), MSRP, best recorded store price with the
 * verdict, price graph, Compare stores and a one-tap Watch with detected defaults. Real recorded data only. */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9/]+/g,' ').trim();
const KIND={pack:'pack',sleeved:'pack',blister1:'blister',blister3:'blister','blister-premium':'blister',box:'box',etb:'etb','etb-pc':'etb',bundle:'bundle',tin:'tin',collection:'collection',bnb:'collection','bnb-stadium':'collection'};
const WATCH_FORMAT={pack:'pack',sleeved:'pack',blister1:'pack',box:'box',etb:'etb','etb-pc':'etb',bundle:'bundle',tin:'tin',collection:'collection'};
const ALIASES=[[/\betb\b/g,'elite trainer box'],[/\bbb\b/g,'booster box'],[/\bpc\b/g,'pokemon center']];

/** Catalog items from the snapshot (+ cards when sought-cards.js is loaded). Pure. */
function catalog(data,sought){
 const out=[];
 for(const s of data?.sets||[])for(const [id,name,type,market] of s.sealed||[])
  out.push({kind:'sealed',id,name,type,set:s.name,era:s.era,released:s.released,groupId:s.groupId,marketUsd:isNum(market)?market:null,search:norm(name+' '+s.name+' '+s.code)});
 for(const c of sought?.cards||[])
  out.push({kind:'card',id:c.tcgplayerProductId,printing:c.printing,name:`${c.name} ${c.number||''}`.trim(),grade:c.grade,set:c.set,card:c,search:norm(`${c.name} ${c.number} ${c.set} ${c.grade==='raw'?'':c.grade}`)});
 return out;
}
/** All words must match; newer sets and booster boxes/ETBs/packs first. Pure. */
function search(items,q,limit=40){
 let n=' '+norm(q)+' ';for(const [re,to] of ALIASES)n=n.replace(re,to);
 const words=n.trim().split(' ').filter(Boolean);if(!words.length)return [];
 const rank={pack:0,etb:1,box:2,bundle:3};
 return items.filter(it=>words.every(w=>it.search.includes(w)))
  .sort((a,b)=>(a.kind==='card')-(b.kind==='card')||String(b.released||'').localeCompare(String(a.released||''))||(rank[a.type]??9)-(rank[b.type]??9)||a.name.localeCompare(b.name))
  .slice(0,limit);
}
const graded=it=>!!(it&&it.kind==='card'&&it.grade&&it.grade!=='raw');
/** The address of one result: kind, id, printing and, for a graded card, its grade. A raw card and its PSA copies share
 *  the id and printing, so the grade is what tells them apart. Pure. */
function refOf(it){return [it.kind,it.id,...(it.printing?[it.printing]:[]),...(graded(it)?[it.grade]:[])].join(':')}
/** The item with exactly this address; no grade means the raw card. Pure. */
function find(list,ref){const [k,id,pr='',grade='']=String(ref).split(':');
 return (list||[]).find(x=>x.kind===k&&String(x.id)===id&&(!pr||x.printing===pr)&&(graded(x)?x.grade:'')===grade)}
/** Default watch for a product: detected format, max price = today's market value in CAD (rounded down). Pure. */
function watchDefaults(item,fx,area){
 const cad=isNum(item.marketUsd)&&isNum(fx)?Math.floor(item.marketUsd*fx):null;
 return {product:item.name,format:WATCH_FORMAT[item.type]||'any',ceiling:cad&&cad>0?cad:null,language:'en',region:area||'Québec'};
}
const core={catalog,search,watchDefaults,refOf,find,graded,KIND,WATCH_FORMAT,norm};
root.CardsteadProduct=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

/* ---------- Page ---------- */
const $=id=>doc.getElementById(id);
const I=()=>root.CardsteadI18n,t=(k,...a)=>I().t(k,...a),M=v=>I().money(v);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=null,data=null,history=null,last=null,back='prices';
function script(src,ok){return ok()?Promise.resolve():new Promise(r=>{const s=doc.createElement('script');s.src=src;s.onload=()=>r();s.onerror=()=>r();doc.head.appendChild(s)})}
async function ensure(){
 if(items)return;
 // Offline or blocked snapshot: the search still opens, with no products and unknown values.
 try{data=await root.CardsteadPackEv.loadData()}catch{data=null}
 await script('./sought-cards.js',()=>!!root.CardsteadSoughtCards);
 history=await root.CardsteadChart.load();
 items=catalog(data,root.CardsteadSoughtCards);
}
const fx=()=>data?.fx?.usdToCad;
function kindLabel(it){return it.kind==='card'?t('p.card')+(it.grade&&it.grade!=='raw'?' · '+it.grade:''):t('kind.'+(KIND[it.type]||'other'))}
function valueCad(it){if(it.kind==='card'){const v=root.CardsteadEbayWatch?.valueOf(it.card,data);return v?.cad??null}return isNum(it.marketUsd)&&isNum(fx())?it.marketUsd*fx():null}
function row(it){
 const key=root.CardsteadChart.keyFor(it),sp=history?root.CardsteadChart.sparkline(history,key,30):'';
 return `<li><button type="button" class="prod-row has-pic" data-item="${esc(refOf(it))}">${(root.CardsteadPics?root.CardsteadPics.imgOr(root.CardsteadPics.tcgSrc(it.id),{cls:'pic prod-pic'}):'')}<span class="prod-main"><strong>${esc(it.name)}</strong><span class="note">${esc(it.set||'')} · ${esc(kindLabel(it))}</span></span><span class="prod-spark">${sp}</span><span class="prod-val">${esc(M(valueCad(it)))}</span></button></li>`;
}
function renderResults(){
 const q=$('pricesSearch').value,box=$('pricesResults');
 if(!q.trim()){
  // Popular right now: booster packs and ETBs of the six newest sets (real products, real prices).
  const sets=(data?.sets||[]).slice(0,6).map(s=>s.groupId);
  const pop=items.filter(x=>x.kind==='sealed'&&sets.includes(x.groupId)&&(x.type==='pack'||x.type==='etb')).slice(0,12);
  box.innerHTML=`<h2>${esc(t('prices.hint'))}</h2><ul class="prod-list">${pop.map(row).join('')}</ul>`;return}
 const r=search(items,q);
 // Cards from My cards that match come first, with their own price and confidence.
 box.innerHTML=(root.CardsteadMyCards?.findHtml?.(q)||'')+`<p class="note" aria-live="polite">${esc(t('prices.results',r.length))}</p>`+(r.length?`<ul class="prod-list">${r.map(row).join('')}</ul>`:`<p class="empty">${esc(t('prices.none'))}</p>`);
}
function watched(it){const W=root.PokeFlipRestock?.watches?.()||[];return W.find(w=>norm(w.product)===norm(it.name))}
async function open(it,from){
 await ensure();if(typeof it==='string')it=find(items,it);if(!it)return;
 last=it;if(from)back=from;root.CardsteadNav?.show('product');
 const host=$('productView'),V=root.CardsteadAlertValue,C=root.CardsteadCompare,ctx=V?await V.context():null;
 const key=root.CardsteadChart.keyFor(it),val=valueCad(it);
 const ch=history?root.CardsteadChart.change(root.CardsteadChart.points(history,key,30)):null;
 // Best recorded store price (followed stores), with the verdict against market value.
 let best=null,dots=[];
 if(it.kind==='sealed'&&C){const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}};
  const P=root.CardsteadStorePrefs;const raw=C.collect({product:it.name,format:WATCH_FORMAT[it.type]},{restock:read(C.KEYS.restock),matches:read(C.KEYS.matches),hub:read(C.KEYS.hub),data});
  const rows=C.sort(P?C.inArea(raw,P,P.get(),P.catalogue()):raw);best=rows.find(r=>r.status==='in'&&isNum(r.price))||null;
  dots=raw.filter(r=>isNum(r.price)).map(r=>({date:r.at,price:r.price,store:r.store}))}
 const a=V&&ctx&&it.kind==='sealed'?V.assess({product:it.name,price:best?.price??null,format:WATCH_FORMAT[it.type]},ctx):null;
 const v=C&&a?C.verdictText(I().lang(),best?.price,a):null;
 const w=it.kind==='sealed'?watched(it):null;
 const def=watchDefaults(it,fx(),root.CardsteadStorePrefs?.get()?.city||undefined);
 // A graded card has no sold history: the history on file is the raw card's, so it is not shown here.
 const raw=graded(it)?find(items,refOf({...it,grade:'raw'})):null;
 const img=root.CardsteadPics?root.CardsteadPics.img(root.CardsteadPics.tcgSrc(it.id),{cls:'pic prod-img'}):'';
 host.innerHTML=`<button type="button" class="btn smallbtn" data-back>← ${esc(t('p.back'))}</button>
 <div class="prod-head">${img}<div><p class="ac-kind">${esc(kindLabel(it))} · ${esc(it.set||'')}</p><h1 class="prod-title">${esc(it.name)}</h1></div></div>
 <div class="prod-metrics">
  <div class="metric"><label>${esc(t('p.market'))}</label>${root.CardsteadPriceLine?root.CardsteadPriceLine.html(it.kind==='sealed'?root.CardsteadPriceLine.sealed(it.marketUsd,data):root.CardsteadPriceLine.card(it.card,data)):`<strong>${esc(M(val))}</strong>`}${ch?`<span class="${ch.abs>=0?'g-up':'g-down'}">${esc(I().pct(ch.rel))} · ${esc(t('p.change30'))}</span>`:''}</div>
  ${it.kind==='card'?`<div class="metric"><label>${esc(t('el.label'))}${it.card?.grade&&it.card.grade!=='raw'?' · '+esc(it.card.grade):''}</label><span id="productEbay"></span></div>`:''}
  <div class="metric"><label>${esc(t('p.msrp'))}</label><strong>${a?.msrp?esc(I().money(a.msrp.usd,'USD')):esc(t('p.unknown'))}</strong><span class="note">${esc(t('p.cadUnknown'))}</span></div>
  ${it.kind==='sealed'?`<div class="metric"><label>${esc(t('p.best'))}</label><strong>${best?esc(M(best.price)):'—'}</strong><span class="note">${best?esc(best.store):esc(t('p.noStore'))}</span></div>`:''}
  ${a?.contents?.evCad?`<div class="metric"><label>${esc(t('p.ev'))}</label><strong>${esc(M(a.contents.evCad))}</strong><span class="note">${a.contents.packs} × EV</span></div>`:''}
 </div>
 ${v&&best?`<p class="cmp-verdict ac-verdict-${esc(v.code)}">${esc(v.text)}</p>`:''}
 ${it.kind==='sealed'?`<div class="prod-watch">${w?`<span class="pill green">✓ ${esc(t('p.watching'))} · ≤ ${esc(M(w.ceiling))}</span>`:`<details id="watchBox"><summary class="btn primary">${esc(t('p.watch'))}</summary><form id="watchForm" class="watch-form"><label class="field" for="watchMax">${esc(t('p.maxPrice'))}</label><input id="watchMax" type="number" min="1" step="1" inputmode="decimal" required value="${def.ceiling??''}"><p class="note">${esc(t('p.watchNote'))}</p><button class="btn primary" type="submit">${esc(t('p.save'))}</button></form></details>`}</div>`:`<p><span class="pill">${esc(t('p.onEbay'))}</span> <a class="btn smallbtn" href="#" data-goto-deals>${esc(t('chip.ebay'))}</a></p>`}
 <div id="productChart" class="g-box">${graded(it)?`<p class="g-empty">${esc(t('p.gradedNoHistory'))}</p>${raw?`<button type="button" class="btn smallbtn" data-item="${esc(refOf(raw))}">${esc(t('p.seeRaw'))}</button>`:''}`:''}</div>
 ${it.kind==='sealed'?'<div id="productCompare" class="cmp cmp-inline"></div>':''}
 <p><a class="btn smallbtn" href="https://www.tcgplayer.com/product/${encodeURIComponent(it.id)}" target="_blank" rel="noopener noreferrer">${esc(t('p.tcg'))}</a></p>`;
 host.querySelector('img.prod-img')?.addEventListener('error',e=>e.target.remove(),{once:true});
 host.querySelector('[data-back]').onclick=()=>root.CardsteadNav?.show(back);
 host.querySelector('[data-goto-deals]')?.addEventListener('click',e=>{e.preventDefault();root.CardsteadNav?.show('deals')});
 if(!graded(it))root.CardsteadChart.render($('productChart'),history,key,{msrpCad:a?.msrp?.cadAtRate??null,dots});
 if(it.kind==='sealed')C?.render($('productCompare'),{product:it.name,format:WATCH_FORMAT[it.type]});
 if(it.kind==='card'&&it.card)root.CardsteadEbayLive?.render($('productEbay'),it.card);
 $('watchForm')?.addEventListener('submit',e=>{e.preventDefault();const n=Number($('watchMax').value);if(!(n>0))return;
  try{root.PokeFlipRestock.addWatch({...def,ceiling:n});open(it)}catch(err){alert(err.message)}});
 root.scrollTo?.(0,0);
}
async function init(){
 const input=$('pricesSearch');if(!input)return;
 input.addEventListener('input',()=>{if(items)renderResults()});
 // Going from one product page to another keeps the way back to where the search was.
 doc.addEventListener('click',e=>{const b=e.target.closest('[data-item]');if(b){e.preventDefault();const here=root.CardsteadNav?.current?.()||'prices';open(b.dataset.item,here==='product'?undefined:here)}});
 root.addEventListener('cardstead:show',async e=>{if(e.detail==='prices'){await ensure();renderResults()}});
 root.addEventListener('cardstead:lang',()=>{if(items&&root.CardsteadNav?.current?.()==='prices')renderResults();if(last&&root.CardsteadNav?.current?.()==='product')open(last)});
}
core.open=open;core.ensure=ensure;core.items=()=>items;
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
