/* Cardstead "Compare stores": one sealed product, every store side by side.
 * Rows come only from what the app has really recorded on this device: your stock checks (Restock watch),
 * automatic shop checks (possible matches) and imported alerts. A followed store with no record is listed as
 * "not tracked" with a search link: no price is ever guessed. MSRP, market value and the verdict come from
 * alert-value.js (dated TCGplayer snapshot, cited MSRP). Panel text in English or French ("tu").
 */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const KEYS={restock:'pokeflip-restock-v1',matches:'pokeflip-restock-matches-v1',hub:'pokeflip-alert-hub-v1',lang:'cardstead-lang-v1'};
const T={
 en:{title:'Compare stores',store:'Store',price:'Price',status:'Status',checked:'Last checked',link:'Link',in:'In stock',out:'Sold out',unknown:'Unknown',buy:'Buy',open:'Open',search:'Search',
  notTracked:'Not tracked',noData:n=>`${n} followed store${n===1?'':'s'} with no record for this product yet`,showAll:'Show all stores (not only my area)',mine:'Stores I follow (my area)',
  msrp:'MSRP',market:'Market value (sealed)',ev:'Expected value of the packs inside',best:'Best in-stock price',none:'No store has a record for this product yet. Record a stock check or import an alert in Restock watch.',
  unknownV:'unknown',unknownM:'unknown',sep:': ',asOf:d=>'TCGplayer, as of '+d,cadUnknown:'CAD unknown',evNote:n=>n+(n>1?' packs':' pack')+' × pack EV',matched:'Matched product',noMatch:'Not matched to a TCGplayer product: values unknown.',
  srcCheck:'your check',online:'Online',chain:'Chain · stores and online',limit:n=>`Limit ${n} per customer`,noCheck:'No check yet',srcAuto:'automatic shop check (possible match)',srcAlert:'imported alert',lang:'Français',close:'Close',ago:m=>m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':Math.round(m/1440)+' d ago',
  under:(d,p)=>`Under value by ${d} (${p})`,over:(d,p)=>`Over value by ${d} (${p})`,fair:'Fair: about market value',scalp:x=>` · scalper price (${x}× US MSRP)`,noValue:'Value unknown',count:(a,b)=>`${a} store${a===1?'':'s'} with a record · ${b} in stock`,
  msrpScalp:x=>`Scalper price (${x}× US MSRP converted)`,msrpOver:p=>`Over MSRP by ${p} (US MSRP converted)`,msrpFair:'Around MSRP (US MSRP converted; market value unknown)',msrpUnder:p=>`Under MSRP by ${p} (US MSRP converted)`},
 fr:{title:'Comparer les magasins',store:'Magasin',price:'Prix',status:'État',checked:'Vérifié',link:'Lien',in:'En stock',out:'Épuisé',unknown:'Inconnu',buy:'Acheter',open:'Ouvrir',search:'Chercher',
  notTracked:'Non suivi',noData:n=>`${n} magasin${n===1?'':'s'} suivi${n===1?'':'s'} sans relevé pour ce produit`,showAll:'Voir tous les magasins (pas seulement ma région)',mine:'Les magasins que je suis (ma région)',
  msrp:'PDSF',market:'Valeur marchande (scellé)',ev:'Valeur attendue des paquets à l’intérieur',best:'Meilleur prix en stock',none:'Aucun magasin n’a encore de relevé pour ce produit. Note une vérification ou importe une alerte dans Restock watch.',
  unknownV:'inconnue',unknownM:'inconnu',sep:' : ',asOf:d=>'TCGplayer, au '+d,cadUnknown:'CAD inconnu',evNote:n=>n+(n>1?' paquets':' paquet')+' × VA du paquet',matched:'Produit associé',noMatch:'Pas associé à un produit TCGplayer : valeurs inconnues.',
  srcCheck:'ta vérification',online:'En ligne',chain:'Chaîne · magasins et en ligne',limit:n=>`Limite de ${n} par client`,noCheck:'Pas encore vérifié',srcAuto:'vérification auto de la boutique (correspondance possible)',srcAlert:'alerte importée',lang:'English',close:'Fermer',ago:m=>m<1?'à l’instant':m<60?'il y a '+m+' min':m<1440?'il y a '+Math.round(m/60)+' h':'il y a '+Math.round(m/1440)+' j',
  under:(d,p)=>`Sous la valeur de ${d} (${p})`,over:(d,p)=>`Au-dessus de la valeur de ${d} (${p})`,fair:'Prix juste : environ la valeur marchande',scalp:x=>` · prix de revendeur (${x}× le PDSF américain)`,noValue:'Valeur inconnue',count:(a,b)=>`${a} magasin${a===1?'':'s'} avec relevé · ${b} en stock`,
  msrpScalp:x=>`Prix de revendeur (${x}× le PDSF américain converti)`,msrpOver:p=>`Au-dessus du PDSF de ${p} (PDSF américain converti)`,msrpFair:'Environ le PDSF (PDSF américain converti; valeur marchande inconnue)',msrpUnder:p=>`Sous le PDSF de ${p} (PDSF américain converti)`}
};
const read=k=>{try{return JSON.parse(root.localStorage?.getItem(k)||'null')}catch{return null}};
function lang(){const v=read(KEYS.lang);if(v==='fr'||v==='en')return v;return /^fr/i.test(root.navigator?.language||'')?'fr':'en'}
function setLang(l){try{root.localStorage.setItem(KEYS.lang,JSON.stringify(l))}catch{}}
const FAMILY={sleeved:'pack',blister1:'pack'}; // a sleeved pack or 1-pack blister is still one booster pack
function keyOf(text,format,data){
 const V=root.CardsteadAlertValue;const m=V&&data?V.match(text,data,format):null;
 if(m&&m.set&&m.kind)return 'tcg:'+m.set.groupId+'|'+(FAMILY[m.kind]||m.kind);
 return 'text:'+(V?V.norm(text):String(text).toLowerCase());
}

