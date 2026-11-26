/* Cardstead My cards: a light watchlist of the cards you own or want.
 * - Add a card: search TCGdex (name, number or id), pick the exact card (set and number), its printing, an optional
 *   grade, and optionally what you paid, a target price and an "X% under value" alert level.
 * - Each card shows its current price in CA$ with sources and confidence (price-line.js). Prices come from the daily
 *   price check (collection-value.js): recent sales on TCGplayer and Cardmarket, finish, edition and condition applied.
 *   Graded cards have no sold-price source here; eBay deals compares them with eBay.ca asking prices.
 * - Alerts: a card whose price is at or under your target (medium or high confidence only) is flagged and notified once
 *   per price. Cards with a target or an alert level are also checked by eBay deals (listing at or under the target,
 *   or at least X% under value).
 * - Cards live in the same saved data as before (app.js). Entries from older versions (portfolio, scanner) appear here
 *   as they are; lots and sales recorded by older versions stay in the data and the backup.
 */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const GRADES=['raw','PSA 10','PSA 9','PSA 8','BGS 9.5','CGC 10','CGC 9.5'];
const CONDITIONS=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'];

/** The printings TCGdex lists for a card, as {finish, edition}. Unknown variants: the three usual finishes. Pure. */
function printings(card){
 const v=card&&card.variants&&typeof card.variants==='object'?card.variants:null;
 if(!v)return [{finish:'Normal',edition:''},{finish:'Holo',edition:''},{finish:'Reverse Holo',edition:''}];
 const base=[];if(v.normal)base.push('Normal');if(v.holo)base.push('Holo');if(!base.length&&!v.reverse)base.push('Holo');
 const out=[];
 for(const f of base){if(v.firstEdition){out.push({finish:f,edition:'1st'},{finish:f,edition:'unlimited'})}else out.push({finish:f,edition:''})}
 if(v.reverse)out.push({finish:'Reverse Holo',edition:''});
 return out;
}
/** Card fields from a full TCGdex card. Pure. */
function fromTcgdex(full,lang){
 const official=full?.set?.cardCount?.official;
 return {name:String(full?.name||''),idCode:String(full?.id||''),setName:String(full?.set?.name||''),
  number:String(full?.localId||'')+(isNum(official)?'/'+official:''),lang:lang==='fr'?'fr':'en',
  image:typeof full?.image==='string'&&/^https:\/\/assets\.tcgdex\.net\//.test(full.image)?full.image+'/low.webp':''};
}
/** What to show as the price of a card: {state:'ok'|'graded'|'pending'|'none', ...}. Pure. */
function priceOf(item){
 if(item.grade&&item.grade!=='raw')return {state:'graded'};
 const m=item.market;
 if(m&&isNum(m.cad))return {state:'ok',cad:m.cad,confidence:m.confidence,sources:Array.isArray(m.sources)?m.sources:[],at:m.at};
 if(m)return {state:'none',why:m.note||'no-sale',at:m.at};
 return {state:item.idCode?'pending':'none',why:item.idCode?null:'no-id'};
}
/** At or under the target price, on a price we trust (medium or high confidence). Pure. */
/** Not confirmed yet (unknown language from a CSV, or an older entry left in Review): no alerts until the person checks it. Pure. */
function needsCheck(item){return item.category==='review'}
function atTarget(item){const p=priceOf(item);return !item.archived&&!needsCheck(item)&&isNum(item.target)&&p.state==='ok'&&p.confidence!=='low'&&p.cad<=item.target}
/** Cards eBay deals should check: those with a target or an alert level. Pure. */
function ebayCards(items){return (items||[]).filter(i=>i&&!i.archived&&!needsCheck(i)&&i.name&&(isNum(i.target)||isNum(i.alertPct))).map(ebayCard)}
/** One card as eBay deals and eBay live prices describe it (exact card, printing, edition, grade, language). Pure. */
function ebayCard(i){
 const p=priceOf(i),graded=!!(i.grade&&i.grade!=='raw');
 const printing=i.finish==='Reverse Holo'?'Reverse Holofoil':i.finish==='Holo'?'Holofoil':i.finish==='Normal'?'Normal':'';
 const ed=i.edition==='1st'?' 1st Edition':i.edition==='shadowless'?' Shadowless':i.edition==='unlimited'?' Unlimited':'';
 const num=String(i.number||'').split('/')[0]||String(i.idCode||'').split('-').pop()||'';
 return {id:'my-'+i.id,mine:true,itemId:i.id,name:i.name,number:i.number||num,set:(i.setName||'')+ed,printing,grade:graded?i.grade:'raw',lang:i.lang,
  value:p.state==='ok'?{cad:p.cad,source:'Watchlist price (recent sales)',date:p.at,confidence:p.confidence}:null,
  target:isNum(i.target)?i.target:null,threshold:isNum(i.alertPct)?i.alertPct/100:null,
  ebayQuery:[i.name,num,i.setName,i.edition==='1st'?'1st edition':i.edition==='shadowless'?'shadowless':'',graded?i.grade:'',i.lang==='fr'?'french':''].filter(Boolean).join(' '),exclude:[]};
}
/** My cards matching a Prices search: every word in the name, set, number or id. Pure. */
function searchMine(items,q){
 const norm=x=>String(x||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9/]+/g,' ').trim();
 const words=norm(q).split(' ').filter(Boolean);if(!words.length)return [];
 return (items||[]).filter(i=>i&&!i.archived&&i.name&&words.every(w=>norm([i.name,i.setName,i.number,i.idCode].join(' ')).includes(w)));
}
const core={printings,fromTcgdex,priceOf,needsCheck,atTarget,ebayCards,ebayCard,searchMine,PAGE:100,GRADES,CONDITIONS};
root.CardsteadMyCards=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const $=id=>doc.getElementById(id);
const I=()=>root.CardsteadI18n,t=(k,...a)=>I()?I().t(k,...a):k,M=v=>I()?I().money(v):'CA$'+Number(v).toFixed(2);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const L=()=>root.pokeflipLedger;
const toast=m=>root.pokeflipToast?root.pokeflipToast(m):null;
const ALERTED='cardstead-mycards-alerted-v1';
const jget=(k,d)=>{try{const v=JSON.parse(root.localStorage.getItem(k)||'null');return v??d}catch{return d}};
const jset=(k,v)=>{try{root.localStorage.setItem(k,JSON.stringify(v))}catch{}};
let adding=null,results=[],editing=null,filter='',searchToken=0,limit=core.PAGE;

