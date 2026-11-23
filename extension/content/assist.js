/* Cardstead Drop Assist: runs on Amazon.ca and Pokémon Center pages.
 * 1. Pokémon Center watch tab: reports queue / stock / price on every load.
 * 2. Checkout assist after a drop: quantity -> add to cart -> cart -> checkout, then STOPS.
 *    The owner reviews the order and clicks "Place order" themselves; this script refuses to press it.
 */
(function(){'use strict';
const A=self.CardsteadAssist;if(!A||window.__cardsteadAssist)return;window.__cardsteadAssist=true;
const host=window.__cardsteadTestHost||location.hostname;
const store=/amazon\.ca$/.test(host)?'amazon':/pokemoncenter\.com$/.test(host)?'pokemoncenter':null;
if(!store)return;
const send=msg=>new Promise(r=>{try{chrome.runtime.sendMessage(msg,x=>r(x))}catch{r(null)}});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const label=el=>[el.innerText,el.value,el.getAttribute('aria-label'),el.getAttribute('title'),el.getAttribute('name')].filter(Boolean).join(' ');

/** The only way this script presses anything. Final purchase controls are refused. */
function safeClick(el,why){
 if(!el)return false;
 if(A.isFinalPurchaseControl(label(el))){banner('Ready: review your order and click the store\'s own button to place it.');return false}
 el.click();return true;
}
function findButton(re){return [...document.querySelectorAll('button,input[type=submit],input[type=button],a[role=button],span.a-button-inner input')].find(b=>re.test(label(b))&&!A.isFinalPurchaseControl(label(b))&&!b.disabled)}
function setQuantity(qty){
 const sel=document.querySelector('select[name="quantity"],select#quantity,select[data-testid*="quantity" i],select[aria-label*="quantit" i]');
 if(sel){const opt=[...sel.options].map(o=>Number(o.value)).filter(n=>n>=1&&n<=qty);const v=opt.length?Math.max(...opt):1;sel.value=String(v);sel.dispatchEvent(new Event('change',{bubbles:true}));return v}
 const inp=document.querySelector('input[name="quantity"],input[type=number][aria-label*="quantit" i],input[data-testid*="quantity" i]');
 if(inp){const max=Number(inp.max)||qty;const v=Math.min(qty,max);const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(inp,String(v));inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));return v}
 return 1;
}

/* Loud on-screen banner + beeps (the background worker also plays a sound and sends notifications). */
let bannerEl=null;
function banner(text,loud=true){
 if(!bannerEl){bannerEl=document.createElement('div');bannerEl.id='cardstead-assist-banner';bannerEl.setAttribute('role','alert');
  bannerEl.style.cssText='position:fixed;z-index:2147483647;left:0;right:0;top:0;padding:18px 20px;font:700 20px/1.35 system-ui,sans-serif;color:#081e1a;background:#58d7b0;box-shadow:0 6px 24px #0008;text-align:center';
  bannerEl.title='Click to hide';bannerEl.style.cursor='pointer';bannerEl.addEventListener('click',()=>{bannerEl.remove();bannerEl=null});
  document.documentElement.appendChild(bannerEl)}
 bannerEl.textContent='Cardstead Drop Assist: '+text+' (click to hide)';
 if(loud)beep();
}
function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)();let t=c.currentTime;for(let i=0;i<6;i++){const o=c.createOscillator(),g=c.createGain();o.frequency.value=i%2?660:990;g.gain.value=0.25;o.connect(g).connect(c.destination);o.start(t);o.stop(t+0.18);t+=0.24}}catch{}}

/* Automatic checkout, last step: re-read this checkout page, let the background re-check every guard,
 * then press "Place your order" ONCE. Any doubt -> nothing pressed, the owner is alerted. */
async function autoCheckout(p,job){
 await wait(1500); // let the page settle so totals and address are final
 const parsed=A.parseAmazonCheckout(document.documentElement.outerHTML);
 const key='cardstead-placed-'+job.attemptId;
 if(sessionStorage.getItem(key)){return} // already pressed on this page: never twice
 const r=await send({type:'auto-verify',id:p.id,parsed});
 if(!r||!r.go){banner('Not bought automatically: '+((r&&r.why)||['no answer']).join('; ')+'. Review it and click Place your order yourself.');return}
 const btn=document.querySelector('input[name="placeYourOrder1"]')||document.querySelector('#submitOrderButtonId input,#submitOrderButtonId button,#placeYourOrder input,#placeYourOrder button,#bottomSubmitOrderButtonId input')||[...document.querySelectorAll('input[type=submit],button')].find(b=>/^\s*place your order\s*$/i.test(label(b)));
 if(!btn){await send({type:'auto-unconfirmed',id:p.id,reason:'Place your order button not found; nothing pressed'});banner('Not bought: the Place your order button was not found.');return}
 sessionStorage.setItem(key,'1');
 banner('Placing your order for '+p.name+'…');
 btn.click(); // the single automatic "Place your order" press, after every guard passed
 setTimeout(async()=>{if(/\/(gp\/buy|checkout)\//i.test(location.pathname)&&!/thank/i.test(location.pathname)&&!A.parseOrderPlaced(document.documentElement.outerHTML,location.href).placed){
  await send({type:'auto-unconfirmed',id:p.id,reason:'still on the checkout page 20 seconds after Place your order'});banner('Amazon did not confirm the order. Check your orders: Drop Assist will not try again.')}},20000);
}

