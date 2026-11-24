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
  {id:'toysrus',name:'Toys"R"Us (now on Staples.ca)',host:'www.staples.ca',auto:'manual',confidence:'fallback',search:g('staples.ca'),note:'toysrus.ca now redirects to a Toys"R"Us section of Staples.ca (Bureau en Gros in Québec); no Toys"R"Us stores are listed. Google site-search link.'},
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
  {id:'canadacomputers',name:'Canada Computers',host:'www.canadacomputers.com',auto:'manual',confidence:'verified-2026-11-23',scope:'chain',search:'https://www.canadacomputers.com/qc/2028/pokemon-boosters',note:'Pokémon boosters category (Québec stores in Montréal, Brossard, Laval and Gatineau). Opens the category page; their search URL is not verified.'},
  // Québec card shops that are not on Shopify (no automatic checks): one-tap Google site search. Verified 2026-11-23 to exist and sell Pokémon TCG.
  {id:'lemaitredujeu',name:'Le Maître du Jeu',host:'www.lemaitredujeu.ca',auto:'manual',confidence:'fallback',scope:'local',region:'montreal',city:'Verdun',search:g('lemaitredujeu.ca'),note:'Montréal (Verdun) game store. Google site-search link.'},
  {id:'thecardsvault',name:'The Cards Vault / La Voûte de Cartes',host:'thecardsvault.com',auto:'manual',confidence:'fallback',scope:'local',region:'montreal',city:'Lachine',search:g('thecardsvault.com'),note:'Montréal (Lachine). Google site-search link.'},
  {id:'cartamagica',name:'Carta Magica Montréal',host:'www.cartamagica.com',auto:'manual',confidence:'fallback',scope:'local',region:'montreal',city:'Montréal',search:g('cartamagica.com'),note:'Montréal (rue St-Hubert). Google site-search link.'},
  {id:'expeditionjeux',name:'L\'Expédition',host:'www.expeditionjeux.com',auto:'manual',confidence:'fallback',scope:'local',region:'montreal',city:'Montréal / Brossard',search:g('expeditionjeux.com'),note:'Montréal (rue St-Hubert) and South Shore (boul. Taschereau). Google site-search link.'},
  {id:'gamekeeper',name:'Game Keeper (Lajeunesse)',host:'www.gamekeeperonline.com',auto:'manual',confidence:'fallback',scope:'local',region:'montreal',city:'Montréal',search:g('gamekeeperonline.com'),note:'Montréal (Ahuntsic). Google site-search link.'},
  {id:'gamekeeperverdun',name:'Game Keeper Verdun',host:'www.gamekeeperverdun.com',auto:'manual',confidence:'fallback',scope:'local',region:'montreal',city:'Verdun',search:g('gamekeeperverdun.com'),note:'Montréal (Verdun, rue Wellington). Google site-search link.'},
  {id:'hokiepokie',name:'HokiePokie TCG',host:'www.hokiepokietcg.ca',auto:'manual',confidence:'fallback',scope:'local',region:'montreal',city:'Montréal',search:g('hokiepokietcg.ca'),note:'Montréal. Google site-search link.'},
  {id:'tome2',name:'Tome 2',host:'www.tome2boutique.com',auto:'manual',confidence:'fallback',scope:'local',region:'south-shore',city:'Saint-Jean-sur-Richelieu',search:g('tome2boutique.com'),note:'Saint-Jean-sur-Richelieu. Google site-search link.'},
  {id:'godsarena',name:'L\'arène des Dieux',host:'www.godsarena.com',auto:'manual',confidence:'fallback',scope:'local',region:'quebec-city',city:'Québec',search:g('godsarena.com'),note:'Québec City (boul. Père-Lelièvre). Google site-search link.'},
  {id:'monnaiecanada',name:'Monnaie Canada',host:'www.monnaiecanada.online',auto:'manual',confidence:'fallback',scope:'local',region:'estrie',city:'Sherbrooke',search:g('monnaiecanada.online'),note:'Sherbrooke (Galeries 4 Saisons). Google site-search link.'},
  {id:'pokemaths',name:'PokéMaths',host:'pokemaths.com',auto:'manual',confidence:'fallback',scope:'local',region:'centre-du-quebec',city:'Drummondville',search:g('pokemaths.com'),note:'Drummondville. Google site-search link.'},
  {id:'imaginaire',name:'Imaginaire',host:'imaginaire.com',auto:'manual',confidence:'fallback',scope:'local',region:'qc-all',city:'Québec, Lévis, Sherbrooke, Trois-Rivières, Laval, Chicoutimi, Montréal',search:g('imaginaire.com'),note:'Québec chain of comic and game stores in several cities. Google site-search link.'},
  // Canadian online card shops (not Shopify) that ship to Québec.
  {id:'happytcg',name:'HappyTCG',host:'happytcg.ca',auto:'manual',confidence:'fallback',scope:'online',search:g('happytcg.ca'),note:'Ships from Québec. Google site-search link.'},
  {id:'pokemarket',name:'Poké-Market',host:'poke-market.ca',auto:'manual',confidence:'fallback',scope:'online',search:g('poke-market.ca'),note:'Québec marketplace that ships across Québec. Google site-search link.'},
  {id:'tistaminis',name:'Tistaminis (online hobby shop)',host:'tistaminis.com',auto:'shopify',confidence:'verified-2026-11-23',search:'https://tistaminis.com/search?q={q}',note:'Shopify store: automatic checks available when you paste a product URL.'},
  {id:'doescards',name:'Doe\'s Cards',host:'doescards.ca',auto:'shopify',confidence:'verified-2026-11-23',search:'https://doescards.ca/search?q={q}',note:'Shopify store: automatic checks available when you paste a product URL.'},
  {id:'raincity',name:'Rain City Games',host:'www.raincity.games',auto:'shopify',confidence:'verified-2026-11-23',search:'https://www.raincity.games/search?q={q}',note:'Shopify store: automatic checks available when you paste a product URL.'}
 ];
 const AUTO_HOSTS=[...new Set(RETAILERS.filter(r=>r.auto==='shopify').map(r=>r.host).concat(SH.SHOPS.map(x=>x.host)))];
 // Amazon.ca links carry the Associates tag from the one setting (affiliate.js); every other link is unchanged.
 const affiliate=u=>{const G=typeof window!=='undefined'?window:globalThis;return G.CardsteadAffiliate?G.CardsteadAffiliate.amazon(u):u};
 function searchUrl(r,query){return affiliate(r.search.replace('{q}',encodeURIComponent(String(query||'pokemon tcg').slice(0,120))))}
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
  const cheapest=pool.slice().sort((a,b)=>toCents(a.price)-toCents(b.price))[0];const vid=Number(cheapest&&cheapest.id);
  return {status:avail.length?'in':'out',price:Math.round(cents)/100,title:String(j.title||'').slice(0,160),variantId:avail.length&&Number.isSafeInteger(vid)&&vid>0?vid:null}}
 const STOP=new Set(['pokemon','tcg','the','a','an','of','de','la','le','les','du','des','et','and','cards','card','carte','cartes','edition','set']);
 const tokens=t=>String(t||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x&&!STOP.has(x));
 // Set names, longest first, so "Scarlet & Violet 151" wins over "Scarlet & Violet". Every set in pack-ev-data.js must be here
 // (a test checks); add upcoming sets by hand. Era names double as set names ("Mega Evolution"), which is why they are listed too.
 const SETS=["Delta Reign","30th Celebration","Pitch Black","Chaos Rising","Perfect Order","Ascended Heroes","Phantasmal Flames","Mega Evolution","Black Bolt","White Flare","Destined Rivals","Journey Together","Prismatic Evolutions","Surging Sparks","Stellar Crown","Shrouded Fable","Twilight Masquerade","Temporal Forces","Paldean Fates","Paradox Rift","Scarlet & Violet 151","Obsidian Flames","Paldea Evolved","Scarlet & Violet Base Set","Crown Zenith","Silver Tempest","Lost Origin","Astral Radiance","Brilliant Stars","Fusion Strike","Evolving Skies","Chilling Reign","Battle Styles","Vivid Voltage","Darkness Ablaze","Rebel Clash","Sword & Shield Base Set",
  "Flowing Fists","Flowing Fist","Scarlet & Violet","Sword & Shield","Celebrations","Hidden Fates","Shining Fates","Pokemon GO"];
 const ERAS=['mega evolution','scarlet violet','sword shield'];
 const phrase=t=>' '+tokens(String(t||'').replace(/\betb\b/ig,'elite trainer box')).join(' ')+' ';
 const SETP=SETS.map(s=>({name:s,p:phrase(s).trim()})).sort((a,b)=>b.p.length-a.p.length);
 /** Set names found in a title. A name inside a longer one is not counted, and an era name is dropped when a set is named too. */
 function setsIn(t){const p=phrase(t);let found=SETP.filter(s=>s.p&&p.includes(' '+s.p+' ')).map(s=>s.p);
  found=found.filter(a=>!found.some(b=>b!==a&&(' '+b+' ').includes(' '+a+' ')));
  if(found.length>1)found=found.filter(a=>!ERAS.includes(a));return found}
 /** Product kind from a title: case, etb-pc, etb, tin, blister, bnb, box, bundle, pack, collection, or null. */
 function kindOf(t){const p=phrase(t);
  if(/ (case|cases) | \d+ (ct|count) /.test(p))return 'case';
  if(/ elite trainer box /.test(p)&&/ (center|centre|pc|exclusive) /.test(p))return 'etb-pc'; // "pokemon" is a stop word
  if(/ elite trainer box | coffret dresseur /.test(p))return 'etb';
  if(/ tin | tins | minitin /.test(p))return 'tin';
  if(/ blister /.test(p))return 'blister';
  if(/ build battle /.test(p))return 'bnb';
  if(/ booster box | display | boite boosters /.test(p))return 'box';
  if(/ bundle /.test(p))return 'bundle';
  if(/ booster pack | sleeved | pack | packs /.test(p))return 'pack';
  if(/ collection | box /.test(p))return 'collection';
  return null}
 const FORMAT_KIND={pack:'pack',box:'box',etb:'etb',bundle:'bundle',collection:'collection',tin:'tin'};
 /** Language a title says it is: 'fr', 'ja', 'ko', 'zh' or null (English shops list English unless they say otherwise). */
 function langOf(t){const p=phrase(t);if(/ (french|francais|francaise|fr|vf|coffret|dresseur|boite) /.test(p))return 'fr';if(/ (japanese|japan|jp|jpn) /.test(p))return 'ja';if(/ (korean|kor) /.test(p))return 'ko';if(/ (chinese|chn|simplified|traditional) /.test(p))return 'zh';return null}
 /** A UPC/EAN written in a variant's barcode or SKU, without leading zeros, or null. */
 const upcOf=v=>{const s=String(v&&(v.barcode||v.sku)||'').replace(/\D/g,'');return s.length>=11&&s.length<=14&&String(v.barcode||v.sku).replace(/[\s-]/g,'').length===s.length?s.replace(/^0+/,''):null};
 /** Size of one variant option: "Case" -> case, "Pack" -> pack, "Box"/"Single"/"Display" -> unit (the product itself), else null. */
 const variantKind=v=>{const t=String(v&&v.title||'').toLowerCase();if(!t||t==='default title')return null;if(/case/.test(t))return 'case';if(/pack/.test(t))return 'pack';if(/box|display|single|unit|each/.test(t))return 'unit';return null};
 // Possible catalogue matches for a watch in a /products.json page.
 // A watch may be a name (older callers) or {product, format, language, upc}.
 //  - barcode: when the watch has a UPC and a variant carries it, that is an exact match; a different UPC on the product is a reject.
 //  - title: >=2 meaningful words, ALL present ("ETB" = "Elite Trainer Box"), the same set (another set's name in the title rejects it),
 //    the same kind (a case of 25, a Pokémon Center ETB or a pack is not a booster box) and the same language.
 // A title match is a lead, never proof: the UI says "verify".
 function matchCatalog(watch,data,host){const W=typeof watch==='string'?{product:watch}:watch||{};
  const w=tokens(phrase(W.product));if(w.length<2||!data||!Array.isArray(data.products))return [];
  const wantKind=FORMAT_KIND[W.format]||kindOf(W.product),wantSets=setsIn(W.product),wantLang=W.language==='fr'?'fr':W.language==='any'?null:'en';
  const wantUpc=W.upc?String(W.upc).replace(/\D/g,'').replace(/^0+/,''):null;const out=[];
  for(const p of data.products){if(!p||!Array.isArray(p.variants)||!p.variants.length||typeof p.handle!=='string')continue;
   let vars=p.variants,by='title';
   const upcs=vars.map(upcOf).filter(Boolean);
   if(wantUpc&&upcs.includes(wantUpc)){vars=vars.filter(v=>upcOf(v)===wantUpc);by='barcode'}
   else{
    if(wantUpc&&upcs.length)continue; // the shop states a different barcode
    const t=new Set(tokens(phrase(p.title)));if(!w.every(x=>t.has(x)))continue;
    const sets=setsIn(p.title);if(wantSets.length&&sets.some(s=>!wantSets.includes(s)))continue;
    const lang=langOf(p.title);if(wantLang==='en'&&lang||wantLang==='fr'&&lang!=='fr')continue;
    if(wantKind){if(kindOf(p.title)!==wantKind)continue;
     // A "Box / Pack / Case" option list: keep the option that is the product itself.
     if(vars.some(variantKind)){vars=vars.filter(v=>{const k=variantKind(v);return !k||k==='unit'||k===wantKind});if(!vars.length)continue}}
   }
   const q=parseShopifyProduct({title:p.title,variants:vars});if(!q)continue;out.push({title:q.title,handle:p.handle,available:q.status==='in',price:q.price,variantId:q.variantId,matchedBy:by,url:'https://'+host+'/products/'+encodeURIComponent(p.handle)})}
  return out}
 // Quantity to put in the cart: what you want, never above the retailer's per-customer limit when you know it.
 function qtyFor(w){const q=Math.max(1,Math.min(99,Math.floor(Number(w&&w.quantity)||1))),l=Math.floor(Number(w&&w.limit)||0);return l>0?Math.min(q,l):q}
 // Fastest legitimate path to checkout. Never submits anything: the shop's own page asks you to confirm payment.
 // Shopify: /cart/<variantId>:<qty> opens a cart (Shop Pay / saved details apply). Amazon.ca: add-to-cart page, with the Associates tag when it is set.
 function buyUrl(o){if(!o)return null;const qty=qtyFor({quantity:o.qty});let u=null;try{u=o.url?new URL(o.url):null}catch{u=null}
  const host=o.host||(u&&u.hostname)||'';
  if(Number.isSafeInteger(o.variantId)&&o.variantId>0&&AUTO_HOSTS.includes(host))return 'https://'+host+'/cart/'+o.variantId+':'+qty;
  if(u&&u.protocol==='https:'&&/^(www\.)?amazon\.ca$/.test(u.hostname)){const m=u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/);if(m)return affiliate('https://www.amazon.ca/gp/aws/cart/add.html?ASIN.1='+m[1]+'&Quantity.1='+qty)}
  return u&&u.protocol==='https:'?affiliate(u.href):null}
 return {RETAILERS,affiliate,qtyFor,buyUrl,matchCatalog,kindOf,setsIn,langOf,SETS,tokens,AUTO_HOSTS,searchUrl,shopifyJsUrl,parseShopifyProduct,MIN_POLL_MS:15*60*1000};
});
