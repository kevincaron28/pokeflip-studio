/* Cardstead eBay watchlist: listings of the most sought-after cards, checked against their market value.
 * Listings come only from the official eBay Browse API through /api/ebay-search (ebay.ca marketplace,
 * items that deliver to Canada). Values come from sought-cards.js and the dated price snapshot. No scraping,
 * no keys in the app, unknown values stay unknown (graded cards have no dated price source).
 */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9/]+/g,' ').trim();
// Titles that are never the card itself.
const BAD=['proxy','custom','orica','replica','fake','reprint','fan art','read description','read desc','see description','empty box','box only','no card','lot of','card lot','bulk','you pick','you choose','pick your','choose your','digital','code card','jumbo','oversized','art card','metal card','gold plated','sticker','display only','playmat','sleeve','binder','pin ','coin only'];
// Not "tag" or "ace": TAG TEAM and ACE SPEC are card names.
const GRADED=/\b(psa|bgs|cgc|sgc|beckett|graded|slab|slabbed)\b/;
const FOREIGN=/\b(japanese|japan|jpn|jp|chinese|korean|kor|french|francais|german|deutsch|italian|spanish|espanol|portuguese|thai|indonesian)\b/;

/** Does this listing title look like this exact card in this exact grade? */
function matches(title,card){
 const t=' '+norm(title)+' ';
 for(const w of BAD.concat(card.exclude||[]))if(t.includes(' '+norm(w)+' '))return {ok:false,why:'excluded word: '+w};
 if(FOREIGN.test(t))return {ok:false,why:'other language'};
 const grade=String(card.grade||'raw').toLowerCase();
 if(grade==='raw'){if(GRADED.test(t))return {ok:false,why:'graded copy'}}
 else{
  const m=grade.match(/^(psa|bgs|cgc|sgc)\s*(\d+(?:\.5)?)$/);if(!m)return {ok:false,why:'unknown grade'};
  if(!new RegExp('\\b'+m[1]+'\\s*'+m[2].replace('.','\\.')+'\\b').test(t))return {ok:false,why:'not '+card.grade};
  const other=t.match(/\b(psa|bgs|cgc|sgc)\s*(\d+(?:\.5)?)\b/g)||[];if(other.some(o=>o.replace(/\s+/,' ')!==m[1]+' '+m[2]))return {ok:false,why:'other grade'};
 }
 const num=String(card.number||'').split('/')[0].replace(/^0+(?=\d)/,'');
 if(num&&!new RegExp('(^|[^0-9a-z])0*'+num.replace(/[^0-9a-z]/gi,'')+'([^0-9]|$)','i').test(t))return {ok:false,why:'card number missing'};
 const first=norm(card.name).split(' ').find(w=>w.length>2);
 if(first&&!t.includes(first))return {ok:false,why:'card name missing'};
 return {ok:true};
}

