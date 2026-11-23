/* Cardstead Drop Assist: pure logic shared by the background worker, the content scripts and the tests.
 * Checkout ASSIST, not a buying bot: it watches, alerts, fills the quantity, adds to cart and opens checkout.
 * It never clicks a final "Place order" control, never solves CAPTCHAs and never skips a queue.
 */
(function(root){'use strict';
const MIN_INTERVAL_MIN=2, DEFAULT_INTERVAL_MIN=3, ROBOT_BACKOFF_MIN=30, DROP_COOLDOWN_MIN=30, ASSIST_TTL_MIN=10;

/** Amazon.ca ASIN or product URL, or a Pokémon Center Canada product URL -> {store,id,url}; null if not supported. */
function productFromInput(text){
 const s=String(text||'').trim();
 if(/^[A-Z0-9]{10}$/i.test(s))return {store:'amazon',id:'amazon:'+s.toUpperCase(),url:'https://www.amazon.ca/dp/'+s.toUpperCase()};
 let u;try{u=new URL(s)}catch{return null}
 if(u.protocol!=='https:')return null;
 if(/^(www\.)?amazon\.ca$/i.test(u.hostname)){
  const m=u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
  return m?{store:'amazon',id:'amazon:'+m[1].toUpperCase(),url:'https://www.amazon.ca/dp/'+m[1].toUpperCase()}:null;
 }
 if(/^(www\.)?pokemoncenter\.com$/i.test(u.hostname)){
  const m=u.pathname.match(/^\/(en-ca|fr-ca)\/product\/([A-Za-z0-9-]+)(?:\/([A-Za-z0-9-]+))?/);
  return m?{store:'pokemoncenter',id:'pokemoncenter:'+m[2].toLowerCase(),url:'https://www.pokemoncenter.com/'+m[1]+'/product/'+m[2]+(m[3]?'/'+m[3]:'')}:null;
 }
 return null;
}

/** "$54.99", "CDN$ 54.99", "54,99 $" -> 54.99 */
function money(text){
 const t=String(text||'').replace(/ /g,' ');
 const m=t.match(/(\d{1,3}(?:[ ,.]\d{3})*|\d+)(?:[.,](\d{2}))?\s*\$|\$\s*(\d{1,3}(?:[ ,]\d{3})*|\d+)(?:\.(\d{2}))?/);
 if(!m)return null;
 const whole=(m[1]||m[3]).replace(/[ ,.]/g,''),cents=m[2]||m[4]||'00';
 const v=Number(whole+'.'+cents);return Number.isFinite(v)&&v>0?v:null;
}
const strip=h=>String(h||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ');
function section(html,id,len=4000){const i=html.search(new RegExp('id=["\']'+id+'["\']'));return i<0?'':html.slice(i,i+len)}

/** Amazon.ca product page HTML -> what matters for a drop. */
function parseAmazon(html){
 const h=String(html||'');
 const robotCheck=/validateCaptcha|Type the characters you see|Enter the characters you see|To discuss automated access to Amazon data/i.test(h);
 if(robotCheck)return {robotCheck:true,inStock:false,price:null,seller:null,maxQty:null,title:null};
 const avail=strip(section(h,'availability',1500));
 const unavailable=/currently unavailable|actuellement indisponible|out of stock|en rupture de stock|temporarily out of stock/i.test(avail);
 const inStock=/id=["']add-to-cart-button["']/.test(h)&&!unavailable;
 const priceBox=section(h,'corePrice_feature_div',3000)||section(h,'corePriceDisplay_desktop_feature_div',3000)||section(h,'apex_desktop',3000);
 const off=priceBox.match(/class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)</);
 const price=off?money(off[1]):null;
 const merchant=strip(section(h,'merchantInfoFeature_feature_div',2500)+' '+section(h,'merchant-info',800)+' '+section(h,'tabular-buybox',3000));
 const seller=/sold by\s*amazon\.ca|vendu par\s*amazon\.ca|ships from and sold by amazon\.ca|expédié et vendu par amazon\.ca|Amazon\.ca\s*(Sold by|Vendu par)?\s*Amazon\.ca/i.test(merchant)?'amazon':/sold by|vendu par/i.test(merchant)?'third-party':null;
 const sel=h.match(/<select[^>]*name=["']quantity["'][^>]*>([\s\S]*?)<\/select>/i);
 const maxQty=sel?Math.max(...[...sel[1].matchAll(/value=["'](\d+)["']/g)].map(m=>Number(m[1])),1):null;
 const tm=h.match(/id=["']productTitle["'][^>]*>([^<]+)</);
 return {robotCheck:false,inStock,price,seller,maxQty,title:tm?tm[1].trim():null};
}

/** Pokémon Center page (HTML string or document text) -> queue / stock / price / purchase limit. */
function parsePokemonCenter(html){
 const h=String(html||''),text=strip(h);
 const queue=/waiting room|you are now in line|you're in line|queue-it|file d'attente|vous êtes (maintenant )?dans la file/i.test(text)||/queue-it\.net|queueit/i.test(h);
 if(queue)return {queue:true,inStock:false,price:null,limit:null,title:null};
 let inStock=null,price=null,title=null;
 for(const m of h.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)){
  try{const j=JSON.parse(m[1]);const items=[].concat(j['@graph']||j);for(const it of items){if(!/Product/i.test(it['@type']||''))continue;title=title||it.name||null;
   for(const o of [].concat(it.offers||[])){if(o.availability)inStock=/InStock|LimitedAvailability|PreOrder/i.test(o.availability)&&!/OutOfStock|SoldOut/i.test(o.availability);if(o.price!==undefined&&price===null)price=Number(o.price)||null}}}catch{}
 }
 const button=h.match(/<button[^>]*>(?:(?!<\/button>)[\s\S])*?(add to cart|ajouter au panier|sold out|épuisé|out of stock|notify me|m'aviser)(?:(?!<\/button>)[\s\S])*?<\/button>/i);
 if(inStock===null&&button){inStock=/add to cart|ajouter au panier/i.test(button[1])&&!/\bdisabled\b/i.test(button[0])}
 if(inStock===null)inStock=/add to cart|ajouter au panier/i.test(text)&&!/sold out|out of stock|épuisé|en rupture/i.test(text);
 if(price===null){const pm=text.match(/(?:CA)?\$\s?\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s?\$/);price=pm?money(pm[0]):null}
 const lim=text.match(/limit(?:ed)?(?: to)?\s*(\d{1,2})\s*per\s*(?:customer|order|household)|limite de\s*(\d{1,2})\s*par/i);
 return {queue:false,inStock:!!inStock,price,limit:lim?Number(lim[1]||lim[2]):null,title};
}

/** How many to put in the cart: the owner's max, never above the store's limit or what the page allows. */
function quantity(product,pageMax,storeLimit){
 let q=Math.max(1,Math.floor(Number(product.maxQty)||1));
 for(const cap of [pageMax,storeLimit,product.storeLimit])if(Number.isFinite(cap)&&cap>=1)q=Math.min(q,Math.floor(cap));
 return q;
}

/** Is this a drop worth acting on? state: per-product memory (lastDropAt, backoffUntil). */
function decide(product,obs,state={},now=Date.now()){
 if(!product.enabled)return {action:'none',reason:'paused'};
 if(obs.robotCheck)return {action:'backoff',reason:'Amazon asked for a robot check: paused for '+ROBOT_BACKOFF_MIN+' min. Open the page yourself if you want.',until:now+ROBOT_BACKOFF_MIN*60000};
 if(obs.queue)return {action:'queue',reason:'In the Pokémon Center waiting room: keep the tab open.'};
 if(!obs.inStock)return {action:'none',reason:'out of stock'};
 if(product.store==='amazon'&&product.amazonOnly!==false&&obs.seller!=='amazon')return {action:'none',reason:obs.seller==='third-party'?'in stock from a third-party seller only':'seller not confirmed as Amazon.ca'};
 if(!Number.isFinite(obs.price))return {action:'none',reason:'in stock but no price found: not acting'};
 if(Number.isFinite(product.maxPrice)&&obs.price>product.maxPrice)return {action:'none',reason:`in stock at $${obs.price.toFixed(2)}, above your max $${product.maxPrice.toFixed(2)}`};
 if(state.lastDropAt&&now-state.lastDropAt<DROP_COOLDOWN_MIN*60000)return {action:'none',reason:'drop already handled in the last '+DROP_COOLDOWN_MIN+' min'};
 return {action:'drop',reason:`in stock at $${obs.price.toFixed(2)} (max $${(product.maxPrice??obs.price).toFixed(2)})`};
}

/** Next check delay: at least 2 minutes, ±20% jitter, longer after failures. */
function nextDelayMs(intervalMin,failures=0,rand=Math.random()){
 const base=Math.max(MIN_INTERVAL_MIN,Number(intervalMin)||DEFAULT_INTERVAL_MIN)*60000;
 const back=Math.min(8,2**Math.max(0,failures));
 return Math.round(base*back*(0.8+0.4*rand));
}

/** Controls the assist must never press. */
const FINAL=/place (your )?order|place order|passer (la |votre )?commande|confirm (and |&\s*)?pay|pay now|payer maintenant|submit (your )?order|complete (your )?(purchase|order)|buy now with 1-click|achat en 1-click|acheter maintenant|buy now|1-click|finali[sz]er/i;
function isFinalPurchaseControl(label){return FINAL.test(String(label||'').replace(/\s+/g,' '))}

/** Product ids that a Cardstead restock alert points at (alert hub entries and recorded checks). */
function signalsFromCardstead(entries,products){
 const ids=new Set();
 for(const e of entries||[]){const p=productFromInput(e?.url||'');if(p&&products.some(x=>x.id===p.id))ids.add(p.id)}
 return [...ids];
}
function ntfyTopicOk(t){return /^[A-Za-z0-9_-]{8,64}$/.test(String(t||''))}

const api={MIN_INTERVAL_MIN,DEFAULT_INTERVAL_MIN,ROBOT_BACKOFF_MIN,DROP_COOLDOWN_MIN,ASSIST_TTL_MIN,productFromInput,money,parseAmazon,parsePokemonCenter,quantity,decide,nextDelayMs,isFinalPurchaseControl,signalsFromCardstead,ntfyTopicOk};
root.CardsteadAssist=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
