/* Cardstead Canadian retailer catalogue + the one automatic check we can do honestly.
 *
 * Why most retailers are "manual": Costco, Walmart, Best Buy, EB Games and the other big chains publish no
 * stock API for the public, their terms restrict automated access, and several sit behind bot management
 * (Akamai / PerimeterX / Cloudflare). Cardstead does not bypass CAPTCHAs or bot protection, does not log in,
 * and does not scrape those sites. For them the app offers a one-tap search link and lets you record the check.
 *
 * "shopify" retailers are independent shops on Shopify. Each product page has a public JSON view
 * (/products/<handle>.js) that Shopify designs for storefront use and that, at the time of writing, is served
 * with CORS open. Those are polled gently while the app is open (15 min minimum per product).
 * searchUrl templates for big chains were written from their public site structure and are NOT live-verified
 * (the sites block automated fetches); `confidence` says so, and a Google site-search fallback is always safe.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PokeFlipRetailers=api;})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const SH=(typeof module==='object'&&module.exports)?require('./canada-shops.js'):(typeof window!=='undefined'?window:globalThis).PokeFlipShops||{SHOPS:[]};
 const g=d=>'https://www.google.com/search?q=site%3A'+d+'+{q}';
 const RETAILERS=[
  {id:'costco',name:'Costco.ca',host:'www.costco.ca',auto:'manual',confidence:'unverified',search:'https://www.costco.ca/CatalogSearch?keyword={q}',note:'Members-only pricing; sealed Pokémon collections appear in limited drops. Bot-protected: check by hand.'},
  {id:'ebgames',name:'EB Games / GameStop Canada',host:'www.ebgames.ca',auto:'manual',confidence:'unverified',search:'https://www.ebgames.ca/SearchResult/QuickSearch?q={q}',note:'Store pickup availability needs your postal code on the product page.'},
  {id:'walmart',name:'Walmart.ca',host:'www.walmart.ca',auto:'manual',confidence:'unverified',search:'https://www.walmart.ca/en/search?q={q}',note:'Marketplace sellers resell above MSRP: check "Sold and shipped by Walmart".'},
  {id:'bestbuy',name:'Best Buy Canada',host:'www.bestbuy.ca',auto:'manual',confidence:'unverified',search:'https://www.bestbuy.ca/en-ca/search?search={q}',note:'Shows ship and store-pickup availability; French pages at /fr-ca/.'},
  {id:'toysrus',name:'Toys"R"Us Canada',host:'www.toysrus.ca',auto:'manual',confidence:'fallback',search:g('toysrus.ca'),note:'Google site-search link (their own search URL is not verified).'},
  {id:'amazon',name:'Amazon.ca',host:'www.amazon.ca',auto:'manual',confidence:'unverified',search:'https://www.amazon.ca/s?k={q}',note:'Prefer "Ships from and sold by Amazon.ca"; third-party prices are often inflated.'},
  {id:'indigo',name:'Indigo',host:'www.indigo.ca',auto:'manual',confidence:'unverified',search:'https://www.indigo.ca/en-ca/search/?keywords={q}',note:'Limited sealed assortment.'},
  {id:'londondrugs',name:'London Drugs',host:'www.londondrugs.com',auto:'manual',confidence:'unverified',search:'https://www.londondrugs.com/search/?q={q}',note:'Mostly western Canada stores.'},
  {id:'canadiantire',name:'Canadian Tire',host:'www.canadiantire.ca',auto:'manual',confidence:'unverified',search:'https://www.canadiantire.ca/en/search-results.html?q={q}',note:'In-store pickup stock is per store: pick your store on the page.'},
  {id:'superstore',name:'Real Canadian Superstore / Loblaws',host:'www.realcanadiansuperstore.ca',auto:'manual',confidence:'unverified',search:'https://www.realcanadiansuperstore.ca/search?search-bar={q}',note:'Per-store inventory; check your local store.'},
  {id:'thesource',name:'The Source',host:'www.thesource.ca',auto:'manual',confidence:'fallback',search:g('thesource.ca'),note:'Google site-search link.'},
  {id:'shoppers',name:'Shoppers Drug Mart',host:'shop.shoppersdrugmart.ca',auto:'manual',confidence:'fallback',search:g('shoppersdrugmart.ca'),note:'Google site-search link.'},
  {id:'wellca',name:'Well.ca',host:'well.ca',auto:'manual',confidence:'unverified',search:'https://well.ca/searchresult.html?keywords={q}',note:'Canadian online pharmacy/retailer that sometimes stocks Pokémon products; free-shipping threshold applies.'},
  {id:'mastermind',name:'Mastermind Toys',host:'www.mastermindtoys.com',auto:'manual',confidence:'unverified',search:'https://www.mastermindtoys.com/search?q={q}',note:'Per-store availability by postal code on the product page.'},
  {id:'pokemoncenter-merch',name:'Pokémon Center (merch)',host:'www.pokemoncenter.com',auto:'manual',confidence:'unverified',search:'https://www.pokemoncenter.com/search/{q}',note:'Plush, accessories and other merchandise (not cards). Official store; no automation.'},
  {id:'pokemoncenter',name:'Pokémon Center (Canada)',host:'www.pokemoncenter.com',auto:'manual',confidence:'unverified',search:'https://www.pokemoncenter.com/search/{q}',note:'Official store; queue/waiting-room drops. No automation.'},
  {id:'tistaminis',name:'Tistaminis (online hobby shop)',host:'tistaminis.com',auto:'shopify',confidence:'verified-2026-11-23',search:'https://tistaminis.com/search?q={q}',note:'Shopify store: automatic checks available when you paste a product URL.'},
  {id:'doescards',name:'Doe\'s Cards',host:'doescards.ca',auto:'shopify',confidence:'verified-2026-11-23',search:'https://doescards.ca/search?q={q}',note:'Shopify store: automatic checks available when you paste a product URL.'},
  {id:'raincity',name:'Rain City Games',host:'www.raincity.games',auto:'shopify',confidence:'verified-2026-11-23',search:'https://www.raincity.games/search?q={q}',note:'Shopify store: automatic checks available when you paste a product URL.'}
 ];
 const AUTO_HOSTS=[...new Set(RETAILERS.filter(r=>r.auto==='shopify').map(r=>r.host).concat(SH.SHOPS.map(x=>x.host)))];
 function searchUrl(r,query){return r.search.replace('{q}',encodeURIComponent(String(query||'pokemon tcg').slice(0,120)))}
 // https://host/products/<handle>[?variant=..] -> https://host/products/<handle>.js  (only allowlisted shops)
 function shopifyJsUrl(productUrl){let u;try{u=new URL(productUrl)}catch{return null}
  if(u.protocol!=='https:'||!AUTO_HOSTS.includes(u.hostname))return null;
  const m=u.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?products\/([a-z0-9][a-z0-9\-_%.]*?)(?:\.js|\.json)?\/?$/i);if(!m)return null;
  return 'https://'+u.hostname+'/products/'+m[1]+'.js'}
 // Shopify product .js: {title, available, price (cents), variants:[{available, price (cents)}]}
 function parseShopifyProduct(j){if(!j||typeof j!=='object'||!Array.isArray(j.variants)||!j.variants.length)return null;
  const avail=j.variants.filter(v=>v&&v.available===true);const pool=avail.length?avail:j.variants;
  const toCents=p=>typeof p==='string'&&p.includes('.')?Number(p)*100:Number(p);const cents=Math.min(...pool.map(v=>toCents(v.price)).filter(Number.isFinite));if(!Number.isFinite(cents))return null;
  // Shopify .js reports prices in cents as integers; a decimal string would be dollars.
  return {status:avail.length?'in':'out',price:Math.round(cents)/100,title:String(j.title||'').slice(0,160)}}
 const STOP=new Set(['pokemon','tcg','the','a','an','of','de','la','le','les','du','des','et','and','cards','card','carte','cartes','edition','set']);
 const tokens=t=>String(t||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x&&!STOP.has(x));
 // Possible catalogue matches for a watch name in a /products.json page. A match needs >=2 meaningful words, ALL present in the
 // title. It is a lead, never proof of the exact set/edition/language: the UI says "verify".
 function matchCatalog(watchName,data,host){const w=tokens(watchName);if(w.length<2||!data||!Array.isArray(data.products))return [];const out=[];
  for(const p of data.products){if(!p||!Array.isArray(p.variants)||!p.variants.length||typeof p.handle!=='string')continue;const t=new Set(tokens(p.title));if(!w.every(x=>t.has(x)))continue;
   const q=parseShopifyProduct({title:p.title,variants:p.variants});if(!q)continue;out.push({title:q.title,handle:p.handle,available:q.status==='in',price:q.price,url:'https://'+host+'/products/'+encodeURIComponent(p.handle)})}
  return out}
 return {RETAILERS,matchCatalog,tokens,AUTO_HOSTS,searchUrl,shopifyJsUrl,parseShopifyProduct,MIN_POLL_MS:15*60*1000};
});