/** Market value in USD with its source and date, or null (unknown). */
function valueOf(card,data){
 if(card.value&&isNum(card.value.cad))return {cad:card.value.cad,usd:null,source:card.value.source||'your value',date:card.value.date||null,mine:true};
 const fx=data?.fx?.usdToCad;
 const live=data?.cardPrices?.[card.tcgplayerProductId+'|'+card.printing];
 if(isNum(live)&&card.marketSource!=='PriceCharting')return {usd:live,cad:isNum(fx)?live*fx:null,source:'TCGplayer market price',date:data.prices?.asOf||null};
 if(isNum(card.marketUsd))return {usd:card.marketUsd,cad:isNum(fx)?card.marketUsd*fx:null,source:card.marketSource==='PriceCharting'?'PriceCharting ungraded value':card.marketSource||'source unknown',date:card.marketDate||null};
 return null;
}
/** Listing price including shipping, in CAD. USD listings are converted at the snapshot's Bank of Canada rate. */
function total(item,fx){
 const conv=(v,c)=>!isNum(v)?null:c==='CAD'?v:c==='USD'&&isNum(fx)?v*fx:null;
 const price=conv(item.price,item.currency);if(price===null)return null;
 const ship=item.shipping===null||item.shipping===undefined?null:conv(item.shipping,item.shippingCurrency||item.currency);
 return {cad:price+(ship||0),shippingKnown:ship!==null,converted:item.currency!=='CAD'};
}
const cadFmt=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'});
const cad=v=>isNum(v)?cadFmt.format(v):'unknown';
function verdict(totalCad,valueCad){
 if(!isNum(totalCad)||!isNum(valueCad)||valueCad<=0)return {code:'unknown',label:'Value unknown',discount:null};
 const d=(valueCad-totalCad)/valueCad;
 if(d>0.05)return {code:'under',label:`Under value by ${cad(valueCad-totalCad)} (${Math.round(d*100)}%)`,discount:d};
 if(d<-0.05)return {code:'over',label:`Over value by ${cad(totalCad-valueCad)} (${Math.round(-d*100)}%)`,discount:d};
 return {code:'fair',label:'Fair: within 5% of market value',discount:d};
}
/** Every matching listing with its value and verdict; best deals first. */
function assess(results,cards,data){
 const fx=data?.fx?.usdToCad,out=[];
 for(const card of cards){const r=results?.[card.id];if(!r)continue;const v=valueOf(card,data);
  for(const it of r.items||[]){if(!it.url)continue;const m=matches(it.title,card);if(!m.ok)continue;const t=total(it,fx);if(!t)continue;
   out.push({card,item:it,value:v,total:t,verdict:verdict(t.cad,v?.cad),fetchedAt:r.fetchedAt})}}
 return out.sort((a,b)=>(b.verdict.discount??-9)-(a.verdict.discount??-9));
}
/** Alert-worthy: at least `threshold` under value (shipping known) or at/below the user's target price. */
function isDeal(row,threshold,target){
 if(isNum(target)&&row.total.shippingKnown&&row.total.cad<=target)return true;
 return row.total.shippingKnown&&isNum(row.verdict.discount)&&row.verdict.discount>=threshold;
}

const KEY='cardstead-ebay-watch-v1',RESULTS='cardstead-ebay-results-v1',SEEN='cardstead-ebay-seen-v1';
const DEFAULTS={removed:[],custom:[],targets:{},threshold:0.10,auto:true};
const jget=(k,d)=>{try{const v=JSON.parse(root.localStorage?.getItem(k)||'null');return v??d}catch{return d}};
const jset=(k,v)=>{try{root.localStorage?.setItem(k,JSON.stringify(v))}catch{}};
function prefs(){const p={...DEFAULTS,...jget(KEY,{})};p.threshold=isNum(p.threshold)&&p.threshold>=0&&p.threshold<=0.9?p.threshold:0.10;return p}
function watched(p=prefs(),list=root.CardsteadSoughtCards?.cards||[]){return list.filter(c=>!p.removed.includes(c.id)).concat(p.custom||[])}

const core={BAD,matches,valueOf,total,verdict,assess,isDeal,prefs,watched,KEY,norm};
root.CardsteadEbayWatch=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root?.document)return;

