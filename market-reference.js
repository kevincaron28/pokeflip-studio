/* Market value for the scanned card, from the catalog's TCGplayer and Cardmarket prices (USD / EUR, converted to CAD at the
   Bank of Canada rate stored with the price snapshot).
   Rules (accuracy audit, 24 Nov 2026):
   - Only sold-based figures make a value: the TCGplayer market price (recent sold average) and the Cardmarket trend.
     A listing price (the TCGplayer mid price) is shown as listed now, never used as the value. On vintage cards the audit found
     the old fallback to the listing mid made the value +100% to +289% wrong.
   - The edition is its own choice. A 1st Edition card never gets the Unlimited price (that was -61% to -79% wrong), and when a
     card exists in both editions and none is chosen, the screen asks for it.
   - Cardmarket pools every edition and language of a vintage card in one product, so it is left out for 1st Edition and
     Shadowless, and dropped when it is more than 3x away from TCGplayer (a different product).
   - Two sources that agree within 25% give High confidence, within 40% Medium, further apart Low. One source is Medium
     (Low when it is stale). The value is for Near Mint; other conditions use a stated share, shown as an estimate.
   - Graded copies: the typical asking price of matching ebay.ca listings for that grade (see ebay-watch.js), Low or Medium. */
(function(root){'use strict';
 const LOC=()=>globalThis.CardsteadI18n?.lang?.()==='fr'?'fr-CA':'en-CA';
const positive=v=>Number.isFinite(v)&&v>0&&v<10000000?v:null;
function dateInfo(value,now=Date.now()){
 let time=typeof value==='number'?(value>100000000000?value:value*1000):Date.parse(value||'');
 if(!Number.isFinite(time)||time<=0||time>now+86400000)return {date:'Unknown',days:null};
 return {date:new Date(time).toISOString().slice(0,10),days:Math.max(0,Math.floor((now-time)/86400000))};
}
const EDITIONS=['','unlimited','1st','shadowless'];
/** TCGplayer price keys for a finish and edition, best first. Edition '' means not chosen. */
function matchingKeys(finish,edition=''){
 if(edition==='1st'){if(finish==='Normal')return ['1st-edition-normal','1st-edition'];if(finish==='Holo')return ['1st-edition-holofoil','1st-edition-holo'];return []}
 if(edition==='shadowless'){if(finish==='Holo')return ['shadowless-holofoil'];if(finish==='Normal')return ['shadowless-normal','shadowless'];return []}
 if(finish==='Normal')return ['normal','unlimited','unlimited-normal'];
 if(finish==='Holo')return ['holofoil','holo','unlimited-holofoil'];
 if(finish==='Reverse Holo')return ['reverse-holofoil','reverse'];
 return [];
}
/** Does this card's price list show a 1st Edition printing? Then the edition must be chosen before a value is shown. */
function hasFirstEdition(pricing){const tg=pricing?.tcgplayer;return !!tg&&typeof tg==='object'&&Object.keys(tg).some(k=>/^1st-edition/.test(k))}
function getQuotes(pricing,finish,now=Date.now(),edition=''){
 const quotes=[],tg=pricing?.tcgplayer,cm=pricing?.cardmarket;
 if(tg&&typeof tg==='object'&&(!tg.unit||tg.unit==='USD')){
  for(const key of matchingKeys(finish,edition)){
   const o=tg[key];if(!o||typeof o!=='object')continue;
   const info=dateInfo(tg.updated,now),price=positive(o.marketPrice);
   if(price!==null)quotes.push({provider:'TCGplayer',variant:key,price,unit:'USD',date:info.date,ageDays:info.days,stale:info.days===null||info.days>14,sold:true});
   else{const mid=positive(o.midPrice);if(mid!==null)quotes.push({provider:'TCGplayer listings',variant:key,price:mid,unit:'USD',date:info.date,ageDays:info.days,stale:info.days===null||info.days>14,asking:true})}
   break;
  }
 }
 // Cardmarket: the main price of a product is the base print of the card; its -holo figures are the reverse holo.
 if(cm&&typeof cm==='object'&&(!cm.unit||cm.unit==='EUR')&&edition!=='1st'&&edition!=='shadowless'){
  const rev=finish==='Reverse Holo';
  if(finish==='Holo'||finish==='Normal'||rev){
   const price=positive(rev?(cm['trend-holo']||cm['avg30-holo']):(cm.trend||cm.avg30));
   if(price!==null){const info=dateInfo(cm.updated,now);quotes.push({provider:'Cardmarket',variant:rev?'reverse holo':finish.toLowerCase(),price,unit:'EUR',date:info.date,ageDays:info.days,stale:info.days===null||info.days>30,sold:true})}
  }
 }
 return quotes;
}
/** CAD equivalent of a USD or EUR quote at the Bank of Canada rate stored with the price snapshot. Pure. */
function toCad(q,fx){const r=q.unit==='USD'?fx?.usdToCad:q.unit==='EUR'?fx?.eurToCad:q.unit==='CAD'?1:null;return Number.isFinite(r)&&r>0?{cad:Math.round(q.price*r*100)/100,rate:r,date:q.unit==='EUR'?fx.eurDate:fx.date}:null}
/** Share of the Near Mint value for a condition. Starting estimates, shown as estimates. */
const CONDITION_SHARE={'Near Mint':1,'Lightly Played':0.8,'Moderately Played':0.65,'Heavily Played':0.45,'Damaged':0.3};
/** One value in CAD from the sold-based quotes, with a range and a confidence level. Null when there is nothing sold-based.
 *  Two sources within 25%: their average. Further apart: the TCGplayer (North American) figure, with the range shown.
 *  Cardmarket alone is not a value: on vintage cards its product often pools editions or is another card (Rayquaza Gold Star
 *  showed EUR 100 for a ~CA$19,000 card); it is shown as unconfirmed instead. */
function estimate(quotes,fx,condition='Near Mint'){
 let xs=quotes.filter(q=>q.sold).map(q=>({...q,cad:toCad(q,fx)?.cad})).filter(q=>Number.isFinite(q.cad));
 const tcg=xs.find(q=>q.provider==='TCGplayer'),cm=xs.find(q=>q.provider==='Cardmarket');
 let dropped=null;
 if(tcg&&cm&&(cm.cad>tcg.cad*3||cm.cad<tcg.cad/3)){dropped=cm;xs=xs.filter(q=>q!==cm)}
 if(!xs.length)return null;
 if(xs.length===1&&xs[0].provider==='Cardmarket')return {cad:null,unconfirmed:xs[0].cad,confidence:'low',sources:1,condition,dropped};
 const vals=xs.map(q=>q.cad).sort((a,b)=>a-b),lo=vals[0],hi=vals[vals.length-1];
 const nm=vals.length===1?lo:(hi-lo)/lo<=0.25?(lo+hi)/2:(xs.find(q=>q.provider==='TCGplayer')||xs[0]).cad;
 let confidence;
 if(vals.length>=2){const d=(hi-lo)/lo;confidence=d<=0.25?'high':d<=0.40?'medium':'low'}
 else confidence=xs[0].stale||xs[0].provider!=='TCGplayer'?'low':'medium';
 const share=CONDITION_SHARE[condition]??1;
 return {cad:Math.round(nm*share*100)/100,nearMint:Math.round(nm*100)/100,low:Math.round(lo*share*100)/100,high:Math.round(hi*share*100)/100,
  confidence,sources:xs.length,condition,share,estimate:share!==1,dropped};
}
const core={positive,dateInfo,matchingKeys,hasFirstEdition,getQuotes,toCad,estimate,CONDITION_SHARE,EDITIONS};
root.PokeFlipMarketReferences=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root?.document)return;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(v,c='CAD')=>new Intl.NumberFormat(LOC(),{style:'currency',currency:c}).format(v);
const PILL={high:['green','High confidence'],medium:['gold','Medium confidence'],low:['red','Low confidence']};
const pill=c=>PILL[c]?`<span class="pill ${PILL[c][0]}" title="How far the price sources agree">${PILL[c][1]}</span>`:'';
let gradedSeq=0;
/** Typical asking price of matching ebay.ca listings through Cardstead's eBay search: the value of a graded copy, or a second
 *  opinion on a raw card that has a single sold source (Near Mint or unstated listings only). */
async function gradedValue(card,grade,box,fx,check=null){
 const W=root.CardsteadEbayWatch,seq=++gradedSeq;
 if(!W?.listingValue||!card?.name){if(!check)box.insertAdjacentHTML('beforeend','<p class="note">Graded value needs the eBay search, which is not available here.</p>');return}
 const num=String(card.localId||card.number||'').trim(),total=card.set?.cardCount?.official;
 const c={id:'scan',name:card.name,number:num&&total?num+'/'+total:num,set:card.set?.name||'',grade,exclude:[]};
 const raw=grade==='raw',q=[card.name,c.number,card.set?.name,raw?'':grade].filter(Boolean).join(' ').slice(0,120);
 const slot=root.document.createElement('div');slot.className='note';slot.textContent=raw?'Checking eBay.ca for a second opinion…':`Looking for ${grade} copies on eBay.ca…`;box.appendChild(slot);
 try{const base=(root.PokeFlipNative&&root.PokeFlipNative.isNative?'https://pokeflip-studio.vercel.app':'')+'/api/ebay-search';
  const r=await fetch(base+'?q='+encodeURIComponent(q),{cache:'no-store'});const j=await r.json();if(seq!==gradedSeq)return;
  if(!r.ok)throw Error(j.error||('eBay search '+r.status));
  const v=W.listingValue(j.items||[],c,fx?.usdToCad,{nmOnly:raw});
  if(raw){const ag=v&&check?W.agreement(check,v.cad):null;
   slot.innerHTML=v?`<div class="row spread" style="padding:9px 0"><span><strong>Second opinion: eBay.ca</strong> ${pill(ag)}<span class="small muted" style="display:block">Typical asking price ${esc(v.source)}, Near Mint or condition not stated. ${ag==='high'?'Agrees with the sold value.':ag==='medium'?'Somewhat close to the sold value.':'Far from the sold value: check the edition and condition.'}</span></span><strong>${money(v.cad)}</strong></div>`:'<p class="note">No second opinion: fewer than 3 matching listings on eBay.ca.</p>';return}
  slot.innerHTML=v?`<div class="row spread" style="padding:9px 0"><span><strong>${esc(grade)}</strong> ${pill(v.confidence)}<span class="small muted" style="display:block">Typical asking price ${esc(v.source)} · ${esc(new Date().toISOString().slice(0,10))}. Sales usually close lower.</span></span><strong>${money(v.cad)}</strong></div>`:
   `<p class="note">Fewer than 3 matching ${esc(grade)} listings on eBay.ca right now: value unknown.</p>`;
 }catch(e){if(seq===gradedSeq)slot.textContent='eBay.ca could not be searched: '+e.message}
}
core.render=(pricing,finish,lang,opts={})=>{
 const fx=root.CardsteadPackData?.fx;
 // The Bank of Canada rates come with the price snapshot; load it once, then draw again.
 if(!fx&&root.CardsteadPackEv?.loadData&&!core._waiting){core._waiting=true;root.CardsteadPackEv.loadData().then(()=>{core._waiting=false;core.render(pricing,finish,lang,opts)}).catch(()=>{core._waiting=false})}
 const box=root.document.getElementById('scanMarketQuotes');if(!box)return;
 const $v=id=>root.document.getElementById(id)?.value;
 const edition=opts.edition??$v('scanEdition')??'',condition=opts.condition??$v('scanCondition')??'Near Mint',grade=opts.grade??$v('scanGrade')??'raw';
 if(grade&&grade!=='raw'){box.innerHTML='';gradedValue(opts.card||root.pokeflipSelectedCard,grade,box,fx);return}
 if(!edition&&hasFirstEdition(pricing)&&(finish==='Holo'||finish==='Normal')){
  box.innerHTML='<p class="note"><strong>Choose the edition.</strong> This card was printed in 1st Edition and Unlimited, and their prices are far apart. Look for the black "Edition 1" stamp on the left under the picture.</p>';return}
 const quotes=getQuotes(pricing,finish,Date.now(),edition),est=estimate(quotes,fx,condition);
 const scope=lang==='fr'?'French cards are priced from the English card: French sales are not tracked.':'Prices are US and European sales converted to CAD.';
 const head=est&&est.cad!==null?`<div style="padding:4px 0 10px"><div class="small muted">Cardstead value${est.estimate?` for ${esc(condition)} (estimate: ${Math.round(est.share*100)}% of Near Mint)`:''}</div><div class="row" style="gap:8px;align-items:baseline"><strong style="font-size:22px">${money(est.cad)}</strong>${pill(est.confidence)}</div>${est.sources>1?`<div class="small muted">Range ${money(est.low)} to ${money(est.high)} · ${est.sources} sources</div>`:'<div class="small muted">One source only</div>'}${est.dropped?`<div class="small muted">Cardmarket (${money(est.dropped.cad)}) left out: more than 3× away, probably a different product.</div>`:''}</div>`
  :'<p class="note"><strong>No recent sale found</strong> for this card, finish and edition. Do not infer a price from listings.</p>';
 const headU=est&&est.cad===null?`<p class="note"><strong>Not confirmed.</strong> Only one European price (${money(est.unconfirmed)}) and no North American sale. Cardmarket often groups editions or lists another card under old cards.</p>`:null;
 const rows=quotes.map(q=>{const c=toCad(q,fx);return `<div class="row spread" style="border-bottom:1px solid #29384e;padding:9px 0"><span><strong>${esc(q.provider)}</strong> <span class="pill">${esc(q.variant)}</span><span class="small muted"> · ${q.asking?'listed now, not a sale':'sold average'} · ${esc(q.date)}${q.stale?' · Stale or undated':''}</span></span><span style="text-align:right"><strong>${money(q.price,q.unit)}</strong>${c&&q.unit!=='CAD'?`<span class="small muted" style="display:block">≈ ${money(c.cad)} CAD · Bank of Canada ${esc(c.date)}</span>`:''}</span></div>`}).join('');
 box.innerHTML=(headU||head)+rows;
 const warning=root.document.createElement('p');warning.className='note';warning.textContent=scope+' Market context, not a guaranteed resale price.';box.appendChild(warning);
 if(est&&(est.cad===null||est.sources<2))gradedValue(opts.card||root.pokeflipSelectedCard,'raw',box,fx,est.nearMint??null);
};
})(typeof window!=='undefined'?window:globalThis);
