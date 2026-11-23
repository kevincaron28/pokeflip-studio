/* Cardstead alert value: what is this restock or price drop really worth?
 * For a store price on a sealed product it finds the TCGplayer product in the dated snapshot
 * (pack-ev-data.js), its market value, the cited MSRP (pack-ev-rates.js) and, for packs and boxes,
 * the expected value of the booster packs inside (pack-ev.js). Nothing is guessed: a product that
 * cannot be matched, an unknown pack count or an unpublished MSRP is shown as "unknown".
 */
(function(root){'use strict';
const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
// Booster packs inside each product kind (Bulbapedia, "Booster pack (TCG)", Products with Booster Packs).
// Elite Trainer Boxes, tins and collections vary by release, so their count stays unknown.
const PACKS={pack:1,sleeved:1,blister1:1,blister3:3,bundle:6,box:36,bnb:4,'bnb-stadium':11};
const PACKS_SOURCE={title:'Bulbapedia: Booster pack (TCG), products with booster packs',url:'https://bulbapedia.bulbagarden.net/wiki/Booster_pack_(TCG)'};
const LABEL={pack:'booster pack',sleeved:'sleeved booster',blister1:'1-pack blister','blister-premium':'premium checklane blister',blister3:'3-pack blister',bundle:'booster bundle',box:'booster box',etb:'Elite Trainer Box','etb-pc':'Pokémon Center Elite Trainer Box',bnb:'Build & Battle Box','bnb-stadium':'Build & Battle Stadium',tin:'tin',collection:'collection box',other:'product'};
const FORMAT_HINT={pack:['pack','sleeved','blister1'],box:['box'],etb:['etb'],bundle:['bundle'],tin:['tin'],collection:['collection','etb-pc','bnb','bnb-stadium','blister-premium']};

/** Product kind from free text (English and common French shop wording). */
function kindOf(text){
 const t=norm(text);
 if(/pokemon center/.test(t)&&/(elite trainer|\betb\b|coffret dresseur)/.test(t))return 'etb-pc';
 if(/(elite trainer|\betb\b|coffret dresseur)/.test(t))return 'etb';
 if(/build and battle stadium|stade de combat/.test(t))return 'bnb-stadium';
 if(/build and battle|construis et combats/.test(t))return 'bnb';
 if(/premium checklane/.test(t))return 'blister-premium';
 if(/\b(3|three|tri) ?packs? blister|\b3 pack\b|tripack|3 boosters|blister 3/.test(t))return 'blister3';
 if(/booster bundle|\bbundle\b|lot de 6|paquet de 6/.test(t))return 'bundle';
 if(/booster box|booster display|\bdisplay\b|36 (packs|boosters)|boite de 36|boite de boosters/.test(t))return 'box';
 if(/\btin\b|boite (en )?metal/.test(t))return 'tin';
 if(/sleeved/.test(t))return 'sleeved';
 if(/checklane|single pack blister|blister/.test(t))return 'blister1';
 if(/collection|premium|coffret/.test(t))return 'collection';
 if(/booster pack|\bbooster\b|\bpack\b|paquet/.test(t))return 'pack';
 return null;
}

/** Find the set and the sealed TCGplayer product(s) a shop's product text refers to. */
function match(text,data,format){
 const t=' '+norm(text)+' ';
 let set=null,len=0;
 for(const s of data?.sets||[]){const n=norm(s.name);if(n.length>len&&t.includes(' '+n+' ')){set=s;len=n.length}}
 if(!set)return {status:'no-set',set:null,kind:kindOf(text),candidates:[]};
 let kind=kindOf(text);
 const pool=(set.sealed||[]).map(([id,name,type,market])=>({id,name,type,market}));
 if(!kind&&FORMAT_HINT[format])kind=FORMAT_HINT[format].find(k=>pool.some(p=>p.type===k))||null;
 if(!kind)return {status:'no-kind',set,kind:null,candidates:[]};
 let c=pool.filter(p=>p.type===kind);
 // A named variant ("[Zapdos]") narrows multi-listing products.
 const named=c.filter(p=>{const v=(p.name.match(/\[([^\]]+)\]/)||[])[1];return v&&t.includes(' '+norm(v)+' ')});
 if(named.length)c=named;
 const priced=c.filter(p=>isNum(p.market));
 return {status:c.length?'ok':'no-product',set,kind,candidates:c,priced};
}

function msrpUsd(set,kind,rates){
 const rule=(rates?.msrp?.products||[]).find(r=>r.groupIds.includes(set.groupId));
 const usd=rule?.usd?.[kind];
 return isNum(usd)?{usd,rule}:null;
}

/** Everything an alert card shows. price/prevPrice in CAD. */
function assess({product,price,prevPrice=null,format=null},ctx){
 const data=ctx?.data,rates=ctx?.rates,fx=data?.fx?.usdToCad;
 const out={product,price:isNum(price)?price:null,match:null,market:null,msrp:null,contents:null,verdict:null,drop:null,asOf:data?.prices?.asOf||null};
 if(isNum(prevPrice)&&isNum(price)&&prevPrice>price){const diff=prevPrice-price;out.drop={from:prevPrice,to:price,diff,pct:diff/prevPrice}}
 if(!data){out.verdict={code:'unknown',label:'Value unknown: price snapshot not loaded'};return out}
 const m=match(product,data,format);out.match=m;
 if(m.status==='ok'&&m.priced.length){
  const vals=m.priced.map(p=>p.market*fx);
  out.market={low:Math.min(...vals),high:Math.max(...vals),count:m.priced.length,product:m.priced.length===1?m.priced[0]:null};
 }
 if(m.set&&m.kind){
  const ms=msrpUsd(m.set,m.kind,rates);if(ms)out.msrp={usd:ms.usd,cadAtRate:ms.usd*fx,source:ms.rule};
  const packs=PACKS[m.kind];
  const evRow=ctx.evRows?.find(r=>r.set.groupId===m.set.groupId);
  if(packs&&evRow&&isNum(evRow.evUsd))out.contents={packs,evCad:packs*evRow.evUsd*fx,partial:!evRow.ev.complete};
  else out.contents={packs:packs||null,evCad:null,partial:false,why:packs?'No sourced pull rates for this set':'Pack count varies for this product'};
 }
 out.verdict=verdict(out.price,out.market,out.msrp);
 return out;
}

/** under (green) / fair (yellow) / over (red) / unknown (grey). */
function verdict(price,market,msrp){
 if(!isNum(price))return {code:'unknown',label:'No store price'};
 const scalp=msrp&&price>=msrp.cadAtRate*1.5?` · scalper price (${(price/msrp.cadAtRate).toFixed(1)}× US MSRP)`:'';
 if(market){
  if(price<market.low*0.95){const d=market.low-price;return {code:'under',label:`Under value by ${cad(d)} (${pct(d/market.low)})`}}
  if(price>market.high*1.05){const d=price-market.high;return {code:'over',label:`Over value by ${cad(d)} (${pct(d/market.high)})${scalp}`}}
  return {code:'fair',label:market.count>1&&market.low!==market.high?'Fair: within the market range':'Fair: about market value'};
 }
 if(msrp){
  const r=price/msrp.cadAtRate;
  if(r>=1.5)return {code:'over',label:`Scalper price (${r.toFixed(1)}× US MSRP converted)`};
  if(r>1.15)return {code:'over',label:`Over MSRP by ${pct(r-1)} (US MSRP converted)`};
  if(r>=0.85)return {code:'fair',label:'Around MSRP (US MSRP converted; market value unknown)'};
  return {code:'under',label:`Under MSRP by ${pct(1-r)} (US MSRP converted)`};
 }
 return {code:'unknown',label:'Value unknown: no matched market price or MSRP'};
}

const cadFmt=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD'});
const usdFmt=new Intl.NumberFormat('en-CA',{style:'currency',currency:'USD'});
function cad(v){return isNum(v)?cadFmt.format(v):'unknown'}
function pct(v){return Math.round(v*100)+'%'}
const range=m=>!m?'unknown':m.low===m.high?cad(m.low):`${cad(m.low)}–${cad(m.high)}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:null}catch{return null}};
const day=s=>{const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'unknown date'};
const STATUS={in:['In stock','green'],out:['Sold out','red'],unknown:['Not confirmed','grey']};

/** Plain-text summary for phone and browser notifications. */
function text(a,{store,status}={}){
 const parts=[`${a.product}: ${cad(a.price)}${store?' at '+store:''}${status==='in'?' (in stock)':''}`];
 if(a.drop)parts.push(`down from ${cad(a.drop.from)} (${pct(a.drop.pct)} off)`);
 parts.push(a.verdict.label);
 parts.push('MSRP: '+(a.msrp?usdFmt.format(a.msrp.usd)+' (US MSRP)':'unknown'));
 parts.push('Market: '+range(a.market));
 if(a.contents?.evCad)parts.push('Packs inside worth '+cad(a.contents.evCad)+' on average');
 return parts.join(' · ');
}

/** Card HTML: an embed-style alert. store/status/url/at come from the stock check. */
function cardHtml(a,{store,status='unknown',url=null,buyUrl=null,buyLabel=null,at=null,kind=null}={}){
 const k=kind||(a.drop?'drop':status==='in'?'restock':'check');
 const title={drop:'Price drop',restock:'Restock',check:'Stock check'}[k];
 const [st,dot]=STATUS[status]||STATUS.unknown;
 const p=a.market?.product||(a.match?.candidates?.length===1?a.match.candidates[0]:null);
 const img=p?`<img class="ac-img" loading="lazy" alt="" src="https://tcgplayer-cdn.tcgplayer.com/product/${encodeURIComponent(p.id)}_200w.jpg">`:'';
 const tcg=id=>`https://www.tcgplayer.com/product/${encodeURIComponent(id)}`;
 const matched=a.match?.status==='ok'?(a.match.candidates.length===1?`<a href="${tcg(a.match.candidates[0].id)}" target="_blank" rel="noopener noreferrer">${esc(a.match.candidates[0].name)}</a>`:`${a.match.candidates.length} TCGplayer listings of the ${esc(LABEL[a.match.kind])}`):a.match?.set?`${esc(a.match.set.name)}: no TCGplayer ${esc(LABEL[a.match.kind]||'product')} found`:'no set name recognized';
 const msrp=a.msrp?`CAD unknown · ${usdFmt.format(a.msrp.usd)} <span class="ac-sub">(≈ ${cad(a.msrp.cadAtRate)} at the Bank of Canada rate)</span>`:'unknown';
 const ev=a.contents?(isNum(a.contents.evCad)?`${cad(a.contents.evCad)}${a.contents.partial?' (lower bound)':''} <span class="ac-sub">${a.contents.packs} pack${a.contents.packs>1?'s':''} × pack EV, booster packs only</span>`:`unknown <span class="ac-sub">${esc(a.contents.why||'')}</span>`):'unknown';
 const go=safe(buyUrl||url);
 return `<article class="alert-card ac-${esc(a.verdict.code)}" aria-label="${esc(title+': '+a.product)}">
 <div class="ac-head"><div><p class="ac-kind">${esc(title)}</p><h3 class="ac-title">${esc(a.product)}</h3></div>${img}</div>
 <dl class="ac-grid"><div><dt>Store</dt><dd>${esc(store||'unknown')}</dd></div><div><dt>Price</dt><dd><strong>${cad(a.price)}</strong></dd></div><div><dt>Status</dt><dd><span class="ac-dot ac-dot-${dot}" aria-hidden="true"></span>${esc(st)}</dd></div></dl>
 ${a.drop?`<p class="ac-drop">${cad(a.drop.from)} → ${cad(a.drop.to)} CAD (${pct(a.drop.pct)} off, ${cad(a.drop.diff)} lower)</p>`:''}
 <dl class="ac-rows"><div><dt>MSRP</dt><dd>${msrp}</dd></div>
 <div><dt>Market value (sealed)</dt><dd>${range(a.market)} ${a.market?`<span class="ac-sub">TCGplayer, as of ${esc(day(a.asOf))}</span>`:''}</dd></div>
 ${a.contents&&a.contents.packs!==undefined?`<div><dt>Expected value of contents</dt><dd>${ev}</dd></div>`:''}
 <div><dt>Matched product</dt><dd class="ac-sub">${matched}</dd></div></dl>
 <p class="ac-verdict">${esc(a.verdict.label)}</p>
 <div class="ac-foot">${go?`<a class="btn smallbtn${buyUrl?' primary':''}" href="${esc(go)}" target="_blank" rel="noopener noreferrer">${esc(buyLabel||'Buy now: checkout at '+(store||'store'))}</a>`:''}<span class="ac-sub">${at?esc(new Date(at).toLocaleString('en-CA')):''}</span></div>
</article>`;
}

/* Shared context: price snapshot + rates + EV rows, loaded once. */
let ctx=null,loading=null;
function context(){
 if(ctx)return Promise.resolve(ctx);
 if(loading)return loading;
 const E=root.CardsteadPackEv;
 loading=(E?.loadData?E.loadData():Promise.resolve(root.CardsteadPackData)).then(data=>{
  const rates=root.CardsteadPackRates||{};
  ctx={data,rates,evRows:E?E.rows(data,rates.sets||{},rates.msrp||null):[]};return ctx;
 }).catch(()=>{loading=null;return null});
 return loading;
}
/** Remove product images that fail to load (the CSP forbids inline onerror handlers). */
function wire(node){node?.querySelectorAll?.('img.ac-img').forEach(i=>i.addEventListener('error',()=>i.remove(),{once:true}))}
const api={wire,kindOf,match,assess,verdict,text,cardHtml,context,current:()=>ctx,PACKS,PACKS_SOURCE,norm};
root.CardsteadAlertValue=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
