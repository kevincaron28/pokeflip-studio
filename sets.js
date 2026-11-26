/* Cardstead Prices > All sets (redesign brief, standout feature 4): every series, every set, every card, with prices.
 * Data: data/sets/index.json and data/sets/<id>.json, built daily by tools/build-sets.mjs from TCGplayer's market prices
 * (recent sold averages, USD), shown in CA$ at the Bank of Canada rate stored with the price snapshot (pack-ev-data.js).
 * Set value = one copy of every numbered card at its cheapest printing.
 * Each set page is a checklist (set-completion.js): tap to tick a card, long-press for quantities per printing, progress
 * in Set or Master mode, owned and missing value, cost to complete, filters, and "watch the missing cards". */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
/** "Mega Rayquaza ex - 138/103" -> "mega rayquaza ex"; number "138/103" -> "138". Pure. */
const cardKey=(name,number)=>norm(String(name).replace(/\s+-\s+[A-Z]*\d+[a-z]?\/?.*$/i,''))+'|'+String(number||'').split('/')[0].replace(/^0+(?=\d)/,'').toLowerCase();
/** Ownership index from the collection: name|number of every unsold card. Pure. */
function owned(ledger){const sold=new Map();for(const s of ledger?.sales||[])sold.set(s.itemId,(sold.get(s.itemId)||0)+s.qty);const out=new Set();
 for(const i of ledger?.items||[]){if((i.qty||0)-(sold.get(i.id)||0)<=0)continue;const num=String(i.idCode||'').split('-').pop();if(num)out.add(cardKey(i.name,num))}return out}
/** Series in order of their newest set, each with its sets. Pure. */
function bySeries(index){const m=new Map();for(const s of index?.sets||[]){if(!m.has(s.series))m.set(s.series,{id:s.series,name:s.seriesName,sets:[]});m.get(s.series).sets.push(s)}
 const list=[...m.values()];for(const g of list)g.sets.sort((a,b)=>b.released.localeCompare(a.released));
 return list.sort((a,b)=>(a.id==='other')-(b.id==='other')||b.sets[0].released.localeCompare(a.sets[0].released))}
