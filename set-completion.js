/* Cardstead set completion: tick the cards you own, set by set, and see what completing the set costs.
 * Pattern (research, 26 Nov 2026: Dex, Pokellector, Eyevo, PokéCardex, Rare Candy, TCG Collector, Collectr, Cardmarket):
 *  - One tap on a card ticks one copy of its usual printing; long-press (or ⋯) sets quantities per printing
 *    (Normal, Holofoil, Reverse Holofoil, 1st Edition...). No separate "variant view".
 *  - Two modes, switched without changing what you own:
 *      Set    = one of each card up to the printed total (any printing counts); secret rares (numbers above the printed
 *               total) are a separate "+N secret" line, never inflating the total;
 *      Master = every printing of every card, secret rares included.
 *  - Three money figures in CA$: owned value, missing value, cost to complete (= the missing cards at their price).
 *  - Prices per printing: TCGplayer market price (recent sales, medium confidence: one sold source), else TCGplayer listing
 *    mid price (low confidence), else eBay.ca asking (ebay-live.js, on demand), else "no price yet".
 *  - Stored on this device first (works offline), in the JSON backup and in the cloud snapshot (revision-checked, RLS).
 * Data: data/sets/<groupId>.json cards [productId, name, number, rarity, {printing: marketUsd}, {printing: listingMidUsd}?]. */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const KEY='cardstead-set-completion-v1',MAX_QTY=999;
const PREFER=['Normal','Holofoil','Unlimited Holofoil','Unlimited','1st Edition Holofoil','1st Edition Normal','1st Edition','Reverse Holofoil'];

/** Printed total from a card number ("138/103" -> 103; "SWSH045" -> null). Pure. */
function printedTotal(number){const m=String(number||'').match(/^\s*[A-Z]*0*(\d+)[a-z]?\s*\/\s*[A-Z]*0*(\d+)\s*$/i);return m?{n:Number(m[1]),total:Number(m[2])}:null}
/** A secret rare: numbered above the printed total. Pure. */
function isSecret(number){const p=printedTotal(number);return !!(p&&p.n>p.total)}
/** Printings a card exists in (from its prices); a card with no price data counts as one printing. Pure. */
function printings(card){const ks=[...new Set([...Object.keys(card[4]||{}),...Object.keys(card[5]||{})])];return ks.length?ks.sort((a,b)=>rank(a)-rank(b)):['Normal']}
function rank(p){const i=PREFER.indexOf(p);return i<0?50:i}
/** The printing a single tap ticks: the usual one (Normal, else Holofoil...). Pure. */
function defaultPrinting(card){return printings(card)[0]}
/** Price of one printing: {usd, kind:'sold'|'listing', confidence} or null. Pure. */
function priceOf(card,printing){const s=card[4]?.[printing];if(isNum(s))return {usd:s,kind:'sold',confidence:'medium'};const l=card[5]?.[printing];if(isNum(l))return {usd:l,kind:'listing',confidence:'low'};return null}
/** The cheapest known printing of a card (what "one of each" costs). Pure. */
function cheapest(card){let best=null;for(const p of printings(card)){const v=priceOf(card,p);if(v&&(!best||v.usd<best.usd))best={...v,printing:p}}return best}
/** Quantities owned for a card in a set state: {printing: qty}. Pure. */
function ownedOf(state,groupId,productId){return state?.sets?.[groupId]?.[productId]||{}}
const has=o=>Object.values(o||{}).some(q=>q>0);