async function assist(){
 const got=await send({type:'assist-get',url:location.href,store});if(!got)return;
 const {product:p,job}=got;
 const path=location.pathname;
 // Automatic checkout (Amazon.ca only, switched on per product by the owner).
 if(store==='amazon'&&job.mode==='auto'&&p.store==='amazon'){
  if(job.attempted){
   const r=A.parseOrderPlaced(document.documentElement.outerHTML,location.href);
   if(r.placed){banner('ORDER PLACED for '+p.name+(r.orderId?' (#'+r.orderId+')':'')+'. The alert has a link to cancel it.');await send({type:'auto-placed',id:p.id,orderId:r.orderId});return}
   if(/\/(gp\/buy|checkout)\//i.test(path))return; // still on checkout after the click: the 20-second check below reports it
   return}
  if(/\/(dp|gp\/product)\//.test(path)){
   const q=setQuantity(job.qty);await wait(400);
   const buy=document.getElementById('buy-now-button');
   if(!buy){banner(p.name+': no Buy Now button. Checkout assist instead.');await send({type:'assist-step',id:p.id,step:'stuck',message:'Automatic checkout: no Buy Now button; nothing bought.'});return}
   banner('Automatic checkout: Buy Now for '+q+' × '+p.name+'…');await send({type:'assist-step',id:p.id,step:'buy-now',message:'Automatic checkout: quantity '+q+' set; Buy Now pressed.'});
   buy.click(); // the one allowed press before the checkout page: Buy Now, automatic mode only
   await wait(6000);
   if(/\/(dp|gp\/product)\//.test(location.pathname)){banner('Amazon opened its quick checkout window. Nothing was bought: review it and place the order yourself.');await send({type:'assist-step',id:p.id,step:'overlay',message:'Automatic checkout stopped: quick-checkout window instead of the checkout page. Nothing bought.'})}
   return}
  if(/\/(gp\/buy|checkout)\//i.test(path)){await autoCheckout(p,job);return}
 }
 if(job.mode!=='checkout'&&job.mode!=='auto'){banner('DROP: '+p.name+' is in stock. Buy it now.');return}
 // Checkout reached: stop and hand over.
 if(store==='amazon'&&/\/(gp\/buy|checkout|gp\/checkoutportal)\//i.test(path)||store==='pokemoncenter'&&/\/checkout/i.test(path)){
  banner('Checkout is open for '+p.name+'. Review it and click Place order yourself.');await send({type:'assist-done',id:p.id});return}
 if(store==='amazon'){
  if(/\/(dp|gp\/product)\//.test(path)){
   const q=setQuantity(job.qty);await wait(400);
   const add=document.getElementById('add-to-cart-button')||findButton(/add to cart|ajouter au panier/i);
   if(!add){banner(p.name+': no Add to Cart button. Open the offers yourself.');await send({type:'assist-step',id:p.id,step:'stuck',message:'No Add to Cart button on the product page.'});return}
   banner('Adding '+q+' × '+p.name+' to your cart…');await send({type:'assist-step',id:p.id,step:'cart',message:'Quantity '+q+' set; Add to Cart pressed.'});
   safeClick(add);await wait(2500);location.assign('https://www.amazon.ca/gp/cart/view.html');return}
  if(/\/gp\/cart|\/cart/.test(path)){
   const go=document.querySelector('input[name="proceedToRetailCheckout"]')||findButton(/proceed to checkout|passer à la caisse|passer la commande/i);
   if(go&&!A.isFinalPurchaseControl(label(go))){banner('Going to checkout…');await send({type:'assist-step',id:p.id,step:'checkout',message:'Cart reached; Proceed to checkout pressed.'});safeClick(go)}
   else banner('Your cart is ready: click Proceed to checkout.');
   return}
  // Amazon's "added to cart" page or side sheet.
  location.assign('https://www.amazon.ca/gp/cart/view.html');return}
 // Pokémon Center
 if(/\/product\//.test(path)){
  const obs=A.parsePokemonCenter(document.documentElement.outerHTML);
  if(obs.queue){banner('You are in the Pokémon Center line. Keep this tab open.',false);return}
  const q=setQuantity(A.quantity(p,null,obs.limit));await wait(400);
  const add=findButton(/^\s*(add to cart|ajouter au panier)\s*$/i)||findButton(/add to cart|ajouter au panier/i);
  if(!add){banner(p.name+': the Add to Cart button is not available yet.');await send({type:'assist-step',id:p.id,step:'stuck',message:'No Add to Cart button on the product page.'});return}
  banner('Adding '+q+' × '+p.name+' to your cart…');await send({type:'assist-step',id:p.id,step:'cart',message:'Quantity '+q+' set; Add to Cart pressed.'});
  safeClick(add);await wait(2500);location.assign(location.origin+'/'+(path.split('/')[1]||'en-ca')+'/cart');return}
 if(/\/cart/.test(path)){
  const go=findButton(/^\s*(checkout|proceed to checkout|passer à la caisse|paiement)\s*$/i)||findButton(/checkout|caisse/i);
  if(go){banner('Going to checkout…');await send({type:'assist-step',id:p.id,step:'checkout',message:'Cart reached; Checkout pressed.'});safeClick(go)}
  else banner('Your cart is ready: click Checkout.');
 }
}

/* Pokémon Center watch tab: report what the page shows. */
if(store==='pokemoncenter'&&/\/product\//.test(location.pathname)||store==='pokemoncenter'&&A.parsePokemonCenter(document.documentElement.outerHTML).queue){
 send({type:'pc-status',url:location.href,obs:A.parsePokemonCenter(document.documentElement.outerHTML)});
}
chrome.runtime.onMessage?.addListener(m=>{if(m?.type==='assist-start')assist()});
assist();
window.__cardsteadAssistApi={safeClick,setQuantity,assist,banner};
})();
