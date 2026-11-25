/* Cardstead eBay watchlist: listings of the most sought-after cards, checked against their market value.
 * Listings come only from the official eBay Browse API through /api/ebay-search (ebay.ca marketplace,
 * items that deliver to Canada). Values come from sought-cards.js and the dated price snapshot. No scraping,
 * no keys in the app, unknown values stay unknown (graded cards have no dated price source).
 */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9/]+/g,' ').trim();
// Titles that are never the card itself.
const BAD=['proxy','custom','orica','replica','fake','reprint','fan art','read description','read desc','see description','empty box','box only','no card','lot of','card lot','bulk','you pick','you choose','pick your','choose your','digital','code card','jumbo','oversized','art card','metal card','gold plated','sticker','display only','playmat','sleeve','binder','pin ','coin only',
 // Measured on ebay.ca, 24 Nov 2026: listings with these words were 77 of 137 "deals" and none was the card.
 'keychain','key chain','novelty','case','magnetic','magnet','mystery','metal','gold foil','golden','gold card','print','poster','a4','display','mount','frame','acrylic','figure','plush','art by','original art','repack','chance','not 1st','non 1st','no 1st','not first','signed','autograph','autographed','altered','alter'];
// Not "tag team" or "ace spec": TAG and ACE count only when a grade number follows.
const GRADED=/\b(psa|bgs|cgc|sgc|beckett|graded|slab|slabbed|grading)\b|\b(ace|tag|pcg|ags|gma|mnt|hga)\s*\d/;
const FOREIGN=/\b(japanese|japan|jpn|jp|chinese|korean|kor|french|francais|german|deutsch|italian|spanish|espanol|portuguese|thai|indonesian)\b/;

/** Edition the watched card needs: '1st', 'shadowless', 'unlimited' or null (modern cards). */
function edition(card){const p=' '+norm((card.printing||'')+' '+(card.set||'')+' '+String(card.id||'').replace(/-/g,' '))+' ';
 if(/ 1st | first edition /.test(p))return '1st';if(/ shadowless /.test(p))return 'shadowless';if(/ unlimited /.test(p))return 'unlimited';return null}
