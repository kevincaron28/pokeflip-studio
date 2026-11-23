/* Cardstead pack value: is a single booster pack worth more opened or sealed?
 * EV = Σ (expected copies of a rarity per pack × average TCGplayer market price of that rarity).
 * Inputs are only dated, cited data: pack-ev-data.js (prices snapshot, tools/build-pack-ev.mjs)
 * and pack-ev-rates.js (published pull-rate tables and MSRP, each with its source).
 * Anything without a source is shown as unknown, never estimated.
 */
(function(root){'use strict';
const round=(v,d=2)=>Math.round((v+Number.EPSILON)*10**d)/10**d;
const isNum=v=>typeof v==='number'&&Number.isFinite(v);

/** One EV line per rarity slot. Values are USD (the price snapshot's currency). */
function computeEv(set,table){
 const lines=[];
 const pool=key=>set?.pools?.[key]||null;
 const add=(line)=>{lines.push(line);return line};
 if(!table||!Array.isArray(table.rates)||!table.rates.length){
  return {lines,status:'no-rates',totalUsd:null,hitsUsd:null,bulkUsd:null,complete:false,structureKnown:false};
 }
 const prob=r=>isNum(r.oneIn)&&r.oneIn>=1?1/r.oneIn:isNum(r.perPack)&&r.perPack>=0?r.perPack:null;
 // Hit lines straight from the published table.
 const listed=new Set();
 for(const r of table.rates){
  const p=prob(r),stats=pool(r.pool);listed.add(r.pool);
  const avg=stats&&isNum(stats.mean)?stats.mean:null;
  add({kind:'odds',label:r.label||r.pool,pool:r.pool,asPrinted:r.asPrinted||null,perPack:p,avg,
   count:stats?.count??0,priced:stats?.priced??0,best:stats?.best||null,
   value:p!==null&&avg!==null?p*avg:null,missing:p===null?'rate':avg===null?'price':null});
 }
 const s=table.structure||null;
 if(s){
  const fixed=(label,key,n)=>{const stats=pool(key),avg=stats&&isNum(stats.mean)?stats.mean:null;
   add({kind:'fixed',label,pool:key,asPrinted:n+' per pack',perPack:n,avg,count:stats?.count??0,priced:stats?.priced??0,best:stats?.best||null,
    value:avg!==null?n*avg:null,missing:avg===null?'price':null})};
  if(isNum(s.commons)&&s.commons>0&&!listed.has('Common'))fixed('Commons','Common',s.commons);
  if(isNum(s.uncommons)&&s.uncommons>0&&!listed.has('Uncommon'))fixed('Uncommons','Uncommon',s.uncommons);
  if(isNum(s.reverse)&&s.reverse>0){
   // A hit printed in a reverse-holo slot replaces that reverse holo.
   let taken=0;for(const key of table.replacesReverse||[]){const r=table.rates.find(x=>x.pool===key);const p=r&&prob(r);if(p!==null&&p!==undefined)taken+=p}
   const n=Math.max(0,s.reverse-taken),avg=isNum(set?.reverseHolo?.mean)?set.reverseHolo.mean:null;
   add({kind:'reverse',label:'Reverse holos (common to rare)',pool:'Reverse Holofoil',asPrinted:(taken?'about '+round(n,2):String(n))+' per pack',perPack:n,avg,
    count:set?.reverseHolo?.priced??0,priced:set?.reverseHolo?.priced??0,best:null,value:avg!==null?n*avg:null,missing:avg===null?'price':null});
  }
  if(!listed.has('Rare')&&Array.isArray(table.rareSlot)&&table.rareSlot.length){
   let taken=0;for(const key of table.rareSlot){const r=table.rates.find(x=>x.pool===key);const p=r&&prob(r);if(p!==null&&p!==undefined)taken+=p}
   const p=Math.max(0,1-taken),stats=pool('Rare'),avg=stats&&isNum(stats.mean)?stats.mean:null;
   add({kind:'remainder',label:'Rare (rest of the rare slot)',pool:'Rare',asPrinted:'about '+round(p*100,1)+'% of packs',perPack:p,avg,
    count:stats?.count??0,priced:stats?.priced??0,best:stats?.best||null,value:avg!==null?p*avg:null,missing:avg===null?'price':null});
  }
 }
 const known=lines.filter(l=>l.value!==null);
 const sum=arr=>arr.reduce((a,l)=>a+l.value,0);
 const hits=known.filter(l=>l.kind==='odds'&&!['Rare','Common','Uncommon'].includes(l.pool));
 const bulk=known.filter(l=>!hits.includes(l));
 const complete=!!s&&lines.every(l=>l.value!==null);
 return {lines,status:complete?'complete':s?'partial':'hits-only',totalUsd:known.length?sum(known):null,
  hitsUsd:hits.length?sum(hits):null,bulkUsd:s&&bulk.length?sum(bulk):null,complete,structureKnown:!!s};
}

/** MSRP for a set: per-set entry first, then the first rule whose eras/sets include it. */
function msrpFor(set,msrp){
 if(!set||!msrp)return null;
 const own=msrp.perSet?.[set.groupId];
 if(own)return own;
 for(const rule of msrp.rules||[]){
  if(Array.isArray(rule.groupIds)&&rule.groupIds.includes(set.groupId))return rule;
  if(Array.isArray(rule.eras)&&rule.eras.includes(set.eraCode)&&!(rule.exceptGroupIds||[]).includes(set.groupId))return rule;
 }
 return null;
}

/** open | sealed | skip | unknown. All three amounts in the same currency. */
function verdict({ev,sealed,msrp}){
 if(!isNum(ev)||!isNum(sealed))return {code:'unknown',label:'Not enough data',why:!isNum(ev)?'No complete sourced pull-rate table for this set, so no EV.':'No sealed pack price in the snapshot.'};
 if(isNum(msrp)&&ev<msrp&&sealed<msrp)return {code:'skip',label:'Skip at retail',why:'Bought at MSRP, you lose on average whether you open it or resell it sealed.'};
 if(ev>=sealed)return {code:'open',label:'Worth opening',why:'The cards inside average more than the sealed pack sells for.'};
 return {code:'sealed',label:'Keep sealed',why:'The sealed pack sells for more than its cards average.'};
}

/** One row per set. fee (0–1) is taken off resale values (opened cards and the sealed pack alike). */
function rows(data,rates,msrp,{fee=0}={}){
 const fx=data?.fx?.usdToCad,keep=1-(isNum(fee)&&fee>0&&fee<1?fee:0);
 const cad=v=>isNum(v)&&isNum(fx)?v*fx:null;
 return (data?.sets||[]).map(set=>{
  const table=rates?.[set.groupId]||null;
  const ev=computeEv(set,table);
  const m=msrpFor(set,msrp);
  const sealedUsd=isNum(set.pack?.market)?set.pack.market*keep:null;
  const evUsd=isNum(ev.totalUsd)&&ev.status!=='no-rates'?ev.totalUsd*keep:null;
  const msrpUsd=isNum(m?.usd)?m.usd:null,msrpCad=isNum(m?.cad)?m.cad:null;
  // Compare in USD: the prices are USD, and only a US MSRP is published for most sets.
  const msrpCmp=msrpUsd??(isNum(msrpCad)&&isNum(fx)?msrpCad/fx:null);
  const v=verdict({ev:ev.complete?evUsd:null,sealed:sealedUsd,msrp:msrpCmp});
  if(!ev.complete&&isNum(evUsd))v.why='Pull rates cover only part of the pack, so the EV is a lower bound.';
  const gapUsd=ev.complete&&isNum(evUsd)&&isNum(sealedUsd)?evUsd-sealedUsd:null;
  return {set,table,ev,msrp:m,msrpCad,msrpUsd,sealedUsd,sealedCad:cad(sealedUsd),evUsd,evCad:cad(evUsd),
   gapUsd,gapCad:cad(gapUsd),ratio:ev.complete&&isNum(evUsd)&&sealedUsd>0?evUsd/sealedUsd:null,fee:1-keep,verdict:v};
 });
}

const SORTS={
 gap:(a,b)=>(b.gapCad??-Infinity)-(a.gapCad??-Infinity),
 ratio:(a,b)=>(b.ratio??-Infinity)-(a.ratio??-Infinity),
 ev:(a,b)=>(b.evCad??-Infinity)-(a.evCad??-Infinity),
 sealed:(a,b)=>(b.sealedCad??-Infinity)-(a.sealedCad??-Infinity),
 newest:(a,b)=>String(b.set.released).localeCompare(String(a.set.released)),
 name:(a,b)=>a.set.name.localeCompare(b.set.name),
};
function filterSort(list,{era='',query='',onlyRated=false,sort='gap'}={}){
 const q=String(query).trim().toLowerCase();
 return list.filter(r=>(!era||r.set.eraCode===era)&&(!onlyRated||r.ev.complete)&&(!q||[r.set.name,r.set.code,r.set.era].join(' ').toLowerCase().includes(q)))
  .sort((a,b)=>(SORTS[sort]||SORTS.gap)(a,b)||SORTS.newest(a,b));
}

const core={computeEv,msrpFor,verdict,rows,filterSort,SORTS,round,FEE:0.1325};
root.CardsteadPackEv=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root?.document)return;

/* ---------- Page ---------- */
const doc=root.document,$=id=>doc.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cadFmt=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'});
const usdFmt=new Intl.NumberFormat('en-CA',{style:'currency',currency:'USD'});
const cad=v=>isNum(v)?cadFmt.format(v):'—';
const usd=v=>isNum(v)?usdFmt.format(v):'—';
const day=s=>{const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'unknown date'};
const safeUrl=u=>{try{const x=new URL(u);return ['https:','http:'].includes(x.protocol)?x.href:null}catch{return null}};
const link=(u,text)=>{const s=safeUrl(u);return s?`<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`:esc(text)};
const product=id=>'https://www.tcgplayer.com/product/'+encodeURIComponent(id);
const PILL={open:'green',sealed:'gold',skip:'red',unknown:''};
let state={data:null,list:[],selected:null,loading:null};

function loadData(){
 if(root.CardsteadPackData)return Promise.resolve(root.CardsteadPackData);
 if(state.loading)return state.loading;
 state.loading=new Promise((resolve,reject)=>{const s=doc.createElement('script');s.src='./pack-ev-data.js';s.onload=()=>root.CardsteadPackData?resolve(root.CardsteadPackData):reject(Error('Price snapshot is empty'));s.onerror=()=>reject(Error('Price snapshot could not load'));doc.head.appendChild(s)});
 state.loading.catch(()=>{state.loading=null});
 return state.loading;
}
function asOfLine(data){
 const p=data.prices,f=data.fx;
 return `Card and sealed pack prices: ${esc(p.source)} (USD) as of <strong>${esc(day(p.asOf))}</strong>, via ${link(p.url,p.via)}. CAD at ${esc(f.usdToCad)} (${link(f.url,f.source)}, ${esc(day(f.date))}). Market prices are before selling fees.`;
}
function msrpCell(r){if(isNum(r.msrpCad))return moneyCell(r.msrpCad,r.msrpUsd);return isNum(r.msrpUsd)?`<span class="muted">CAD unknown</span><div class="small"><strong>${usd(r.msrpUsd)}</strong> US</div>`:'<span class="muted">unknown</span>'}
function moneyCell(cadV,usdV){return isNum(cadV)?`<strong>${cad(cadV)}</strong><div class="small muted">${usd(usdV)}</div>`:'<span class="muted">unknown</span>'}
function evCell(r){
 if(!isNum(r.evCad))return '<span class="muted">unknown</span>';
 return `<strong>${cad(r.evCad)}</strong>${r.ev.complete?'':'<div class="small muted">lower bound</div>'}<div class="small muted">${usd(r.evUsd)}</div>`;
}
const signed=v=>(v>=0?'+':'−')+cad(Math.abs(v));
function gapCell(r){if(!isNum(r.gapCad))return '<span class="muted">—</span>';const pos=r.gapCad>=0;return `<strong class="${pos?'pack-up':'pack-down'}">${signed(r.gapCad)}</strong><div class="small muted">EV = ${Math.round(r.ratio*100)}% of sealed</div>`}
function feeNow(){return $('packFees')?.checked?0.1325:0}
function rebuild(){const rates=root.CardsteadPackRates||{};state.list=rows(state.data,rates.sets||{},rates.msrp||null,{fee:feeNow()})}
function renderList(){
 const box=$('packList');if(!box)return;
 const shown=filterSort(state.list,{era:$('packEra').value,query:$('packSearch').value,onlyRated:$('packRated').checked,sort:$('packSort').value});
 $('packCount').textContent=`${shown.length} of ${state.list.length} sets · ${state.list.filter(r=>r.ev.complete).length} with sourced pull rates`;
 if(!shown.length){box.innerHTML='<p class="empty">No set matches these filters.</p>';return}
 box.innerHTML=`<table class="pack-table"><thead><tr><th scope="col">Set</th><th scope="col">MSRP</th><th scope="col">Sealed pack</th><th scope="col">EV opened</th><th scope="col">EV − sealed</th><th scope="col">Verdict</th></tr></thead><tbody>${shown.map(r=>`<tr data-pack="${esc(r.set.groupId)}" tabindex="0" aria-label="${esc(r.set.name)}: open details"><td data-label="Set"><strong>${esc(r.set.name)}</strong><div class="small muted">${esc(r.set.era)} · ${esc(r.set.released)}</div></td><td data-label="MSRP">${msrpCell(r)}</td><td data-label="Sealed pack">${moneyCell(r.sealedCad,r.sealedUsd)}</td><td data-label="EV opened">${evCell(r)}</td><td data-label="EV − sealed">${gapCell(r)}</td><td data-label="Verdict"><span class="pill ${PILL[r.verdict.code]}">${esc(r.verdict.label)}</span>${r.table?.confidence==='low'?' <span class="pill">low-confidence odds</span>':''}</td></tr>`).join('')}</tbody></table>`;
}
function oddsText(l){
 if(l.kind==='odds')return l.asPrinted?esc(l.asPrinted):l.perPack!==null?'1 in '+round(1/l.perPack,1):'unknown';
 return esc(l.asPrinted||'');
}
function renderDetail(groupId){
 const box=$('packDetail'),r=state.list.find(x=>String(x.set.groupId)===String(groupId));
 if(!box)return;if(!r){box.classList.add('hidden');box.innerHTML='';return}
 state.selected=r.set.groupId;
 const fx=state.data.fx.usdToCad,t=r.table,m=r.msrp,s=r.set;
 const lines=r.ev.lines.slice().sort((a,b)=>(b.value??-1)-(a.value??-1));
 const breakdown=lines.length?`<div class="table-scroll"><table class="pack-breakdown"><thead><tr><th scope="col">Slot / rarity</th><th scope="col">Odds per pack</th><th scope="col">Cards priced</th><th scope="col">Average card</th><th scope="col">Adds to EV</th></tr></thead><tbody>${lines.map(l=>`<tr><td data-label="Slot / rarity"><strong>${esc(l.label)}</strong>${l.best?`<div class="small muted">Best: ${esc(l.best.name)} ${usd(l.best.price)}</div>`:''}</td><td data-label="Odds per pack">${oddsText(l)}</td><td data-label="Cards priced">${l.priced}${l.kind==='reverse'?'':' / '+l.count}</td><td data-label="Average card">${isNum(l.avg)?cad(l.avg*fx):'<span class="muted">unknown</span>'}</td><td data-label="Adds to EV">${isNum(l.value)?`<strong>${cad(l.value*fx)}</strong>`:`<span class="muted">unknown ${l.missing==='rate'?'rate':'price'}</span>`}</td></tr>`).join('')}</tbody></table></div>`:`<p class="note">${esc((root.CardsteadPackRates?.notes||{})[s.groupId]||'No published pull-rate table was found for this set.')} Its EV is unknown: Cardstead does not guess odds.</p>`;
 const top=(s.top||[]).map(c=>`<li><a href="${esc(product(c.id))}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a> <span class="pill">${esc(c.variant||c.rarity)}</span> <strong>${cad(c.price*fx)}</strong> <span class="small muted">${usd(c.price)}</span></li>`).join('');
 const src=t?.source;
 const structure=t?.structure;
 box.innerHTML=`<div class="row spread"><div><h2>${esc(s.name)} booster pack</h2><p class="note">${esc(s.era)} · released ${esc(s.released)}${s.code?' · '+esc(s.code):''}</p></div><button type="button" class="btn smallbtn" id="packClose">Back to list</button></div>
 <div class="grid4 pack-metrics"><div class="metric"><label>MSRP (Canada)</label><strong>${isNum(r.msrpCad)?cad(r.msrpCad):'unknown'}</strong><span class="small muted">${isNum(r.msrpUsd)?'US MSRP '+usd(r.msrpUsd):'USD unknown'}</span></div><div class="metric"><label>Sealed pack (market)</label><strong>${cad(r.sealedCad)}</strong><span class="small muted">${usd(r.sealedUsd)} · ${link(product(s.pack.id),'TCGplayer')}</span></div><div class="metric"><label>EV if opened${r.ev.complete?'':' (lower bound)'}</label><strong>${isNum(r.evCad)?cad(r.evCad):'unknown'}</strong><span class="small muted">${isNum(r.evUsd)?usd(r.evUsd):''}${isNum(r.ev.hitsUsd)?' · hits '+cad(r.ev.hitsUsd*fx*(1-r.fee)):''}</span></div><div class="metric"><label>EV − sealed</label><strong>${isNum(r.gapCad)?signed(r.gapCad):'—'}</strong><span class="small muted">${isNum(r.ratio)?'EV = '+Math.round(r.ratio*100)+'% of sealed':''}${r.ev.complete&&isNum(r.evUsd)&&isNum(r.msrpUsd)?' · EV − US MSRP '+(r.evUsd-r.msrpUsd>=0?'+':'−')+usd(Math.abs(r.evUsd-r.msrpUsd)):''}</span></div></div>
 <p class="pack-verdict pack-${esc(r.verdict.code)}"><strong>${esc(r.verdict.label)}.</strong> ${esc(r.verdict.why)}${r.fee?' Values are after '+round(r.fee*100,2)+'% selling fees.':''}</p>
 <div class="pack-yourprice"><div><label class="field" for="packYourPrice">Price you would pay for one pack · CAD</label><input id="packYourPrice" type="number" min="0" max="10000" step="0.01" inputmode="decimal" placeholder="e.g. a Canadian store price"></div><p class="note" id="packYourResult" aria-live="polite">${isNum(r.msrpCad)?'':'No Canadian MSRP is published for this pack, so enter what a store charges you.'}</p></div>
 <div id="packCompare" class="cmp cmp-inline"></div>
 <h3>EV by rarity slot</h3>${breakdown}
 ${r.ev.status==='hits-only'?'<p class="note">The source gives hit odds but not the pack layout, so commons, uncommons and reverse holos are left out: this EV is a lower bound.</p>':''}
 <h3>Top hits in the set</h3>${top?`<ol class="pack-top">${top}</ol>`:'<p class="note">No priced cards.</p>'}
 <h3>Sources</h3><ul class="pack-sources small">
 <li>Pull rates${t?.confidence==='low'?' (low confidence)':''}: ${src?`${link(src.url,src.title)} (${esc(src.publisher||'')}${src.date?', '+esc(src.date):''}${src.sample?', '+esc(Number(src.sample).toLocaleString('en-CA'))+'+ packs opened':''})`:'<span class="muted">unknown: no published table found</span>'}${t?.caveats?` <span class="muted">${esc(t.caveats)}</span>`:''}</li>
 ${structure?.source?`<li>Pack layout: ${link(structure.source.url,structure.source.title)}</li>`:''}
 <li>MSRP: ${m?`${m.sourceUrl?link(m.sourceUrl,m.sourceTitle||m.sourceUrl):esc(m.sourceTitle||'')}${m.seen?' (seen '+esc(m.seen)+')':''}${m.note?` <span class="muted">${esc(m.note)}</span>`:''}`:'<span class="muted">unknown</span>'}</li>
 <li>${asOfLine(state.data)}</li>
 <li class="muted">EV assumes every card of a rarity is equally likely and uses TCGplayer market prices for Near Mint English cards, before selling fees and shipping. Single packs vary a lot: most packs return far less than the EV and a few return far more.</li></ul>`;
 box.classList.remove('hidden');
 root.CardsteadCompare?.render($('packCompare'),{product:s.name+' Booster Pack',format:'pack'});
 const price=$('packYourPrice'),out=$('packYourResult');
 price.addEventListener('input',()=>{const v=Number(price.value);out.textContent=yourPrice(r,v)});
 $('packClose').onclick=()=>{box.classList.add('hidden');state.selected=null;const row=doc.querySelector(`[data-pack="${CSS.escape(String(s.groupId))}"]`);row?.focus()};
 box.scrollIntoView({block:'start',behavior:'smooth'});
}
function yourPrice(r,v){
 if(!(v>0))return '';
 const parts=[];
 if(isNum(r.evCad))parts.push(`${r.ev.complete?'Opening':'Opening (lower bound)'}: ${signed(r.evCad-v)} on average`);
 if(isNum(r.sealedCad))parts.push(`reselling sealed: ${signed(r.sealedCad-v)}`);
 return parts.length?parts.join(' · ')+(r.fee?' (after fees).':' (before fees and shipping).'):'Not enough data to compare.';
}
async function open(){
 const status=$('packStatus');
 try{
  const data=await loadData();state.data=data;
  rebuild();
  status.innerHTML=asOfLine(data);
  renderList();
 }catch(error){status.textContent='Pack prices could not load: '+error.message+'. Reload the page to try again.'}
}
function init(){
 const tab=doc.querySelector('[data-tab="packs"]');if(!tab||!$('packList'))return;
 tab.addEventListener('click',()=>{if(!state.data)open()});
 for(const id of ['packEra','packSort','packRated'])$(id).addEventListener('change',renderList);
 $('packFees').addEventListener('change',()=>{if(!state.data)return;rebuild();renderList();if(state.selected)renderDetail(state.selected)});
 $('packSearch').addEventListener('input',renderList);
 $('packList').addEventListener('click',e=>{const tr=e.target.closest('[data-pack]');if(tr)renderDetail(tr.dataset.pack)});
 $('packList').addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const tr=e.target.closest('[data-pack]');if(tr){e.preventDefault();renderDetail(tr.dataset.pack)}});
 // The mobile drawer navigates by clicking the tab, so this also covers phones.
 if(!$('packs').classList.contains('hidden'))open();
}
core.open=open;core.loadData=loadData;
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
