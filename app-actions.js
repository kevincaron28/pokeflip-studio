/* Help and about, in Settings: share the app, rate it, report a problem, and read the privacy policy without
 * leaving the app. Also asks for a Play Store rating once, in the Android app, after someone saves their first
 * alert (never when the app starts, and never with a question before Google's own card).
 * French uses "tu". Nothing here sends data: a problem report is a draft in the person's own email app. */
(function(root){'use strict';
const SITE='https://pokeflip-studio.vercel.app/';
const REVIEW_KEY='cardstead-review-asked-v1',REVIEW_WAIT_MS=2500;
const TEXT={
 en:{privacy:'Privacy policy',close:'Close',sections:'Sections',web:'Open on the web',loading:'Loading…',failed:'The privacy policy could not be loaded here. Open it on the web.',
  report:'Report a problem',reportNote:'This opens your email app with the message ready. Nothing is sent until you send it.',kind:'What is it about?',message:'What happened?',
  hint:'What you did, what you expected and what you saw. For a price, name the card or product.',details:'Add the app version and phone details',send:'Open my email app',copy:'Copy instead',cancel:'Cancel',
  empty:'Write a few words first.',noContact:'The contact address could not be loaded. Check your connection and try again.',
  opened:to=>`If no email app opens, tap Copy instead and send the text to ${to}.`,copied:to=>`Copied. Send it to ${to}.`,copyAsk:'Copy this text',
  shareText:'Pokémon card prices in CA$ and Canadian restock alerts.',linkCopied:'Link copied.',copyLink:'Copy this link',web_app:'Website',android:'Android app',lang:'Language',page:'Page',device:'Device',to:'To'},
 fr:{privacy:'Politique de confidentialité',close:'Fermer',sections:'Sections',web:'Ouvrir sur le Web',loading:'Chargement…',failed:'La politique de confidentialité n’a pas pu s’afficher ici. Ouvre-la sur le Web.',
  report:'Signaler un problème',reportNote:'Ton application de courriel s’ouvre avec le message prêt. Rien n’est envoyé tant que tu ne l’envoies pas.',kind:'C’est à propos de quoi?',message:'Qu’est-ce qui s’est passé?',
  hint:'Ce que tu as fait, ce que tu attendais et ce que tu as vu. Pour un prix, nomme la carte ou le produit.',details:'Ajouter la version de l’application et les détails du téléphone',send:'Ouvrir mon courriel',copy:'Copier à la place',cancel:'Annuler',
  empty:'Écris d’abord quelques mots.',noContact:'L’adresse de contact n’a pas pu être chargée. Vérifie ta connexion et réessaie.',
  opened:to=>`Si aucune application de courriel ne s’ouvre, touche « Copier à la place » et envoie le texte à ${to}.`,copied:to=>`Copié. Envoie-le à ${to}.`,copyAsk:'Copie ce texte',
  shareText:'Les prix des cartes Pokémon en $ CA et les alertes d’arrivage au Canada.',linkCopied:'Lien copié.',copyLink:'Copie ce lien',web_app:'Site Web',android:'Application Android',lang:'Langue',page:'Page',device:'Appareil',to:'À'},
};
const KINDS={
 en:{bug:'Something is broken',price:'A price or card is wrong',alert:'An alert or restock',idea:'An idea',other:'Something else'},
 fr:{bug:'Quelque chose ne fonctionne pas',price:'Un prix ou une carte est erroné',alert:'Une alerte ou un arrivage',idea:'Une idée',other:'Autre chose'},
};
/** The first mail address linked in the privacy policy, so it is written in one place only. Pure. */
function contactFrom(html){const m=/href="mailto:([^"?]+@[^"?]+)/i.exec(String(html||''));return m?m[1]:''}
/** A mail draft for a problem report. Pure. */
function draft({to,kind,message,details,lang}){
 const L=KINDS[lang]?lang:'en',subject=`Cardstead: ${KINDS[L][kind]||KINDS[L].other}`;
 const body=String(message||'').trim()+(details?`\n\n---\n${details}`:'');
 return {subject,body,href:`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
}
/** The policy text in one language, from the parsed privacy page. Pure apart from the document given. */
function policyParts(page,lang){
 const fr=page.getElementById('fr');
 if(lang==='fr'&&fr)return [...fr.children];
 const out=[];
 for(const el of page.querySelector('main')?.children||[]){if(el===fr||el.tagName==='HR')break;out.push(el)}
 return out;
}
const core={SITE,REVIEW_KEY,TEXT,KINDS,contactFrom,draft,policyParts};
root.CardsteadActions=core;
if(typeof module!=='undefined'&&module.exports)module.exports=core;
const doc=root.document;if(!doc)return;

const $=id=>doc.getElementById(id);
const lang=()=>root.CardsteadI18n?.lang?.()==='fr'?'fr':'en';
const T=()=>TEXT[lang()];
const native=()=>root.PokeFlipNative?.isNative===true;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dialog(id,cls){let d=$(id);if(d)return d;d=doc.createElement('dialog');d.id=id;d.className='editdialog '+cls;d.setAttribute('data-no-translate','');doc.body.append(d);
 d.addEventListener('click',e=>{if(e.target.closest('[data-close]'))d.close()});return d}
const privacyText=()=>fetch('./privacy.html').then(r=>{if(!r.ok)throw Error(String(r.status));return r.text()});

/* ---------- Privacy policy ---------- */
async function openPrivacy(section){
 const t=T(),L=lang(),d=dialog('privacyDialog','doc-dialog');
 const web=SITE+'privacy.html'+(section==='delete'?(L==='fr'?'#supprimer':'#delete'):(L==='fr'?'#fr':''));
 d.setAttribute('aria-label',t.privacy);
 d.innerHTML=`<div class="doc-bar"><strong>${esc(t.privacy)}</strong><button type="button" class="btn smallbtn" data-close>${esc(t.close)}</button></div>
 <details class="doc-toc" hidden><summary>${esc(t.sections)}</summary><div></div></details>
 <div class="doc-body" lang="${L}"><p class="note">${esc(t.loading)}</p></div>
 <p><a class="btn smallbtn" href="${esc(web)}" target="_blank" rel="noopener">${esc(t.web)}</a></p>`;
 if(!d.open)d.showModal();
 const body=d.querySelector('.doc-body'),toc=d.querySelector('.doc-toc');
 try{
  const page=new root.DOMParser().parseFromString(await privacyText(),'text/html');
  const parts=policyParts(page,L).map(el=>doc.importNode(el,true));
  if(!parts.length)throw Error('empty');
  body.replaceChildren(...parts);
  // The language follows the app, so the page's own language link goes.
  body.querySelectorAll('a[href="#fr"]').forEach(a=>{const before=a.previousSibling;if(before?.nodeType===3)before.textContent=before.textContent.replace(/\s*·\s*$/,'');a.remove()});
  body.querySelectorAll('[id]').forEach(el=>{el.dataset.anchor=el.id;el.removeAttribute('id')});
  body.querySelectorAll('a[href]').forEach(a=>{a.target='_blank';a.rel='noopener'});
  const list=toc.querySelector('div');
  list.replaceChildren(...[...body.querySelectorAll('h2')].map(h=>{const b=doc.createElement('button');b.type='button';b.className='btn smallbtn';b.textContent=h.textContent;
   b.onclick=()=>{toc.open=false;h.scrollIntoView({block:'start'})};return b}));
  toc.hidden=false;
  const target=section==='delete'&&body.querySelector('[data-anchor="delete"],[data-anchor="supprimer"]');
  if(target)target.scrollIntoView({block:'start'});else d.scrollTop=0;
 }catch{body.innerHTML=`<p class="note">${esc(T().failed)}</p>`}
}

/* ---------- Report a problem ---------- */
async function detailsText(){
 const t=T(),info=native()?await root.PokeFlipNative.appInfo?.():null;
 const app=native()?`${t.android}${info?.version?` ${info.version} (${info.build})`:''}`:t.web_app;
 return [`Cardstead: ${app}`,`${t.lang}: ${lang()}`,`${t.page}: ${root.location.hash||'#/'}`,`${t.device}: ${String(root.navigator.userAgent).slice(0,220)}`].join('\n');
}
async function openReport(){
 const t=T(),d=dialog('reportDialog','report-dialog');
 // The page that was open before the report is the one worth naming.
 const details=await detailsText();
 d.setAttribute('aria-label',t.report);
 d.innerHTML=`<h2>${esc(t.report)}</h2><p class="note">${esc(t.reportNote)}</p>
 <form id="reportForm" novalidate>
 <label class="field" for="reportKind">${esc(t.kind)}</label><select id="reportKind">${Object.entries(KINDS[lang()]).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select>
 <label class="field" for="reportText">${esc(t.message)}</label><textarea id="reportText" rows="5" maxlength="1500" placeholder="${esc(t.hint)}"></textarea>
 <label class="checkline"><input type="checkbox" id="reportDetails" checked> ${esc(t.details)}</label>
 <pre class="note report-details">${esc(details)}</pre>
 <div class="row"><button type="submit" class="btn primary">${esc(t.send)}</button><button type="button" class="btn" id="reportCopy">${esc(t.copy)}</button><button type="button" class="btn" data-close>${esc(t.cancel)}</button></div>
 <p class="note" id="reportStatus" aria-live="polite"></p></form>`;
 let to='';const contact=privacyText().then(h=>{to=contactFrom(h)}).catch(()=>{});
 const say=m=>{$('reportStatus').textContent=m};
 const made=async()=>{
  const message=$('reportText').value;if(!message.trim()){say(T().empty);$('reportText').focus();return null}
  await contact;if(!to){say(T().noContact);return null}
  return draft({to,kind:$('reportKind').value,message,details:$('reportDetails').checked?details:'',lang:lang()});
 };
 $('reportText').oninput=()=>say('');
 $('reportDetails').onchange=e=>{d.querySelector('.report-details').hidden=!e.target.checked};
 $('reportForm').onsubmit=async e=>{e.preventDefault();const m=await made();if(!m)return;say(T().opened(to));core.mail(m.href)};
 $('reportCopy').onclick=async()=>{const m=await made();if(!m)return;const text=`${T().to}: ${to}\n${m.subject}\n\n${m.body}`;
  try{await root.navigator.clipboard.writeText(text);say(T().copied(to))}catch{root.prompt?.(T().copyAsk,text);say(T().opened(to))}};
 if(!d.open)d.showModal();
}
core.mail=href=>{root.location.href=href};

/* ---------- Share and rate ---------- */
async function shareApp(){
 const data={title:'Cardstead',text:T().shareText,url:SITE};
 if(await root.PokeFlipNative?.share?.(data))return;
 try{if(root.navigator.share){await root.navigator.share(data);return}}catch(e){if(e?.name==='AbortError')return}
 try{await root.navigator.clipboard.writeText(SITE);root.pokeflipToast?.(T().linkCopied)}catch{root.prompt?.(T().copyLink,SITE)}
}
let asking=false;
const asked=()=>{try{return !!root.localStorage.getItem(REVIEW_KEY)}catch{return true}};
async function askForRating(){
 if(asking||!native()||asked())return;asking=true;
 try{
  await new Promise(r=>setTimeout(r,core.reviewWait));
  // Not over another window, and not once the person has left the app.
  if(doc.visibilityState!=='visible'||doc.querySelector('dialog[open]'))return;
  // Google decides whether its card appears; either way this device is not asked again.
  if(await root.PokeFlipNative.requestReview?.())root.localStorage.setItem(REVIEW_KEY,new Date().toISOString().slice(0,10));
 }catch{}finally{asking=false}
}
core.reviewWait=REVIEW_WAIT_MS;
core.openPrivacy=openPrivacy;core.openReport=openReport;core.shareApp=shareApp;core.askForRating=askForRating;

function init(){
 doc.addEventListener('click',e=>{
  const policy=e.target.closest?.('a[data-privacy]');
  // A modified click still opens the web page in a new tab.
  if(policy&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&typeof root.HTMLDialogElement==='function'){e.preventDefault();openPrivacy(policy.dataset.privacy);return}
  if(e.target.closest?.('[data-report]')){e.preventDefault();openReport();return}
  if(e.target.closest?.('[data-share-app]')){e.preventDefault();shareApp();return}
  if(e.target.closest?.('[data-rate]')){e.preventDefault();root.PokeFlipNative?.openStore?.()}
 });
 const showRate=()=>doc.querySelectorAll('[data-rate]').forEach(b=>{b.hidden=!native()});showRate();
 root.addEventListener('cardstead:alert-saved',()=>askForRating());
}
// The Android app's bridge script runs first (build-web.mjs places it before the page scripts).
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