/** Condition written in a listing title: NM, LP, MP, HP, DMG or null when not stated. "HP 120" (hit points) is not a condition. */
function condition(title){const t=' '+norm(title).replace(/\//g,' ')+' ';
 if(/ (dmg|damaged|damage|crease|creased|creases|torn|poor) /.test(t))return 'DMG';
 if(/ (heavily played|heavy play|heavy played) /.test(t)||/ hp (?!\d)/.test(t)&&!/\d hp /.test(t))return 'HP';
 if(/ (mp|moderately played|moderate play|played) /.test(t))return 'MP';
 if(/ (lp|vlp|lightly played|light play|excellent) /.test(t))return 'LP';
 if(/ (nm|near mint|mint|pack fresh) /.test(t))return 'NM';
 return null}
/** Share of a Near Mint value a played copy is worth. Starting estimates, always shown as estimates. */
const COND_SHARE={NM:1,LP:0.8,MP:0.65,HP:0.45,DMG:0.3};

/** Does this listing title look like this exact card in this exact grade and edition? */
function matches(title,card,item){
 const t=' '+norm(title)+' ';
 for(const w of BAD.concat(card.exclude||[]))if(t.includes(' '+norm(w)+' '))return {ok:false,why:'excluded word: '+w};
 if(card.lang==='fr'){if(!/ (french|francais|fran[cç]ais|fr) /.test(t))return {ok:false,why:'French not stated'};if(FOREIGN.test(t.replace(/ (french|francais|fran[cç]ais) /g,' ')))return {ok:false,why:'other language'}}
 else if(FOREIGN.test(t))return {ok:false,why:'other language'};
 const grade=String(card.grade||'raw').toLowerCase();
 if(grade==='raw'){if(GRADED.test(t)||item&&/^graded$/i.test(item.condition||''))return {ok:false,why:'graded copy'}}
 else{
  if(/\bnot\s+(a\s+)?(psa|bgs|cgc|sgc|graded)\b/.test(t))return {ok:false,why:'says not graded'};
  const m=grade.match(/^(psa|bgs|cgc|sgc)\s*(\d+(?:\.5)?)$/);if(!m)return {ok:false,why:'unknown grade'};
  if(!new RegExp('\\b'+m[1]+'\\s*'+m[2].replace('.','\\.')+'\\b').test(t))return {ok:false,why:'not '+card.grade};
  const other=t.match(/\b(psa|bgs|cgc|sgc)\s*(\d+(?:\.5)?)\b/g)||[];if(other.some(o=>o.replace(/\s+/,' ')!==m[1]+' '+m[2]))return {ok:false,why:'other grade'};
 }
 const num=String(card.number||'').split('/')[0].replace(/^0+(?=\d)/,'');
 if(num&&!new RegExp('(^|[^0-9a-z])0*'+num.replace(/[^0-9a-z]/gi,'')+'([^0-9]|$)','i').test(t))return {ok:false,why:'card number missing'};
 const first=norm(card.name).split(' ').find(w=>w.length>2);
 if(first&&!t.includes(first))return {ok:false,why:'card name missing'};
 const ed=edition(card),first1=/ 1st | first edition /.test(t);
 if(ed==='1st'&&!first1)return {ok:false,why:'1st Edition not stated'};
 if(ed==='shadowless'&&(!t.includes(' shadowless ')||first1))return {ok:false,why:'Shadowless not stated'};
 if(ed==='unlimited'&&(first1||t.includes(' shadowless ')))return {ok:false,why:'other edition'};
 const pr=String(card.printing||'').toLowerCase(),rev=t.includes(' reverse ');
 if(/reverse/.test(pr)&&!rev)return {ok:false,why:'reverse holo not stated'};
 if(/holofoil/.test(pr)&&!/reverse/.test(pr)&&rev)return {ok:false,why:'reverse holo, a different printing'};
 return {ok:true,condition:grade==='raw'?condition(title):null};
}

/** Sold-based market value in CAD with its source and date, or null (unknown).
 *  Graded cards never get a raw price: their value comes from listingValue (asking prices). */
function valueOf(card,data){
 if(card.value&&isNum(card.value.cad))return {cad:card.value.cad,usd:null,source:card.value.source||'your value',date:card.value.date||null,mine:true,confidence:card.value.confidence};
 if(card.grade&&card.grade!=='raw')return null;
 const fx=data?.fx?.usdToCad;
 const live=data?.cardPrices?.[card.tcgplayerProductId+'|'+card.printing];
 if(isNum(live)&&card.marketSource!=='PriceCharting')return {usd:live,cad:isNum(fx)?live*fx:null,source:'TCGplayer market price',date:data.prices?.asOf||null,sold:true};
 if(isNum(card.marketUsd))return {usd:card.marketUsd,cad:isNum(fx)?card.marketUsd*fx:null,source:card.marketSource==='PriceCharting'?'PriceCharting ungraded value':card.marketSource||'source unknown',date:card.marketDate||null,sold:true};
 return null;
}
/** Listing price including shipping, in CAD. USD listings are converted at the snapshot's Bank of Canada rate. */
function total(item,fx){
 const conv=(v,c)=>!isNum(v)?null:c==='CAD'?v:c==='USD'&&isNum(fx)?v*fx:null;
 const price=conv(item.price,item.currency);if(price===null)return null;
 const ship=item.shipping===null||item.shipping===undefined?null:conv(item.shipping,item.shippingCurrency||item.currency);
 return {cad:price+(ship||0),shippingKnown:ship!==null,converted:item.currency!=='CAD'};
}
/** Typical asking price of the matching listings: the median after dropping the cheapest and dearest 20%.
 *  These are asking prices, never sales, so confidence is at most "medium". Needs at least 3 listings.
 *  nmOnly: for raw cards, leave out listings that say they are played. */
function listingValue(items,card,fx,{nmOnly=false}={}){
 const xs=[];for(const it of items||[]){const m=matches(it.title,card,it);if(!m.ok)continue;if(nmOnly&&m.condition&&m.condition!=='NM')continue;const t=total(it,fx);if(t)xs.push(t.cad)}// shipping not shown (calculated at checkout) counts as the item price
 if(xs.length<3)return null;xs.sort((a,b)=>a-b);const cut=Math.floor(xs.length*0.2),mid=xs.slice(cut,xs.length-cut);
 const med=mid.length%2?mid[(mid.length-1)/2]:(mid[mid.length/2-1]+mid[mid.length/2])/2;
 const spread=(mid[mid.length-1]-mid[0])/med;
 return {cad:Math.round(med*100)/100,n:xs.length,spread:Math.round(spread*100)/100,source:`from ${xs.length} eBay.ca listings (asking prices)`,asking:true,confidence:xs.length>=5&&spread<0.5?'medium':'low'};
}
/** How well two values agree: high within 25%, medium within 40%, low beyond. */
function agreement(a,b){if(!isNum(a)||!isNum(b)||a<=0||b<=0)return null;const d=Math.abs(a-b)/Math.min(a,b);return d<=0.25?'high':d<=0.40?'medium':'low'}
const cadFmt=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'});
const cad=v=>isNum(v)?cadFmt.format(v):'unknown';
/** More than 50% under value is almost never the real card in that condition (keychains, replicas, mislabelled copies). */
const SUSPECT=0.5;
function verdict(totalCad,valueCad){
 if(!isNum(totalCad)||!isNum(valueCad)||valueCad<=0)return {code:'unknown',label:'Value unknown',discount:null};
 const d=(valueCad-totalCad)/valueCad;
 if(d>SUSPECT)return {code:'suspect',label:`Too cheap to trust: ${Math.round(d*100)}% under value. Probably not the real card; check the photos.`,discount:d};
 if(d>0.05)return {code:'under',label:`Under value by ${cad(valueCad-totalCad)} (${Math.round(d*100)}%)`,discount:d};
 if(d<-0.05)return {code:'over',label:`Over value by ${cad(totalCad-valueCad)} (${Math.round(-d*100)}%)`,discount:d};
 return {code:'fair',label:'Fair: within 5% of market value',discount:d};
}
/** Every matching listing with its value and verdict; best deals first, suspect listings last.
 *  Raw cards: the value is for Near Mint; a listing that says LP/MP/HP/DMG is compared with that share of it.
 *  The eBay.ca asking median is a second opinion on the sold value: when both agree, confidence is high.
 *  Graded cards: the value is the trimmed median of matching listings (asking prices, low or medium confidence). */
function assess(results,cards,data){
 const fx=data?.fx?.usdToCad,out=[];
 for(const card of cards){const r=results?.[card.id];if(!r)continue;
  const graded=card.grade&&card.grade!=='raw';
  const ask=r.stats&&isNum(r.stats.cad)?r.stats:listingValue(r.items,card,fx,{nmOnly:!graded});
  let v=valueOf(card,data);
  if(!v&&graded&&ask)v={...ask,date:r.fetchedAt||null};
  else if(v&&!v.mine)v={...v,check:ask||null,confidence:ask?agreement(v.cad,ask.cad):'medium'};
  for(const it of r.items||[]){if(!it.url)continue;const m=matches(it.title,card,it);if(!m.ok)continue;const t=total(it,fx);if(!t)continue;
   const share=m.condition?COND_SHARE[m.condition]:1,vc=v&&isNum(v.cad)?v.cad*share:null;
   // Measured against the lower of the sold value and the typical eBay.ca asking price, so a deal is cheap on both.
   const ref=v&&isNum(v.cad)?(v.check&&isNum(v.check.cad)&&!v.asking?Math.min(v.cad,v.check.cad):v.cad)*share:null;
   out.push({card,item:it,value:v,condition:m.condition||null,valueForCondition:vc,dealRef:ref,total:t,verdict:verdict(t.cad,ref),fetchedAt:r.fetchedAt})}}
 return out.sort((a,b)=>(a.verdict.code==='suspect')-(b.verdict.code==='suspect')||(b.verdict.discount??-9)-(a.verdict.discount??-9));
}
/** Alert-worthy: at least `threshold` under value (shipping known) or at/below the user's target price. Never a suspect listing. */
/** Why a listing under value is not a deal we alert on (null when it is one). Measured on ebay.ca, 24 Nov 2026:
 *  these rules took flagged deals from 53% to 100% real deals on the same listings. */
function doubt(row){
 if(row.value&&row.value.confidence==='low'&&!row.value.asking)return 'value uncertain';
 if(row.item&&!(row.item.feedback>0))return 'seller with no feedback';
 return null;
}
function isDeal(row,threshold,target){
 if(row.verdict.code==='suspect')return false;
 if(doubt(row))return false;
 // Graded values are asking prices, which run about a third above sales: ask for 20% under them.
 if(row.value&&row.value.asking)threshold=Math.max(threshold,0.20);
 if(isNum(target)&&row.total.shippingKnown&&row.total.cad<=target)return true;
 return row.total.shippingKnown&&isNum(row.verdict.discount)&&row.verdict.discount>=threshold;
}

const KEY='cardstead-ebay-watch-v1',RESULTS='cardstead-ebay-results-v1',SEEN='cardstead-ebay-seen-v1';
const DEFAULTS={removed:[],custom:[],targets:{},threshold:0.10,auto:true};
const jget=(k,d)=>{try{const v=JSON.parse(root.localStorage?.getItem(k)||'null');return v??d}catch{return d}};
const jset=(k,v)=>{try{root.localStorage?.setItem(k,JSON.stringify(v))}catch{}};
function prefs(){const p={...DEFAULTS,...jget(KEY,{})};p.threshold=isNum(p.threshold)&&p.threshold>=0&&p.threshold<=0.9?p.threshold:0.10;return p}
function watched(p=prefs(),list=root.CardsteadSoughtCards?.cards||[],mine=myCards()){return list.filter(c=>!p.removed.includes(c.id)).concat(p.custom||[],mine)}
/** Target and alert level of a My cards row, each in its own span (translated whole). */
function mineExtra(c){let x='';if(isNum(c.target))x+=`<span> · Target ${cad(c.target)}</span>`;if(isNum(c.threshold))x+=`<span> · Alert at ${Math.round(c.threshold*100)}% under value</span>`;return x}
/** My cards that have a target price or an alert level (mycards.js). */
function myCards(){try{const L=root.pokeflipLedger,M=root.CardsteadMyCards;return L&&M?M.ebayCards(L.getData().items):[]}catch{return []}}
/** Alert level and target for a card: its own (My cards) or the eBay deals settings. */
function ruleFor(card,p){return card.mine?{threshold:isNum(card.threshold)?card.threshold:p.threshold,target:isNum(card.target)?card.target:undefined}:{threshold:p.threshold,target:p.targets[card.id]}}

const core={BAD,doubt,matches,edition,condition,COND_SHARE,valueOf,total,listingValue,agreement,verdict,assess,isDeal,prefs,watched,ruleFor,KEY,norm};
root.CardsteadEbayWatch=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root?.document)return;