function active(){return (L()?.getData().items||[]).filter(i=>!i.archived)}
function printingLabel(p){return (p.finish==='Reverse Holo'?t('mc.reverse'):p.finish==='Holo'?t('mc.holo'):p.finish==='Normal'?t('mc.normal'):p.finish)+(p.edition==='1st'?' · '+t('mc.first'):p.edition==='unlimited'?' · '+t('mc.unlimited'):p.edition==='shadowless'?' · Shadowless':'')}
function gradeLabel(g){return !g||g==='raw'?t('mc.raw'):g}
function priceHtml(item){
 const p=priceOf(item),PL=root.CardsteadPriceLine;
 if(p.state==='ok')return PL?PL.html({cad:p.cad,sources:p.sources,confidence:p.confidence}):esc(M(p.cad));
 if(p.state==='graded')return `<span class="note">${esc(t('mc.gradedPrice'))}</span>`;
 if(p.state==='pending')return `<span class="note">${esc(t('mc.pending'))}</span>`;
 return `<span class="note">${esc(t('mc.noPrice.'+(p.why||'no-sale')))}</span>`;
}
function rowHtml(i){
 const hit=atTarget(i),p=priceOf(i);
 const facts=[i.setName||i.idCode,i.number?'#'+i.number:'',String(i.lang||'').toUpperCase(),printingLabel({finish:i.finish,edition:i.edition||''}),i.grade&&i.grade!=='raw'?i.grade:'',i.condition&&i.condition!=='Near Mint'&&(!i.grade||i.grade==='raw')?i.condition:'',i.qty>1?'×'+i.qty:''].filter(Boolean);
 const mine=[isNum(i.unitCost)?t('mc.paidEach',M(i.unitCost)):'',isNum(i.target)?t('mc.targetIs',M(i.target)):'',isNum(i.alertPct)?t('mc.alertIs',i.alertPct):''].filter(Boolean);
 const gain=isNum(i.unitCost)&&p.state==='ok'?p.cad-i.unitCost:null;
 return `<li class="mc-card${hit?' mc-hit':''}" data-mc-id="${esc(i.id)}">
  <div class="mc-row">${i.image?`<img class="pic mc-img" loading="lazy" decoding="async" alt="" src="${esc(i.image)}">`:'<span class="mc-img mc-noimg" aria-hidden="true">▱</span>'}
  <div class="mc-main"><strong>${esc(i.name)}</strong><span class="note">${esc(facts.join(' · '))}</span>
   <div class="mc-price">${priceHtml(i)}${hit?` <span class="pill green">${esc(t('mc.atTarget'))}</span>`:''}${needsCheck(i)?` <span class="pill gold" title="${esc(t('mc.checkWhy'))}">${esc(t('mc.check'))}</span>`:''}</div>
   <div class="mc-ebay" data-mc-ebay="${esc(i.id)}">${ebayHtml(i)}</div>
   ${mine.length?`<span class="note">${esc(mine.join(' · '))}${gain!==null?` · <span class="${gain>=0?'g-up':'g-down'}">${esc((gain>=0?'+':'−')+M(Math.abs(gain)))}</span>`:''}</span>`:''}</div>
  <button type="button" class="btn smallbtn" data-mc-edit="${esc(i.id)}">${esc(t('mc.edit'))}</button></div>
  ${editing===i.id?(needsCheck(i)?`<p class="note">${esc(t('mc.checkWhy'))}</p>`:'')+editHtml(i):''}</li>`;
}
function ebayHtml(i){const E=root.CardsteadEbayLive;if(!E||!i.name)return '';const c=E.cached(ebayCard(i));return c?E.html({state:'ok',live:c},{compact:true}):`<button type="button" class="btn smallbtn" data-mc-ebaybtn="${esc(i.id)}">${esc(t('el.check'))}</button>`}
/** Live eBay prices for the cards on screen: up to 30 lookups per visit, graded cards and cards with a target first. */
let autoDone=new Set();
async function autoEbay(list){const E=root.CardsteadEbayLive;if(!E)return;
 const todo=list.filter(i=>i.name&&!autoDone.has(i.id)&&!E.cached(ebayCard(i))).sort((a,b)=>((b.grade&&b.grade!=='raw')+isNum(b.target))-((a.grade&&a.grade!=='raw')+isNum(a.target))).slice(0,30);
 for(const i of todo){autoDone.add(i.id);const el=doc.querySelector(`[data-mc-ebay="${CSS.escape(i.id)}"]`);if(!el)continue;const r=await E.render(el,ebayCard(i),{compact:true});if(r&&r.state!=='ok')break}}
