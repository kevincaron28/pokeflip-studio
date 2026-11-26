/* Drops > Coming drops: upcoming sets and sealed products with their release dates.
 * Sources: data/release-calendar.json (TCGplayer presale products and their estimated release dates, rebuilt daily by
 * tools/build-sets.mjs) and data/official-releases.json (hand-kept official announcements with links). When both give a
 * date and they differ, both are shown. Release dates are when stores may sell; Canadian shops can be a day or two off. */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
/** Releases grouped by set: TCGplayer products + the official entry for that set, soonest first. Pure. */
function releases(cal,official,today=new Date().toISOString().slice(0,10)){
 const by=new Map();
 for(const i of cal?.items||[]){if(i.date<today)continue;const k=norm(i.set);if(!by.has(k))by.set(k,{set:i.set,code:i.code,tcgDate:i.date,products:[]});const r=by.get(k);if(i.date<r.tcgDate)r.tcgDate=i.date;r.products.push(i)}
 for(const o of official?.releases||[]){if(o.date<today)continue;const k=norm(o.set);if(!by.has(k))by.set(k,{set:o.set,code:'',tcgDate:null,products:[]});by.get(k).official=o}
 const out=[...by.values()].map(r=>({...r,date:r.official?.date||r.tcgDate,dateDiffers:!!(r.official&&r.tcgDate&&r.official.date!==r.tcgDate)}));
 return out.sort((a,b)=>a.date.localeCompare(b.date)||a.set.localeCompare(b.set));
}
const FORMAT={pack:'pack',box:'box',etb:'etb',bundle:'bundle',collection:'collection',tin:'tin'};
const core={releases,FORMAT};
root.CardsteadCalendar=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;
const $=id=>doc.getElementById(id);
const I=()=>root.CardsteadI18n,t=(k,...a)=>I()?I().t(k,...a):k,M=v=>I()?I().money(v):'$'+Number(v).toFixed(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BASE=()=>root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'.';
const day=d=>{const x=Date.parse(d+'T12:00:00Z');return Number.isFinite(x)?new Date(x).toLocaleDateString(I()?.lang?.()==='fr'?'fr-CA':'en-CA',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}):d};
let cache=null;
async function load(){if(cache)return cache;const get=async p=>{try{const r=await fetch(BASE()+p,{cache:'no-cache'});return r.ok?await r.json():null}catch{return null}};
 const [cal,official]=await Promise.all([get('/data/release-calendar.json'),get('/data/official-releases.json')]);
 const d=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData().catch(()=>null):root.CardsteadPackData;
 cache={cal,official,fx:d?.fx?.usdToCad??null};return cache}
async function render(){
 const host=$('calendarView');if(!host)return;const {cal,official,fx}=await load();
 if(!cal&&!official){host.innerHTML=`<p class="empty">${esc(t('cal.fail'))}</p>`;return}
 const list=releases(cal,official);
 host.innerHTML=`<p class="note">${esc(t('cal.source'))}</p>`+(list.length?list.map(r=>{const o=r.official;
  const status=o?`<span class="pill ${o.status==='confirmed'?'green':'gold'}">${esc(t(o.status==='confirmed'?'cal.confirmed':'cal.announced'))}</span>`:`<span class="pill">${esc(t('cal.estimate'))}</span>`;
  return `<article class="panel cal-item"><div class="cal-head"><div><p class="ac-kind">${esc(day(r.date))}</p><h2>${esc(r.set)}</h2></div>${status}</div>
  ${r.dateDiffers?`<p class="note">${esc(t('cal.differs',day(o.date),day(r.tcgDate)))}</p>`:''}
  ${o?.prerelease?`<p class="note">${esc(t('cal.prerelease',day(o.prerelease)))}</p>`:''}
  ${o?.note?`<p class="note">${esc(I()?.lang?.()==='fr'&&o.noteFr||o.note)}</p>`:''}
  ${o?.sources?.length?`<p class="note">${esc(t('cal.sources'))} ${o.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`).join(' · ')}</p>`:''}
  ${r.products.length?`<ul class="prod-list">${r.products.map(p=>{const cad=isNum(p.marketUsd)&&isNum(fx)?p.marketUsd*fx:null,fmt=FORMAT[p.kind];
   return `<li><div class="prod-row has-pic">${(root.CardsteadPics?root.CardsteadPics.imgOr(root.CardsteadPics.tcgSrc(p.productId),{cls:'pic prod-pic'}):'')}<span class="prod-main"><strong>${esc(p.name)}</strong><span class="note">${[p.date!==r.date?t('cal.tcgDate',day(p.date)):'',cad?t('cal.presale',M(cad)):''].filter(Boolean).map(esc).join(' · ')}</span></span>
   <span class="prod-val">${fmt&&cad?`<button type="button" class="btn smallbtn" data-cal-watch="${esc(p.productId)}">${esc(t('cal.watch'))}</button>`:''}<a class="btn smallbtn" href="https://www.tcgplayer.com/product/${encodeURIComponent(p.productId)}" target="_blank" rel="noopener noreferrer">TCGplayer</a></span></div></li>`}).join('')}</ul>`:`<p class="note">${esc(t('cal.noProducts'))}</p>`}</article>`}).join(''):`<p class="empty">${esc(t('cal.none'))}</p>`);
 host.querySelectorAll('[data-cal-watch]').forEach(b=>b.onclick=()=>{const p=cal.items.find(i=>String(i.productId)===b.dataset.calWatch);const W=root.PokeFlipRestock;if(!p||!W?.addWatch)return;
  try{W.addWatch({product:p.name,format:FORMAT[p.kind],ceiling:Math.ceil(p.marketUsd*fx),language:'en'});b.textContent=t('cal.watching');b.disabled=true}catch(e){b.textContent=e.message}});
}
root.addEventListener('cardstead:show',e=>{if(e.detail==='calendar')render()});
root.addEventListener('cardstead:lang',()=>{if(root.CardsteadNav?.current?.()==='calendar')render()});
core.render=render;
})(typeof window!=='undefined'?window:globalThis);