const core={cardKey,owned,bySeries,norm};
root.CardsteadSets=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const $=id=>doc.getElementById(id);
const I=()=>root.CardsteadI18n,t=(k,...a)=>I()?I().t(k,...a):k,M=v=>I()?I().money(v):'$'+Number(v).toFixed(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let index=null,fx=null,series=null,open=null,sort='number',query='';
// The Android app has no data/ folder in its bundle: read the published files from the website.
const BASE=()=>root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'.';
const cad=usd=>isNum(usd)&&isNum(fx)?usd*fx:null;
const day=d=>{const x=Date.parse(d||'');return Number.isFinite(x)?new Date(x).toLocaleDateString(I()?.lang?.()==='fr'?'fr-CA':'en-CA',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):''};
const img=id=>root.CardsteadPics?root.CardsteadPics.imgOr(root.CardsteadPics.tcgSrc(id),{cls:'pic'}):'';
async function load(){
 if(!index){const r=await fetch(BASE()+'/data/sets/index.json',{cache:'no-cache'});if(!r.ok)throw Error('sets '+r.status);index=await r.json()}
 if(!isNum(fx)){const d=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData():root.CardsteadPackData;fx=d?.fx?.usdToCad??null}
}
function source(){return `<p class="note">${esc(t('sets.source',day(index.asOf),fx?fx.toFixed(4):'—'))}</p>`}
function list(){
 const host=$('setsView');const groups=bySeries(index);series=series||groups[0]?.id;
 const counts=root.CardsteadSetCompletion?root.CardsteadSetCompletion.ownedCounts(root.CardsteadSetCompletion.get()):{};
 const mine=index.sets.filter(s=>counts[s.id]>0);if(series==='mine'&&!mine.length)series=groups[0]?.id;
 const q=norm(query),sets=q?index.sets.filter(s=>norm(s.name+' '+s.code+' '+s.seriesName).includes(q)):series==='mine'?mine:(groups.find(g=>g.id===series)?.sets||[]);
 host.innerHTML=`<div class="sets-tools"><input id="setsSearch" type="search" placeholder="${esc(t('sets.search'))}" value="${esc(query)}" aria-label="${esc(t('sets.search'))}"></div>
 <div class="sets-series" role="group">${mine.length?`<button type="button" class="chip${!q&&series==='mine'?' on':''}" data-series="mine">★ ${esc(t('sc.mySets'))} <span class="note">${mine.length}</span></button>`:''}${groups.map(g=>`<button type="button" class="chip${!q&&g.id===series?' on':''}" data-series="${esc(g.id)}">${esc(t('sets.series.'+g.id)!=='sets.series.'+g.id?t('sets.series.'+g.id):g.name)} <span class="note">${g.sets.length}</span></button>`).join('')}</div>
 ${source()}
 <ul class="sets-list">${sets.map(s=>{const c=s.chase[0],pk=s.sealed?.pack,etb=s.sealed?.etb,bx=s.sealed?.box;
  const P=root.CardsteadPics,pic=P?(s.logo?P.img(s.logo,{cls:'pic sets-logo'}):P.imgOr(P.tcgSrc(pk&&pk[0]),{cls:'pic sets-logo sets-pack'})):'';
  return `<li><button type="button" class="sets-row has-pic" data-set="${s.id}">${pic}<span class="sets-main"><strong>${esc(s.name)}</strong>${counts[s.id]?`<span class="sc-row-progress"><i style="width:${Math.min(100,Math.round(counts[s.id]/Math.max(1,s.cards)*100))}%"></i></span><span class="note">${esc(t('sc.rowOwned',counts[s.id],s.cards))}</span>`:''}<span class="note">${esc(day(s.released))} · ${esc(t('sets.cards',s.cards))}${c?` · ${esc(t('sets.chase'))}: ${esc(c[1])} ${esc(M(cad(c[4])))}`:''}</span>
  ${pk||etb||bx?`<span class="note">${[pk&&t('sets.pack')+' '+M(cad(pk[1])),etb&&t('sets.etb')+' '+M(cad(etb[1])),bx&&t('sets.box')+' '+M(cad(bx[1]))].filter(Boolean).map(esc).join(' · ')}</span>`:''}</span>
  <span class="sets-val"><span class="note">${esc(t('sets.value'))}</span><strong>${esc(M(cad(s.setValueUsd)))}</strong></span></button></li>`}).join('')||`<li class="empty">${esc(t('sets.none'))}</li>`}</ul>`;
 const sInput=$('setsSearch');sInput.oninput=()=>{query=sInput.value;const pos=sInput.selectionStart;list();const n=$('setsSearch');n.focus();n.setSelectionRange(pos,pos)};
 host.querySelectorAll('[data-series]').forEach(b=>b.onclick=()=>{series=b.dataset.series;query='';list()});
 host.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>detail(Number(b.dataset.set)));
}
async function detail(id){
 const host=$('setsView'),s=index.sets.find(x=>x.id===id);if(!s)return;
 if(open!==id){open=id;filter='all';rarity='';shown=BATCH}
 root.dispatchEvent(new CustomEvent('cardstead:set'));
 if(!setData||setData.id!==id){
  host.innerHTML=`<p class="note">${esc(t('sets.loading'))}</p>`;
  try{const r=await fetch(`${BASE()}/data/sets/${id}.json`,{cache:'no-cache'});setData=await r.json();setData.id=id}catch{host.innerHTML=`<p class="empty">${esc(t('sets.fail'))}</p>`;return}
 }
 render();root.scrollTo?.(0,0);
}
/** The checklist page of the open set: progress, money, filters and the card grid (drawn in batches as you scroll). */
function render(){
 const host=$('setsView'),s=index.sets.find(x=>x.id===open),SC=root.CardsteadSetCompletion;if(!s||!setData||!SC)return;
 const st=SC.get(),sum=SC.summary(setData.cards,st,s.id,mode,fx);
 const rarities=[...new Set(setData.cards.map(c=>c[3]).filter(Boolean))].sort();
 let cards=SC.sortCards(setData.cards,sort,st,s.id);
 if(filter==='missing')cards=cards.filter(c=>!SC.has(SC.ownedOf(st,s.id,c[0])));else if(filter==='owned')cards=cards.filter(c=>SC.has(SC.ownedOf(st,s.id,c[0])));
 if(rarity)cards=cards.filter(c=>c[3]===rarity);
 visible=cards;
 const chip=(attr,val,cur,label)=>`<button type="button" class="chip${cur===val?' on':''}" ${attr}="${esc(val)}">${esc(label)}</button>`;
 host.innerHTML=`<div class="page-bar"><button type="button" class="btn smallbtn" data-sets-back>← ${esc(t('sets.back'))}</button><button type="button" class="btn smallbtn" data-share>${esc(t('share.label'))}</button></div>
 <div class="sets-head">${s.logo&&root.CardsteadPics?root.CardsteadPics.img(s.logo,{cls:'pic sets-head-logo'}):''}<div><p class="ac-kind">${esc(s.seriesName)} · ${esc(day(s.released))}${s.code?' · '+esc(s.code):''}</p><h2>${esc(s.name)}</h2></div></div>
 <div class="panel sc-progress" id="scProgress">${progressHtml(sum)}</div>
 <div class="sc-tools">
  <div class="sets-sort" role="group">${chip('data-sc-filter','all',filter,t('sc.all'))}${chip('data-sc-filter','missing',filter,t('sc.missing'))}${chip('data-sc-filter','owned',filter,t('sc.owned'))}</div>
  <div class="sets-sort" role="group">${chip('data-sort','number',sort,t('sets.byNumber'))}${chip('data-sort','price',sort,t('sets.byPrice'))}${chip('data-sort','missing-price',sort,t('sc.missingPriciest'))}</div>
  <select data-sc-rarity aria-label="${esc(t('sc.rarity'))}"><option value="">${esc(t('sc.allRarities'))}</option>${rarities.map(r=>`<option${r===rarity?' selected':''}>${esc(r)}</option>`).join('')}</select>
 </div>
 <p class="note sc-hint">${esc(t('sc.hint'))}</p>
 <ul class="sets-grid sc-grid" id="scGrid"></ul><div id="scMore" class="sc-more"></div>
 <div id="scSheet" class="sc-sheet" hidden></div>`;
 host.querySelector('[data-sets-back]').onclick=()=>{if(root.CardsteadRoutes?.backTo('sets'))return;open=null;setData=null;list();root.dispatchEvent(new CustomEvent('cardstead:set'))};
 host.querySelectorAll('[data-sc-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.scFilter;shown=BATCH;render()});
 host.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.sort;shown=BATCH;render()});
 host.querySelector('[data-sc-rarity]').onchange=e=>{rarity=e.target.value;shown=BATCH;render()};
 wireProgress();
 drawMore(true);
}
function progressHtml(sum){const SC=root.CardsteadSetCompletion;const chip=(attr,val,cur,label)=>`<button type="button" class="chip${cur===val?' on':''}" ${attr}="${esc(val)}">${esc(label)}</button>`;
 return `<div class="sc-modes" role="group" aria-label="${esc(t('sc.mode'))}">${chip('data-sc-mode','set',mode,t('sc.modeSet'))}${chip('data-sc-mode','master',mode,t('sc.modeMaster'))}</div>
  <p class="sc-count"><strong>${esc(t('sc.count',sum.owned,sum.total))}</strong> · ${esc(I()?I().pct(sum.pct/100).replace(/^\+/,''):sum.pct+'%')}${mode==='set'&&sum.secretTotal?` <span class="note">${esc(t('sc.secret',sum.secretOwned,sum.secretTotal))}</span>`:''}</p>
  <div class="sc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${sum.pct}"><i style="width:${Math.min(100,sum.pct)}%"></i></div>
  <dl class="sc-money"><div><dt>${esc(t('sc.ownedValue'))}</dt><dd>${esc(M(sum.ownedValue))}</dd></div><div><dt>${esc(t('sc.missingValue'))}</dt><dd>${esc(M(sum.missingValue))}</dd></div><div><dt>${esc(t('sc.toComplete'))}</dt><dd><strong>${esc(M(sum.costToComplete))}</strong></dd></div></dl>
  <p class="note">${esc(t('sc.moneyRule',day(index.asOf)))}${sum.missingUnpriced?' '+esc(t('sc.unpriced',sum.missingUnpriced)):''}</p>
  <div class="row"><button type="button" class="btn smallbtn primary" data-sc-watch${sum.missing.length?'':' disabled'}>☆ ${esc(t('sc.watchMissing',Math.min(sum.missing.length,WATCH_MAX)))}</button><button type="button" class="btn smallbtn" data-sc-undo${SC.canUndo()?'':' disabled'}>↶ ${esc(t('sc.undo'))}</button></div>`}