/** Progress and money for one set. mode 'set' | 'master'. fx: USD->CAD. Pure. */
function summary(cards,state,groupId,mode='set',fx=null){
 const cad=u=>isNum(u)&&isNum(fx)?u*fx:null;
 const out={mode,owned:0,total:0,secretOwned:0,secretTotal:0,ownedValue:0,missingValue:0,missingUnpriced:0,ownedUnpriced:0,missing:[]};
 for(const c of cards||[]){
  const own=ownedOf(state,groupId,c[0]),secret=isSecret(c[2]);
  // Owned value: every copy at its own printing's price, whatever the mode.
  for(const [p,q] of Object.entries(own)){if(!(q>0))continue;const v=priceOf(c,p)||cheapest(c);if(v&&isNum(cad(v.usd)))out.ownedValue+=q*cad(v.usd);else out.ownedUnpriced+=q}
  if(mode==='master'){
   for(const p of printings(c)){out.total++;if(own[p]>0){out.owned++;continue}const v=priceOf(c,p);out.missing.push({card:c,printing:p,price:v});if(v&&isNum(cad(v.usd)))out.missingValue+=cad(v.usd);else out.missingUnpriced++}
  }else if(secret){out.secretTotal++;if(has(own))out.secretOwned++}
  else{out.total++;if(has(own)){out.owned++;continue}const v=cheapest(c);out.missing.push({card:c,printing:v?v.printing:defaultPrinting(c),price:v});if(v&&isNum(cad(v.usd)))out.missingValue+=cad(v.usd);else out.missingUnpriced++}
 }
 out.pct=out.total?Math.round(out.owned/out.total*1000)/10:0;
 out.ownedValue=Math.round(out.ownedValue*100)/100;out.missingValue=Math.round(out.missingValue*100)/100;out.costToComplete=out.missingValue;
 return out;
}
/** New state with one printing's quantity set (0 removes it). Never mutates. Pure. */
function setQty(state,groupId,productId,printing,qty){
 const q=Math.max(0,Math.min(MAX_QTY,Math.floor(Number(qty)||0)));
 const s={v:1,sets:{...(state?.sets||{})}};const g={...(s.sets[groupId]||{})},c={...(g[productId]||{})};
 if(q>0)c[printing]=q;else delete c[printing];
 if(Object.keys(c).length)g[productId]=c;else delete g[productId];
 if(Object.keys(g).length)s.sets[groupId]=g;else delete s.sets[groupId];
 return s;
}
/** One tap: tick the usual printing when nothing is owned, otherwise clear the card. Pure. */
function toggle(state,groupId,card){const own=ownedOf(state,groupId,card[0]);if(has(own)){let s=state;for(const p of Object.keys(own))s=setQty(s,groupId,card[0],p,0);return s}return setQty(state,groupId,card[0],defaultPrinting(card),1)}
/** Sets with at least one owned card: {groupId: count of cards owned}. Pure. */
function ownedCounts(state){const out={};for(const [g,cards] of Object.entries(state?.sets||{}))out[g]=Object.values(cards).filter(has).length;return out}
/** Validate a stored, restored or synced state (throws on anything unexpected). Pure. */
function validate(s){
 if(s==null)return true;
 if(typeof s!=='object'||s.v!==1||typeof s.sets!=='object'||Array.isArray(s.sets))throw Error('Invalid set completion data');
 let n=0;for(const [g,cards] of Object.entries(s.sets)){if(!/^\d{1,9}$/.test(g)||typeof cards!=='object'||Array.isArray(cards))throw Error('Invalid set in set completion');
  for(const [id,pr] of Object.entries(cards)){if(!/^\d{1,12}$/.test(id)||typeof pr!=='object'||Array.isArray(pr))throw Error('Invalid card in set completion');
   for(const [p,q] of Object.entries(pr)){if(typeof p!=='string'||p.length>60||!Number.isInteger(q)||q<1||q>MAX_QTY)throw Error('Invalid quantity in set completion');if(++n>200000)throw Error('Set completion too large')}}}
 return true;
}
/** Sort the visible cards: by number, price (high first), or missing priciest first. Pure. */
function sortCards(cards,how,state,groupId){
 const num=c=>{const p=printedTotal(c[2]);return p?p.n:Number.MAX_SAFE_INTEGER};const top=c=>{const v=cheapest(c);return v?v.usd:-1};
 const list=[...cards];
 if(how==='price')list.sort((a,b)=>top(b)-top(a));
 else if(how==='missing-price')list.sort((a,b)=>(has(ownedOf(state,groupId,a[0]))-has(ownedOf(state,groupId,b[0])))||top(b)-top(a));
 else list.sort((a,b)=>num(a)-num(b)||String(a[2]).localeCompare(String(b[2]),'en',{numeric:true}));
 return list;
}
const core={KEY,printedTotal,isSecret,printings,defaultPrinting,priceOf,cheapest,ownedOf,summary,setQty,toggle,ownedCounts,validate,sortCards,has};
root.CardsteadSetCompletion=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
if(!root.document)return;

// Device storage, undo, and the cloud: a change is saved here first, then the usual cloud backup picks it up.
let state=null,undo=[];
function read(){if(state)return state;try{const s=JSON.parse(root.localStorage.getItem(KEY)||'null');validate(s);state=s||{v:1,sets:{}}}catch{state={v:1,sets:{}}}return state}
let saveTimer=null;
function write(next,{remember=true}={}){validate(next);if(remember){undo.push(read());if(undo.length>30)undo.shift()}state=next;
 try{root.localStorage.setItem(KEY,JSON.stringify(next))}catch{}
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>root.dispatchEvent(new Event('pokeflip:saved')),1500);}
Object.assign(core,{
 get:()=>JSON.parse(JSON.stringify(read())),
 apply:next=>write(next),
 canUndo:()=>undo.length>0,
 undo:()=>{const prev=undo.pop();if(prev)write(prev,{remember:false});return !!prev},
 // Restore from a backup or the cloud (replaces this device's ticks; validated first). null keeps this device's ticks.
 setData:data=>{if(data==null)return;validate(data);state=data;undo=[];try{root.localStorage.setItem(KEY,JSON.stringify(data))}catch{}}
});
})(typeof window!=='undefined'?window:globalThis);
