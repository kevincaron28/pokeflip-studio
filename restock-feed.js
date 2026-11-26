/* Recent restocks: what Cardstead's own shop checks saw at Canadian shops in the last 7 days, for everyone,
 * no account needed. Reads one public database function (migrations/008-restock-feed.sql) when the Drops page is
 * opened. Says plainly when the checks have stopped, so an old list never looks live.
 * Typical asking price (migrations/009-shop-prices.sql): the middle price among 3 or more shops with stock, in CA$,
 * shown on a sealed product's page and next to each restock. Asking prices, never sales. */
(function(root){'use strict';
const RPC='https://fehvorwdcswhhonavyit.supabase.co/rest/v1/rpc/';
const KEY='sb_publishable_uRWUN4b6l2Op-rd0nDIOOg_r__6Tz-g'; // publishable key, public by design (see cloud-sync.js)
const MINE='cardstead-feed-mine';
const STALE_MIN=30,FRESH_MS=120000,STEP=12;
const https=u=>{try{return new URL(u).protocol==='https:'}catch{return false}};
const num=v=>v===null||v===''||!Number.isFinite(Number(v))||Number(v)<=0?null:Number(v);
const when=v=>{const t=Date.parse(v);return Number.isFinite(t)?t:null};
/** The database answer, checked field by field; rows without a name, shop, safe link or time are dropped. Pure. */
function clean(data){
 if(!data||typeof data!=='object'||!Array.isArray(data.items))return null;
 const items=[];
 for(const r of data.items.slice(0,200)){
  if(!r||typeof r.name!=='string'||!r.name||typeof r.store_name!=='string'||!https(r.url)||when(r.seen_at)===null)continue;
  items.push({product:String(r.product||''),name:r.name.slice(0,200),lang:['EN','FR','JP'].includes(r.lang)?r.lang:'EN',store:String(r.store||''),storeName:r.store_name.slice(0,100),
   city:typeof r.city==='string'?r.city.slice(0,80):'',url:r.url,price:num(r.price_cad),inStock:r.in_stock===true,seen:when(r.seen_at),
   market:num(r.market_cad),marketAsOf:/^\d{4}-\d{2}-\d{2}/.test(r.market_as_of||'')?String(r.market_as_of).slice(0,10):null,
   image:https(r.image)?r.image:null});
 }
 items.sort((a,b)=>b.seen-a.seen);
 return {checkedAt:when(data.checked_at),shops:Math.max(0,Number(data.shops_checked)||0),items};
}
/** 'live' when a shop was read in the last half hour, else 'paused' (or 'never'). Pure. */
function status(checkedAt,now){if(!checkedAt)return 'never';return now-checkedAt<=STALE_MIN*60000?'live':'paused'}
/** "3 minutes ago" in the language shown. Pure. */
function ago(then,now,locale){
 const s=Math.max(0,Math.round((now-then)/1000)),f=new Intl.RelativeTimeFormat(locale,{numeric:'auto'});
 if(s<3600)return f.format(-Math.max(1,Math.round(s/60)),'minute');
 if(s<86400)return f.format(-Math.round(s/3600),'hour');
 return f.format(-Math.round(s/86400),'day');
}
/** The typical-price answer, checked: only entries from 3 or more shops with sensible numbers. Pure. */
function cleanPrices(data){
 const out=new Map();if(!data||typeof data!=='object'||Array.isArray(data))return out;
 for(const [k,v] of Object.entries(data)){
  const shops=Number(v?.shops),typical=num(v?.typical),low=num(v?.low),high=num(v?.high);
  if(Number.isInteger(shops)&&shops>=3&&typical&&low&&high&&low<=typical&&typical<=high)out.set(k,{shops,typical,low,high});
 }
 return out;
}
/** How an asking price compares with the typical one: within 5% is about the same. Pure. */
function compare(price,typical){
 if(!num(price)||!num(typical))return null;const d=price/typical-1,pct=Math.round(Math.abs(d)*100);
 return {code:pct<=5?'same':d>0?'above':'below',pct};
}
/** The checker's names for a sealed product (English and French), from data/drop-catalogue.json. Pure. */
function productKeys(catalogue,id){
 for(const s of catalogue?.sets||[]){const p=(s.products||[]).find(x=>String(x.id)===String(id));if(p)return ['EN','FR'].map(l=>({lang:l,key:`${s.slug}|${p.kind}|${l}`}))}
 return [];
}
const core={clean,status,ago,cleanPrices,compare,productKeys};
root.CardsteadRestockFeed=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const t=(k,...a)=>root.CardsteadI18n?root.CardsteadI18n.t(k,...a):k;
const locale=()=>root.CardsteadI18n?.lang?.()==='fr'?'fr-CA':'en-CA';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat(locale(),{style:'currency',currency:'CAD'}).format(v);
const day=iso=>new Intl.DateTimeFormat(locale(),{dateStyle:'medium',timeZone:'UTC'}).format(new Date(iso+'T00:00:00Z'));
let feed=null,loadedAt=0,loading=false,shown=STEP,prices=new Map(),pricesAt=0,pricesAsk=null,catalogue=null;
const mine=()=>{try{return root.localStorage.getItem(MINE)!=='0'}catch{return true}};
function panel(){
 let el=doc.getElementById('restockFeed');if(el)return el;
 const sec=doc.getElementById('restock'),first=sec?.querySelector('.panel, details');if(!sec)return null;
 el=doc.createElement('div');el.id='restockFeed';el.className='panel';el.hidden=true;
 sec.insertBefore(el,first&&first.parentNode===sec?first:null);
 el.addEventListener('change',e=>{if(e.target.id!=='feedMine')return;try{root.localStorage.setItem(MINE,e.target.checked?'1':'0')}catch{}shown=STEP;draw()});
 el.addEventListener('click',e=>{if(e.target.closest('[data-feed-more]')){shown+=STEP;draw()}});
 return el;
}
function row(x,now){
 const sub=[x.storeName,x.city].filter(Boolean).join(' · ');
 const price=[x.price?t('feed.price',money(x.price)):'',x.market?t('feed.market',money(x.market),x.marketAsOf?day(x.marketAsOf):''):''].filter(Boolean).join(' · ');
 const p=prices.get(x.product),c=x.inStock&&p?compare(x.price,p.typical):null;
 return `<li class="feed-row${x.inStock?'':' out'}">${x.image?`<img src="${esc(x.image)}" alt="" loading="lazy" width="48" height="48">`:'<span class="feed-noimg" aria-hidden="true"></span>'}
  <div><strong>${esc(x.name)}</strong><p class="note">${esc(sub)}${x.lang==='EN'?'':' · '+esc(x.lang)}</p>${price?`<p class="note">${esc(price)}</p>`:''}${c?`<p class="feed-verdict ${c.code}">${esc(t('typ.'+c.code,c.pct,p.shops,money(p.typical)))}</p>`:''}
  <p><span class="feed-state">${esc(t(x.inStock?'feed.in':'feed.out',ago(x.seen,now,locale())))}</span> <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(t('feed.open'))}</a></p></div></li>`;
}
function draw(){
 const el=panel();if(!el||!feed)return;
 const now=Date.now(),state=status(feed.checkedAt,now),only=mine(),P=root.CardsteadStorePrefs;
 const list=only&&P?feed.items.filter(x=>P.hostOn(x.store)):feed.items;
 const line=state==='live'?t('feed.live',ago(feed.checkedAt,now,locale()),feed.shops):state==='paused'?t('feed.paused',ago(feed.checkedAt,now,locale())):t('feed.never');
 el.hidden=false;
 el.innerHTML=`<h2>${esc(t('feed.title'))}</h2><p class="${state==='live'?'note':'feed-paused'}" role="status">${esc(line)}</p>
  <label class="checkline"><input type="checkbox" id="feedMine"${only?' checked':''}> ${esc(t('feed.mine'))}</label>
  ${list.length?`<ul class="feed-list">${list.slice(0,shown).map(x=>row(x,now)).join('')}</ul>`:`<p class="empty">${esc(t(only&&feed.items.length?'feed.noneMine':'feed.none'))}</p>`}
  ${list.length>shown?`<p><button type="button" class="btn" data-feed-more>${esc(t('feed.more',list.length-shown))}</button></p>`:''}
  <p class="note">${esc(t('feed.note'))}</p>`;
}
async function rpc(name){
 const r=await root.fetch(RPC+name,{method:'POST',headers:{apikey:KEY,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
 return r.ok?r.json():null;
}
/** Typical prices, asked once every few minutes. Empty when the database cannot say. */
function loadPrices(){
 if(Date.now()-pricesAt<FRESH_MS)return Promise.resolve(prices);
 return pricesAsk||=rpc('shop_prices').then(d=>{if(d){prices=cleanPrices(d);pricesAt=Date.now()}return prices},()=>prices).finally(()=>{pricesAsk=null});
}
/** The line on a sealed product's page. Stays hidden when fewer than 3 shops have the product. */
core.productPrice=async(el,it)=>{
 if(!el||it?.kind!=='sealed')return;
 try{
  if(!catalogue){const base=root.PokeFlipNative?.isNative?'https://pokeflip-studio.vercel.app':'.';const r=await root.fetch(base+'/data/drop-catalogue.json');if(!r.ok)return;catalogue=await r.json()}
  const keys=productKeys(catalogue,it.id);if(!keys.length)return;
  const all=await loadPrices();
  const lines=keys.filter(k=>all.has(k.key)).map(k=>{const p=all.get(k.key);return `<p><strong>${esc(t(k.lang==='FR'?'typ.titleFr':'typ.title',money(p.typical)))}</strong> <span class="note">${esc(t('typ.range',p.shops,money(p.low),money(p.high)))}</span></p>`});
  if(!lines.length||!el.isConnected)return;
  el.innerHTML=lines.join('')+`<p class="note">${esc(t('typ.note'))}</p>`;el.hidden=false;
 }catch{/* offline: nothing to add */}
};
async function load(){
 if(loading||(feed&&Date.now()-loadedAt<FRESH_MS))return draw();
 loading=true;
 try{
  const got=clean(await rpc('restock_feed'));
  if(got){feed=got;loadedAt=Date.now();loadPrices().then(draw)}
 }catch{/* offline: keep what we have; with nothing yet, the panel stays hidden */}
 finally{loading=false}
 draw();
}
function init(){
 const open=()=>{const s=doc.getElementById('restock');return !!s&&!s.classList.contains('hidden')};
 root.addEventListener('cardstead:show',e=>{if(e.detail==='restock')load()});
 root.addEventListener('cardstead:lang',draw);
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&open())load()});
 if(open())load();
}
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
