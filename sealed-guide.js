/* PokéFlip Sealed Guide: TCGdex catalog, user-sourced retail and sold observations.
 * No unlicensed price feeds, automated valuations, or implied authenticity checks.
 */
(function(root){'use strict';
 const TYPES={pack:'Booster pack',box:'Booster box',etb:'Elite Trainer Box (ETB)',bundle:'Booster bundle',blister:'Blister / sleeved pack',collection:'Collection / premium box',tin:'Tin',other:'Other sealed product'};
 const KEY='pokeflip-sealed-v1';
 const num=v=>Number(v);
 const round=v=>Math.round((v+Number.EPSILON)*100)/100;
 const key=o=>[o.setId,o.type,o.edition?.trim().toLowerCase(),o.language,o.packs].join('|');
 const money=v=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(v);
 function validate(o){
  if(!o||typeof o!=='object'||!['sold','retail'].includes(o.kind))throw Error('Invalid observation kind');
  if(!/^[\w.\-]{1,40}$/.test(o.setId||''))throw Error('Set ID is required');
  if(!TYPES[o.type])throw Error('Unknown sealed product format');
  if(!['en','fr','ja','other'].includes(o.language))throw Error('Invalid language');
  if(typeof o.edition!=='string'||!o.edition.trim()||o.edition.length>100)throw Error('Specify exact edition or product name');
  if(!Number.isInteger(o.packs)||o.packs<0||o.packs>1000)throw Error('Invalid pack count');
  if(!Number.isFinite(o.price)||o.price<=0||o.price>10000000)throw Error('Invalid CAD price');
  if(o.currency!=='CAD')throw Error('Prices must be in CAD; convert verified transaction first');
  if(typeof o.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(o.date)||!Number.isFinite(Date.parse(o.date+'T12:00:00Z'))||o.date>new Date().toISOString().slice(0,10))throw Error('Invalid date');
  if(typeof o.source!=='string'||!o.source.trim()||o.source.length>150)throw Error('Provide a store or sales source');
  if(o.url){let url;try{url=new URL(o.url)}catch{throw Error('Invalid source URL')}if(!['https:','http:'].includes(url.protocol))throw Error('Invalid source URL protocol')}
  return true;
 }
 function median(values){if(!values.length)return null;const a=values.slice().sort((a,b)=>a-b);return round(a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2)}
 function benchmark(observations,identity,now=new Date()){
  const cutDate=new Date(now.getTime()-180*86400000).toISOString().slice(0,10),todayDate=now.toISOString().slice(0,10);
  const sales=observations.filter(o=>o.kind==='sold'&&key(o)===key(identity)&&o.currency==='CAD'&&o.date>=cutDate&&o.date<=todayDate&&Number.isFinite(o.price));
  const m=median(sales.map(o=>o.price));return {count:sales.length,median:m,ready:sales.length>=3,low:sales.length?Math.min(...sales.map(o=>o.price)):null,high:sales.length?Math.max(...sales.map(o=>o.price)):null};
 }
 function calculate({price,shipping=0,taxRate=14.975,market=null,feeRate=13.25,fulfillment=0}){
  const p=num(price),s=num(shipping),t=num(taxRate),fee=num(feeRate),f=num(fulfillment);
  if([p,s,t,fee,f].some(v=>!Number.isFinite(v)||v<0)||t>100||fee>100)throw Error('Invalid purchase or fee inputs');
  const landed=round((p+s)*(1+t/100));
  const result={landed,perPack:null,market:null,spread:null,projectedNet:null,verdict:'No reliable sold benchmark'};
  if(market!==null&&Number.isFinite(num(market))&&num(market)>0){const m=num(market);result.market=m;result.spread=round(m-landed);result.projectedNet=round(m*(1-fee/100)-f-landed);result.verdict=result.projectedNet>0?'Potential margin (not a guarantee)':'Above net resale break-even';}
  return result;
 }
 function validateBackup(entries){if(!Array.isArray(entries)||entries.length>10000)throw Error('Invalid sealed observations');for(const o of entries)validate(o);return true}
 const API={TYPES,key,validate,median,benchmark,calculate,validateBackup};root.PokeFlipSealed=API;
 if(typeof document==='undefined')return;
 const $=id=>document.getElementById(id);
 let observations=[];let setCatalog=[];
 function safeText(el,value){el.textContent=String(value??'');return el}
 function load(){try{let arr=JSON.parse(localStorage.getItem(KEY)||'[]');validateBackup(arr);observations=arr}catch{observations=[];$('sealedMsg').textContent='Sealed observations could not be loaded. Check your last backup.'}}
 function persist(){localStorage.setItem(KEY,JSON.stringify(observations));window.dispatchEvent(new Event('pokeflip:saved'))}
 function identity(){return {setId:$('sealedSet').value||$('sealedManualSet').value.trim(),type:$('sealedType').value,edition:$('sealedEdition').value.trim(),language:$('sealedLanguage').value,packs:Number($('sealedPacks').value)}}
 function defaultPacks(){const map={pack:1,box:36,bundle:6,etb:9,blister:1,collection:0,tin:0,other:0};$('sealedPacks').value=map[$('sealedType').value]??0;render()}
 function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
 function referenceSet(){let id=$('sealedSet').value;return setCatalog.find(s=>s.id===id)}
 function ebayUrl(){let s=referenceSet();let phrase=(s?s.name+' ':'')+$('sealedEdition').value+' '+TYPES[$('sealedType').value]+' Pokemon sealed '+$('sealedLanguage').value;return 'https://www.ebay.ca/sch/i.html?_nkw='+encodeURIComponent(phrase)+'&LH_Sold=1&LH_Complete=1'}
 function dateToday(){return new Date().toISOString().slice(0,10)}
 function render(){
  let i=identity(), valid=!!(i.setId&&i.edition&&Number.isInteger(i.packs)&&i.packs>=0);
  const list=observations.filter(o=>valid&&key(o)===key(i)).sort((a,b)=>b.date.localeCompare(a.date));
  const data=benchmark(observations,i), market=data.ready?data.median:null;
  $('sealedCompCount').textContent=data.count+' matching sold example(s) from the last 180 days';
  $('sealedBenchmark').textContent=data.ready?money(data.median):'Not established';
  $('sealedRange').textContent=data.ready?'Recent observed range: '+money(data.low)+' – '+money(data.high):'Need at least 3 recent, exactly matching CAD sold transactions. Active listings do not count.';
  let p=Number($('sealedPrice').value||0),ship=Number($('sealedShip').value||0),tax=Number($('sealedTax').value||0),fee=Number($('sealedFee').value||0),fulfill=Number($('sealedFulfillment').value||0);
  try{const v=calculate({price:p,shipping:ship,taxRate:tax,market,feeRate:fee,fulfillment:fulfill});$('sealedLanded').textContent=money(v.landed);$('sealedPerPack').textContent=i.packs>0?money(v.landed/i.packs):'N/A';$('sealedMargin').textContent=v.projectedNet===null?'Insufficient sold evidence':money(v.projectedNet)+' estimated net before labour / income tax';$('sealedVerdict').textContent=v.verdict;}catch(e){$('sealedMargin').textContent='Check input amounts';$('sealedVerdict').textContent=e.message}
  $('sealedResearch').href=ebayUrl();
  const tbody=$('sealedObservations');tbody.replaceChildren();
  for(const o of list.slice(0,80)){
   let tr=el('tr');for(const v of [o.kind==='sold'?'SOLD':'Store ask',o.date,o.source,money(o.price),o.kind==='sold'?'Sale':'Asking price'])tr.appendChild(el('td','',v));
   let td=el('td'),b=el('button','btn smallbtn','Delete');b.type='button';b.onclick=()=>{if(!confirm('Delete this price observation?'))return;observations=observations.filter(x=>x.id!==o.id);persist();render()};td.appendChild(b);tr.appendChild(td);tbody.appendChild(tr);
  }
  $('sealedEmpty').classList.toggle('hidden',list.length>0);
 }
 async function sets(){
  const selector=$('sealedSet');safeText($('sealedCatalogStatus'),'Loading English Pokémon expansion catalog…');
  try{
   const r=await fetch('https://api.tcgdex.net/v2/en/sets',{cache:'force-cache'});if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();if(!Array.isArray(data))throw Error('Unexpected catalog response');
   setCatalog=data.filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string').reverse();
   const previous=selector.value;selector.replaceChildren(new Option('Choose a set…',''));
   for(const s of setCatalog)selector.add(new Option(s.name+' ('+s.id+')',s.id));
   if(previous)selector.value=previous;
   safeText($('sealedCatalogStatus'),setCatalog.length+' sets loaded from TCGdex. Sealed products are separate SKUs; confirm the exact box/edition.');render();
  }catch(err){safeText($('sealedCatalogStatus'),'Catalog offline. Enter a set ID manually below (from TCGdex or your product packaging).');$('sealedManualSet').classList.remove('hidden')}
 }
 function formSubmit(e){e.preventDefault();try{
  let i=identity();if(!i.setId&&$('sealedManualSet').value.trim())i.setId=$('sealedManualSet').value.trim();
  let o={...i,kind:$('sealedKind').value,price:Number($('sealedObsPrice').value),currency:'CAD',date:$('sealedObsDate').value,source:$('sealedSource').value.trim(),url:$('sealedUrl').value.trim()};validate(o);
  if(o.kind==='sold'&&!$('sealedConfirmed').checked)throw Error('Confirm this is a completed sale, not an asking price.');
  o.id=globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random();observations.push(o);persist();$('sealedMsg').textContent='Price evidence saved locally. Export a backup after your session.';$('sealedObsPrice').value='';$('sealedConfirmed').checked=false;render();
 }catch(err){$('sealedMsg').textContent=err.message}}
 function init(){if(!$('sealed'))return;load();$('sealedObsDate').value=dateToday();$('sealedSet').addEventListener('change',render);$('sealedManualSet').addEventListener('input',render);$('sealedType').addEventListener('change',defaultPacks);
  for(const id of ['sealedEdition','sealedLanguage','sealedPacks','sealedPrice','sealedShip','sealedTax','sealedFee','sealedFulfillment'])$(id).addEventListener('input',render);
  $('sealedForm').addEventListener('submit',formSubmit);$('sealedRefresh').onclick=sets;
  document.querySelector('[data-tab="sealed"]').addEventListener('click',()=>{if(!setCatalog.length)sets()});
  window.PokeFlipSealed.getObservations=()=>JSON.parse(JSON.stringify(observations));
  window.PokeFlipSealed.setObservations=arr=>{validateBackup(arr);observations=JSON.parse(JSON.stringify(arr));persist();render()};
  render();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