/** Every recorded price for this product, latest per store. Pure: inputs are the stored records. */
function collect(target,{restock,matches,hub,data}){
 const want=keyOf(target.product,target.format,data),rows=new Map();
 const add=r=>{if(!r.store)return;const k=r.store.toLowerCase();const old=rows.get(k);if(!old||Date.parse(r.at)>Date.parse(old.at))rows.set(k,r)};
 const watches=restock?.watches||[];
 for(const o of restock?.observations||[]){const w=watches.find(x=>x.id===o.watchId);if(!w||keyOf(w.product,w.format,data)!==want)continue;
  add({store:o.store,price:isNum(o.price)&&o.price>0?o.price:null,status:o.status,at:o.checkedAt,url:o.url||null,source:'check',limit:w.limit??null})}
 for(const m of matches||[]){const w=watches.find(x=>x.id===m.watchId);const text=m.title||w?.product;if(keyOf(text,w?.format,data)!==want)continue;
  add({store:m.shop,host:m.host,price:isNum(m.price)?m.price:null,status:m.available?'in':'out',at:m.checkedAt,url:m.url||null,source:'auto',limit:w?.limit??null})}
 for(const a of hub||[]){if(keyOf(a.product,null,data)!==want)continue;
  add({store:a.retailer,price:isNum(a.price)?a.price:null,status:a.status,at:a.observedAt,url:a.url||null,source:'alert'})}
 return [...rows.values()];
}
/** Where a store is (city, online or chain) and a short badge, from My area & stores' catalogue. Pure. */
function storeInfo(name,host,P,cat){const s=host?cat.find(x=>x.host===host):P?.storeFor(name,cat);const words=String(name||'?').replace(/[^\p{L}\p{N} ]/gu,' ').trim().split(/\s+/);const badge=(words.length>1?words[0][0]+words[1][0]:words[0].slice(0,2)).toUpperCase();return {store:s||null,badge,kind:s?.kind||null,city:s?.kind==='local'?s.city||'':''}}
const RANK={in:0,unknown:1,out:2};
/** In stock first, then cheapest; unknown prices after known ones. */
function sort(rows){return rows.slice().sort((a,b)=>(RANK[a.status]??1)-(RANK[b.status]??1)||(a.price??Infinity)-(b.price??Infinity)||String(a.store).localeCompare(String(b.store)))}
/** Area filter: keep rows from followed stores (and stores Cardstead does not know, since you recorded them). */
function inArea(rows,P,prefs,cat){if(!P)return rows;return rows.filter(r=>{const s=r.host?cat.find(x=>x.host===r.host):P.storeFor(r.store,cat);return !s||P.isOn(s,prefs)})}
/** Followed stores with no record: listed as not tracked, never priced. */
function untracked(rows,P,prefs,cat,all){
 if(!P)return [];const have=new Set(rows.map(r=>{const s=r.host?cat.find(x=>x.host===r.host):P.storeFor(r.store,cat);return s?.key}).filter(Boolean));
 return cat.filter(s=>(all||P.isOn(s,prefs))&&!have.has(s.key)).sort((a,b)=>a.name.localeCompare(b.name));
}
/** Same bands as the alert cards (alert-value.js verdict), worded in the panel's language. */
function verdictText(l,price,a){
 const t=T[l],m=a?.market,fmt=money(l),pct=x=>Math.round(x*100)+(l==='fr'?' %':'%');
 if(!isNum(price))return {code:'unknown',text:t.noValue};
 const ms=a?.msrp?.cadAtRate;
 if(m){if(price<m.low*0.95){const d=m.low-price;return {code:'under',text:t.under(fmt(d),pct(d/m.low))}}
  if(price>m.high*1.05){const d=price-m.high;const sc=isNum(ms)&&price>=ms*1.5?t.scalp((price/ms).toFixed(1)):'';return {code:'over',text:t.over(fmt(d),pct(d/m.high))+sc}}
  return {code:'fair',text:t.fair}}
 if(isNum(ms)){const r=price/ms;
  if(r>=1.5)return {code:'over',text:t.msrpScalp(r.toFixed(1))};
  if(r>1.15)return {code:'over',text:t.msrpOver(pct(r-1))};
  if(r>=0.85)return {code:'fair',text:t.msrpFair};
  return {code:'under',text:t.msrpUnder(pct(1-r))}}
 return {code:'unknown',text:t.noValue};
}
function money(l){const f=new Intl.NumberFormat(l==='fr'?'fr-CA':'en-CA',{style:'currency',currency:'CAD'});return v=>isNum(v)?f.format(v):'—'}

