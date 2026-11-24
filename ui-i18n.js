/* Cardstead UI language for the new navigation, Home, Prices, product view and graphs (EN / FR, French in "tu").
 * Language: the saved choice, else the browser (fr -> French). Shared with Compare stores (cardstead-lang-v1).
 * Elements with data-i18n="key" get their text; data-i18n-ph="key" sets a placeholder. */
(function(root){'use strict';
const KEY='cardstead-lang-v1';
const S={
 en:{
  'pl.sold':'sold average','pl.asking':'asking median of {0} listings','pl.yours':'your value','pl.unknown':'Value unknown','pl.high':'High','pl.medium':'Medium','pl.low':'Low','pl.why':'How far the price sources agree, and how recent they are',
  'nav.portfolio':'Portfolio','nav.drops':'Drops','chip.overview':'Overview','chip.addCard':'Add card','chip.selling':'Selling:','fab.addCard':'Add card',
  'nav.home':'Home','nav.prices':'Prices','nav.watch':'Watch','nav.collection':'Collection','nav.settings':'Settings',
  'chip.find':'Find a product','chip.packs':'Booster pack value','chip.watches':'My watches','chip.ebay':'eBay deals',
  'chip.scan':'Scan','chip.cards':'Cards','chip.lots':'Lots','chip.sales':'Sales','chip.business':'Business',
  'chip.settings':'Settings','chip.advanced':'Advanced:','chip.deal':'Buy or Pass','chip.ebaySold':'eBay sold research','chip.sealed':'Sealed price log',
  'home.title':'What to buy or watch now','home.sub':'Good buys from your watches, how prices are moving, and where things are in stock. Real recorded prices only.',
  'home.good':'Good buys right now','home.goodEmpty':'No watched product has a recent in-stock price at or under its market value. Watch a product to see it here.',
  'home.watch':'My watchlist','home.watchEmpty':'You are not watching anything yet. Find a product and tap Watch.',
  'home.movers':'Market movers (30 days)','home.moversEmpty':'Not enough price history yet.','home.ebay':'Best eBay deals','home.ebayEmpty':'No eBay deal from your last scan.',
  'home.find':'Find a product','home.scan':'Scan a card','home.noStock':'No stock seen yet','home.best':'Best price','home.up':'up','home.down':'down',
  'prices.title':'Prices','prices.sub':'Search any sealed product or watched card: market value, MSRP, price graph and where to buy.',
  'prices.search':'Search a product, e.g. Surging Sparks ETB','prices.results':n=>`${n} result${n===1?'':'s'}`,'prices.none':'No product matches. Try the set name and the product type (ETB, booster box, bundle…).',
  'prices.hint':'Popular right now','prices.packs':'See every booster pack: is it worth opening?',
  'p.back':'Back','p.market':'Market value','p.msrp':'MSRP','p.best':'Best store price','p.ev':'Packs inside are worth','p.change30':'30 days',
  'p.noStore':'No store price recorded yet','p.watch':'Watch this','p.watching':'Watching','p.maxPrice':'Max price you would pay · CAD','p.save':'Start watching',
  'p.watchNote':'You get an alert when a store you follow has it in stock at or under this price. Default: today\'s market value.',
  'p.cadUnknown':'CAD unknown','p.unknown':'unknown','p.tcg':'View on TCGplayer','p.card':'Card','p.sealed':'Sealed product','p.onEbay':'On your eBay watchlist',
  'g.title':'Price history','g.d7':'7 days','g.d30':'30 days','g.y1':'1 year','g.market':'Market value (CAD)','g.msrp':'MSRP (US, converted)','g.stores':'Store prices you recorded',
  'g.notEnough':n=>`Not enough history yet (${n} day${n===1?'':'s'} of prices).`,'g.source':'TCGplayer market price, converted to CAD at each day\'s Bank of Canada rate.',
  'g.summary':(a,b,c)=>`From ${a} to ${b}, ${c}.`,
  's.language':'Language','s.advancedTitle':'Advanced tools','s.advancedNote':'Calculators and manual logs for experienced sellers. Everything else is detected or defaulted.',
  'w.advanced':'Advanced restock tools (sources, regions, manual checks, imports, logs)','w.more':'More options (format, language, area, quantity, shop limit, shop link)','s.help':'Help & tips','kind.pack':'Booster pack','kind.box':'Booster box','kind.etb':'Elite Trainer Box','kind.bundle':'Booster bundle','kind.tin':'Tin','kind.collection':'Collection','kind.blister':'Blister','kind.other':'Product'
 },
 fr:{
  'pl.sold':'moyenne des ventes','pl.asking':'médiane de {0} annonces','pl.yours':'ta valeur','pl.unknown':'Valeur inconnue','pl.high':'Élevée','pl.medium':'Moyenne','pl.low':'Faible','pl.why':'À quel point les sources de prix concordent, et leur fraîcheur',
  'nav.portfolio':'Portefeuille','nav.drops':'Arrivages','chip.overview':'Aperçu','chip.addCard':'Ajouter une carte','chip.selling':'Vente :','fab.addCard':'Ajouter une carte',
  'nav.home':'Accueil','nav.prices':'Prix','nav.watch':'Surveiller','nav.collection':'Collection','nav.settings':'Réglages',
  'chip.find':'Trouver un produit','chip.packs':'Valeur des boosters','chip.watches':'Mes suivis','chip.ebay':'Aubaines eBay',
  'chip.scan':'Scanner','chip.cards':'Cartes','chip.lots':'Lots','chip.sales':'Ventes','chip.business':'Revente',
  'chip.settings':'Réglages','chip.advanced':'Avancé :','chip.deal':'Acheter ou passer','chip.ebaySold':'Ventes eBay','chip.sealed':'Journal des prix scellés',
  'home.title':'Quoi acheter ou surveiller maintenant','home.sub':'Les bonnes affaires de tes suivis, l’évolution des prix et où trouver le stock. Seulement des prix réellement notés.',
  'home.good':'Bonnes affaires en ce moment','home.goodEmpty':'Aucun produit suivi n’a un prix récent en stock à sa valeur marchande ou moins. Suis un produit pour le voir ici.',
  'home.watch':'Ma liste de suivi','home.watchEmpty':'Tu ne suis encore rien. Trouve un produit et touche Suivre.',
  'home.movers':'Plus fortes variations (30 jours)','home.moversEmpty':'Pas encore assez d’historique de prix.','home.ebay':'Meilleures aubaines eBay','home.ebayEmpty':'Aucune aubaine eBay à ton dernier balayage.',
  'home.find':'Trouver un produit','home.scan':'Scanner une carte','home.noStock':'Pas encore vu en stock','home.best':'Meilleur prix','home.up':'hausse','home.down':'baisse',
  'prices.title':'Prix','prices.sub':'Cherche n’importe quel produit scellé ou carte suivie : valeur marchande, PDSF, graphique et où l’acheter.',
  'prices.search':'Cherche un produit, ex. Surging Sparks ETB','prices.results':n=>`${n} résultat${n===1?'':'s'}`,'prices.none':'Aucun produit trouvé. Essaie le nom de l’extension et le type (ETB, booster box, bundle…).',
  'prices.hint':'Populaires en ce moment','prices.packs':'Voir tous les boosters : vaut-il la peine de les ouvrir?',
  'p.back':'Retour','p.market':'Valeur marchande','p.msrp':'PDSF','p.best':'Meilleur prix en magasin','p.ev':'Les paquets à l’intérieur valent','p.change30':'30 jours',
  'p.noStore':'Aucun prix en magasin noté pour l’instant','p.watch':'Suivre','p.watching':'Suivi','p.maxPrice':'Prix maximum que tu paierais · CAD','p.save':'Commencer le suivi',
  'p.watchNote':'Tu reçois une alerte quand un magasin que tu suis l’a en stock à ce prix ou moins. Par défaut : la valeur marchande d’aujourd’hui.',
  'p.cadUnknown':'CAD inconnu','p.unknown':'inconnu','p.tcg':'Voir sur TCGplayer','p.card':'Carte','p.sealed':'Produit scellé','p.onEbay':'Dans ta liste eBay',
  'g.title':'Historique des prix','g.d7':'7 jours','g.d30':'30 jours','g.y1':'1 an','g.market':'Valeur marchande (CAD)','g.msrp':'PDSF (américain, converti)','g.stores':'Prix notés en magasin',
  'g.notEnough':n=>`Pas encore assez d’historique (${n} jour${n>1?'s':''} de prix).`,'g.source':'Prix du marché TCGplayer, converti en CAD au taux de la Banque du Canada de chaque jour.',
  'g.summary':(a,b,c)=>`Du ${a} au ${b}, ${c}.`,
  's.language':'Langue','s.advancedTitle':'Outils avancés','s.advancedNote':'Calculatrices et journaux manuels pour les vendeurs expérimentés. Tout le reste est détecté ou réglé par défaut.',
  'w.advanced':'Outils de restock avancés (sources, régions, vérifications manuelles, imports, journaux)','w.more':'Plus d’options (format, langue, région, quantité, limite par client, lien de boutique)','s.help':'Aide et conseils','kind.pack':'Booster','kind.box':'Boîte de boosters','kind.etb':'Coffret Dresseur d’élite','kind.bundle':'Lot de boosters','kind.tin':'Boîte en métal','kind.collection':'Coffret','kind.blister':'Blister','kind.other':'Produit'
 }
};
function lang(){try{const v=JSON.parse(root.localStorage?.getItem(KEY)||'null');if(v==='fr'||v==='en')return v}catch{}return /^fr/i.test(root.navigator?.language||'')?'fr':'en'}
function t(key,...args){const v=S[lang()][key]??S.en[key];return typeof v==='function'?v(...args):v??key}
function money(v,cur='CAD'){return Number.isFinite(v)?new Intl.NumberFormat(lang()==='fr'?'fr-CA':'en-CA',{style:'currency',currency:cur}).format(v):'—'}
function pct(v){return Number.isFinite(v)?(v>0?'+':v<0?'−':'')+Math.abs(Math.round(v*1000)/10).toLocaleString(lang()==='fr'?'fr-CA':'en-CA')+(lang()==='fr'?' %':'%'):'—'}
function date(s,opts={year:'numeric',month:'short',day:'numeric'}){const d=Date.parse(s);return Number.isFinite(d)?new Date(d).toLocaleDateString(lang()==='fr'?'fr-CA':'en-CA',{...opts,timeZone:'UTC'}):''}
function apply(scope){const d=root.document;if(!d)return;(scope||d).querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)});(scope||d).querySelectorAll('[data-i18n-ph]').forEach(el=>{el.placeholder=t(el.dataset.i18nPh)});d.documentElement.lang=lang()==='fr'?'fr-CA':'en-CA'}
function set(l){try{root.localStorage.setItem(KEY,JSON.stringify(l==='fr'?'fr':'en'))}catch{}apply();root.dispatchEvent?.(new Event('cardstead:lang'))}
const api={S,lang,t,money,pct,date,apply,set,KEY};
root.CardsteadI18n=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
