/* Page addresses (#/drops, #/watchlist, #/sets/12, #/product/sealed:565606): Back goes to the page you came
 * from, and a set or product can be bookmarked or shared. Only addresses starting with "#/" are read, so
 * sign-in links (#access_token=…) are left alone. Also keeps the tab title, description and canonical address
 * in the language shown. */
(function(root){'use strict';
const SITE='https://pokeflip-studio.vercel.app/';
const PAGES={prices:'',sets:'sets',packs:'packs',restock:'drops',calendar:'drops/calendar',deals:'drops/ebay',mycards:'watchlist',settings:'settings',deal:'settings/buy-or-pass',ebay:'settings/ebay-sold',sealed:'settings/sealed'};
const TITLES={sets:'chip.sets',packs:'chip.packs',restock:'nav.drops',calendar:'chip.calendar',deals:'chip.ebay',mycards:'nav.mycards',settings:'nav.settings',deal:'chip.deal',ebay:'chip.ebaySold',sealed:'chip.sealed'};
/** The address of a page; '' when there is none (a product page without its product). Pure. */
function toHash(page,id){
 if(page==='product')return id?'#/product/'+encodeURIComponent(id):'';
 if(page==='sets'&&id)return '#/sets/'+encodeURIComponent(id);
 return PAGES[page]===undefined?'':'#/'+PAGES[page];
}
/** {page, id} for an address of ours, else null. Pure. */
function parse(hash){
 if(!String(hash||'').startsWith('#/'))return null;
 const path=String(hash).slice(2).replace(/\/+$/,'');
 try{
  let m=/^product\/([^/]+)$/.exec(path);
  if(m){const id=decodeURIComponent(m[1]);return /^(sealed|card):\d+(:[A-Za-z0-9 .()+'-]*){0,2}$/.test(id)?{page:'product',id}:null}
  m=/^sets\/(\d+)$/.exec(path);if(m)return {page:'sets',id:Number(m[1])};
 }catch{return null}
 const page=Object.keys(PAGES).find(k=>PAGES[k]===path);return page?{page}:null;
}
/** The address to send someone: always the public website, without the sender's language. Pure. */
function shareUrl(hash){return SITE+(hash==='#/'?'':hash)}
const core={SITE,PAGES,toHash,parse,shareUrl};
root.CardsteadRoutes=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const I=()=>root.CardsteadI18n,t=k=>I()?I().t(k):k;
let applying=false,page='prices';
const idOf=p=>p==='product'?root.CardsteadProduct?.ref?.():p==='sets'?root.CardsteadSets?.current?.():null;
const here=()=>root.location.hash||'#/';
function nameOf(p){return p==='product'?root.CardsteadProduct?.title?.():p==='sets'?root.CardsteadSets?.title?.():''}
function describe(){
 const name=nameOf(page)||(TITLES[page]?t(TITLES[page]):'');
 doc.title=name?name+' · Cardstead':t('seo.title');
 doc.querySelector('meta[name="description"]')?.setAttribute('content',t('seo.description'));
 // The French copy of the page (…?lang=fr) is its own address for search engines.
 const asked=new URLSearchParams(root.location.search).get('lang');
 doc.querySelector('link[rel="canonical"]')?.setAttribute('href',SITE+(asked==='fr'||asked==='en'?'?lang='+asked:''));
}
function record(){
 describe();
 if(applying)return;
 const hash=toHash(page,idOf(page));if(!hash||hash===here())return;
 root.history.pushState({depth:(root.history.state?.depth||0)+1,from:here()},'',hash);
}
async function follow(){
 const at=root.location.hash?parse(root.location.hash):{page:'prices'};if(!at)return;
 applying=true;
 try{
  if(at.page==='product'){await root.CardsteadProduct?.open(at.id);if(root.CardsteadProduct?.ref?.()!==at.id)root.CardsteadNav?.show('prices')}
  else{if(at.page==='sets')root.CardsteadSets?.select?.(at.id||null);root.CardsteadNav?.show(at.page)}
 }finally{applying=false}
}
/** Back inside the app (the Android back button). False when there is nowhere to go back to. */
core.back=()=>{if(!(root.history.state?.depth>0))return false;root.history.back();return true};
/** An on-screen "← Back": the browser's Back when that leads to the same place, so history does not loop. */
core.backTo=(p,id)=>root.history.state?.from===toHash(p,id)&&core.back();
async function share(){
 const url=shareUrl(toHash(page,idOf(page))||'#/'),title=nameOf(page)||'Cardstead';
 try{if(root.navigator.share){await root.navigator.share({title,url});return}}catch(e){if(e?.name==='AbortError')return}
 try{await root.navigator.clipboard.writeText(url);root.pokeflipToast?.(t('share.copied'))}catch{root.prompt?.(t('share.copy'),url)}
}
function init(){
 root.addEventListener('cardstead:show',e=>{page=e.detail;record()});
 root.addEventListener('cardstead:set',()=>{if(page==='sets')record()});
 root.addEventListener('cardstead:lang',describe);
 root.addEventListener('popstate',()=>follow());
 doc.addEventListener('click',e=>{if(e.target.closest?.('[data-share]')){e.preventDefault();share()}});
 describe();
 if(parse(root.location.hash))follow();
}
// After nav.js has shown the first page.
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