function optionList(list,value,label=x=>x){return list.map(v=>`<option value="${esc(typeof v==='string'?v:JSON.stringify(v))}"${(typeof v==='string'?v:JSON.stringify(v))===value?' selected':''}>${esc(label(v))}</option>`).join('')}
function moneyField(id,label,value,hint){return `<div><label class="field" for="${id}">${esc(label)}</label><input id="${id}" type="number" min="0" step="0.01" inputmode="decimal" value="${isNum(value)?value:''}" placeholder="${esc(hint||t('mc.optional'))}"></div>`}
function alertField(id,value){return `<div><label class="field" for="${id}">${esc(t('mc.alertPct'))}</label><input id="${id}" type="number" min="1" max="90" step="1" inputmode="numeric" value="${isNum(value)?value:''}" placeholder="${esc(t('mc.alertHint'))}"></div>`}
function editHtml(i){
 const opts=printings(null).concat(i.edition?[{finish:i.finish,edition:i.edition}]:[]),cur=JSON.stringify({finish:i.finish||'Normal',edition:i.edition||''});
 if(!opts.some(o=>JSON.stringify(o)===cur))opts.unshift({finish:i.finish||'Normal',edition:i.edition||''});
 return `<form class="mc-edit" data-mc-form="${esc(i.id)}"><div class="grid2">
  <div><label class="field" for="mcEPrint">${esc(t('mc.printing'))}</label><select id="mcEPrint">${optionList(opts,cur,printingLabel)}</select></div>
  <div><label class="field" for="mcEGrade">${esc(t('mc.grade'))}</label><select id="mcEGrade">${optionList(GRADES,i.grade||'raw',gradeLabel)}</select></div>
  <div><label class="field" for="mcECond">${esc(t('mc.condition'))}</label><select id="mcECond">${optionList(CONDITIONS,i.condition||'Near Mint',c=>t('mc.cond.'+c))}</select></div>
  <div><label class="field" for="mcELang">${esc(t('mc.lang'))}</label><select id="mcELang"><option value="en"${i.lang==='en'?' selected':''}>English (EN)</option><option value="fr"${i.lang==='fr'?' selected':''}>Français (FR)</option></select></div>
  <div><label class="field" for="mcEQty">${esc(t('mc.qty'))}</label><input id="mcEQty" type="number" min="1" step="1" value="${esc(i.qty)}"></div>
  ${moneyField('mcEPaid',t('mc.paid'),i.unitCost)}${moneyField('mcETarget',t('mc.target'),i.target)}${alertField('mcEAlert',i.alertPct)}</div>
  <div class="row"><button type="submit" class="btn primary smallbtn">${esc(t('mc.save'))}</button><button type="button" class="btn smallbtn" data-mc-cancel="1">${esc(t('mc.cancel'))}</button><button type="button" class="btn smallbtn danger" data-mc-remove="${esc(i.id)}">${esc(t('mc.remove'))}</button></div></form>`;
}
function addHtml(){
 if(!adding)return '';
 if(adding.step==='search')return `<div class="panel mc-add" id="mcAdd"><h2>${esc(t('mc.addTitle'))}</h2>
  <div class="grid2"><div><label class="field" for="mcLang">${esc(t('mc.lang'))}</label><select id="mcLang"><option value="en"${adding.lang==='en'?' selected':''}>English (EN)</option><option value="fr"${adding.lang==='fr'?' selected':''}>Français (FR)</option></select></div>
  <div><label class="field" for="mcQuery">${esc(t('mc.query'))}</label><div class="row"><input id="mcQuery" class="grow" autocomplete="off" placeholder="Pikachu / 025 / sv01-25" value="${esc(adding.query||'')}"><button type="button" class="btn primary" id="mcFind">${esc(t('mc.find'))}</button></div></div></div>
  <div id="mcResults" aria-live="polite">${resultsHtml()}</div><div class="row"><button type="button" class="btn smallbtn" data-mc-close="1">${esc(t('mc.cancel'))}</button></div></div>`;
 const c=adding.card,opts=printings(adding.full),cur=JSON.stringify(adding.printing||opts[0]);
 return `<div class="panel mc-add" id="mcAdd"><h2>${esc(t('mc.addTitle'))}</h2>
  <div class="mc-row">${c.image?`<img class="mc-img" alt="" src="${esc(c.image)}">`:''}<div class="mc-main"><strong>${esc(c.name)}</strong><span class="note">${esc([c.setName||c.idCode,c.number?'#'+c.number:'',c.lang.toUpperCase()].filter(Boolean).join(' · '))}</span>
  ${adding.otherCatalog?`<p class="note">${esc(t('mc.otherCatalog'))}</p>`:''}</div></div>
  <form id="mcAddForm"><div class="grid2">
  <div><label class="field" for="mcPrint">${esc(t('mc.printing'))}</label><select id="mcPrint">${optionList(opts,cur,printingLabel)}</select></div>
  <div><label class="field" for="mcGrade">${esc(t('mc.grade'))}</label><select id="mcGrade">${optionList(GRADES,adding.grade||'raw',gradeLabel)}</select></div>
  <div><label class="field" for="mcCond">${esc(t('mc.condition'))}</label><select id="mcCond">${optionList(CONDITIONS,adding.condition||'Near Mint',x=>t('mc.cond.'+x))}</select></div>
  <div><label class="field" for="mcQty">${esc(t('mc.qty'))}</label><input id="mcQty" type="number" min="1" step="1" value="1"></div>
  ${moneyField('mcPaid',t('mc.paid'))}${moneyField('mcTarget',t('mc.target'))}${alertField('mcAlert')}</div>
  <p class="mc-price" id="mcAddPrice">${adding.priceHtml||esc(t('mc.pricing'))}</p>
  <div class="row"><button type="submit" class="btn primary">${esc(t('mc.addSave'))}</button><button type="button" class="btn" data-mc-back="1">${esc(t('mc.back'))}</button></div></form></div>`;
}
function resultsHtml(){
 if(adding?.searching)return `<p class="note">${esc(t('mc.searching'))}</p>`;
 if(adding?.error)return `<p class="alert">${esc(t('mc.searchError',adding.error))}</p>`;
 if(!adding?.searched)return `<p class="note">${esc(t('mc.searchHint'))}</p>`;
 if(!results.length)return `<p class="note">${esc(t('mc.noMatch'))}</p>`;
 return `<p class="note">${esc(t('mc.pick'))}</p><div class="mc-results">${results.map((c,n)=>`<button type="button" class="mc-result" data-mc-pick="${n}">${root.CardsteadPics?root.CardsteadPics.imgOr(c.image?c.image+'/low.webp':'',{cls:'pic mc-pick-pic'}):''}<span><strong>${esc(c.name)}</strong><span class="note">${esc(c.setName||c.id)} · #${esc(c.localId)}${c.lookupLanguage&&c.lookupLanguage!==adding.lang?' · '+esc(t('mc.catalog.'+c.lookupLanguage)):''}</span></span></button>`).join('')}</div>`;
}
function render(){
 const host=$('myCards');if(!host||!L())return;
 // The filter box shows from 9 cards; below that, an old filter must not hide cards with no way to clear it.
 const items=active(),q=items.length>8?filter.trim().toLowerCase():'';
 const shown=items.filter(i=>!q||[i.name,i.setName,i.idCode,i.number].join(' ').toLowerCase().includes(q));
 const hits=items.filter(atTarget),data=L().getData(),older=data.sales.length||data.lots.some(l=>!l.mycards);
 const prog=root.CardsteadCollection?.progress?.();
 host.innerHTML=`<div class="panel mc-top"><p class="note">${esc(t('mc.intro'))}</p><div class="row"><button type="button" class="btn primary" id="mcAddBtn"${adding?' hidden':''}>+ ${esc(t('mc.add'))}</button>
  <span class="note" id="mcStatus">${prog?esc(t('mc.checking',prog.done,prog.total)):''}</span></div></div>
  ${addHtml()}
  ${hits.length?`<div class="panel mc-alerts"><h2>${esc(t('mc.hitsTitle',hits.length))}</h2><p class="note">${esc(t('mc.hitsNote'))}</p></div>`:''}
  <div class="panel">${items.length?`<div class="row spread"><h2>${esc(t('mc.count',items.length))}</h2>${items.length>8?`<input id="mcFilter" class="mc-filter" placeholder="${esc(t('mc.filter'))}" value="${esc(filter)}">`:''}</div>
  <ul class="mc-list">${shown.slice(0,limit).map(rowHtml).join('')}</ul>${shown.length>limit?`<div class="row spread"><span class="note">${esc(t('mc.showing',Math.min(limit,shown.length),shown.length))}</span><button type="button" class="btn smallbtn" data-mc-more="1">${esc(t('mc.more'))}</button></div>`:''}`:`<p class="empty">${esc(t('mc.empty'))}</p>`}</div>
  <p class="note">${esc(t('mc.how'))}${older?' '+esc(t('mc.older')):''}</p>`;
 if(!adding&&!editing)setTimeout(()=>autoEbay(shown.slice(0,limit)),300);
 const f=$('mcFilter');if(f)f.oninput=()=>{filter=f.value;limit=core.PAGE;const pos=f.selectionStart;render();const g=$('mcFilter');g.focus();g.setSelectionRange(pos,pos)};
 const qy=$('mcQuery');if(qy){qy.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search()}};if(adding?.focus){qy.focus();adding.focus=false}}
 const pr=$('mcPrint'),gr=$('mcGrade'),cd=$('mcCond');for(const el of [pr,gr,cd])if(el)el.onchange=previewPrice;
 const af=$('mcAddForm');if(af)af.onsubmit=e=>{e.preventDefault();saveNew()};
 host.querySelectorAll('[data-mc-form]').forEach(fm=>fm.onsubmit=e=>{e.preventDefault();saveEdit(fm.dataset.mcForm)});
}
async function search(){
 const q=$('mcQuery').value.trim(),lang=$('mcLang').value;adding.query=q;adding.lang=lang;if(!q){toast(t('mc.enterQuery'));return}
 const token=++searchToken;adding.searching=true;adding.error=null;results=[];render();
 try{const K=root.PokeFlipCardLookup,list=await K.lookup(q,lang,'');
  const sets={};for(const l of new Set(list.map(c=>c.lookupLanguage||lang)))sets[l]=K.setNames?await K.setNames(l):{};
  if(token!==searchToken)return;results=list.map(c=>({...c,setName:c.set?.name||sets[c.lookupLanguage||lang]?.[K.setOf(c)]||''}));adding.searched=true}
 catch(e){if(token!==searchToken)return;adding.error=e.message}
 adding.searching=false;render();
}
async function pick(n){
 const c=results[n];if(!c)return;const lang=adding.lang;
 adding.step='details';adding.card={...fromTcgdex(c,c.lookupLanguage||lang),lang};adding.full=null;adding.otherCatalog=!!(c.lookupLanguage&&c.lookupLanguage!==lang);adding.priceHtml=null;render();
 try{const res=await fetch(`https://api.tcgdex.net/v2/${c.lookupLanguage||lang}/cards/${encodeURIComponent(c.id)}`);
  if(res.ok){const full=await res.json();adding.full=full;adding.card={...fromTcgdex(full,lang),lang};adding.printing=printings(full)[0];
   // Prices: the English catalogue carries them for every language's printings.
   if(!full.pricing&&(c.lookupLanguage||lang)!=='en'){const r2=await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(c.id)}`).catch(()=>null);if(r2&&r2.ok)adding.full={...full,pricing:(await r2.json()).pricing}}}}
 catch{}
 render();previewPrice();
}
function currentChoice(){const p=JSON.parse($('mcPrint').value);return {finish:p.finish,edition:p.edition,grade:$('mcGrade').value,condition:$('mcCond').value}}
async function marketNow(card,choice,pricing){
 if(choice.grade!=='raw'||!pricing)return null;
 const C=root.CardsteadCollection,MR=root.PokeFlipMarketReferences;if(!C||!MR)return null;
 const data=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData().catch(()=>null):root.CardsteadPackData;
 return C.marketFor({...card,...choice},pricing,data?.fx,MR);
}
async function previewPrice(){
 if(!adding||adding.step!=='details'||!$('mcPrint'))return;const choice=currentChoice();Object.assign(adding,{printing:{finish:choice.finish,edition:choice.edition},grade:choice.grade,condition:choice.condition});
 const m=await marketNow(adding.card,choice,adding.full?.pricing);adding.market=m;
 adding.priceHtml=choice.grade!=='raw'?`<span class="note">${esc(t('mc.gradedPrice'))}</span>`:m?priceHtml({market:m,grade:'raw',idCode:adding.card.idCode}):`<span class="note">${esc(t(adding.full?'mc.noPrice.no-sale':'mc.pricing'))}</span>`;
 const el=$('mcAddPrice');if(el)el.innerHTML=adding.priceHtml;
}
function saveNew(){
 const choice=currentChoice();
 try{const r=L().addCard({...adding.card,...choice,qty:$('mcQty').value,paid:$('mcPaid').value,target:$('mcTarget').value,alertPct:$('mcAlert').value,market:choice.grade==='raw'?adding.market:null});
  if(!r)return;if($('mcTarget').value||$('mcAlert').value)root.CardsteadNotify?.ask();toast(t(r.merged?'mc.merged':'mc.added',adding.card.name));adding=null;results=[];render();checkAlerts([r.id]);}
 catch(e){toast(t('mc.invalid',e.message))}
}
function saveEdit(id){
 const p=JSON.parse($('mcEPrint').value);
 try{const ok=L().updateCard(id,{finish:p.finish,edition:p.edition,grade:$('mcEGrade').value,condition:$('mcECond').value,lang:$('mcELang').value,confirm:true,qty:$('mcEQty').value,paid:$('mcEPaid').value,target:$('mcETarget').value,alertPct:$('mcEAlert').value});
  if(ok){if($('mcETarget').value||$('mcEAlert').value)root.CardsteadNotify?.ask();editing=null;toast(t('mc.saved'));render();checkAlerts([id]);setTimeout(()=>root.CardsteadCollection?.refresh?.(),500)}}
 catch(e){toast(t('mc.invalid',e.message))}
}
function notify(title,body){
 if(root.PokeFlipNative&&root.PokeFlipNative.isNative){root.PokeFlipNative.notify(title,body);return}
 if('Notification' in root&&Notification.permission==='granted'){navigator.serviceWorker?.getRegistration?.().then(reg=>reg?.showNotification?reg.showNotification(title,{body,icon:'icon-192.png',tag:'mycards'}):new Notification(title,{body})).catch(()=>{})}
}
/** Notify once per card and price when it is at or under its target. */
function checkAlerts(ids){
 const seen=jget(ALERTED,{}),items=active().filter(i=>!ids||ids.includes(i.id));let n=0;
 for(const i of items){if(!atTarget(i)){if(seen[i.id]!==undefined&&!(isNum(i.target)&&priceOf(i).cad<=i.target))delete seen[i.id];continue}
  const cad=priceOf(i).cad;if(seen[i.id]===cad)continue;seen[i.id]=cad;n++;
  notify(t('mc.notifyTitle'),t('mc.notifyBody',i.name,M(cad),M(i.target)))}
 jset(ALERTED,seen);return n;
}
doc.addEventListener('click',e=>{
 const host=$('myCards');const inMine=host&&host.contains(e.target);
 if(e.target.closest('[data-mc-add]')){adding={step:'search',lang:root.CardsteadI18n?.lang?.()==='fr'?'fr':'en',focus:true};results=[];setTimeout(render,0);return}
 if(!inMine)return;
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='mcAddBtn'){adding={step:'search',lang:root.CardsteadI18n?.lang?.()==='fr'?'fr':'en',focus:true};results=[];render();return}
 if(b.id==='mcFind'){search();return}
 if(b.dataset.mcPick!==undefined){pick(Number(b.dataset.mcPick));return}
 if(b.dataset.mcBack){adding.step='search';render();return}
 if(b.dataset.mcClose){adding=null;results=[];render();return}
 if(b.dataset.mcEdit){editing=editing===b.dataset.mcEdit?null:b.dataset.mcEdit;render();return}
 if(b.dataset.mcCancel){editing=null;render();return}
 if(b.dataset.mcMore){limit+=core.PAGE;render();return}
 if(b.dataset.mcEbaybtn){const it=active().find(i=>i.id===b.dataset.mcEbaybtn);if(it)root.CardsteadEbayLive?.render(b.closest('[data-mc-ebay]'),ebayCard(it),{compact:true});return}
 if(b.dataset.mcRemove){const id=b.dataset.mcRemove,item=active().find(i=>i.id===id);if(!item||!confirm(t('mc.confirmRemove',item.name)))return;
  const r=L().removeCard(id);if(r){editing=null;toast(t(r==='hidden'?'mc.hidden':'mc.removed',item.name));render()}}
});
root.addEventListener('cardstead:show',e=>{if(e.detail==='mycards'){autoDone=new Set();render()}});
root.addEventListener('pokeflip:saved',()=>{if(!$('mycards')?.classList.contains('hidden'))render()});
root.addEventListener('cardstead:lang',render);
root.addEventListener('cardstead:prices-progress',e=>{const s=$('mcStatus');if(s)s.textContent=t('mc.checking',e.detail.done,e.detail.total)});
root.addEventListener('cardstead:prices',e=>{checkAlerts(e.detail?.changed||null);render()});
/** "In My cards" block for the Prices search (product.js): matching cards with their price, linking to My cards. */
function findHtml(q){
 const hits=searchMine(active(),q).slice(0,12);if(!hits.length)return '';
 return `<h3>${esc(t('mc.inMine'))}</h3><ul class="prod-list">${hits.map(i=>`<li><button type="button" class="prod-row has-pic" data-page-link="mycards">${root.CardsteadPics?root.CardsteadPics.imgOr(i.image,{cls:'pic prod-pic'}):''}<span class="prod-main"><strong>${esc(i.name)}</strong><span class="note">${esc([i.setName||i.idCode,i.number?'#'+i.number:'',printingLabel({finish:i.finish,edition:i.edition||''}),i.grade&&i.grade!=='raw'?i.grade:''].filter(Boolean).join(' · '))}</span></span><span class="prod-val">${priceHtml(i)}${atTarget(i)?` <span class="pill green">${esc(t('mc.atTarget'))}</span>`:''}${root.CardsteadEbayLive?.cached(ebayCard(i))?'<br>'+root.CardsteadEbayLive.html({state:'ok',live:root.CardsteadEbayLive.cached(ebayCard(i))},{compact:true}):''}</span></button></li>`).join('')}</ul>`;
}
core.render=render;core.checkAlerts=checkAlerts;core.findHtml=findHtml;
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',render);else render();
})(typeof window!=='undefined'?window:globalThis);
