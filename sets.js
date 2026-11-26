/* Cardstead Prices > All sets (redesign brief, standout feature 4): every series, every set, every card, with prices.
 * Data: data/sets/index.json and data/sets/<id>.json, built daily by tools/build-sets.mjs from TCGplayer's market prices
 * (recent sold averages, USD), shown in CA$ at the Bank of Canada rate stored with the price snapshot (pack-ev-data.js).
 * Set value = one copy of every numbered card at its cheapest printing. Owned cards are ticked when a card in your
 * collection has the same name and number (a lead, not proof of the exact printing). */
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
let index=null,fx=null,series=null,open=null,sort='price',query='';
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
 const q=norm(query),sets=q?index.sets.filter(s=>norm(s.name+' '+s.code+' '+s.seriesName).includes(q)):(groups.find(g=>g.id===series)?.sets||[]);
 host.innerHTML=`<div class="sets-tools"><input id="setsSearch" type="search" placeholder="${esc(t('sets.search'))}" value="${esc(query)}" aria-label="${esc(t('sets.search'))}"></div>
 <div class="sets-series" role="group">${groups.map(g=>`<button type="button" class="chip${!q&&g.id===series?' on':''}" data-series="${esc(g.id)}">${esc(t('sets.series.'+g.id)!=='sets.series.'+g.id?t('sets.series.'+g.id):g.name)} <span class="note">${g.sets.length}</span></button>`).join('')}</div>
 ${source()}
 <ul class="sets-list">${sets.map(s=>{const c=s.chase[0],pk=s.sealed?.pack,etb=s.sealed?.etb,bx=s.sealed?.box;
  const P=root.CardsteadPics,pic=P?(s.logo?P.img(s.logo,{cls:'pic sets-logo'}):P.imgOr(P.tcgSrc(pk&&pk[0]),{cls:'pic sets-logo sets-pack'})):'';
  return `<li><button type="button" class="sets-row has-pic" data-set="${s.id}">${pic}<span class="sets-main"><strong>${esc(s.name)}</strong><span class="note">${esc(day(s.released))} · ${esc(t('sets.cards',s.cards))}${c?` · ${esc(t('sets.chase'))}: ${esc(c[1])} ${esc(M(cad(c[4])))}`:''}</span>
  ${pk||etb||bx?`<span class="note">${[pk&&t('sets.pack')+' '+M(cad(pk[1])),etb&&t('sets.etb')+' '+M(cad(etb[1])),bx&&t('sets.box')+' '+M(cad(bx[1]))].filter(Boolean).map(esc).join(' · ')}</span>`:''}</span>
  <span class="sets-val"><span class="note">${esc(t('sets.value'))}</span><strong>${esc(M(cad(s.setValueUsd)))}</strong></span></button></li>`}).join('')||`<li class="empty">${esc(t('sets.none'))}</li>`}</ul>`;
 const sInput=$('setsSearch');sInput.oninput=()=>{query=sInput.value;const pos=sInput.selectionStart;list();const n=$('setsSearch');n.focus();n.setSelectionRange(pos,pos)};
 host.querySelectorAll('[data-series]').forEach(b=>b.onclick=()=>{series=b.dataset.series;query='';list()});
 host.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>detail(Number(b.dataset.set)));
}
async function detail(id){
 const host=$('setsView'),s=index.sets.find(x=>x.id===id);if(!s)return;open=id;
 host.innerHTML=`<p class="note">${esc(t('sets.loading'))}</p>`;
 let d;try{const r=await fetch(`${BASE()}/data/sets/${id}.json`,{cache:'no-cache'});d=await r.json()}catch{host.innerHTML=`<p class="empty">${esc(t('sets.fail'))}</p>`;return}
 const mine=owned(root.pokeflipLedger?.getData?.());
 const price=c=>{const v=Object.values(c[4]);return v.length?Math.max(...v):null};
 const cards=d.cards.map(c=>({id:c[0],name:c[1],number:c[2],rarity:c[3],prints:c[4],top:price(c),own:mine.has(cardKey(c[1],c[2]))}));
 if(sort==='price')cards.sort((a,b)=>(b.top??-1)-(a.top??-1));
 const have=cards.filter(c=>c.own).length;
 host.innerHTML=`<button type="button" class="btn smallbtn" data-sets-back>← ${esc(t('sets.back'))}</button>
 <div class="sets-head">${s.logo&&root.CardsteadPics?root.CardsteadPics.img(s.logo,{cls:'pic sets-head-logo'}):''}<div><p class="ac-kind">${esc(s.seriesName)} · ${esc(day(s.released))}${s.code?' · '+esc(s.code):''}</p><h2>${esc(s.name)}</h2>
  <p class="note">${esc(t('sets.cards',s.cards))} · ${esc(t('sets.owned',have,s.cards,Math.round(have/Math.max(1,s.cards)*100)))}</p></div>
  <div class="sets-val"><span class="note">${esc(t('sets.value'))}</span><strong>${esc(M(cad(s.setValueUsd)))}</strong><span class="note">${esc(t('sets.valueRule'))}</span></div></div>
 ${source()}
 <div class="sets-sort" role="group"><button type="button" class="chip${sort==='price'?' on':''}" data-sort="price">${esc(t('sets.byPrice'))}</button><button type="button" class="chip${sort==='number'?' on':''}" data-sort="number">${esc(t('sets.byNumber'))}</button></div>
 <ul class="sets-grid">${cards.map(c=>`<li class="${c.own?'own':''}"><a href="https://www.tcgplayer.com/product/${c.id}" target="_blank" rel="noopener noreferrer">${img(c.id)}<span class="sets-card"><strong>${esc(c.name.replace(/\s+-\s+.*$/,''))}</strong><span class="note">${esc(c.number)} · ${esc(c.rarity)}</span>
  <span class="sets-prints">${Object.entries(c.prints).map(([p,v])=>`<span>${esc(p)} <b>${esc(M(cad(v)))}</b></span>`).join('')||`<span class="note">${esc(t('sets.noPrice'))}</span>`}</span>${c.own?`<span class="pill green">✓ ${esc(t('sets.youOwn'))}</span>`:''}</span></a></li>`).join('')}</ul>`;
 host.querySelector('[data-sets-back]').onclick=()=>{open=null;list()};
 host.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.sort;detail(id)});
 host.querySelectorAll('img').forEach(i=>i.addEventListener('error',()=>i.remove(),{once:true}));
 root.scrollTo?.(0,0);
}
async function show(){const host=$('setsView');if(!host)return;try{await load()}catch{host.innerHTML=`<p class="empty">${esc(t('sets.fail'))}</p>`;return}open?detail(open):list()}
root.addEventListener('cardstead:show',e=>{if(e.detail==='sets')show()});
root.addEventListener('cardstead:lang',()=>{if(root.CardsteadNav?.current?.()==='sets')show()});
core.show=show;
})(typeof window!=='undefined'?window:globalThis);