/* ---------- Page ---------- */
const doc=root.document,$=id=>doc.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const day=s=>{const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'unknown date'};
const API=()=>(root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'')+'/api/ebay-search';
// The app (another origin) asks with its own URL, so the CDN never hands it a copy cached for the website (CORS).
const SRC=()=>root.PokeFlipNative&&root.PokeFlipNative.isNative?'&src=app':'';
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
 <dl class="ac-grid"><div><dt>Seller</dt><dd>${esc(it.seller||'unknown')}${isNum(it.feedback)?' ('+esc(it.feedback)+'%)':''}${it.country?' · '+esc(it.country):''}</dd></div><div><dt>Price + shipping</dt><dd><strong>${cad(r.total.cad)}</strong>${r.total.shippingKnown?'':' <span class="ac-sub">+ shipping unknown</span>'}${r.total.converted?' <span class="ac-sub">(converted from '+esc(it.currency)+')</span>':''}</dd></div><div><dt>Condition</dt><dd>${esc(r.condition?r.condition+' (from the title)':it.condition||'not stated')}</dd></div></dl>
 <dl class="ac-rows"><div><dt>Listing</dt><dd class="ac-sub">${esc(it.title)}</dd></div>
 <div><dt>Market value</dt><dd>${v&&isNum(v.cad)?cad(v.cad)+` <span class="ac-sub">${esc(v.source)}${v.date?', as of '+esc(day(v.date)):''}</span>`:'unknown <span class="ac-sub">'+(r.card.grade&&r.card.grade!=='raw'?'fewer than 3 matching eBay.ca listings':'no market price')+'</span>'}${v&&isNum(v.cad)?confPill(v.confidence):''}</dd></div>
 ${v&&v.check?`<div><dt>Second opinion</dt><dd>${cad(v.check.cad)} <span class="ac-sub">${esc(v.check.source)}</span></dd></div>`:''}
 ${r.condition&&r.condition!=='NM'&&isNum(r.valueForCondition)?`<div><dt>Value for ${esc(r.condition)}</dt><dd>${cad(r.valueForCondition)} <span class="ac-sub">estimate: ${Math.round(COND_SHARE[r.condition]*100)}% of Near Mint</span></dd></div>`:''}</dl>
 <p class="ac-verdict">${esc(r.verdict.label)}</p>
 <div class="ac-foot"><a class="btn smallbtn primary" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">View on eBay</a><span class="ac-sub">Checked ${esc(new Date(r.fetchedAt).toLocaleString('en-CA'))}</span></div></article>`;
}
function confPill(c){const k={high:['green','High'],medium:['gold','Medium'],low:['red','Low']}[c];return k?` <span class="pill ${k[0]}" title="How far the price sources agree">${k[1]} confidence</span>`:''}
function wire(node){node.querySelectorAll('img.ac-img').forEach(i=>i.addEventListener('error',()=>i.remove(),{once:true}))}
function renderDeals(){
 const host=$('dealsList');if(!host)return;const p=prefs(),res=jget(RESULTS,{});
 const all=assess(res.byCard||{},watched(p),data),under=all.filter(r=>r.verdict.code==='under'),rows=under.filter(r=>{const k=ruleFor(r.card,p);return isDeal(r,k.threshold,k.target)}),maybe=under.filter(r=>!rows.includes(r)),suspect=all.filter(r=>r.verdict.code==='suspect').length;
 $('dealsCount').textContent=res.at?`${rows.length} listing(s) under market value · last scan ${new Date(res.at).toLocaleString('en-CA')} · alerts at ${Math.round(p.threshold*100)}% under value or your target price${suspect?` · ${suspect} hidden: more than 50% under value, probably not the real card`:''}`:'No scan yet.';
 host.innerHTML=(rows.length?rows.slice(0,40).map(dealHtml).join(''):'<p class="empty">No listing is a sure deal in the last scan.</p>')
  +(maybe.length?`<details class="panel advanced"><summary>${maybe.length} more under value, not alerted (value uncertain, new seller, or less than your alert level)</summary>${maybe.slice(0,40).map(r=>dealHtml(r)+(doubt(r)?`<p class="note">Not alerted: ${esc(doubt(r))}.</p>`:'')).join('')}</details>`:'');wire(host);
}
function renderWatch(){
 const host=$('dealsWatch');if(!host)return;const p=prefs(),q=norm($('dealsFilter').value),fx=data?.fx?.usdToCad;
 const list=watched(p).filter(c=>!q||norm(cardLabel(c)).includes(q));
 $('dealsWatchCount').textContent=`${watched(p).length} cards watched (${p.removed.length} removed, ${(p.custom||[]).length} added by you, ${myCards().length} from My cards)`;
 host.replaceChildren();
 for(const c of list.slice(0,200)){const v=valueOf(c,data);const row=doc.createElement('div');row.className='deal-watch';
  row.innerHTML=`<div><strong>${esc(cardLabel(c))}</strong><div class="note">${v&&isNum(v.cad)?cad(v.cad)+' · '+esc(v.source)+(v.date?', '+esc(day(v.date)):''):'Value unknown'}${c.demandSourceUrl?` · <a href="${esc(c.demandSourceUrl)}" target="_blank" rel="noopener noreferrer">why it's watched</a>`:''}</div></div>
  <label class="deal-target"><span class="note">Target CAD</span><input type="number" min="0" step="1" inputmode="decimal" value="${esc(p.targets[c.id]??'')}" aria-label="Target price for ${esc(c.name)}"></label><button type="button" class="btn smallbtn">Remove</button>`;
  if(c.mine){row.innerHTML=`<div><strong>${esc(cardLabel(c))}</strong> <span class="pill">My cards</span><div class="note">${v&&isNum(v.cad)?cad(v.cad)+' · '+esc(v.source):'Value unknown'}${mineExtra(c)}</div></div><button type="button" class="btn smallbtn" data-page-link="mycards">Edit in My cards</button>`;host.append(row);continue}
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
   try{const r=await fetch(API()+'?q='+encodeURIComponent(c.ebayQuery||cardLabel(c))+SRC(),{cache:'no-store'});
    if(r.status===429){msg.textContent='eBay search limit reached; the scan continues later.';break}
    const j=await r.json();if(!r.ok)throw Error(j.error||r.status);
    // Keep the 8 cheapest matching listings per card.
    // Also keep the typical asking price of all matches: the value of graded cards, a second opinion for raw ones.
    const ok=(j.items||[]).filter(it=>matches(it.title,c,it).ok),graded=c.grade&&c.grade!=='raw';
    res.byCard[c.id]={fetchedAt:j.fetchedAt,items:ok.slice(0,8),stats:listingValue(ok,c,data?.fx?.usdToCad,{nmOnly:!graded})};done++}
   catch{failed++}
   await new Promise(r=>setTimeout(r,1200))}
  res.at=new Date().toISOString();jset(RESULTS,res);
  const seen=new Set(jget(SEEN,[]));
  for(const r of assess(res.byCard,cards,data)){const k=ruleFor(r.card,p);if(isDeal(r,k.threshold,k.target)&&!seen.has(r.item.id)){seen.add(r.item.id);notifyDeal(r)}}
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