const core={T,KEYS,keyOf,collect,sort,inArea,untracked,verdictText,storeInfo,lang};
root.CardsteadCompare=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root?.document)return;

/* ---------- Panel ---------- */
const doc=root.document;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:null}catch{return null}};
function searchLink(s,q){const R=root.PokeFlipRetailers;if(s.key.startsWith('retailer:')){const r=R?.RETAILERS.find(x=>'retailer:'+x.id===s.key);return r?R.searchUrl(r,q):null}return 'https://'+s.host+'/search?q='+encodeURIComponent(q)}
async function render(host,target){
 if(!host)return;const l=lang(),t=T[l],fmt=money(l);
 const V=root.CardsteadAlertValue,P=root.CardsteadStorePrefs;
 const ctx=V?await V.context():null;const data=ctx?.data||null;
 const all=host.dataset.all==='1';
 const raw=collect(target,{restock:read(KEYS.restock),matches:read(KEYS.matches),hub:read(KEYS.hub),data});
 const prefs=P?.get(),cat=P?P.catalogue():[];
 const rows=sort(all?raw:inArea(raw,P,prefs,cat));
 const best=rows.find(r=>r.status==='in'&&isNum(r.price));
 const a=V&&ctx?V.assess({product:target.product,price:best?.price??null,format:target.format},ctx):null;
 const day=s=>{const d=Date.parse(s);return Number.isFinite(d)?new Date(d).toLocaleDateString(l==='fr'?'fr-CA':'en-CA',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):''};
 const marketTxt=a?.market?(a.market.low===a.market.high?fmt(a.market.low):fmt(a.market.low)+'–'+fmt(a.market.high))+` <span class="ac-sub">${esc(t.asOf(day(a.asOf)))}</span>`:esc(t.unknownV);
 const msrpTxt=a?.msrp?`${esc(t.cadUnknown)} · ${new Intl.NumberFormat(l==='fr'?'fr-CA':'en-CA',{style:'currency',currency:'USD'}).format(a.msrp.usd)}`:esc(t.unknownM);
 const evTxt=a?.contents?.evCad?`${fmt(a.contents.evCad)} <span class="ac-sub">${esc(t.evNote(a.contents.packs))}</span>`:esc(t.unknownV);
 const v=verdictText(l,best?.price,a);
 const now=Date.now(),mins=s=>Math.max(0,Math.round((now-Date.parse(s))/60000));
 const st={in:[t.in,'green'],out:[t.out,'red'],unknown:[t.unknown,'grey']};
 const src={check:t.srcCheck,auto:t.srcAuto,alert:t.srcAlert};
 const none=untracked(raw,P,prefs,cat,all);
 host.innerHTML=`<div class="cmp-head"><h3>${esc(t.title)}${esc(t.sep)}${esc(target.product)}</h3><button type="button" class="btn smallbtn" data-cmp-lang>${esc(t.lang)}</button></div>
 <dl class="ac-rows cmp-values"><div><dt>${esc(t.msrp)}</dt><dd>${msrpTxt}</dd></div><div><dt>${esc(t.market)}</dt><dd>${marketTxt}</dd></div>${a?.contents?.packs?`<div><dt>${esc(t.ev)}</dt><dd>${evTxt}</dd></div>`:''}
 <div><dt>${esc(t.best)}</dt><dd>${best?`<strong>${fmt(best.price)}</strong> · ${esc(best.store)}`:esc(t.unknownM)}</dd></div></dl>
 ${a&&a.match?.status!=='ok'?`<p class="note">${esc(t.noMatch)}</p>`:''}
 <p class="cmp-verdict ac-verdict-${esc(v.code)}">${esc(v.text)}</p>
 <label class="checkline"><input type="checkbox" data-cmp-all ${all?'checked':''}> ${esc(t.showAll)}</label>
 <p class="note">${esc(t.count(rows.length,rows.filter(r=>r.status==='in').length))}</p>
 ${rows.length?`<ul class="cmp-list">${rows.map(r=>{const u=safe(r.url),rv=verdictText(l,r.price,a),info=storeInfo(r.store,r.host,P,cat),sx=st[r.status]||st.unknown;
  const where=info.kind==='online'?t.online:info.kind==='chain'?t.chain:info.city;
  return `<li class="cmp-store cmp-${esc(r.status)}"><span class="cmp-badge" aria-hidden="true">${esc(info.badge)}</span>
  <div class="cmp-store-main"><strong class="cmp-store-name">${esc(r.store)}</strong><span class="ac-sub">${esc([where,src[r.source]].filter(Boolean).join(' · '))}</span>
  <span class="cmp-meta"><span class="ac-dot ac-dot-${sx[1]}" aria-hidden="true"></span>${esc(sx[0])} · ${esc(t.ago(mins(r.at)))}${isNum(r.limit)?' · '+esc(t.limit(r.limit)):''}</span></div>
  <div class="cmp-store-price"><strong>${fmt(r.price)}</strong>${rv.code!=='unknown'?`<span class="cmp-pill cmp-pill-${esc(rv.code)}">${esc(rv.text)}</span>`:''}${u?`<a class="cmp-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc((r.status==='in'?t.buy:t.open)+': '+r.store)}">${esc(r.status==='in'?t.buy:t.open)} ↗</a>`:''}</div></li>`}).join('')}</ul>`:`<p class="empty">${esc(t.none)}</p>`}
 ${none.length?`<details class="cmp-untracked"><summary>${esc(t.noData(none.length))}</summary><ul class="cmp-list">${none.map(s=>{const u=safe(searchLink(s,target.product)),info=storeInfo(s.name,s.host,P,cat);const where=s.kind==='online'?t.online:s.kind==='chain'?t.chain:s.city||'';
  return `<li class="cmp-store cmp-none"><span class="cmp-badge" aria-hidden="true">${esc(info.badge)}</span><div class="cmp-store-main"><strong class="cmp-store-name">${esc(s.name)}</strong><span class="ac-sub">${esc(where)}</span><span class="cmp-meta">${esc(t.notTracked)} · ${esc(t.noCheck)}</span></div><div class="cmp-store-price">${u?`<a class="cmp-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t.search+': '+s.name)}">${esc(t.search)} ↗</a>`:''}</div></li>`}).join('')}</ul></details>`:''}`;
 // In the dialog, its label and Close button follow the panel language.
 const dlg=host.closest('dialog');if(dlg){const ttl=dlg.querySelector('#compareTitle');if(ttl)ttl.textContent=t.title+t.sep+target.product;const cl=dlg.querySelector('[data-cmp-close]');if(cl)cl.textContent=t.close}
 host.querySelector('[data-cmp-lang]').onclick=()=>{setLang(l==='fr'?'en':'fr');render(host,target)};
 host.querySelector('[data-cmp-all]').onchange=e=>{host.dataset.all=e.target.checked?'1':'';render(host,target)};
}
/* Dialog opened from any "Compare stores" button (alert cards, watch rows, Ready to buy). */
function openDialog(target){
 const d=doc.getElementById('compareDialog');if(!d)return;
 d.querySelector('[data-cmp-close]').textContent=T[lang()].close;
 const host=d.querySelector('#compareBody');host.dataset.all='';
 render(host,target);if(!d.open)d.showModal();
}
doc.addEventListener('click',e=>{const b=e.target.closest?.('[data-compare]');if(!b)return;e.preventDefault();openDialog({product:b.dataset.compare,format:b.dataset.format||null})});
doc.addEventListener('DOMContentLoaded',()=>{const d=doc.getElementById('compareDialog');d?.querySelector('[data-cmp-close]')?.addEventListener('click',()=>d.close())});
core.render=render;core.openDialog=openDialog;
})(typeof window!=='undefined'?window:globalThis);