function wireProgress(){const host=$('scProgress'),SC=root.CardsteadSetCompletion,s=index.sets.find(x=>x.id===open);if(!host||!s)return;
 host.querySelectorAll('[data-sc-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.scMode;try{root.localStorage.setItem('cardstead-set-mode-v1',mode)}catch{}render()});
 host.querySelector('[data-sc-undo]').onclick=()=>{if(SC.undo()){const y=root.scrollY;render();root.scrollTo?.(0,y)}};
 host.querySelector('[data-sc-watch]').onclick=()=>watchMissing(s,SC.summary(setData.cards,SC.get(),s.id,mode,fx));}
const BATCH=60,WATCH_MAX=150,EBAY_PER_VIEW=10;
let mode=(()=>{try{return root.localStorage.getItem('cardstead-set-mode-v1')==='master'?'master':'set'}catch{return 'set'}})();
let filter='all',rarity='',shown=BATCH,visible=[],setData=null,observer=null,ebayLeft=EBAY_PER_VIEW;
/** Draw the next batch of cards (and keep a sentinel to draw more on scroll): fast with 300+ cards. */
function drawMore(reset){
 const grid=$('scGrid'),more=$('scMore');if(!grid)return;
 if(reset){grid.innerHTML='';ebayLeft=EBAY_PER_VIEW}
 const from=grid.children.length,to=Math.min(visible.length,reset?shown:from+BATCH);
 grid.insertAdjacentHTML('beforeend',visible.slice(from,to).map(tile).join(''));
 shown=Math.max(shown,to);
 for(const li of [...grid.children].slice(from))wireTile(li);
 more.innerHTML=to<visible.length?`<p class="note">${esc(t('sc.showing',to,visible.length))}</p>`:'';
 observer?.disconnect();
 if(to<visible.length&&'IntersectionObserver' in root){observer=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))drawMore(false)},{rootMargin:'600px'});observer.observe(more)}
 else if(to<visible.length){more.innerHTML+=`<button type="button" class="btn smallbtn" data-sc-more>${esc(t('sc.more'))}</button>`;more.querySelector('[data-sc-more]').onclick=()=>drawMore(false)}
}
function cardName(c){return String(c[1]).replace(/\s+-\s+[A-Z]*\d+[a-z]?\/?.*$/i,'')}
/** One card tile: picture, name, number, price with confidence, what you own. */
function tile(c){
 const SC=root.CardsteadSetCompletion,st=SC.get(),own=SC.ownedOf(st,open,c[0]),n=Object.values(own).reduce((a,q)=>a+q,0);
 const v=SC.cheapest(c),price=v?`<span class="pl-compact"><strong>${esc(M(cad(v.usd)))}</strong> <span class="pill ${v.confidence==='medium'?'gold':'red'} pl-conf" title="${esc(t(v.kind==='sold'?'sc.soldWhy':'sc.listingWhy'))}">${esc(t('pl.'+v.confidence))}</span></span>`:`<span class="sc-ebay" data-sc-ebay="${esc(c[0])}"><span class="note">${esc(t('sc.noPrice'))}</span></span>`;
 const secret=SC.isSecret(c[2]);
 return `<li class="sc-tile${n?' own':''}" data-sc-card="${esc(c[0])}"><button type="button" class="sc-tap" aria-pressed="${n?'true':'false'}" aria-label="${esc(cardName(c)+' '+c[2])}">${img(c[0])}${n?`<span class="sc-check" aria-hidden="true">✓${n>1?' ×'+n:''}</span>`:''}</button>
  <span class="sets-card"><strong>${esc(cardName(c))}</strong><span class="note">${esc(c[2])} · ${esc(c[3])}${secret?' · '+esc(t('sc.secretTag')):''}</span>${price}
  ${n?`<span class="note sc-own">${esc(Object.entries(own).map(([p,q])=>q+'× '+p).join(' · '))}</span>`:''}</span>
  <button type="button" class="btn smallbtn sc-more-btn" data-sc-variants="${esc(c[0])}" aria-label="${esc(t('sc.variants'))}">⋯</button></li>`;
}
function wireTile(li){
 const id=Number(li.dataset.scCard),c=setData.cards.find(x=>x[0]===id),SC=root.CardsteadSetCompletion;if(!c)return;
 const btn=li.querySelector('.sc-tap');let timer=null,long=false;
 // Tap ticks the usual printing (or clears the card); a long press opens quantities per printing.
 btn.addEventListener('pointerdown',()=>{long=false;timer=setTimeout(()=>{long=true;sheet(c)},500)});
 for(const ev of ['pointerup','pointerleave','pointercancel'])btn.addEventListener(ev,()=>clearTimeout(timer));
 btn.addEventListener('contextmenu',e=>e.preventDefault());
 btn.addEventListener('click',()=>{if(long){long=false;return}SC.apply(SC.toggle(SC.get(),open,c));refreshTile(li,c)});
 li.querySelector('[data-sc-variants]').onclick=()=>sheet(c);
 const eb=li.querySelector('[data-sc-ebay]');if(eb&&ebayLeft>0&&root.CardsteadEbayLive){ebayLeft--;const s=index.sets.find(x=>x.id===open);
  root.CardsteadEbayLive.render(eb,{name:cardName(c),number:c[2],set:s?.name||'',printing:'',grade:'raw',lang:'en'},{compact:true})}
}
/** Redraw one tile and the progress after a change (keeps the scroll position). */
function refreshTile(li,c){const tmp=doc.createElement('ul');tmp.innerHTML=tile(c);const nl=tmp.firstElementChild;li.replaceWith(nl);wireTile(nl);updateProgress()}
function updateProgress(){const box=$('scProgress'),SC=root.CardsteadSetCompletion;if(!box)return;box.innerHTML=progressHtml(SC.summary(setData.cards,SC.get(),open,mode,fx));wireProgress()}
/** Quantities per printing for one card (the long-press sheet). */
function sheet(c){
 const box=$('scSheet'),SC=root.CardsteadSetCompletion;if(!box)return;
 const draw=()=>{const own=SC.ownedOf(SC.get(),open,c[0]);
  box.innerHTML=`<div class="sc-sheet-card" role="dialog" aria-label="${esc(cardName(c))}"><div class="row spread"><strong>${esc(cardName(c))} · ${esc(c[2])}</strong><button type="button" class="btn smallbtn" data-sc-close>${esc(t('sc.done'))}</button></div>
  <ul class="sc-variants">${SC.printings(c).map(p=>{const v=SC.priceOf(c,p),q=own[p]||0;return `<li><span>${esc(p)}${v?` <span class="note">${esc(M(cad(v.usd)))}</span>`:''}</span><span class="sc-step"><button type="button" class="btn smallbtn" data-sc-dec="${esc(p)}" aria-label="−">−</button><b>${q}</b><button type="button" class="btn smallbtn" data-sc-inc="${esc(p)}" aria-label="+">+</button></span></li>`}).join('')}</ul></div>`;
  box.querySelectorAll('[data-sc-inc],[data-sc-dec]').forEach(b=>b.onclick=()=>{const p=b.dataset.scInc||b.dataset.scDec,cur=SC.ownedOf(SC.get(),open,c[0])[p]||0;SC.apply(SC.setQty(SC.get(),open,c[0],p,cur+(b.dataset.scInc?1:-1)));draw()});
  box.querySelector('[data-sc-close]').onclick=()=>{box.hidden=true;const li=doc.querySelector(`[data-sc-card="${c[0]}"]`);if(li)refreshTile(li,c);else updateProgress()};};
 draw();box.hidden=false;
}
/** Send the missing cards to the Watchlist (one tap, confirmed): exact printing, today's TCGplayer price. */
function watchMissing(s,sum){
 const L=root.pokeflipLedger;if(!L?.addCard)return;
 // The most valuable missing cards first (an unpriced card last), at most WATCH_MAX.
 const list=[...sum.missing].sort((a,b)=>(b.price?.usd??-1)-(a.price?.usd??-1)).slice(0,WATCH_MAX);if(!list.length||!confirm(t('sc.watchConfirm',list.length,s.name)))return;
 let added=0;
 for(const m of list){const c=m.card,p=m.printing,v=m.price,num=String(c[2]);
  const finish=/reverse/i.test(p)?'Reverse Holo':/holo/i.test(p)?'Holo':'Normal',edition=/1st/i.test(p)?'1st':/unlimited/i.test(p)?'unlimited':'';
  const market=v&&isNum(cad(v.usd))?{cad:Math.round(cad(v.usd)*100)/100,confidence:v.confidence,sources:[{name:'TCGplayer',kind:v.kind==='sold'?'sold':'asking',date:index.asOf}],at:new Date().toISOString(),from:'TCGplayer'}:null;
  try{const r=L.addCard({name:cardName(c),setName:s.name,number:num,lang:'en',finish,edition,grade:'raw',qty:1,market,tcgplayerId:c[0],tcgGroup:s.id,tcgPrint:p,image:root.CardsteadPics?.tcgSrc(c[0])||''});if(r&&!r.merged)added++}catch{}}
 root.pokeflipToast?.(t('sc.watched',added));
}
async function show(){const host=$('setsView');if(!host)return;try{await load()}catch{host.innerHTML=`<p class="empty">${esc(t('sets.fail'))}</p>`;return}open?detail(open):list()}
root.addEventListener('cardstead:show',e=>{if(e.detail==='sets')show()});
root.addEventListener('cardstead:lang',()=>{if(root.CardsteadNav?.current?.()==='sets')show()});
root.addEventListener('cardstead:sets-changed',()=>{if(root.CardsteadNav?.current?.()==='sets')show()});
core.show=show;
// Page addresses (routes.js): which set is open, and opening one from a link.
core.current=()=>open;core.title=()=>index?.sets.find(x=>x.id===open)?.name||'';core.select=id=>{if(open!==id){open=null;setData=null;if(id){open=id;filter='all';rarity='';shown=BATCH}}};
})(typeof window!=='undefined'?window:globalThis);