/* ---------- Page ---------- */
const doc=root.document,$=id=>doc.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=s=>{const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'unknown date'};
const API=()=>(root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'')+'/api/ebay-search';
let data=null,status='unknown',scanning=false,timer=null;
function script(src,ready){return ready()?Promise.resolve():new Promise((res,rej)=>{const s=doc.createElement('script');s.src=src;s.onload=()=>res();s.onerror=()=>rej(Error(src+' could not load'));doc.head.appendChild(s)})}
async function loadAll(){
 await script('./sought-cards.js',()=>!!root.CardsteadSoughtCards);
 data=root.CardsteadPackEv?.loadData?await root.CardsteadPackEv.loadData():null;
}
function cardLabel(c){return `${c.name}${c.number?' '+c.number:''} · ${c.set||''}${c.grade&&c.grade!=='raw'?' · '+c.grade:''}`}
function dealHtml(r){
 const v=r.value,it=r.item;
 return `<article class="alert-card ac-${esc(r.verdict.code)}" aria-label="${esc('eBay listing: '+cardLabel(r.card))}">
 <div class="ac-head"><div><p class="ac-kind">eBay listing</p><h3 class="ac-title">${esc(cardLabel(r.card))}</h3></div>${it.image?`<img class="ac-img" loading="lazy" alt="" src="${esc(it.image)}">`:''}</div>
 <dl class="ac-grid"><div><dt>Seller</dt><dd>${esc(it.seller||'unknown')}${isNum(it.feedback)?' ('+esc(it.feedback)+'%)':''}${it.country?' · '+esc(it.country):''}</dd></div><div><dt>Price + shipping</dt><dd><strong>${cad(r.total.cad)}</strong>${r.total.shippingKnown?'':' <span class="ac-sub">+ shipping unknown</span>'}${r.total.converted?' <span class="ac-sub">(converted from '+esc(it.currency)+')</span>':''}</dd></div><div><dt>Condition</dt><dd>${esc(it.condition||'not stated')}</dd></div></dl>
 <dl class="ac-rows"><div><dt>Listing</dt><dd class="ac-sub">${esc(it.title)}</dd></div>
 <div><dt>Market value</dt><dd>${v&&isNum(v.cad)?cad(v.cad)+` <span class="ac-sub">${esc(v.source)}${v.date?', as of '+esc(day(v.date)):''}</span>`:'unknown <span class="ac-sub">'+(r.card.grade&&r.card.grade!=='raw'?'no dated graded price source':'no market price')+'</span>'}</dd></div></dl>
 <p class="ac-verdict">${esc(r.verdict.label)}</p>
 <div class="ac-foot"><a class="btn smallbtn primary" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">View on eBay</a><span class="ac-sub">Checked ${esc(new Date(r.fetchedAt).toLocaleString('en-CA'))}</span></div></article>`;
}
function wire(node){node.querySelectorAll('img.ac-img').forEach(i=>i.addEventListener('error',()=>i.remove(),{once:true}))}
function renderDeals(){
 const host=$('dealsList');if(!host)return;const p=prefs(),res=jget(RESULTS,{});
 const rows=assess(res.byCard||{},watched(p),data).filter(r=>r.verdict.code==='under');
 $('dealsCount').textContent=res.at?`${rows.length} listing(s) under market value · last scan ${new Date(res.at).toLocaleString('en-CA')} · alerts at ${Math.round(p.threshold*100)}% under value or your target price`:'No scan yet.';
 host.innerHTML=rows.length?rows.slice(0,40).map(dealHtml).join(''):'<p class="empty">No listing under market value in the last scan.</p>';wire(host);
}
function renderWatch(){
 const host=$('dealsWatch');if(!host)return;const p=prefs(),q=norm($('dealsFilter').value),fx=data?.fx?.usdToCad;
 const list=watched(p).filter(c=>!q||norm(cardLabel(c)).includes(q));
 $('dealsWatchCount').textContent=`${watched(p).length} cards watched (${p.removed.length} removed, ${(p.custom||[]).length} added by you)`;
 host.replaceChildren();
 for(const c of list.slice(0,200)){const v=valueOf(c,data);const row=doc.createElement('div');row.className='deal-watch';
  row.innerHTML=`<div><strong>${esc(cardLabel(c))}</strong><div class="note">${v&&isNum(v.cad)?cad(v.cad)+' · '+esc(v.source)+(v.date?', '+esc(day(v.date)):''):'Value unknown'}${c.demandSourceUrl?` · <a href="${esc(c.demandSourceUrl)}" target="_blank" rel="noopener noreferrer">why it's watched</a>`:''}</div></div>
  <label class="deal-target"><span class="note">Target CAD</span><input type="number" min="0" step="1" inputmode="decimal" value="${esc(p.targets[c.id]??'')}" aria-label="Target price for ${esc(c.name)}"></label><button type="button" class="btn smallbtn">Remove</button>`;
  row.querySelector('input').onchange=e=>{const q2=prefs();const n=Number(e.target.value);if(e.target.value===''||!(n>0))delete q2.targets[c.id];else q2.targets[c.id]=n;jset(KEY,q2)};
  row.querySelector('button').onclick=()=>{const q2=prefs();if(c.custom)q2.custom=q2.custom.filter(x=>x.id!==c.id);else q2.removed=[...new Set([...q2.removed,c.id])];jset(KEY,q2);renderWatch();renderDeals()};
  host.append(row)}
 void fx;
}
async function checkStatus(){
 const box=$('dealsSetup');
 try{const r=await fetch(API()+'?status=1',{cache:'no-store'});const j=await r.json().catch(()=>({}));status=j.configured?'ready':'setup'}catch{status='offline'}
 box.classList.toggle('hidden',status==='ready');
 $('dealsScan').disabled=status!=='ready';
 if(status==='offline')box.querySelector('p').textContent='eBay not connected: the search service could not be reached. It needs an internet connection and the Cardstead website.';
 return status;
}
function notifyDeal(r){
 const text=`${cardLabel(r.card)}: ${cad(r.total.cad)} on eBay · ${r.verdict.label}`;
 if(root.PokeFlipNative&&root.PokeFlipNative.isNative){root.PokeFlipNative.notify('Cardstead eBay deal',text);return}
 if('Notification' in root&&Notification.permission==='granted'){navigator.serviceWorker?.getRegistration?.().then(reg=>reg?.showNotification?reg.showNotification('Cardstead eBay deal',{body:text,icon:'icon-192.png'}):new Notification('Cardstead eBay deal',{body:text})).catch(()=>{})}
}
async function scan(){
 if(scanning||status!=='ready')return;scanning=true;const btn=$('dealsScan'),msg=$('dealsMessage');btn.disabled=true;
 const p=prefs(),cards=watched(p),res=jget(RESULTS,{byCard:{}});res.byCard=res.byCard||{};let done=0,failed=0;
 try{for(const c of cards){if(doc.hidden&&!root.PokeFlipNative)break;msg.textContent=`Checking eBay: ${done+1} of ${cards.length} (${c.name})…`;
   try{const r=await fetch(API()+'?q='+encodeURIComponent(c.ebayQuery||cardLabel(c)),{cache:'no-store'});
    if(r.status===429){msg.textContent='eBay search limit reached; the scan continues later.';break}
    const j=await r.json();if(!r.ok)throw Error(j.error||r.status);
    // Keep the 8 cheapest matching listings per card.
    res.byCard[c.id]={fetchedAt:j.fetchedAt,items:(j.items||[]).filter(it=>matches(it.title,c).ok).slice(0,8)};done++}
   catch{failed++}
   await new Promise(r=>setTimeout(r,1200))}
  res.at=new Date().toISOString();jset(RESULTS,res);
  const seen=new Set(jget(SEEN,[]));
  for(const r of assess(res.byCard,cards,data))if(isDeal(r,p.threshold,p.targets[r.card.id])&&!seen.has(r.item.id)){seen.add(r.item.id);notifyDeal(r)}
  jset(SEEN,[...seen].slice(-3000));
  msg.textContent=`Scan finished: ${done} card(s) checked${failed?', '+failed+' failed':''}.`;
 }finally{scanning=false;btn.disabled=status!=='ready';renderDeals()}
}
async function open(){
 try{await loadAll()}catch(e){$('dealsMessage').textContent=e.message;return}
 $('dealsThreshold').value=Math.round(prefs().threshold*100);$('dealsAuto').checked=prefs().auto;
 renderWatch();renderDeals();
 if(await checkStatus()==='ready'&&prefs().auto&&!timer){timer=setInterval(()=>{if(prefs().auto&&!doc.hidden)scan()},60*60*1000)}
}
function init(){
 const tab=doc.querySelector('[data-tab="deals"]');if(!tab||!$('dealsList'))return;
 tab.addEventListener('click',()=>{if(!data)open()});
 $('dealsScan').onclick=scan;
 $('dealsFilter').addEventListener('input',renderWatch);
 $('dealsThreshold').onchange=e=>{const p=prefs(),n=Number(e.target.value);if(n>=0&&n<=90){p.threshold=n/100;jset(KEY,p);renderDeals()}};
 $('dealsAuto').onchange=e=>{const p=prefs();p.auto=e.target.checked;jset(KEY,p)};
 $('dealsRestore').onclick=()=>{const p=prefs();p.removed=[];jset(KEY,p);renderWatch();renderDeals()};
 $('dealsAddForm').onsubmit=e=>{e.preventDefault();const p=prefs();const name=$('dealsAddName').value.trim(),query=$('dealsAddQuery').value.trim();if(!name||query.length<3)return;
  const val=Number($('dealsAddValue').value);
  const c={id:'my-'+Date.now().toString(36),custom:true,name,number:$('dealsAddNumber').value.trim(),set:$('dealsAddSet').value.trim(),grade:$('dealsAddGrade').value,ebayQuery:query.slice(0,120),exclude:[],value:val>0?{cad:val,source:'your value',date:new Date().toISOString().slice(0,10)}:null};
  p.custom=[...(p.custom||[]),c].slice(-200);jset(KEY,p);e.target.reset();renderWatch()};
}
core.open=open;core.scan=scan;
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
