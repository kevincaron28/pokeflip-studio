'use strict';
/* Sold-comparable research ledger. No unauthorized scraping, no fictitious live feed. */
(function(root){
 const KEY='pokeflip-ebay-comps-v1';
 const norm=v=>String(v||'').trim().toLowerCase();
 const fmt=n=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'}).format(n);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function validUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'&&(/(^|\.)ebay\.(ca|com|co\.uk|fr|de|com\.au)$/.test(u.hostname));}catch{return false}}
 function validate(c){
  if(!c||typeof c!=='object'||typeof c.itemId!=='string'||!c.itemId||typeof c.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||!Number.isFinite(Date.parse(c.date+'T00:00:00Z'))||new Date(c.date+'T00:00:00Z').toISOString().slice(0,10)!==c.date)throw Error('Invalid comparable date or item');
  if(!Number.isFinite(c.price)||c.price<=0||c.price>1e7||!Number.isFinite(c.shipping)||c.shipping<0||c.shipping>1e7||!['CAD','USD'].includes(c.currency)||!['en','fr'].includes(c.lang)||!['Normal','Holo','Reverse Holo','Other','Other / special'].includes(c.finish)||!['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'].includes(c.condition))throw Error('Invalid comparable fields');
  if(c.url&&!validUrl(c.url))throw Error('Sold listing URL must be an HTTPS eBay URL');
  if(!['sold','product-research'].includes(c.provenance))throw Error('Choose how sale was verified');
  return c;
 }
 function median(arr){if(!arr.length)return null;const s=[...arr].sort((a,b)=>a-b),h=Math.floor(s.length/2);return s.length%2?s[h]:(s[h-1]+s[h])/2}
 function summarize(comps,item,opts={}){
  const now=opts.now?new Date(opts.now):new Date(),maxDays=opts.maxDays??90;
  const matching=comps.filter(c=>c.itemId===item.id&&norm(c.lang)===norm(item.lang)&&norm(c.finish)===norm(item.finish)&&norm(c.condition)===norm(item.condition)&&c.currency==='CAD'&&c.date<=now.toISOString().slice(0,10)&&now-new Date(c.date+'T00:00:00Z')<=maxDays*86400000);
  const values=matching.map(c=>c.price+c.shipping);const value=median(values),itemOnlyMedian=median(matching.map(c=>c.price)),range=values.length?[Math.min(...values),Math.max(...values)]:null;
  // Never infer a valid cash market price from 0-2 comps; show observations only.
  return {count:matching.length,median:value,itemOnlyMedian,range,eligible:matching.length>=3,source:'eBay verified sold comps (manual observations)',maxDays,exactMatch:'card record + language + condition + finish; verify set/printing before using'};
 }
 function searchUrl(item){const terms=[item.name,item.idCode, item.lang==='fr'?'French':'English',item.finish==='Reverse Holo'?'reverse holo':item.finish==='Holo'?'holo':'', 'pokemon'].filter(Boolean).join(' ');return 'https://www.ebay.ca/sch/i.html?'+new URLSearchParams({'_nkw':terms,'LH_Sold':'1','LH_Complete':'1'}).toString()}
 function fees({sale,shippingCharged=0,tax=0,rate=13.25,perOrder=null,packaging=0,postage=0,adRate=0,international=0}){
  const gross=Number(sale)+Number(shippingCharged),base=gross+Number(tax);
  if([sale,shippingCharged,tax,rate,packaging,postage,adRate,international].some(x=>!Number.isFinite(Number(x))||Number(x)<0)||rate>100||adRate>100||international>100)throw Error('Invalid fee inputs');
  // eBay charges a per-order fixed fee; threshold depends on the order's total (incl. relevant taxes and postage).
  const orderFee=perOrder===null?(base<=10?0.30:0.40):Number(perOrder);
  const finalValue=base*rate/100+orderFee,ads=base*adRate/100,extra=base*international/100;
  return {fee:finalValue+ads+extra,net:gross-finalValue-ads-extra-Number(packaging)-Number(postage),finalValue,orderFee,ads,extra};
 }
 const core={validate,median,summarize,searchUrl,fees};
 if(typeof module!=='undefined'&&module.exports)module.exports=core;
 if(!root||!root.document)return;
 const $=id=>document.getElementById(id);
 function read(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(x=>{try{validate(x);return true}catch{return false}}).slice(-10000):[]}catch{return []}}
 let comps=read();let active=null;
 function records(){return root.pokeflipLedger?.getData?.()||{items:[]}}
 function refreshItems(){const prev=$('compItem').value;const items=records().items;$('compItem').innerHTML='<option value="">Choose a card</option>'+items.filter(i=>i.idCode).map(i=>`<option value="${esc(i.id)}">${esc(i.name)} · ${esc(i.idCode)} · ${esc(i.lang.toUpperCase())} · ${esc(i.finish)} · ${esc(i.condition)}</option>`).join('');if(items.some(i=>i.id===prev))$('compItem').value=prev;else if(active&&items.some(i=>i.id===active))$('compItem').value=active;}
 function show(){refreshItems();const item=records().items.find(i=>i.id===$('compItem').value);active=item?.id||null;
  const box=$('ebayCompResults');if(!item){box.innerHTML='<p class="note">Select an identified card from your inventory. Bulk entries need a verified card identity first.</p>';return}
  $('compLang').value=item.lang;$('compCondition').value=['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'].includes(item.condition)?item.condition:'Near Mint';$('compFinish').value=['Normal','Holo','Reverse Holo','Other','Other / special'].includes(item.finish)?item.finish:'Other / special';
  const m=summarize(comps,item);const mine=comps.filter(c=>c.itemId===item.id).sort((a,b)=>b.date.localeCompare(a.date));
  box.innerHTML=`<div class="row spread"><a class="btn" href="${esc(searchUrl(item))}" target="_blank" rel="noopener noreferrer">Search eBay sold listings</a><a class="btn" href="https://www.ebay.ca/help/selling/selling-tools/terapeak?id=4853" target="_blank" rel="noopener noreferrer">eBay Product Research</a></div><div class="grid2" style="margin-top:14px"><div class="metric"><label>Exact-match sold comps (last 90 days)</label><strong>${m.count}</strong></div><div class="metric"><label>Observed median, buyer total (CAD)</label><strong>${m.median==null?'—':fmt(m.median)}</strong></div></div><p class="note">${m.eligible?`<div class="row"><button class="btn primary" id="applyEbayPrice">Use ${fmt(m.itemOnlyMedian)} CAD item-only median as inventory estimate</button></div>`:''}${m.eligible?'Three or more matching recent observations. Still check set and special variants before using this estimate.':'Not enough closely matching recent sold comparisons to suggest a valuation (minimum 3).'} Buyer total includes shipping charged by seller, not taxes; exclude shipping before setting an item-only listing price. No automatic market feed.</p>${mine.length?`<div class="scroll"><table><thead><tr><th>Sold</th><th>Lang / finish / condition</th><th>Buyer paid</th><th>Evidence</th><th></th></tr></thead><tbody>${mine.map(c=>`<tr><td>${esc(c.date)}</td><td>${esc(c.lang)} · ${esc(c.finish)} · ${esc(c.condition)}</td><td>${fmt(c.price+c.shipping)} ${esc(c.currency)}</td><td>${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Listing</a>`:esc(c.provenance)}</td><td><button type="button" class="btn smallbtn danger" data-deletecomp="${esc(c.id)}">Remove</button></td></tr>`).join('')}</tbody></table></div>`:''}`;
 }
 function push(c){validate(c);comps.push(c);if(comps.length>10000)comps=comps.slice(-10000);localStorage.setItem(KEY,JSON.stringify(comps));show();}
 $('compItem').addEventListener('change',show);
 $('compForm').addEventListener('submit',e=>{e.preventDefault();const item=records().items.find(i=>i.id===$('compItem').value);if(!item)return alert('Select a specific card first');const c={id:crypto.randomUUID?.()||String(Date.now()),itemId:item.id,date:$('compDate').value,price:Number($('compPrice').value),shipping:Number($('compShipping').value||0),currency:$('compCurrency').value,lang:$('compLang').value,condition:$('compCondition').value,finish:$('compFinish').value,provenance:$('compProof').value,url:$('compUrl').value.trim()};try{push(c);$('compPrice').value='';$('compUrl').value='';$('compShipping').value='0';}catch(err){alert(err.message)}});
 $('ebayCompResults').addEventListener('click',e=>{if(e.target.closest('#applyEbayPrice')){const item=records().items.find(i=>i.id===$('compItem').value);if(!item)return;const m=summarize(comps,item);if(!m.eligible)return alert('At least 3 recent exact-match CAD sold comps required');if(confirm('Update this card’s estimated item price to '+fmt(m.itemOnlyMedian)+'? Shipping excluded. This is a manual sold-comparable estimate, not a guaranteed sale price.')){root.pokeflipLedger.updatePricing(item.id,m.itemOnlyMedian,'eBay sold comps ('+m.count+' verified, CAD, 90d)',new Date().toLocaleDateString('en-CA'));show();}return;}const btn=e.target.closest('[data-deletecomp]');if(!btn||!confirm('Remove this comparison observation?'))return;comps=comps.filter(c=>c.id!==btn.dataset.deletecomp);localStorage.setItem(KEY,JSON.stringify(comps));show()});
 $('feeForm').addEventListener('input',()=>{try{const result=fees({sale:Number($('feePrice').value),shippingCharged:Number($('feeShipBuyer').value||0),tax:Number($('feeTax').value||0),rate:Number($('feeRate').value),packaging:Number($('feePacking').value||0),postage:Number($('feePostage').value||0),adRate:Number($('feeAds').value||0)});$('feeResult').textContent=`Estimated eBay fees ${fmt(result.fee)} · seller cash after fees, postage and packaging ${fmt(result.net)} (before card purchase cost, returns and income tax).`; }catch(err){$('feeResult').textContent=err.message}});
 $('feeForm').dispatchEvent(new Event('input'));
 $('compDate').value=new Date().toLocaleDateString('en-CA');
 root.addEventListener('pokeflip:saved',show);show();
 root.pokeflipEbay={...core,getComps:()=>comps.map(c=>({...c})),setComps:list=>{if(!Array.isArray(list)||list.length>10000)throw Error('Invalid eBay observations');list.forEach(validate);comps=list.map(c=>({...c}));localStorage.setItem(KEY,JSON.stringify(comps));show()}};
 })(typeof window!=='undefined'?window:undefined);