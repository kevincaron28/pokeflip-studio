/* Cardstead UI language for the new navigation, Home, Prices, product view and graphs (EN / FR, French in "tu").
 * Language: the saved choice, else the browser (fr -> French). Shared with Compare stores (cardstead-lang-v1).
 * Elements with data-i18n="key" get their text; data-i18n-ph="key" sets a placeholder. */
(function(root){'use strict';
const KEY='cardstead-lang-v1';
const S={
 en:{
  'cv.title':'My collection','cv.empty':'No cards yet. Tap Add card to scan or type your first card.','cv.value':'Value','cv.paid':'Paid',
  'cv.vsPaid':(a,b,c)=>`vs ${a} paid`,'cv.noCostYet':'Add what you paid (purchase lots) to see your gain or loss.','cv.r30':'1M','cv.r90':'3M','cv.r365':'1Y','cv.r3650':'All',
  'cv.historyStarts':(a,b,c)=>`The graph starts today (${a} day of history). One point is added each day you open your Portfolio.`,'cv.chartLabel':(a,b,c)=>`Collection value and amount paid over ${a} days`,
  'cv.confLabel':'How much of the value is well sourced','cv.conf.high':'high confidence','cv.conf.medium':'medium confidence','cv.conf.low':'low confidence','cv.conf.yours':'your own prices',
  'cv.raw':'Raw cards','cv.graded':'Graded cards','cv.cards':(a,b,c)=>`${a} cards`,'cv.unvalued':(a,b,c)=>`${a} cards have no value yet.`,'cv.review':'Review them','cv.noCost':(a,b,c)=>`${a} cards have no purchase cost, so they are left out of gain or loss.`,
  'cv.top':'Biggest holdings','cv.how':'Values: recent sales from TCGplayer and Cardmarket in CA$, for the edition, finish and condition you entered. Refreshed once a day.','cv.refreshing':(a,b,c)=>`Updating prices: ${a} of ${b} cards…`,
  'pl.sold':'sold average','pl.asking':(a,b,c)=>`asking median of ${a} listings`,'pl.yours':'your value','pl.unknown':'Value unknown','pl.high':'High','pl.medium':'Medium','pl.low':'Low','pl.why':'How far the price sources agree, and how recent they are',
  'nav.portfolio':'Portfolio','nav.drops':'Drops','chip.overview':'Overview','chip.addCard':'Add card','chip.selling':'Selling:','fab.addCard':'Add card',
  'chip.sets':'All sets','sets.title':'All sets','sets.sub':'Every series and set, with the value of a complete set, the chase cards and sealed prices, in CA$.',
  'sets.search':'Search a set (name or code)','sets.source':(d,r)=>`TCGplayer sold averages of ${d}, in CA$ at the Bank of Canada rate (1 USD = ${r} CAD). English cards.`,
  'sets.cards':n=>`${n} cards`,'sets.chase':'Top card','sets.pack':'Pack','sets.etb':'ETB','sets.box':'Box','sets.value':'Set value','sets.none':'No set found.',
  'sets.loading':'Loading the cards…','sets.fail':'The set list could not be loaded. Check your connection and try again.','sets.back':'All sets',
  'sets.owned':(h,n,p)=>`you own ${h} of ${n} (${p}%)`,'sets.valueRule':'one of each card, cheapest printing','sets.byPrice':'Highest price first','sets.byNumber':'By number',
  'sets.noPrice':'no recent sale','sets.youOwn':'in your collection',
  'sets.series.other':'Promos & special products',
  'chip.calendar':'Coming drops','cal.title':'Coming drops','cal.sub':'New sets and sealed products with their release dates, so you can set your watches before launch day.',
  'cal.source':'Release dates from TCGplayer presale listings (updated daily) and official announcements. Canadian shops sometimes sell a day early or late.',
  'cal.confirmed':'Official date','cal.announced':'Announced','cal.estimate':'TCGplayer estimate','cal.differs':(a,b)=>`Announced for ${a}; TCGplayer lists ${b}.`,
  'cal.prerelease':a=>`Prerelease events from ${a}.`,'cal.sources':'Sources:','cal.tcgDate':a=>`TCGplayer date: ${a}`,'cal.presale':a=>`presale ${a}`,
  'cal.watch':'Watch','cal.watching':'Watching','cal.noProducts':'No products listed yet.','cal.none':'No upcoming releases listed right now.','cal.fail':'The release list could not be loaded. Check your connection and try again.',
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
  'cv.title':'Ma collection','cv.empty':'Aucune carte pour l’instant. Touche Ajouter une carte pour scanner ou taper ta première carte.','cv.value':'Valeur','cv.paid':'Payé',
  'cv.vsPaid':(a,b,c)=>`par rapport à ${a} payés`,'cv.noCostYet':'Ajoute ce que tu as payé (lots d’achat) pour voir ton gain ou ta perte.','cv.r30':'1 M','cv.r90':'3 M','cv.r365':'1 A','cv.r3650':'Tout',
  'cv.historyStarts':(a,b,c)=>`Le graphique commence aujourd’hui (${a} jour d’historique). Un point s’ajoute chaque jour où tu ouvres ton portefeuille.`,'cv.chartLabel':(a,b,c)=>`Valeur de la collection et montant payé sur ${a} jours`,
  'cv.confLabel':'Part de la valeur bien appuyée par des sources','cv.conf.high':'confiance élevée','cv.conf.medium':'confiance moyenne','cv.conf.low':'confiance faible','cv.conf.yours':'tes propres prix',
  'cv.raw':'Cartes non gradées','cv.graded':'Cartes gradées','cv.cards':(a,b,c)=>`${a} cartes`,'cv.unvalued':(a,b,c)=>`${a} cartes n’ont pas encore de valeur.`,'cv.review':'Les vérifier','cv.noCost':(a,b,c)=>`${a} cartes n’ont pas de coût d’achat; elles sont exclues du gain ou de la perte.`,
  'cv.top':'Plus grosses positions','cv.how':'Valeurs : ventes récentes TCGplayer et Cardmarket en $ CA, pour l’édition, le fini et l’état indiqués. Mises à jour une fois par jour.','cv.refreshing':(a,b,c)=>`Mise à jour des prix : ${a} sur ${b} cartes…`,
  'pl.sold':'moyenne des ventes','pl.asking':(a,b,c)=>`médiane de ${a} annonces`,'pl.yours':'ta valeur','pl.unknown':'Valeur inconnue','pl.high':'Élevée','pl.medium':'Moyenne','pl.low':'Faible','pl.why':'À quel point les sources de prix concordent, et leur fraîcheur',
  'nav.portfolio':'Portefeuille','nav.drops':'Arrivages','chip.overview':'Aperçu','chip.addCard':'Ajouter une carte','chip.selling':'Vente :','fab.addCard':'Ajouter une carte',
  'chip.sets':'Toutes les extensions','sets.title':'Toutes les extensions','sets.sub':'Chaque série et extension, avec la valeur d’une extension complète, les cartes recherchées et les prix des produits scellés, en $ CA.',
  'sets.search':'Chercher une extension (nom ou code)','sets.source':(d,r)=>`Moyennes des ventes TCGplayer du ${d}, en $ CA au taux de la Banque du Canada (1 USD = ${r} CAD). Cartes anglaises.`,
  'sets.cards':n=>`${n} cartes`,'sets.chase':'Carte vedette','sets.pack':'Paquet','sets.etb':'ETB','sets.box':'Boîte','sets.value':'Valeur de l’extension','sets.none':'Aucune extension trouvée.',
  'sets.loading':'Chargement des cartes…','sets.fail':'Impossible de charger la liste des extensions. Vérifie ta connexion et réessaie.','sets.back':'Toutes les extensions',
  'sets.owned':(h,n,p)=>`tu en as ${h} sur ${n} (${p} %)`,'sets.valueRule':'une de chaque carte, impression la moins chère','sets.byPrice':'Prix le plus élevé d’abord','sets.byNumber':'Par numéro',
  'sets.noPrice':'aucune vente récente','sets.youOwn':'dans ta collection',
  'sets.series.other':'Promos et produits spéciaux',
  'chip.calendar':'Prochaines sorties','cal.title':'Prochaines sorties','cal.sub':'Les nouvelles extensions et produits scellés avec leurs dates de sortie, pour créer tes suivis avant le jour J.',
  'cal.source':'Dates tirées des préventes TCGplayer (mises à jour chaque jour) et des annonces officielles. Les boutiques canadiennes vendent parfois un jour plus tôt ou plus tard.',
  'cal.confirmed':'Date officielle','cal.announced':'Annoncé','cal.estimate':'Estimation TCGplayer','cal.differs':(a,b)=>`Annoncé pour le ${a}; TCGplayer indique le ${b}.`,
  'cal.prerelease':a=>`Avant-premières à partir du ${a}.`,'cal.sources':'Sources :','cal.tcgDate':a=>`Date TCGplayer : ${a}`,'cal.presale':a=>`prévente ${a}`,
  'cal.watch':'Suivre','cal.watching':'Suivi','cal.noProducts':'Aucun produit annoncé pour l’instant.','cal.none':'Aucune sortie à venir pour l’instant.','cal.fail':'Impossible de charger la liste des sorties. Vérifie ta connexion et réessaie.',
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
