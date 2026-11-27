/* Help & FAQ (#/help) and the short first-run walkthrough of the Android app. EN and FR, French uses "tu".
 * Every answer describes what the app does today: change it here when the behaviour changes. */
(function(root){'use strict';
const SEEN='cardstead-tour-v1';
const HELP={
 en:{title:'Help & FAQ',intro:'How Cardstead gets its prices, when it can alert you, and what it keeps.',more:'Still stuck?',tour:'Show the walkthrough',report:'Report a problem',privacy:'Privacy policy',
  topics:[
   {id:'prices',q:'Where do the prices come from?',a:[
    'Card and sealed product prices come from recent sales on TCGplayer (and Cardmarket for cards), converted to CA$ at the Bank of Canada rate and refreshed once a day.',
    'eBay.ca figures and the “typical asking price at Canadian shops” are asking prices, not sales.',
    'Each price names its source and how far to trust it. Graded cards have no sold-price source here. Check before you buy or sell.']},
   {id:'alerts',q:'How do price alerts work?',a:[
    'Add a card to your Watchlist with a target price in CA$, or an alert when it is a chosen percentage under its value.',
    'Cardstead checks while it is open and tells you when a card reaches it. Allow notifications to get a phone notification.',
    'If Settings → Drop alerts shows “Also when a card on my Watchlist reaches my target price”, tick it to be told with the app closed: once a day, for ungraded English Near Mint cards added from a set page, using your cloud backup.']},
   {id:'watches',q:'How do I watch a sealed product?',a:[
    'Open the product (or use Drops → My watches) and save a watch with the most you would pay.',
    'While Cardstead is open it checks the shops it is able to check. Big chains have one-tap links to check yourself.',
    'A match is a possible match: confirm the exact set, edition and language on the shop page. Cardstead never buys for you.']},
   {id:'feed',q:'What is “Recent restocks”?',a:[
    'On the Drops page: what Cardstead’s own shop checks saw at Canadian shops in the last 7 days. No account needed.',
    'It says when the checks have paused. Stock can sell out before you get there.']},
   {id:'sets',q:'What are the Watchlist and set completion?',a:[
    'The Watchlist holds cards you own or want, with their value, what you paid and your price targets.',
    'Under Prices → All sets, tap a card to tick it off. Hold it (or use ⋯) for quantities and printings such as reverse holo or 1st Edition.',
    '“Set” counts one of each card up to the printed total; “Master set” counts every printing. You see the owned value, the missing value and the cost to complete, and can add the missing cards to your Watchlist.']},
   {id:'push',q:'How do I get push notifications?',a:[
    'Settings → Drop alerts on this device → Turn on drop alerts. You need to sign in to your Cardstead account first.',
    'You get a notification when a sealed product comes back in stock at a shop in your area, at most one per product per store every 30 minutes. It is not a guarantee of stock.',
    'If Settings says the Android app cannot receive them yet, open Cardstead in Chrome on your phone and turn them on there. If nothing arrives, check that notifications are allowed in your phone’s settings.']},
   {id:'data',q:'Is my collection saved?',a:[
    'It stays on this device and works without an account. Clearing the app’s data or uninstalling erases what you have not backed up.',
    'In Settings you can download a backup file, or sign in with an emailed code to keep a cloud copy. Automatic cloud backup runs only while Cardstead is open.',
    'You can delete your account in Settings → Account and privacy.']},
  ]},
 fr:{title:'Aide et FAQ',intro:'D’où viennent les prix, quand Cardstead peut t’avertir et ce qu’il conserve.',more:'Toujours bloqué?',tour:'Revoir la visite guidée',report:'Signaler un problème',privacy:'Politique de confidentialité',
  topics:[
   {id:'prices',q:'D’où viennent les prix?',a:[
    'Les prix des cartes et des produits scellés viennent des ventes récentes sur TCGplayer (et Cardmarket pour les cartes), convertis en $ CA au taux de la Banque du Canada et actualisés une fois par jour.',
    'Les chiffres d’eBay.ca et le « prix demandé habituel dans les boutiques canadiennes » sont des prix demandés, pas des ventes.',
    'Chaque prix indique sa source et à quel point s’y fier. Les cartes gradées n’ont pas de source de prix vendus ici. Vérifie avant d’acheter ou de vendre.']},
   {id:'alerts',q:'Comment fonctionnent les alertes de prix?',a:[
    'Ajoute une carte à ta liste de suivi avec un prix cible en $ CA, ou une alerte quand elle passe sous sa valeur d’un pourcentage choisi.',
    'Cardstead vérifie pendant qu’il est ouvert et te prévient quand une carte l’atteint. Autorise les notifications pour en recevoir sur ton téléphone.',
    'Si Réglages → Alertes d’arrivage affiche « Aussi quand une carte de ma liste de suivi atteint mon prix cible », coche-le pour être averti même quand l’application est fermée : une fois par jour, pour les cartes anglaises non gradées à l’état Near Mint ajoutées depuis la page d’une série, à partir de ta sauvegarde infonuagique.']},
   {id:'watches',q:'Comment suivre un produit scellé?',a:[
    'Ouvre le produit (ou va dans Arrivages → Mes suivis) et enregistre un suivi avec le maximum que tu paierais.',
    'Pendant que Cardstead est ouvert, il vérifie les boutiques qu’il peut vérifier. Pour les grandes chaînes, des liens en un toucher te permettent de vérifier toi-même.',
    'Un résultat est une correspondance possible : confirme l’extension, l’édition et la langue sur la page de la boutique. Cardstead n’achète jamais à ta place.']},
   {id:'feed',q:'C’est quoi, les « arrivages récents »?',a:[
    'Dans la page Arrivages : ce que les vérifications de boutiques de Cardstead ont vu au Canada dans les 7 derniers jours. Aucun compte requis.',
    'La liste indique quand les vérifications sont en pause. Le stock peut s’épuiser avant ton passage.']},
   {id:'sets',q:'Que font la liste de suivi et le suivi des extensions?',a:[
    'La liste de suivi contient les cartes que tu possèdes ou que tu veux, avec leur valeur, ce que tu as payé et tes prix cibles.',
    'Dans Prix → Toutes les extensions, touche une carte pour la cocher. Garde le doigt dessus (ou utilise ⋯) pour les quantités et les impressions, comme reverse holo ou 1re édition.',
    '« Extension » compte une de chaque carte jusqu’au total imprimé; « Master set » compte toutes les impressions. Tu vois la valeur possédée, la valeur manquante et le coût pour compléter, et tu peux ajouter les cartes manquantes à ta liste de suivi.']},
   {id:'push',q:'Comment recevoir des notifications?',a:[
    'Réglages → Alertes d’arrivage sur cet appareil → active les alertes. Connecte-toi d’abord à ton compte Cardstead.',
    'Tu reçois une notification quand un produit scellé revient en stock dans une boutique de ta région, au plus une par produit et par boutique toutes les 30 minutes. Le stock n’est pas garanti.',
    'Si les réglages disent que l’application Android ne peut pas encore les recevoir, ouvre Cardstead dans Chrome sur ton téléphone et active-les là. Si rien n’arrive, vérifie que les notifications sont autorisées dans les réglages du téléphone.']},
   {id:'data',q:'Ma collection est-elle sauvegardée?',a:[
    'Elle reste sur cet appareil et fonctionne sans compte. Effacer les données de l’application ou la désinstaller supprime ce que tu n’as pas sauvegardé.',
    'Dans les réglages, tu peux télécharger un fichier de sauvegarde, ou te connecter avec un code reçu par courriel pour garder une copie en ligne. La sauvegarde automatique ne tourne que pendant que Cardstead est ouvert.',
    'Tu peux supprimer ton compte dans les réglages, à la section du compte et de la confidentialité.']},
  ]},
};
const TOUR={
 en:{label:'Welcome to Cardstead',skip:'Skip',back:'Back',next:'Next',done:'Start',step:(a,b)=>`Step ${a} of ${b}`,steps:[
  {icon:'◔',title:'Prices in Canadian dollars',text:'Search any card or sealed product. Each price shows where it comes from and how far to trust it.'},
  {icon:'★',title:'Your Watchlist and sets',text:'Save cards with a target price. Under All sets, tick the cards you own and see what completing the set costs.'},
  {icon:'🔔',title:'Restocks and drops',text:'See recent restocks at Canadian shops, watch a product with your max price and turn on drop alerts in Settings.'},
  {icon:'⚙',title:'Help is in Settings',text:'Change the language, back up your collection, read Help & FAQ or report a problem there.'}]},
 fr:{label:'Bienvenue dans Cardstead',skip:'Passer',back:'Retour',next:'Suivant',done:'Commencer',step:(a,b)=>`Étape ${a} sur ${b}`,steps:[
  {icon:'◔',title:'Des prix en dollars canadiens',text:'Cherche une carte ou un produit scellé. Chaque prix indique sa source et à quel point s’y fier.'},
  {icon:'★',title:'Ta liste de suivi et tes extensions',text:'Enregistre des cartes avec un prix cible. Dans Toutes les extensions, coche tes cartes et vois ce qu’il en coûte pour compléter.'},
  {icon:'🔔',title:'Arrivages et réapprovisionnements',text:'Vois les arrivages récents au Canada, suis un produit avec ton prix maximum et active les alertes dans les réglages.'},
  {icon:'⚙',title:'L’aide est dans les réglages',text:'Change la langue, sauvegarde ta collection, consulte l’aide et la FAQ ou signale un problème à cet endroit.'}]},
};
/** The walkthrough opens by itself once, in the Android app, and not over a link someone followed in. Pure. */
function opensByItself({native,seen,hash}){return !!native&&!seen&&(!hash||hash==='#/')}
const core={SEEN,HELP,TOUR,opensByItself};
root.CardsteadHelp=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const $=id=>doc.getElementById(id);
const lang=()=>root.CardsteadI18n?.lang?.()==='fr'?'fr':'en';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(){
 const host=$('help');if(!host)return;const h=HELP[lang()];
 const open=new Set([...host.querySelectorAll('details[open]')].map(d=>d.dataset.topic));
 host.innerHTML=`<h1>${esc(h.title)}</h1><p class="muted">${esc(h.intro)}</p>
 ${h.topics.map(t=>`<details class="panel faq" data-topic="${t.id}"${open.has(t.id)?' open':''}><summary>${esc(t.q)}</summary>${t.a.map(p=>`<p class="note">${esc(p)}</p>`).join('')}</details>`).join('')}
 <div class="panel"><h2>${esc(h.more)}</h2><div class="row"><button type="button" class="btn primary" data-report>${esc(h.report)}</button><button type="button" class="btn" data-tour>${esc(h.tour)}</button><a class="btn" href="https://pokeflip-studio.vercel.app/privacy.html" data-privacy="" target="_blank" rel="noopener">${esc(h.privacy)}</a></div></div>`;
}

let step=0;
function draw(){
 const d=$('tourDialog'),t=TOUR[lang()],s=t.steps[step],last=step===t.steps.length-1;
 d.setAttribute('aria-label',t.label);
 d.innerHTML=`<div class="tour-icon" aria-hidden="true">${s.icon}</div><h2 tabindex="-1">${esc(s.title)}</h2><p>${esc(s.text)}</p>
 <div class="tour-dots" role="img" aria-label="${esc(t.step(step+1,t.steps.length))}">${t.steps.map((_,i)=>`<i class="${i===step?'on':''}"></i>`).join('')}</div>
 <div class="row spread"><button type="button" class="btn" data-tour-skip${last?' hidden':''}>${esc(t.skip)}</button><span class="row">${step?`<button type="button" class="btn" data-tour-back>${esc(t.back)}</button>`:''}<button type="button" class="btn primary" data-tour-next>${esc(last?t.done:t.next)}</button></span></div>`;
 d.querySelector('h2').focus();
}
function tour(){
 let d=$('tourDialog');
 if(!d){d=doc.createElement('dialog');d.id='tourDialog';d.className='editdialog tour-dialog';d.setAttribute('data-no-translate','');doc.body.append(d);
  d.addEventListener('click',e=>{
   if(e.target.closest('[data-tour-skip]'))return d.close();
   if(e.target.closest('[data-tour-back]')){step--;return draw()}
   if(e.target.closest('[data-tour-next]')){if(step>=TOUR[lang()].steps.length-1)return d.close();step++;draw()}
  })}
 step=0;
 // Seen as soon as it shows: closing it any way (Skip, Back, leaving the app) is enough.
 try{root.localStorage.setItem(SEEN,'1')}catch{}
 if(!d.open)d.showModal();
 draw();
}
core.tour=tour;core.render=render;

function init(){
 root.addEventListener('cardstead:show',e=>{if(e.detail==='help')render()});
 if($('help')&&!$('help').classList.contains('hidden'))render();
 root.addEventListener('cardstead:lang',()=>{if($('help')&&!$('help').classList.contains('hidden'))render();if($('tourDialog')?.open)draw()});
 doc.addEventListener('click',e=>{if(e.target.closest?.('[data-tour]')){e.preventDefault();tour()}});
 let seen=true;try{seen=!!root.localStorage.getItem(SEEN)}catch{}
 if(typeof root.HTMLDialogElement==='function'&&opensByItself({native:root.PokeFlipNative?.isNative===true,seen,hash:root.location.hash}))tour();
}
// Runs after nav.js and routes.js, which may already have opened #/help.
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
